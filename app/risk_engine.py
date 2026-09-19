from dataclasses import dataclass
import re


@dataclass
class SecurityFinding:
    tool: str
    severity: str
    title: str
    description: str = ""
    exploitability: float = 0.5
    production: bool = True
    fix_available: bool = True
    # Stable, scanner-provided identifier (CVE-XXXX-YYYY, GHSA-xxxx-yyyy-zzzz,
    # CODE-<PATTERN>, GITLEAKS-<RULE-ID>). Carried as a first-class field so it
    # survives the SecurityFinding -> Finding persistence boundary instead of
    # being recoverable only by parsing the title. Empty string when the source
    # scanner supplies no stable identifier -- never a placeholder.
    vulnerability_id: str = ""


# Base severity scores
SEVERITY_SCORES = {
    "CRITICAL": 100,
    "HIGH": 80,
    "MEDIUM": 50,
    "LOW": 25,
    "UNKNOWN": 10,
}


def calculate_risk(finding: SecurityFinding) -> int:
    """
    Calculate Rakshak risk score from 0-100.

    Risk is based on:
    - Trivy severity
    - Exploitability
    - Whether the finding affects production
    - Whether a fix is available
    """

    severity = finding.severity.upper()

    base_score = SEVERITY_SCORES.get(
        severity,
        SEVERITY_SCORES["UNKNOWN"],
    )

    # Keep exploitability between 0 and 1.
    exploitability = max(
        0.0,
        min(
            float(finding.exploitability),
            1.0,
        ),
    )

    # Higher exploitability = higher risk.
    exploitability_multiplier = (
        0.7 + (exploitability * 0.3)
    )

    # Production systems receive full risk.
    production_multiplier = (
        1.0
        if finding.production
        else 0.8
    )

    # A vulnerability without a fix is slightly
    # less actionable, but still dangerous.
    fix_multiplier = (
        1.0
        if finding.fix_available
        else 0.95
    )

    score = (
        base_score
        * exploitability_multiplier
        * production_multiplier
        * fix_multiplier
    )

    return min(
        100,
        max(
            0,
            round(score),
        ),
    )


def get_priority(
    severity: str,
    risk_score: int,
) -> str:
    """
    Determine Rakshak priority.

    CRITICAL and HIGH Trivy findings retain their
    original priority.

    MEDIUM and LOW findings can be promoted when
    their calculated risk is unusually high.
    """

    severity = severity.upper()

    if severity == "CRITICAL":
        return "CRITICAL"

    if severity == "HIGH":
        return "HIGH"

    if severity == "MEDIUM":
        if risk_score >= 70:
            return "HIGH"

        return "MEDIUM"

    if severity == "LOW":
        if risk_score >= 70:
            return "MEDIUM"

        return "LOW"

    if risk_score >= 70:
        return "MEDIUM"

    return "LOW"


def extract_cve(title: str) -> str:
    """
    Extract vulnerability ID from a finding title.

    Examples:
        CVE-2026-1234: Example vulnerability
        GHSA-xxxx-yyyy-zzzz: Example
        TEMP-12345: Example
    """

    if not title:
        return "UNKNOWN"

    title = title.strip()

    # CVE
    cve_match = re.match(
        r"^(CVE-\d{4}-\d+)",
        title,
        re.IGNORECASE,
    )

    if cve_match:
        return cve_match.group(1).upper()

    # GHSA
    ghsa_match = re.match(
        r"^(GHSA-[A-Za-z0-9-]+)",
        title,
        re.IGNORECASE,
    )

    if ghsa_match:
        return ghsa_match.group(1).upper()

    # Generic vulnerability identifier
    generic_match = re.match(
        r"^([A-Za-z]+-\d{4,}-?[A-Za-z0-9-]*)",
        title,
    )

    if generic_match:
        return generic_match.group(1).upper()

    # Fallback
    return title.split(":")[0].strip()


def extract_package(description: str) -> str:
    """
    Extract package information from the parser-generated
    description.

    Example:
        Package: perl-base
    """

    if not description:
        return "Unknown package"

    match = re.search(
        r"Package:\s*(.+)",
        description,
        re.IGNORECASE,
    )

    if match:
        return match.group(1).strip()

    return "Unknown package"


def extract_target(description: str) -> str:
    """
    Extract Trivy target from the parser-generated
    description.

    Example:
        Target: rakshak:latest (debian 13.6)
    """

    if not description:
        return "Unknown target"

    match = re.search(
        r"Target:\s*(.+)",
        description,
        re.IGNORECASE,
    )

    if match:
        return match.group(1).strip()

    return "Unknown target"


def extract_fixed_version(description: str) -> str:
    """
    Extract fixed version from the parser-generated
    description.

    Example:
        Fixed version: 5.40.2-1
    """

    if not description:
        return ""

    match = re.search(
        r"Fixed version:\s*(.+)",
        description,
        re.IGNORECASE,
    )

    if match:
        value = match.group(1).strip()

        if value.lower() == "no fix available":
            return ""

        return value

    return ""


