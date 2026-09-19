import re

from app.risk_engine import SecurityFinding, calculate_risk
from app.cloudflare_ai_client import analyze_with_cloudflare


# =========================================================
# VERSION VALIDATION HELPER
# =========================================================

def _extract_version_mentions(text: str) -> list[str]:
    """
    Extract version-like patterns from text.
    Matches patterns like 3.1.0, 4.0.0, v2.5.1, version 1.2.3, etc.
    """
    if not text:
        return []
    # Match version patterns: x.y.z, x.y, vX.Y.Z, version X.Y.Z
    version_pattern = r'\b(?:v|version\s+)?(\d+(?:\.\d+){1,2})\b'
    matches = re.findall(version_pattern, text, re.IGNORECASE)
    return matches


def _ai_recommendation_mentions_specific_version(
    ai_recommendation: str,
    expected_fixed_version: str | None,
) -> tuple[bool, str | None]:
    """
    Check if AI recommendation mentions a specific version.
    Returns (mentions_version, mentioned_version_or_None).
    """
    mentioned_versions = _extract_version_mentions(ai_recommendation)
    if not mentioned_versions:
        return False, None

    # If there's an expected fixed version, check if any mentioned version differs
    if expected_fixed_version:
        for v in mentioned_versions:
            if v != expected_fixed_version:
                return True, v  # mentions a DIFFERENT specific version
        return True, expected_fixed_version  # mentions the expected version

    # No expected version - any specific version mention is an invention
    return True, mentioned_versions[0]


def _detect_mechanism_from_description(finding: dict) -> str | None:
    """
    Detect vulnerability mechanism from finding description/evidence.
    Returns a mechanism string if clearly supported, None otherwise.
    Never guesses - only returns when keywords are clearly present.
    """
    text = _clean(
        " ".join(
            str(finding.get(key, ""))
            for key in ("description", "evidence", "code_snippet", "snippet", "title")
        )
    ).lower()

    # XSS / cross-site scripting
    if any(kw in text for kw in ["xss", "cross-site scripting", "cross site scripting", "script execution", "detached subtree", "executable content", "dompurify"]):
        return "xss"

    # DoS / denial of service (before RCE to avoid false positives)
    if any(kw in text for kw in ["denial of service", "denial-of-service", "dos", "resource exhaustion", "availability impact", "crash", "unbounded", "infinite loop"]):
        return "dos"

    # RCE / remote/arbitrary code execution
    if any(kw in text for kw in ["remote code execution", "arbitrary code execution", "code execution", "rce", "execute arbitrary code"]):
        return "rce"

    # Path traversal
    if any(kw in text for kw in ["path traversal", "directory traversal", "traversal", "..", "arbitrary file read", "file read", "directory read"]):
        return "path_traversal"

    # Privilege escalation
    if any(kw in text for kw in ["privilege escalation", "privilege elevate", "elevate privileges", "local privilege"]):
        return "privilege_escalation"

    # Information disclosure / data exposure
    if any(kw in text for kw in ["information disclosure", "information leak", "data exposure", "data leak", "sensitive information", "memory leak", "confidentiality"]):
        return "information_disclosure"

    return None


# =========================================================
# TEXT CLEANING
# =========================================================

def _clean(text: str) -> str:
    """Normalize text for analysis."""

    if not text:
        return ""

    return re.sub(
        r"\s+",
        " ",
        str(text),
    ).strip()


def _finding_subject(finding: dict) -> str:
    """Return a stable, finding-specific subject for fallback text."""
    vulnerability_id = _clean(finding.get("vulnerability_id", ""))
    title = _clean(finding.get("title", ""))
    package_name = _clean(finding.get("package_name", ""))
    target = _clean(finding.get("target", ""))

    identity = " - ".join(value for value in (vulnerability_id, title) if value)
    component = package_name or target
    if component:
        return f"{identity or 'This finding'} in {component}"
    return identity or "This finding"


def _finding_evidence(finding: dict) -> str:
    evidence = (
        finding.get("evidence")
        or finding.get("code_snippet")
        or finding.get("snippet")
        or ""
    )
    return _clean(evidence)


