import json
from pathlib import Path

from risk_engine import SecurityFinding


def parse_gitleaks_report(report_path: str) -> list[SecurityFinding]:
    """
    Read a Gitleaks JSON report and convert detected
    secrets into Rakshak SecurityFinding objects.
    """

    path = Path(report_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Gitleaks report not found: {report_path}"
        )

    with path.open("r", encoding="utf-8") as file:
        report = json.load(file)

    findings = []

    for secret in report:
        rule_id = secret.get("RuleID", "unknown-secret")
        description = secret.get(
            "Description",
            "Potential secret detected in source code.",
        )

        file_path = secret.get("File", "Unknown file")
        line_number = secret.get("StartLine", "Unknown")

        commit = secret.get(
            "Commit",
            "Unknown",
        )

        findings.append(
            SecurityFinding(
                tool="Gitleaks",
                severity="CRITICAL",
                title=f"Secret detected: {rule_id}",
                description=(
                    f"{description}\n"
                    f"File: {file_path}\n"
                    f"Line: {line_number}\n"
                    f"Commit: {commit}"
                ),
                exploitability=0.95,
                production=True,
                fix_available=True,
            )
        )

    return findings