def prioritize_findings(
    findings: list[SecurityFinding],
) -> list[dict]:
    """
    Calculate risk scores and aggregate findings.

    Findings are grouped by:

        vulnerability ID + target

    Multiple affected packages are preserved.

    Example:

        CVE-2025-69720
        ├── libncursesw6
        ├── libtinfo6
        ├── ncurses-base
        └── ncurses-bin
    """

    raw_results = []

    # =========================================================
    # STEP 1: Calculate risk for every raw finding
    # =========================================================

    for finding in findings:

        severity = finding.severity.upper()

        score = calculate_risk(
            finding
        )

        priority = get_priority(
            severity,
            score,
        )

        vulnerability_id = extract_cve(
            finding.title
        )

        package = extract_package(
            finding.description
        )

        target = extract_target(
            finding.description
        )

        fixed_version = extract_fixed_version(
            finding.description
        )

        raw_results.append(
            {
                "tool": finding.tool,
                "title": finding.title,
                "description": finding.description,
                "severity": severity,
                "risk_score": score,
                "priority": priority,
                "vulnerability_id": vulnerability_id,
                "package": package,
                "target": target,
                "exploitability": finding.exploitability,
                "production": finding.production,
                "fix_available": finding.fix_available,
                "fixed_version": fixed_version,
            }
        )

    # =========================================================
    # STEP 2: Aggregate identical vulnerabilities
    # =========================================================

    grouped = {}

    for finding in raw_results:

        key = (
            finding["vulnerability_id"],
            finding["target"],
        )

        if key not in grouped:

            grouped[key] = {
                "tool": finding["tool"],
                "title": finding["title"],
                "description": finding["description"],
                "severity": finding["severity"],
                "risk_score": finding["risk_score"],
                "priority": finding["priority"],
                "vulnerability_id": finding[
                    "vulnerability_id"
                ],
                "target": finding["target"],
                "affected_packages": [],
                "affected_package_count": 0,
                "exploitability": finding[
                    "exploitability"
                ],
                "production": finding[
                    "production"
                ],
                "fix_available": finding[
                    "fix_available"
                ],
                "fixed_version": finding[
                    "fixed_version"
                ],
            }

        group = grouped[key]

        # =====================================================
        # Keep highest severity
        # =====================================================

        severity_rank = {
            "CRITICAL": 5,
            "HIGH": 4,
            "MEDIUM": 3,
            "LOW": 2,
            "UNKNOWN": 1,
        }

        current_rank = severity_rank.get(
            group["severity"],
            1,
        )

        new_rank = severity_rank.get(
            finding["severity"],
            1,
        )

        if new_rank > current_rank:

            group["severity"] = finding[
                "severity"
            ]

        # =====================================================
        # Keep highest risk score
        # =====================================================

        if finding["risk_score"] > group[
            "risk_score"
        ]:

            group["risk_score"] = finding[
                "risk_score"
            ]

        # =====================================================
        # Keep highest priority
        # =====================================================

        priority_rank = {
            "CRITICAL": 4,
            "HIGH": 3,
            "MEDIUM": 2,
            "LOW": 1,
        }

        if priority_rank.get(
            finding["priority"],
            1,
        ) > priority_rank.get(
            group["priority"],
            1,
        ):

            group["priority"] = finding[
                "priority"
            ]

        # =====================================================
        # Keep highest exploitability
        # =====================================================

        if finding["exploitability"] > group[
            "exploitability"
        ]:

            group["exploitability"] = finding[
                "exploitability"
            ]

        # =====================================================
        # Production finding takes precedence
        # =====================================================

        if finding["production"]:
            group["production"] = True

        # =====================================================
        # If ANY instance has a fix, preserve that information
        # =====================================================

        if finding["fix_available"]:
            group["fix_available"] = True

        # =====================================================
        # Preserve fixed version
        # =====================================================

        if (
            not group["fixed_version"]
            and finding["fixed_version"]
        ):
            group["fixed_version"] = finding[
                "fixed_version"
            ]

        # =====================================================
        # Add affected package
        # =====================================================

        package = finding["package"]

        if (
            package
            and package not in group[
                "affected_packages"
            ]
        ):

            group["affected_packages"].append(
                package
            )

    # =========================================================
    # STEP 3: Finalize aggregated findings
    # =========================================================

    results = list(
        grouped.values()
    )

    for finding in results:

        packages = finding[
            "affected_packages"
        ]

        finding[
            "affected_package_count"
        ] = len(packages)

        # Recalculate risk after aggregation.
        #
        # Build a temporary SecurityFinding using
        # the aggregated information.
        aggregated_finding = SecurityFinding(
            tool=finding["tool"],
            severity=finding["severity"],
            title=finding["title"],
            description=finding["description"],
            exploitability=finding[
                "exploitability"
            ],
            production=finding[
                "production"
            ],
            fix_available=finding[
                "fix_available"
            ],
        )

        finding["risk_score"] = calculate_risk(
            aggregated_finding
        )

        finding["priority"] = get_priority(
            finding["severity"],
            finding["risk_score"],
        )

        # Add useful package information to description.
        package_text = ", ".join(
            packages
        )

        finding["description"] = (
            f"{finding['description']}\n"
            f"Affected packages: "
            f"{package_text}"
        )

    # =========================================================
    # STEP 4: Sort highest risk first
    # =========================================================

    severity_rank = {
        "CRITICAL": 5,
        "HIGH": 4,
        "MEDIUM": 3,
        "LOW": 2,
        "UNKNOWN": 1,
    }

    return sorted(
        results,
        key=lambda finding: (
            finding["risk_score"],
            severity_rank.get(
                finding["severity"],
                1,
            ),
            finding["vulnerability_id"],
        ),
        reverse=True,
    )