def _finding_focus(finding: dict) -> str:
    text = _clean(
        " ".join(
            str(finding.get(key, ""))
            for key in ("vulnerability_id", "title", "description", "evidence", "code_snippet")
        )
    ).lower()
    if "eval(" in text or "unsafe eval" in text or "rce_eval" in text:
        return "dynamic code execution through eval()"
    if "pickle" in text or "unsafe deserialization" in text or "rce_pickle" in text:
        return "unsafe deserialization of attacker-controlled pickle data"
    if "command injection" in text or "os.system" in text or "shell=true" in text:
        return "attacker-controlled operating-system command execution"
    if "secret" in text or "credential" in text or "api key" in text:
        return "exposure or misuse of a credential or secret"
    if "cve-" in text or finding.get("package_name"):
        return f"a dependency issue affecting {_clean(finding.get('package_name', 'the identified package'))}"
    return f"the security condition identified by {_finding_subject(finding)}"


# =========================================================
# RULE-BASED FALLBACK
# =========================================================

def _vulnerability_category(finding: dict) -> str:
    """Determine the vulnerability category from finding data."""
    text = _clean(
        " ".join(
            str(finding.get(key, ""))
            for key in ("vulnerability_id", "title", "description", "evidence", "code_snippet", "tool")
        )
    ).lower()

    if "code-rce_eval" in text or "unsafe eval" in text or "eval(" in text:
        return "eval_rce"
    if "code-rce_pickle" in text or "pickle.loads" in text or "pickle.load" in text or "unsafe deserialization" in text:
        return "pickle_deserialization"
    if "code-command_injection" in text or "command injection" in text or "os.system" in text or "shell=true" in text:
        return "command_injection"
    if "code-sql_injection" in text or "sql injection" in text:
        return "sql_injection"
    if "code-hardcoded_secret" in text or "hardcoded secret" in text or "credential" in text or "api key" in text or "secret detected" in text or "gitleaks" in text:
        return "secret_exposure"
    if "code-xxe" in text or "xxe" in text:
        return "xxe"
    if "code-insecure_crypto" in text or "insecure cryptography" in text or "weak cipher" in text or "hardcoded key" in text:
        return "insecure_cryptography"
    if "cve-" in text or finding.get("package_name") or "dependency" in text or "trivy" in text:
        return "dependency_vulnerability"
    if "container" in text or "docker" in text or "image" in text:
        return "container_vulnerability"
    return "unknown"


