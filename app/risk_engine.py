from dataclasses import dataclass


@dataclass
class SecurityFinding:
    tool: str
    severity: str
    title: str
    description: str = ""
    exploitability: float = 0.5
    production: bool = True
    fix_available: bool = True


SEVERITY_SCORES = {
    "CRITICAL": 100,
    "HIGH": 80,
    "MEDIUM": 50,
    "LOW": 25,
    "UNKNOWN": 10,
}


def calculate_risk(finding: SecurityFinding) -> int:
    """
    Calculate a 0-100 risk score for a security finding.
    """

    base_score = SEVERITY_SCORES.get(
        finding.severity.upper(),
        SEVERITY_SCORES["UNKNOWN"],
    )

    # Exploitability multiplier
    exploitability_multiplier = 0.7 + (finding.exploitability * 0.3)

    # Production systems receive higher priority
    production_multiplier = 1.0 if finding.production else 0.8

    # Findings without an available fix are slightly less actionable
    fix_multiplier = 1.0 if finding.fix_available else 0.9

    score = (
        base_score
        * exploitability_multiplier
        * production_multiplier
        * fix_multiplier
    )

    return min(100, round(score))


def get_priority(score: int) -> str:
    """Convert a numerical risk score into a priority."""

    if score >= 90:
        return "CRITICAL"

    if score >= 70:
        return "HIGH"

    if score >= 40:
        return "MEDIUM"

    return "LOW"


def prioritize_findings(findings: list[SecurityFinding]) -> list[dict]:
    """
    Calculate scores and sort findings from highest to lowest risk.
    """

    results = []

    for finding in findings:
        score = calculate_risk(finding)

        results.append(
            {
                "tool": finding.tool,
                "title": finding.title,
                "description": finding.description,
                "severity": finding.severity.upper(),
                "risk_score": score,
                "priority": get_priority(score),
            }
        )

    return sorted(
        results,
        key=lambda finding: finding["risk_score"],
        reverse=True,
    )