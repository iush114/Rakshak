import re

from app.cloudflare_ai_client import analyze_with_cloudflare


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


# =========================================================
# RULE-BASED FALLBACK
# =========================================================

def generate_ai_explanation(
    severity: str,
    risk_score: int,
    exploitability: float,
    production: bool,
    fix_available: bool,
) -> str:

    severity = str(
        severity
    ).upper()

    severity_text = {
        "CRITICAL": "critical severity",
        "HIGH": "high severity",
        "MEDIUM": "medium severity",
        "LOW": "low severity",
        "UNKNOWN": "unknown severity",
    }.get(
        severity,
        "unknown severity",
    )

    if exploitability >= 0.75:

        exploitability_text = (
            "high exploitability"
        )

    elif exploitability >= 0.50:

        exploitability_text = (
            "moderate exploitability"
        )

    elif exploitability >= 0.30:

        exploitability_text = (
            "low exploitability"
        )

    else:

        exploitability_text = (
            "very low exploitability"
        )

    if production:

        environment_text = (
            "The finding affects a production environment, "
            "which increases its practical risk."
        )

    else:

        environment_text = (
            "The finding affects a non-production environment, "
            "which reduces its immediate operational risk."
        )

    if fix_available:

        remediation_text = (
            "A security fix is available, making remediation actionable."
        )

    else:

        remediation_text = (
            "No fixed version is currently available, so monitoring "
            "and compensating controls may be required."
        )

    return (
        f"This finding has {severity_text}, "
        f"{exploitability_text}, "
        f"and a calculated risk score of "
        f"{risk_score}/100. "
        f"{environment_text} "
        f"{remediation_text}"
    )


# =========================================================
# RULE-BASED IMPACT
# =========================================================