def generate_ai_explanation(
    severity: str,
    risk_score: int,
    exploitability: float,
    production: bool,
    fix_available: bool,
    finding: dict | None = None,
) -> str:

    finding = finding or {}
    category = _vulnerability_category(finding)
    vulnerability_id = _clean(finding.get("vulnerability_id", ""))
    package_name = _clean(finding.get("package_name", ""))
    target = _clean(finding.get("target", ""))
    evidence = _clean(finding.get("evidence") or finding.get("code_snippet") or finding.get("snippet") or "")
    file_path = _clean(finding.get("file_path", "") or target)

    component = package_name or target or "the affected component"

    # Build interpretation based on vulnerability category
    if category == "eval_rce":
        return (
            f"This vulnerability allows arbitrary code execution through unsafe use of eval(). "
            f"When attacker-controlled input reaches eval(), it is executed as code in the application's "
            f"security context. The finding was detected in {component}"
            f"{f' at {file_path}' if file_path else ''}"
            f"{f': {evidence}' if evidence else ''}."
        )

    if category == "pickle_deserialization":
        return (
            f"This vulnerability allows arbitrary code execution through unsafe deserialization of "
            f"attacker-controlled pickle data. Python's pickle module can execute arbitrary code during "
            f"deserialization. The finding was detected in {component}"
            f"{f' at {file_path}' if file_path else ''}"
            f"{f': {evidence}' if evidence else ''}."
        )

    if category == "command_injection":
        return (
            f"This vulnerability allows attacker-controlled operating system command execution. "
            f"Unsanitized user input is passed to a shell command executor (e.g., os.system, subprocess with "
            f"shell=True), allowing an attacker to inject arbitrary commands. The finding was detected in "
            f"{component}{f' at {file_path}' if file_path else ''}{f': {evidence}' if evidence else ''}."
        )

    if category == "sql_injection":
        return (
            f"This vulnerability allows SQL injection through string concatenation in database queries. "
            f"Attacker-controlled input is directly interpolated into SQL statements without parameterization, "
            f"enabling unauthorized database queries, data access, or modification. The finding was detected in "
            f"{component}{f' at {file_path}' if file_path else ''}{f': {evidence}' if evidence else ''}."
        )

    if category == "secret_exposure":
        secret_type = "credential"
        if "aws" in evidence.lower() or "aws" in vulnerability_id.lower():
            secret_type = "AWS credential"
        elif "stripe" in evidence.lower():
            secret_type = "Stripe API key"
        return (
            f"This finding exposes a hardcoded {secret_type} in source code. The secret can be extracted by "
            f"anyone with access to the repository, potentially allowing unauthorized access to the associated "
            f"service or resource. The finding was detected in {component}{f' at {file_path}' if file_path else ''}."
        )

    if category == "insecure_cryptography":
        return (
            f"This finding detects use of insecure cryptographic primitives (e.g., DES, MD5, SHA1) or "
            f"hardcoded encryption keys. These algorithms are cryptographically broken or the hardcoded keys "
            f"defeat the purpose of encryption. The finding was detected in {component}"
            f"{f' at {file_path}' if file_path else ''}{f': {evidence}' if evidence else ''}."
        )

    if category == "xxe":
        return (
            f"This vulnerability is an XML External Entity (XXE) issue. The application parses XML input with "
            f"a parser that resolves external entities, potentially allowing file read, SSRF, or denial of service. "
            f"The finding was detected in {component}{f' at {file_path}' if file_path else ''}."
        )

    if category in ("dependency_vulnerability", "container_vulnerability"):
        vid = vulnerability_id or "the reported vulnerability"
        mechanism = _detect_mechanism_from_description(finding)

        if mechanism == "xss":
            return (
                f"This vulnerability in {component} ({vid}) involves a cross-site scripting (XSS) issue. "
                f"The affected package can fail to properly sanitize attacker-controlled content, "
                f"potentially allowing script execution in a victim's browser context when the vulnerable "
                f"sanitization path is reached with untrusted input."
            )
        if mechanism == "rce":
            return (
                f"This vulnerability in {component} ({vid}) can allow remote or arbitrary code execution. "
                f"When the vulnerable code path is reached with attacker-controlled input, "
                f"an attacker may be able to execute arbitrary code in the application's security context."
            )
        if mechanism == "sql_injection":
            return (
                f"This vulnerability in {component} ({vid}) involves SQL injection. "
                f"Attacker-controlled input may be improperly handled in database queries, "
                f"enabling unauthorized query execution, data access, or modification."
            )
        if mechanism == "command_injection":
            return (
                f"This vulnerability in {component} ({vid}) involves command injection. "
                f"Attacker-controlled input may reach shell command execution without proper sanitization, "
                f"allowing arbitrary OS command execution with the application's privileges."
            )
        if mechanism == "ssrf":
            return (
                f"This vulnerability in {component} ({vid}) involves server-side request forgery (SSRF). "
                f"The affected code may make requests to attacker-controlled or internal resources, "
                f"potentially accessing internal services or sensitive data."
            )
        if mechanism == "dos":
            return (
                f"This vulnerability in {component} ({vid}) can lead to denial of service. "
                f"Attacker-controlled input may trigger excessive resource consumption, crashes, "
                f"or infinite loops, reducing the availability of the affected application."
            )
        if mechanism == "path_traversal":
            return (
                f"This vulnerability in {component} ({vid}) involves path traversal. "
                f"Attacker-controlled input may allow reading or writing files outside the intended directory, "
                f"potentially exposing sensitive data or modifying application files."
            )
        if mechanism == "privilege_escalation":
            return (
                f"This vulnerability in {component} ({vid}) involves privilege escalation. "
                f"An attacker may be able to elevate privileges beyond intended limits, "
                f"gaining access to protected resources or operations."
            )
        if mechanism == "information_disclosure":
            return (
                f"This vulnerability in {component} ({vid}) involves information disclosure. "
                f"Sensitive data may be exposed to unauthorized parties through the affected code path, "
                f"potentially compromising confidentiality."
            )

        # Safe generic fallback - no mechanism guessed
        return (
            f"This is a known vulnerability ({vid}) in {component}. "
            f"The vulnerability affects the identified package/version and could be exploited "
            f"when the affected code path is reached with attacker-controlled input."
        )

    # Generic fallback that still interprets, not repeats
    focus = _finding_focus(finding)
    return (
        f"This finding involves {focus} in {component}. "
        f"The underlying security mechanism allows an attacker to potentially exploit "
        f"the condition when the affected code path is reached."
    )


