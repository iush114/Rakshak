from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Optional
import uuid

from app.trivy_parser import parse_trivy_report
from app.gitleaks_parser import parse_gitleaks_report
from app.risk_engine import prioritize_findings
from app.code_scanner import scan_code_content

from app.report_generator import (
    generate_report,
    print_report,
    save_report,
)

from app.ai_analyzer import analyze_finding


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="Rakshak",
    description="AI-Powered DevSecOps Threat Detection Platform",
    version="1.0.0",
)

# Configure CORS for frontend web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST/RESPONSE MODELS
# =========================================================

class ScanRequest(BaseModel):
    """
    Request model for /api/scan endpoint.
    
    At least one scan type must be enabled.
    """
    
    code_scanning: bool = False
    dependency_scanning: bool = False
    secret_detection: bool = False
    container_scanning: bool = False
    
    @field_validator("code_scanning", "dependency_scanning", "secret_detection", "container_scanning", mode="after")
    @classmethod
    def validate_at_least_one_selected(cls, v):
        """Validator is applied per field, so we need to check in __init__"""
        return v
    
    def __init__(self, **data):
        super().__init__(**data)
        if not any([
            self.code_scanning,
            self.dependency_scanning,
            self.secret_detection,
            self.container_scanning,
        ]):
            raise ValueError(
                "At least one security scan must be selected."
            )


# =========================================================
# API DATA LOADING
# =========================================================

def load_findings(
    use_ai: bool = False,
    code_scanning: bool = True,
    dependency_scanning: bool = True,
    secret_detection: bool = True,
    container_scanning: bool = True,
):
    """
    Run selected security parsers and return
    prioritized + analyzed findings.

    Parameters:
        use_ai: Enable Cloudflare Workers AI analysis
        code_scanning: Run static code analysis
        dependency_scanning: Run Trivy filesystem/dependency scan
        secret_detection: Run Gitleaks secret scan
        container_scanning: Run Trivy Docker image scan

    Returns:
        List of enriched SecurityFinding dictionaries
    """

    trivy_report = (
        "reports/trivy-results.json"
    )

    trivy_image_report = (
        "reports/trivy-image-results.json"
    )

    gitleaks_report = (
        "reports/gitleaks-results.json"
    )

    all_findings = []

    # =====================================================
    # CODE SCANNING (Static Analysis)
    # =====================================================

    if code_scanning:
        # Note: Code scanner requires actual source code.
        # In the current implementation, we don't have a code submission endpoint.
        # This is a placeholder for future integration.
        pass

    # =====================================================
    # TRIVY FILESYSTEM / DEPENDENCY SCAN
    # =====================================================

    if dependency_scanning:
        trivy_findings = parse_trivy_report(
            trivy_report
        )
        all_findings.extend(trivy_findings)

    # =====================================================
    # TRIVY DOCKER IMAGE SCAN
    # =====================================================

    if container_scanning:
        trivy_image_findings = parse_trivy_report(
            trivy_image_report
        )
        all_findings.extend(trivy_image_findings)

    # =====================================================
    # GITLEAKS SECRET SCAN
    # =====================================================

    if secret_detection:
        try:
            gitleaks_findings = parse_gitleaks_report(
                gitleaks_report
            )
            all_findings.extend(gitleaks_findings)
        except FileNotFoundError:
            # Gitleaks report may not exist
            print(f"[INFO] Gitleaks report not found: {gitleaks_report}")

    # =====================================================
    # RISK SCORING + PRIORITIZATION
    # =====================================================

    prioritized_findings = prioritize_findings(
        all_findings
    )

    # =====================================================
    # AI ANALYSIS
    # =====================================================

    enriched_findings = []

    for finding in prioritized_findings:

        try:

            analyzed = analyze_finding(
                finding,
                use_ai=use_ai,
            )

            if isinstance(
                analyzed,
                dict,
            ):
                finding = analyzed

        except Exception as exc:

            print(
                f"[WARNING] AI analysis failed: {exc}"
            )

        enriched_findings.append(
            finding
        )

    return enriched_findings


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def home():

    return {
        "message": "Rakshak DevSecOps Platform",
        "status": "running",
        "version": "1.0.0",
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
    }


# =========================================================
# SUMMARY
# =========================================================

