from datetime import datetime
import json
def generate_report(findings):
    """
    Generate a unified Rakshak security report
    from prioritized security findings.
    """

    if not findings:
        return {
            "generated_at": datetime.now().isoformat(),
            "security_score": 100,
            "summary": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
            },
            "findings": [],
        }

    critical = sum(
        1 for finding in findings
        if finding["priority"] == "CRITICAL"
    )

    high = sum(
        1 for finding in findings
        if finding["priority"] == "HIGH"
    )

    medium = sum(
        1 for finding in findings
        if finding["priority"] == "MEDIUM"
    )

    low = sum(
        1 for finding in findings
        if finding["priority"] == "LOW"
    )

    # The highest-risk finding determines the main
    # security impact of the project.
    highest_risk = max(
        finding["risk_score"]
        for finding in findings
    )

    security_score = max(0, 100 - highest_risk)

    return {
        "generated_at": datetime.now().isoformat(),

        "security_score": security_score,

        "summary": {
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
        },

        "findings": findings,
    }


def print_report(report):
    """
    Print the unified Rakshak report in a readable format.
    """

    print("\n")
    print("=" * 70)
    print("                 RAKSHAK SECURITY REPORT")
    print("=" * 70)

    print(f"\nSecurity Score: {report['security_score']}/100")

    summary = report["summary"]

    print("\nSummary:")
    print(f"  CRITICAL : {summary['critical']}")
    print(f"  HIGH     : {summary['high']}")
    print(f"  MEDIUM   : {summary['medium']}")
    print(f"  LOW      : {summary['low']}")

    print("\nPrioritized Findings:")
    print("-" * 70)

    for index, finding in enumerate(
        report["findings"],
        start=1,
    ):
        print(
            f"\n{index}. "
            f"[{finding['priority']}] "
            f"{finding['title']}"
        )

        print(
            f"   Risk Score : "
            f"{finding['risk_score']}/100"
        )

        print(
            f"   Severity   : "
            f"{finding['severity']}"
        )

        print(
            f"   Tool       : "
            f"{finding['tool']}"
        )

        print(
            f"   Description: "
            f"{finding['description']}"
        )

    print("\n" + "=" * 70)




def save_report(report, output_path="reports/rakshak-report.json"):
    """
    Save the Rakshak security report as JSON.
    """

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=4)

    print(f"\nReport saved to: {output_path}")