# =========================================================
# RULE-BASED IMPACT
# =========================================================

def generate_potential_impact(
    title: str,
    description: str,
    severity: str,
    finding: dict | None = None,
) -> str:

    finding = finding or {}
    category = _vulnerability_category(finding)
    vulnerability_id = _clean(finding.get("vulnerability_id", ""))
    package_name = _clean(finding.get("package_name", ""))
    target = _clean(finding.get("target", ""))
    component = package_name or target or "the affected component"

    if category == "eval_rce":
        return (
            f"An attacker who can supply input to the vulnerable eval() call may execute arbitrary code "
            f"in the application's security context. This can lead to full application compromise, data theft, "
            f"or lateral movement. Exploitability depends on whether untrusted input reaches the eval() call."
        )

    if category == "pickle_deserialization":
        return (
            f"An attacker who can supply malicious pickle data to the vulnerable deserialization call may "
            f"execute arbitrary code during deserialization. This can result in application compromise, data "
            f"exposure, or full system compromise. Exploitability depends on whether untrusted serialized data "
            f"reaches the pickle.loads()/pickle.load() call."
        )

    if category == "command_injection":
        return (
            f"An attacker who can control input to the vulnerable shell command may execute arbitrary OS "
            f"commands with the application's privileges. This can lead to full system compromise, data access, "
            f"or further lateral movement. Exploitability depends on whether untrusted input reaches the shell "
            f"execution without sanitization."
        )

    if category == "sql_injection":
        return (
            f"An attacker who can control input to the vulnerable SQL query may execute arbitrary database "
            f"commands. This can result in unauthorized data access, data modification, or database takeover. "
            f"Exploitability depends on whether untrusted input reaches the concatenated query."
        )

    if category == "secret_exposure":
        return (
            f"The exposed credential can be used by anyone with repository access to authenticate to the "
            f"associated service. This may grant unauthorized access to cloud resources, APIs, databases, or "
            f"other sensitive systems. The credential must be treated as compromised."
        )

    if category == "insecure_cryptography":
        return (
            f"Use of broken cryptographic algorithms or hardcoded keys may allow attackers to decrypt "
            f"sensitive data, forge signatures, or bypass authentication. Data encrypted with these algorithms "
            f"should be considered compromised."
        )

    if category == "xxe":
        return (
            f"An attacker supplying malicious XML may read arbitrary files from the filesystem, perform "
            f"server-side request forgery (SSRF), or cause denial of service. Exploitability depends on "
            f"whether untrusted XML reaches the vulnerable parser."
        )

    if category in ("dependency_vulnerability", "container_vulnerability"):
        vid = vulnerability_id or "this vulnerability"
        mechanism = _detect_mechanism_from_description(finding)

        if mechanism == "xss":
            return (
                f"An attacker who can supply malicious content to the vulnerable component may execute "
                f"attacker-controlled JavaScript in a victim's browser, potentially compromising the "
                f"security context of users viewing the affected application. Exploitability depends on "
                f"whether untrusted content reaches the vulnerable sanitization or rendering path."
            )
        if mechanism == "rce":
            return (
                f"An attacker who can supply input to the vulnerable code path may execute arbitrary code "
                f"in the application's security context. This can result in application compromise, data "
                f"theft, or lateral movement. Exploitability depends on whether attacker-controlled input "
                f"reaches the vulnerable execution path."
            )
        if mechanism == "sql_injection":
            return (
                f"An attacker who can control input to the vulnerable database query may execute arbitrary "
                f"SQL commands. This can result in unauthorized data access, data modification, or "
                f"database takeover. Exploitability depends on whether untrusted input reaches the "
                f"concatenated query."
            )
        if mechanism == "command_injection":
            return (
                f"An attacker who can control input to the vulnerable shell command may execute arbitrary "
                f"OS commands with the application's privileges. This can lead to full system compromise, "
                f"data access, or lateral movement. Exploitability depends on whether untrusted input "
                f"reaches the shell execution without sanitization."
            )
        if mechanism == "ssrf":
            return (
                f"An attacker may be able to induce the application to make requests to arbitrary "
                f"internal or external resources, potentially accessing sensitive internal services, "
                f"metadata endpoints, or file systems. Exploitability depends on whether attacker-"
                f"controlled URLs reach the vulnerable request logic."
            )
        if mechanism == "dos":
            return (
                f"An attacker may be able to trigger excessive resource consumption, application "
                f"crashes, or infinite loops, reducing the availability of the affected service. "
                f"Exploitability depends on whether attacker-controlled input reaches the vulnerable "
                f"resource-intensive code path."
            )
        if mechanism == "path_traversal":
            return (
                f"An attacker may be able to read or write files outside the intended directory, "
                f"potentially exposing sensitive data, modifying application files, or achieving "
                f"code execution. Exploitability depends on whether attacker-controlled paths reach "
                f"the vulnerable file operation."
            )
        if mechanism == "privilege_escalation":
            return (
                f"An attacker may be able to gain higher privileges than intended, potentially "
                f"accessing protected resources or performing sensitive operations. Exploitability "
                f"depends on whether the vulnerable condition is reachable with the attacker's "
                f"current access level."
            )
        if mechanism == "information_disclosure":
            return (
                f"Sensitive information may be exposed to unauthorized parties through the vulnerable "
                f"component, potentially compromising confidentiality. Exploitability depends on "
                f"whether the attacker can access the vulnerable disclosure path."
            )

        # Safe generic fallback - no mechanism guessed
        return (
            f"An attacker may exploit {vid} in {component} when the vulnerable code path is reached. "
            f"The specific impact depends on the actual vulnerability mechanism. Exploitability depends "
            f"on whether the affected component processes attacker-controlled input."
        )

    # Generic fallback - still specific, not generic
    return (
        f"Exploitation of this finding could affect {component}. The practical impact depends on whether "
        f"the vulnerable code path is reachable with attacker-controlled input and the specific nature "
        f"of the security condition."
    )