@app.get("/api/summary")
def get_summary():

    # AI is disabled here so the dashboard
    # can load quickly.

    findings = load_findings(
        use_ai=False
    )

    critical = sum(
        1
        for finding in findings
        if str(
            finding.get(
                "priority",
                "",
            )
        ).upper() == "CRITICAL"
    )

    high = sum(
        1
        for finding in findings
        if str(
            finding.get(
                "priority",
                "",
            )
        ).upper() == "HIGH"
    )

    medium = sum(
        1
        for finding in findings
        if str(
            finding.get(
                "priority",
                "",
            )
        ).upper() == "MEDIUM"
    )

    low = sum(
        1
        for finding in findings
        if str(
            finding.get(
                "priority",
                "",
            )
        ).upper() == "LOW"
    )

    if findings:

        overall_risk = round(
            sum(
                finding.get(
                    "risk_score",
                    0,
                )
                for finding in findings
            )
            / len(findings)
        )

    else:

        overall_risk = 0

    return {
        "total_findings": len(findings),
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "overall_risk_score": overall_risk,
    }


# =========================================================
# FINDINGS
# =========================================================

@app.get("/api/findings")
def get_findings(
    severity: Optional[str] = None,
    priority: Optional[str] = None,
    tool: Optional[str] = None,
    search: Optional[str] = None,
):

    # AI is disabled here.
    # This endpoint is designed for the frontend
    # dashboard and returns compact finding information.

    findings = load_findings(
        use_ai=False
    )

    # =====================================================
    # SEVERITY FILTER
    # =====================================================

    if severity:

        severity = severity.upper()

        findings = [
            finding
            for finding in findings
            if str(
                finding.get(
                    "severity",
                    "",
                )
            ).upper() == severity
        ]

    # =====================================================
    # PRIORITY FILTER
    # =====================================================

    if priority:

        priority = priority.upper()

        findings = [
            finding
            for finding in findings
            if str(
                finding.get(
                    "priority",
                    "",
                )
            ).upper() == priority
        ]

    # =====================================================
    # TOOL FILTER
    # =====================================================

    if tool:

        tool_lower = tool.lower()

        findings = [
            finding
            for finding in findings
            if str(
                finding.get(
                    "tool",
                    "",
                )
            ).lower() == tool_lower
        ]

    # =====================================================
    # SEARCH
    # =====================================================

    if search:

        search_lower = search.lower()

        findings = [
            finding
            for finding in findings
            if (
                search_lower
                in str(
                    finding.get(
                        "title",
                        "",
                    )
                ).lower()
            )
            or (
                search_lower
                in str(
                    finding.get(
                        "vulnerability_id",
                        "",
                    )
                ).lower()
            )
            or (
                search_lower
                in str(
                    finding.get(
                        "description",
                        "",
                    )
                ).lower()
            )
            or (
                search_lower
                in str(
                    finding.get(
                        "target",
                        "",
                    )
                ).lower()
            )
        ]

    # =====================================================
    # COMPACT FINDINGS
    # =====================================================

    compact_findings = []

    for finding in findings:

        compact_findings.append(
            {
                "vulnerability_id": finding.get(
                    "vulnerability_id",
                    "",
                ),

                "title": finding.get(
                    "title",
                    "",
                ),

                "severity": finding.get(
                    "severity",
                    "UNKNOWN",
                ),

                "priority": finding.get(
                    "priority",
                    "LOW",
                ),

                "risk_score": finding.get(
                    "risk_score",
                    0,
                ),

                "tool": finding.get(
                    "tool",
                    "",
                ),

                "target": finding.get(
                    "target",
                    "",
                ),

                "affected_packages": finding.get(
                    "affected_packages",
                    [],
                ),

                "affected_package_count": finding.get(
                    "affected_package_count",
                    0,
                ),

                "fixed_version": finding.get(
                    "fixed_version",
                    "",
                ),

                "fix_available": finding.get(
                    "fix_available",
                    False,
                ),

                "exploitability": finding.get(
                    "exploitability",
                    0,
                ),

                "production": finding.get(
                    "production",
                    True,
                ),
            }
        )

    return {
        "total": len(compact_findings),
        "findings": compact_findings,
    }


# =========================================================
# SINGLE VULNERABILITY
# =========================================================