def generate_potential_impact(
    title: str,
    description: str,
    severity: str,
) -> str:

    text = _clean(
        f"{title} {description}"
    ).lower()

    if (
        "remote code execution" in text
        or "remote code" in text
        or "execute arbitrary code" in text
    ):

        return (
            "An attacker may be able to execute arbitrary code "
            "on the affected system, potentially resulting in "
            "application compromise, data exposure, or full "
            "system compromise."
        )

    if (
        "privilege escalation" in text
        or "privilege elevate" in text
        or "elevate privileges" in text
        or "local privilege" in text
    ):

        return (
            "A local attacker may be able to gain higher privileges "
            "than intended, potentially allowing access to protected "
            "resources or sensitive system operations."
        )

    if (
        "buffer overflow" in text
        or "out-of-bounds write" in text
        or "out of bounds write" in text
    ):

        return (
            "Crafted input may trigger memory corruption, potentially "
            "causing application crashes, denial of service, information "
            "disclosure, or code execution depending on the affected "
            "component."
        )

    if (
        "out-of-bounds read" in text
        or "out of bounds read" in text
        or "buffer over-read" in text
        or "buffer under-read" in text
    ):

        return (
            "Crafted input may cause the affected component to read "
            "memory outside its intended bounds, potentially causing "
            "a crash or disclosure of sensitive memory contents."
        )

    if (
        "denial of service" in text
        or "denial-of-service" in text
    ):

        return (
            "An attacker may be able to trigger excessive resource "
            "consumption or a crash, reducing the availability of "
            "the affected application or service."
        )

    if (
        "information disclosure" in text
        or "sensitive information" in text
        or "information leak" in text
        or "memory leak" in text
    ):

        return (
            "The vulnerability may expose sensitive information "
            "from the affected process, filesystem, memory, or "
            "application environment."
        )

    if (
        "path traversal" in text
        or "directory traversal" in text
    ):

        return (
            "An attacker may be able to access or write files "
            "outside the intended directory, potentially exposing "
            "sensitive data or modifying application files."
        )

    if (
        "authentication bypass" in text
        or (
            "authentication" in text
            and "bypass" in text
        )
    ):

        return (
            "An attacker may be able to bypass intended "
            "authentication controls and access resources "
            "without valid authorization."
        )

    if (
        "authorization" in text
        or "credential" in text
        or "password" in text
        or "secret" in text
    ):

        return (
            "Sensitive authentication credentials or secrets may "
            "be exposed or mishandled, potentially allowing "
            "unauthorized access to protected resources."
        )

    if (
        "race condition" in text
        or "toctou" in text
    ):

        return (
            "A race condition may allow an attacker to manipulate "
            "a resource between security checks and its use, "
            "potentially bypassing intended security controls."
        )

    if "aslr" in text:

        return (
            "The vulnerability may weaken address-space "
            "randomization protections, potentially making "
            "exploitation of other memory-corruption vulnerabilities "
            "easier."
        )

    if "symlink" in text:

        return (
            "An attacker may exploit symbolic-link handling to "
            "access or modify files outside the intended security "
            "boundary."
        )

    if severity.upper() == "CRITICAL":

        return (
            "This vulnerability may have a severe security impact "
            "and could potentially result in significant compromise "
            "of the affected environment."
        )

    if severity.upper() == "HIGH":

        return (
            "This vulnerability may allow an attacker to compromise "
            "the affected component or gain unauthorized access to "
            "sensitive resources."
        )

    if severity.upper() == "MEDIUM":

        return (
            "This vulnerability may negatively affect the "
            "confidentiality, integrity, or availability of the "
            "affected component."
        )

    return (
        "The vulnerability may affect the security or reliability "
        "of the affected component depending on how it is exposed "
        "and used in the deployment."
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
) -> str:

    text = _clean(
        f"{title} {description}"
    ).lower()

    packages = (
        ", ".join(
            affected_packages
        )
        if affected_packages
        else "the affected package"
    )

    # -----------------------------------------------------
    # FIXED VERSION AVAILABLE
    # -----------------------------------------------------

    if fix_available and fixed_version:

        return (
            f"Upgrade {packages} to version "
            f"{fixed_version} or later, then rebuild "
            f"and redeploy the affected application "
            f"or Docker image."
        )

    # -----------------------------------------------------
    # FIX AVAILABLE BUT VERSION NOT PROVIDED
    # -----------------------------------------------------

    if fix_available:

        return (
            f"Upgrade {packages} to the latest "
            f"security-fixed version and rebuild "
            f"the affected application or Docker image."
        )

    # -----------------------------------------------------
    # PIP
    # -----------------------------------------------------

    if "pip" in text:

        return (
            "Upgrade pip to the latest security-fixed release "
            "and rebuild the Docker image. Review package "
            "installation sources and avoid installing "
            "untrusted wheel archives."
        )

    # -----------------------------------------------------
    # PRIVILEGE ESCALATION
    # -----------------------------------------------------

    if (
        "privilege escalation" in text
        or "local privilege" in text
    ):

        return (
            "Apply the latest vendor security updates when "
            "available, avoid running affected utilities with "
            "unnecessary elevated privileges, and restrict "
            "local access to the affected system."
        )

    # -----------------------------------------------------
    # BUFFER / OUT-OF-BOUNDS
    # -----------------------------------------------------

    if (
        "buffer overflow" in text
        or "out-of-bounds" in text
        or "out of bounds" in text
    ):

        return (
            "Update the affected package or base image when "
            "a patched release becomes available. Until then, "
            "avoid processing untrusted input with the affected "
            "utility and apply appropriate container isolation."
        )

    # -----------------------------------------------------
    # DENIAL OF SERVICE
    # -----------------------------------------------------

    if "denial of service" in text:

        return (
            "Update the affected component when a fix becomes "
            "available and restrict untrusted input that could "
            "trigger excessive resource consumption."
        )

    # -----------------------------------------------------
    # SYMLINK / RACE CONDITION
    # -----------------------------------------------------

    if (
        "symlink" in text
        or "race condition" in text
        or "toctou" in text
    ):

        return (
            "Apply vendor security updates when available and "
            "restrict untrusted local users from interacting "
            "with the affected utility or filesystem resources."
        )

    # -----------------------------------------------------
    # ASLR
    # -----------------------------------------------------

    if "aslr" in text:

        return (
            "Keep the affected system and base image fully patched "
            "and maintain exploit mitigations such as ASLR. "
            "Treat this primarily as a defense-in-depth concern "
            "unless combined with another exploitable vulnerability."
        )

    # -----------------------------------------------------
    # GENERAL FALLBACK
    # -----------------------------------------------------

    return (
        "Monitor the vulnerability for a vendor fix, keep the "
        "affected package and base image updated, and apply "
        "compensating security controls appropriate to the deployment."
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

    exploitability = float(
        finding.get(
            "exploitability",
            0.5,
        )
    )

    production = bool(
        finding.get(
            "production",
            True,
        )
    )

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
    # STEP 1: RELIABLE RULE-BASED ANALYSIS
    # =====================================================

    fallback = {
        "ai_explanation": generate_ai_explanation(
            severity=severity,
            risk_score=risk_score,
            exploitability=exploitability,
            production=production,
            fix_available=fix_available,
        ),

        "potential_impact": generate_potential_impact(
            title=title,
            description=description,
            severity=severity,
        ),

        "recommended_action": generate_recommended_action(
            title=title,
            description=description,
            fix_available=fix_available,
            fixed_version=fixed_version,
            affected_packages=affected_packages,
        ),

        "risk_summary": (
            f"{finding.get('priority', 'LOW')} priority finding "
            f"with a risk score of {risk_score}/100."
        ),
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

                # ---------------------------------------------
                # AI-generated fields that can safely be used
                # ---------------------------------------------

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

                # ---------------------------------------------
                # RECOMMENDED ACTION
                #
                # Rule-based remediation is authoritative
                # when there is no confirmed fixed version.
                # ---------------------------------------------

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

                        fallback[
                            "recommended_action"
                        ] = str(
                            ai_recommended_action
                        ).strip()

                else:

                    # Keep trusted rule-based remediation.
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