# =========================================================
# RULE-BASED REMEDIATION
# =========================================================

def generate_recommended_action(
    title: str,
    description: str,
    fix_available: bool,
    fixed_version: str,
    affected_packages: list[str],
    finding: dict | None = None,
) -> str:

    finding = finding or {}
    category = _vulnerability_category(finding)
    vulnerability_id = _clean(finding.get("vulnerability_id", ""))
    package_name = _clean(finding.get("package_name", ""))
    target = _clean(finding.get("target", ""))

    # =====================================================
    # CODE SCANNER REMEDIATION
    # =====================================================

    if category == "eval_rce":
        return (
            "Replace eval() with safe alternatives: use JSON.parse() for JSON data, "
            "ast.literal_eval() for limited Python literal evaluation, or implement explicit "
            "input validation/parsing logic. Never pass attacker-controlled data to eval()."
        )

    if category == "pickle_deserialization":
        return (
            "Do not deserialize untrusted data using pickle. Replace with a safer serialization "
            "format such as JSON, msgpack, or protobuf. If pickle is required, validate and "
            "sanitize all external input before deserialization and consider using restricted "
            "unpicklers."
        )

    if category == "command_injection":
        return (
            "Avoid shell command execution with user-controlled input. Use subprocess.run() with "
            "an argument list (not a shell string), validate and sanitize all input against an "
            "allowlist, and avoid shell=True. Consider using dedicated libraries for the intended "
            "operation instead of shell commands."
        )

    if category == "sql_injection":
        return (
            "Use parameterized queries (prepared statements) or an ORM with proper parameter "
            "binding. Never concatenate user input into SQL strings. Validate input against "
            "expected formats and apply least-privilege database accounts."
        )

    if category == "secret_exposure":
        return (
            "Remove the exposed secret from source code immediately. Revoke and rotate the "
            "compromised credential in the issuing service. Store secrets in environment variables "
            "or a secret management system (e.g., HashiCorp Vault, AWS Secrets Manager, "
            "GitHub Actions secrets). Scan Git history for the secret and consider history "
            "rewriting if the secret was committed."
        )

    if category == "insecure_cryptography":
        return (
            "Replace broken algorithms (DES, MD5, SHA1) with modern alternatives (AES-GCM, "
            "SHA-256/384/512, bcrypt/scrypt/Argon2 for passwords). Remove hardcoded encryption "
            "keys; use a key management system or derive keys from secrets at runtime."
        )

    if category == "xxe":
        return (
            "Disable external entity resolution in the XML parser. For Python's lxml, use "
            "etree.XMLParser(resolve_entities=False). For other parsers, consult documentation "
            "for the equivalent setting. Validate XML input against a schema."
        )

    # =====================================================
    # DEPENDENCY / CONTAINER VULNERABILITIES
    # =====================================================

    if category in ("dependency_vulnerability", "container_vulnerability"):
        packages = (
            ", ".join(affected_packages)
            if affected_packages
            else (package_name or "the affected package")
        )

        if fix_available and fixed_version:
            return (
                f"Upgrade {packages} to version {fixed_version} or later, then rebuild "
                f"and redeploy the affected application or Docker image. Verify the fix with a "
                f"follow-up scan."
            )

        if fix_available:
            return (
                f"Upgrade {packages} to the latest security-fixed version and rebuild "
                f"the affected application or Docker image. Verify the fix with a follow-up scan."
            )

        # No fix available
        return (
            f"No fixed version is currently available for {packages}. Monitor for vendor updates, "
            f"apply compensating controls (e.g., WAF rules, input validation, network segmentation), "
            f"and consider alternative packages if the risk is unacceptable."
        )

    # =====================================================
    # GENERAL FALLBACK
    # =====================================================

    subject = _finding_subject(finding)
    return (
        f"Review {subject} against the supplied description and evidence, "
        "apply the available vendor or code remediation, and verify the "
        "affected component with a focused security test."
    )


