import json
from pathlib import Path

from risk_engine import SecurityFinding


def parse_trivy_report(report_path: str) -> list[SecurityFinding]:
    """
    Read a Trivy JSON report and convert vulnerabilities
    into Rakshak SecurityFinding objects.
    """

    path = Path(report_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Trivy report not found: {report_path}"
        )

    with path.open("r", encoding="utf-8") as file:
        report = json.load(file)

    findings = []

    for result in report.get("Results", []):
        target = result.get("Target", "Unknown target")

        for vulnerability in result.get("Vulnerabilities", []) or []:
            severity = vulnerability.get("Severity", "UNKNOWN")

            vulnerability_id = vulnerability.get(
                "VulnerabilityID",
                "Unknown vulnerability",
            )

            title = vulnerability.get(
                "Title",
                vulnerability_id,
            )

            description = vulnerability.get(
                "Description",
                "",
            )

            installed_version = vulnerability.get(
                "InstalledVersion",
                "Unknown",
            )

            fixed_version = vulnerability.get(
                "FixedVersion",
                "",
            )

            # Trivy's CVSS score can be used as an
            # approximation of exploitability.
            cvss_score = 0.5

            cvss = vulnerability.get("CVSS", {})

            if cvss:
                for _, cvss_data in cvss.items():
                    score = cvss_data.get("V3Score")

                    if score is not None:
                        cvss_score = min(float(score) / 10, 1.0)
                        break

            findings.append(
                SecurityFinding(
                    tool="Trivy",
                    severity=severity,
                    title=f"{vulnerability_id}: {title}",
                    description=(
                        f"{description}\n"
                        f"Target: {target}\n"
                        f"Installed version: {installed_version}\n"
                        f"Fixed version: "
                        f"{fixed_version or 'No fix available'}"
                    ),
                    exploitability=cvss_score,
                    production=True,
                    fix_available=bool(fixed_version),
                )
            )

    return findings