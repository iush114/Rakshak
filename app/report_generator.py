import json
from pathlib import Path
def generate_report(findings):
    """
    Convert prioritized Rakshak findings into a JSON-serializable report.
    Accepts:
        - list[dict] from prioritize_findings()
    Returns:
        dict containing summary and findings.
    """
    if findings is None:
        findings = []
    if not isinstance(findings, list):
        findings = list(findings)
    # ---------------------------------------------------------
    # Calculate summary
    # ---------------------------------------------------------
    total = len(findings)
    critical = sum(
        1 for finding in findings
        if str(finding.get("priority", "")).upper() == "CRITICAL"
    )
    high = sum(
        1 for finding in findings
        if str(finding.get("priority", "")).upper() == "HIGH"
    )
    medium = sum(
        1 for finding in findings
        if str(finding.get("priority", "")).upper() == "MEDIUM"
    )
    low = sum(
        1 for finding in findings
        if str(finding.get("priority", "")).upper() == "LOW"
    )
    risk_scores = [
        int(finding.get("risk_score", 0))
        for finding in findings
        if isinstance(finding, dict)
    ]
    overall_risk = (
        round(sum(risk_scores) / len(risk_scores))
        if risk_scores
        else 0
    )
    # ---------------------------------------------------------
    # Build report
    # ---------------------------------------------------------
    report = {
        "tool": "Rakshak",
        "summary": {
            "total_findings": total,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "overall_risk_score": overall_risk,
        },
        "findings": findings,
    }
    return report
def save_report(report, output_path="reports/rakshak-report.json"):
    """
    Save Rakshak report as JSON.
    """
    path = Path(output_path)
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    with path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            report,
            file,
            indent=2,
            ensure_ascii=False,
        )
    print(
        f"[INFO] Rakshak report saved to: {path}"
    )
    return path
def print_report(report):
    """
    Print a readable Rakshak security report
    to the terminal.
    """
    if not isinstance(report, dict):
        print("[WARNING] Invalid Rakshak report.")
        return
    summary = report.get(
        "summary",
        {},
    )
    findings = report.get(
        "findings",
        [],
    )
    print()
    print("=" * 70)
    print("                    RAKSHAK SECURITY REPORT")
    print("=" * 70)
    print()
    print("SUMMARY")
    print("-" * 70)
    print(
        f"Total findings : "
        f"{summary.get('total_findings', 0)}"
    )
    print(
        f"Critical       : "
        f"{summary.get('critical', 0)}"
    )
    print(
        f"High           : "
        f"{summary.get('high', 0)}"
    )
    print(
        f"Medium         : "
        f"{summary.get('medium', 0)}"
    )
    print(
        f"Low            : "
        f"{summary.get('low', 0)}"
    )
    print(
        f"Overall risk   : "
        f"{summary.get('overall_risk_score', 0)}/100"
    )
    print()
    print("=" * 70)
    print("FINDINGS")
    print("=" * 70)
    if not findings:
        print()
        print("No security findings detected.")
        print()
        return
    for index, finding in enumerate(
        findings,
        start=1,
    ):
        print()
        print(
            f"[{index}] "
            f"{finding.get('priority', 'UNKNOWN')} "
            f"- "
            f"{finding.get('vulnerability_id', 'UNKNOWN')}"
        )
        print(
            f"Tool       : "
            f"{finding.get('tool', 'Unknown')}"
        )
        print(
            f"Severity   : "
            f"{finding.get('severity', 'UNKNOWN')}"
        )
        print(
            f"Risk Score : "
            f"{finding.get('risk_score', 0)}/100"
        )
        print(
            f"Target     : "
            f"{finding.get('target', 'Unknown target')}"
        )
        print(
            f"Packages   : "
            f"{', '.join(finding.get('affected_packages', []))}"
        )
        print(
            f"Title      : "
            f"{finding.get('title', 'Unknown')}"
        )
        if finding.get("fixed_version"):
            print(
                f"Fixed In   : "
                f"{finding.get('fixed_version')}"
            )
        print("-" * 70)