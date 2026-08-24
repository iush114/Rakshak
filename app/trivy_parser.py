import json
from pathlib import Path
from app.risk_engine import SecurityFinding
def parse_trivy_report(report_path: str) -> list[SecurityFinding]:
    """
    Parse a Trivy JSON report and convert vulnerabilities
    into Rakshak SecurityFinding objects.
    Supports:
        - Trivy filesystem/dependency scans
        - Trivy Docker image scans
    The parser:
        - Handles missing/empty reports safely
        - Extracts CVSS scores when available
        - Preserves Trivy severity
        - Deduplicates identical CVE + package + target combinations
    """
    path = Path(report_path)
    # ---------------------------------------------------------
    # Report does not exist
    # ---------------------------------------------------------
    if not path.exists():
        print(f"[INFO] Trivy report not found, skipping: {report_path}")
        return []
    # ---------------------------------------------------------
    # Report is empty
    # ---------------------------------------------------------
    if path.stat().st_size == 0:
        print(f"[INFO] Trivy report is empty, skipping: {report_path}")
        return []
    # ---------------------------------------------------------
    # Load JSON
    # ---------------------------------------------------------
    try:
        with path.open("r", encoding="utf-8") as file:
            report = json.load(file)
    except json.JSONDecodeError as exc:
        print(
            f"[WARNING] Invalid Trivy JSON report: "
            f"{report_path} ({exc})"
        )
        return []
    except OSError as exc:
        print(
            f"[WARNING] Unable to read Trivy report: "
            f"{report_path} ({exc})"
        )
        return []
    # ---------------------------------------------------------
    # Validate report structure
    # ---------------------------------------------------------
    if not isinstance(report, dict):
        print(f"[WARNING] Invalid Trivy report structure: {report_path}")
        return []
    results = report.get("Results", [])
    if not isinstance(results, list):
        print(f"[WARNING] Trivy Results field is invalid: {report_path}")
        return []
    findings = []
    # Prevent exact duplicate entries.
    #
    # Same CVE can legitimately affect multiple packages, so the
    # package and target are part of the key.
    seen = set()
    # ---------------------------------------------------------
    # Parse Trivy results
    # ---------------------------------------------------------
    for result in results:
        if not isinstance(result, dict):
            continue
        target = result.get(
            "Target",
            "Unknown target"
        )
        vulnerabilities = result.get(
            "Vulnerabilities",
            []
        ) or []
        if not isinstance(vulnerabilities, list):
            continue
        for vulnerability in vulnerabilities:
            if not isinstance(vulnerability, dict):
                continue
            # -------------------------------------------------
            # Basic vulnerability information
            # -------------------------------------------------
            severity = str(
                vulnerability.get(
                    "Severity",
                    "UNKNOWN"
                )
            ).upper()
            vulnerability_id = str(
                vulnerability.get(
                    "VulnerabilityID",
                    "Unknown vulnerability"
                )
            )
            title = str(
                vulnerability.get(
                    "Title",
                    vulnerability_id
                )
            )
            description = str(
                vulnerability.get(
                    "Description",
                    ""
                )
            )
            package_name = str(
                vulnerability.get(
                    "PkgName",
                    "Unknown package"
                )
            )
            installed_version = str(
                vulnerability.get(
                    "InstalledVersion",
                    "Unknown"
                )
            )
            fixed_version = str(
                vulnerability.get(
                    "FixedVersion",
                    ""
                )
            )
            # -------------------------------------------------
            # Exact duplicate detection
            # -------------------------------------------------
            duplicate_key = (
                vulnerability_id,
                package_name,
                target,
                installed_version,
            )
            if duplicate_key in seen:
                continue
            seen.add(duplicate_key)
            # -------------------------------------------------
            # Extract CVSS score
            # -------------------------------------------------
            exploitability = 0.5
            cvss = vulnerability.get("CVSS", {})
            if isinstance(cvss, dict):
                for _, cvss_data in cvss.items():
                    if not isinstance(cvss_data, dict):
                        continue
                    score = cvss_data.get("V3Score")
                    if score is None:
                        score = cvss_data.get("V2Score")
                    if score is None:
                        continue
                    try:
                        score = float(score)
                        # Normalize 0-10 CVSS score to 0-1.
                        exploitability = min(
                            max(score / 10.0, 0.0),
                            1.0
                        )
                    except (ValueError, TypeError):
                        pass
                    break
            # -------------------------------------------------
            # Determine whether a fix exists
            # -------------------------------------------------
            fix_available = bool(
                fixed_version
                and fixed_version.strip()
                and fixed_version.lower()
                not in {
                    "none",
                    "n/a",
                    "unknown",
                }
            )
            # -------------------------------------------------
            # Build description
            # -------------------------------------------------
            finding_description = (
                f"{description}\n"
                f"Package: {package_name}\n"
                f"Target: {target}\n"
                f"Installed version: {installed_version}\n"
                f"Fixed version: "
                f"{fixed_version or 'No fix available'}"
            )
            # -------------------------------------------------
            # Build Rakshak SecurityFinding
            # -------------------------------------------------
            finding = SecurityFinding(
                tool="Trivy",
                severity=severity,
                title=f"{vulnerability_id}: {title}",
                description=finding_description,
                exploitability=exploitability,
                production=True,
                fix_available=fix_available,
            )
            findings.append(finding)
    print(
        f"[INFO] Parsed {len(findings)} unique Trivy findings "
        f"from {report_path}"
    )
    return findings