@app.get(
    "/api/findings/{vulnerability_id}"
)
def get_finding(
    vulnerability_id: str,
):

    # Keep this endpoint fast.
    findings = load_findings(
        use_ai=False
    )

    vulnerability_id = (
        vulnerability_id.upper()
    )

    for finding in findings:

        current_id = str(
            finding.get(
                "vulnerability_id",
                "",
            )
        ).upper()

        if current_id == vulnerability_id:

            return finding

    raise HTTPException(
        status_code=404,
        detail="Vulnerability not found",
    )


# =========================================================
# SCAN ORCHESTRATION API
# =========================================================

@app.post("/api/scan")
def orchestrate_scan(request: ScanRequest):
    """
    Orchestrate security scans based on user selection.
    
    Accepts:
        {
            "code_scanning": bool,
            "dependency_scanning": bool,
            "secret_detection": bool,
            "container_scanning": bool
        }
    
    At least one scan type must be selected.
    
    Returns aggregated findings with scan metadata.
    """
    
    # Validate at least one scan is selected
    try:
        # The validation is done in ScanRequest.__init__
        pass
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )
    
    # Generate unique scan ID
    scan_id = str(uuid.uuid4())
    
    # Execute selected scans
    try:
        findings = load_findings(
            use_ai=False,
            code_scanning=request.code_scanning,
            dependency_scanning=request.dependency_scanning,
            secret_detection=request.secret_detection,
            container_scanning=request.container_scanning,
        )
    except Exception as e:
        return {
            "status": "failed",
            "scan_id": scan_id,
            "errors": [
                {
                    "scanner": "orchestration",
                    "message": f"Failed to orchestrate scans: {str(e)}",
                }
            ],
        }
    
    # Calculate severity counts
    critical_count = sum(
        1
        for finding in findings
        if str(finding.get("priority", "")).upper() == "CRITICAL"
    )
    
    high_count = sum(
        1
        for finding in findings
        if str(finding.get("priority", "")).upper() == "HIGH"
    )
    
    medium_count = sum(
        1
        for finding in findings
        if str(finding.get("priority", "")).upper() == "MEDIUM"
    )
    
    low_count = sum(
        1
        for finding in findings
        if str(finding.get("priority", "")).upper() == "LOW"
    )
    
    # Calculate overall risk score
    if findings:
        overall_risk_score = round(
            sum(
                finding.get("risk_score", 0)
                for finding in findings
            )
            / len(findings)
        )
    else:
        overall_risk_score = 0
    
    return {
        "scan_id": scan_id,
        "selected_scans": {
            "code_scanning": request.code_scanning,
            "dependency_scanning": request.dependency_scanning,
            "secret_detection": request.secret_detection,
            "container_scanning": request.container_scanning,
        },
        "status": "completed",
        "findings": findings,
        "total_findings": len(findings),
        "critical": critical_count,
        "high": high_count,
        "medium": medium_count,
        "low": low_count,
        "overall_risk_score": overall_risk_score,
    }


# =========================================================
# AI ANALYSIS FOR A SINGLE FINDING
# =========================================================

@app.get(
    "/api/findings/{vulnerability_id}/analyze"
)
def analyze_single_finding(
    vulnerability_id: str,
):

    # First load findings WITHOUT Cloudflare AI.
    findings = load_findings(
        use_ai=False
    )

    vulnerability_id = (
        vulnerability_id.upper()
    )

    for finding in findings:

        current_id = str(
            finding.get(
                "vulnerability_id",
                "",
            )
        ).upper()

        if current_id == vulnerability_id:

            # Send ONLY this finding to Cloudflare AI.
            analyzed = analyze_finding(
                finding,
                use_ai=True,
            )

            return analyzed

    raise HTTPException(
        status_code=404,
        detail="Vulnerability not found",
    )


# =========================================================
# CLI REPORT GENERATION
# =========================================================

def main():

    print(
        "[INFO] Loading security findings..."
    )

    print(
        "[INFO] Cloudflare AI analysis enabled for CLI report."
    )

    findings = load_findings(
        use_ai=True
    )

    print(
        f"[INFO] Total security findings: "
        f"{len(findings)}"
    )

    report = generate_report(
        findings
    )

    print_report(
        report
    )

    save_report(
        report
    )


# =========================================================
# RUN DIRECTLY
# =========================================================

if __name__ == "__main__":
    main()