# =========================================================
# MAIN AI ANALYZER
# =========================================================

def analyze_finding(
    finding: dict,
    use_ai: bool = True,
) -> dict:

    severity = finding.get(
        "severity",
        "UNKNOWN",
    )

    risk_score = int(
        finding.get(
            "risk_score",
            0,
        )
    )

    exploitability_value = finding.get("exploitability", 0)
    try:
        exploitability = float(exploitability_value or 0)
    except (TypeError, ValueError):
        exploitability = 0.0

    production_value = finding.get("production")
    production = bool(production_value) if production_value is not None else False

    fix_available = bool(
        finding.get(
            "fix_available",
            False,
        )
    )

    fixed_version = finding.get(
        "fixed_version",
        "",
    )

    title = finding.get(
        "title",
        "",
    )

    description = finding.get(
        "description",
        "",
    )

    affected_packages = finding.get(
        "affected_packages",
        [],
    )

    # =====================================================
    # STEP 1: RULE-BASED ANALYSIS
    # =====================================================

    # Build a concise, interpretive risk summary
    severity = str(severity).upper()
    priority = str(finding.get('priority', 'unspecified')).capitalize()
    category = _vulnerability_category(finding)

    # Category-specific consequence for risk summary
    # For dependency vulnerabilities, use mechanism-specific consequence when available
    if category in ("dependency_vulnerability", "container_vulnerability"):
        mechanism = _detect_mechanism_from_description(finding)
        category_consequence = {
            "xss": "potential XSS / script execution in browser context",
            "rce": "potential arbitrary code execution",
            "sql_injection": "unauthorized database queries",
            "command_injection": "attacker-controlled OS command execution",
            "ssrf": "server-side request forgery to internal/external resources",
            "dos": "denial of service / resource exhaustion",
            "path_traversal": "unauthorized file system access",
            "privilege_escalation": "elevation of privileges",
            "information_disclosure": "sensitive data exposure",
        }.get(mechanism, "exploitation of known vulnerability in dependency")
    else:
        category_consequence = {
            "eval_rce": "arbitrary code execution via eval()",
            "pickle_deserialization": "arbitrary code execution via unsafe deserialization",
            "command_injection": "attacker-controlled OS command execution",
            "sql_injection": "unauthorized database queries",
            "secret_exposure": "credential compromise and unauthorized access",
            "insecure_cryptography": "weakened data protection",
            "xxe": "file read, SSRF, or DoS via XML parsing",
            "dependency_vulnerability": "exploitation of known vulnerability in dependency",
            "container_vulnerability": "exploitation of known vulnerability in container image",
        }.get(category, "exploitation of the identified security condition")

    # =====================================================
    # CALCULATE RISK SCORE FROM ACTUAL FINDING DATA
    # =====================================================
    # Scanners do not provide risk_score; calculate it using the
    # established formula from risk_engine.py so that scan_service.py
    # and main.py can compute a meaningful overall_risk.
    calculated_risk_score = calculate_risk(
        SecurityFinding(
            tool=finding.get("tool", ""),
            severity=severity,
            title=title,
            description=description,
            exploitability=exploitability,
            production=production,
            fix_available=fix_available,
        )
    )

    fallback = {
        "ai_explanation": generate_ai_explanation(
            severity=severity,
            risk_score=calculated_risk_score,
            exploitability=exploitability,
            production=production,
            fix_available=fix_available,
            finding=finding,
        ),

        "potential_impact": generate_potential_impact(
            title=title,
            description=description,
            severity=severity,
            finding=finding,
        ),

        "recommended_action": generate_recommended_action(
            title=title,
            description=description,
            fix_available=fix_available,
            fixed_version=fixed_version,
            affected_packages=affected_packages,
            finding=finding,
        ),

        "risk_summary": (
            f"{severity} severity, {priority} priority. "
            f"Application risk score: {calculated_risk_score}/100. "
            f"Scanner exploitability: {exploitability}. "
            f"Primary consequence: {category_consequence}."
        ),

        "risk_score": calculated_risk_score,
    }

    # =====================================================
    # STEP 2: CLOUDFLARE AI
    # =====================================================

    if use_ai:

        try:

            cloudflare_analysis = analyze_with_cloudflare(
                finding
            )

            # =================================================
            # STEP 3: USE AI RESULTS SAFELY
            # =================================================

            if isinstance(
                cloudflare_analysis,
                dict,
            ):

                ai_fields = [
                    "ai_explanation",
                    "potential_impact",
                    "risk_summary",
                ]

                for key in ai_fields:

                    value = cloudflare_analysis.get(
                        key,
                        "",
                    )

                    if value:

                        fallback[key] = str(
                            value
                        ).strip()

                # =================================================
                # RECOMMENDED ACTION
                # =================================================
                #
                # For code scanner and secret findings,
                # rule-based remediation is more reliable.
                #
                # For package vulnerabilities with a confirmed
                # fixed version, Cloudflare AI may improve the
                # recommendation -- BUT only if it doesn't invent versions.
                # =================================================

                scanner_text = _clean(
                    f"{title} {description}"
                ).lower()

                is_code_or_secret = (
                    "code-rce_" in scanner_text
                    or "code-command_injection" in scanner_text
                    or "unsafe eval" in scanner_text
                    or "pickle.loads" in scanner_text
                    or "command injection" in scanner_text
                    or "secret detected" in scanner_text
                    or "gitleaks" in scanner_text
                    or "hardcoded secret" in scanner_text
                )

                if not is_code_or_secret:

                    if (
                        fix_available
                        and fixed_version
                    ):

                        ai_recommended_action = (
                            cloudflare_analysis.get(
                                "recommended_action",
                                "",
                            )
                        )

                        if ai_recommended_action:
                            # Validate that AI doesn't invent a version
                            mentions_version, mentioned = _ai_recommendation_mentions_specific_version(
                                ai_recommended_action, fixed_version
                            )
                            if mentions_version and mentioned != fixed_version:
                                # AI invented a different version -- reject, use fallback
                                pass
                            else:
                                fallback[
                                    "recommended_action"
                                ] = str(
                                    ai_recommended_action
                                ).strip()

                    elif fix_available:
                        # fix_available but no fixed_version -- AI must not invent any version
                        ai_recommended_action = (
                            cloudflare_analysis.get(
                                "recommended_action",
                                "",
                            )
                        )

                        if ai_recommended_action:
                            mentions_version, _ = _ai_recommendation_mentions_specific_version(
                                ai_recommended_action, None
                            )
                            if not mentions_version:
                                fallback[
                                    "recommended_action"
                                ] = str(
                                    ai_recommended_action
                                ).strip()

                else:

                    fallback[
                        "recommended_action"
                    ] = generate_recommended_action(
                        title=title,
                        description=description,
                        fix_available=fix_available,
                        fixed_version=fixed_version,
                        affected_packages=affected_packages,
                    )

        except Exception as exc:

            print(
                f"[WARNING] Cloudflare AI analysis failed: {exc}"
            )

    # =====================================================
    # STEP 4: UPDATE FINDING
    # =====================================================

    finding.update(
        fallback
    )

    return finding


# =========================================================
# BACKWARD COMPATIBILITY
# =========================================================

def enrich_finding(
    finding: dict,
) -> dict:

    return analyze_finding(
        finding
    )