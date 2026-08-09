from fastapi import FastAPI

app = FastAPI(
    title="Rakshak",
    description="AI-Powered DevSecOps Threat Detection Platform",
    version="1.0.0"
)


@app.get("/")
def home():
    return {
        "message": "Rakshak DevSecOps Platform",
        "status": "running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


from trivy_parser import parse_trivy_report
from gitleaks_parser import parse_gitleaks_report
from risk_engine import prioritize_findings
from report_generator import (
    generate_report,
    print_report,
    save_report,
)


def main():
    trivy_report = "reports/trivy-results.json"
    gitleaks_report = "reports/gitleaks-results.json"

    # Parse Trivy findings
    trivy_findings = parse_trivy_report(trivy_report)

    # Parse Gitleaks findings
    gitleaks_findings = parse_gitleaks_report(gitleaks_report)

    # Combine findings from both security tools
    all_findings = trivy_findings + gitleaks_findings

    # Calculate risk scores and priorities
    prioritized_findings = prioritize_findings(all_findings)

    # Generate unified Rakshak report
    report = generate_report(prioritized_findings)

    # Display report
    print_report(report)
    save_report(report)

if __name__ == "__main__":
    main()