import json
import os
import re

import requests
from dotenv import load_dotenv


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()


CLOUDFLARE_ACCOUNT_ID = os.getenv(
    "CLOUDFLARE_ACCOUNT_ID"
)

CLOUDFLARE_API_TOKEN = os.getenv(
    "CLOUDFLARE_API_TOKEN"
)

CLOUDFLARE_AI_MODEL = os.getenv(
    "CLOUDFLARE_AI_MODEL",
    "@cf/meta/llama-3.2-3b-instruct",
)


# =========================================================
# CLOUDFLARE AI URL
# =========================================================

CLOUDFLARE_AI_URL = (
    f"https://api.cloudflare.com/client/v4/accounts/"
    f"{CLOUDFLARE_ACCOUNT_ID}/ai/run/"
    f"{CLOUDFLARE_AI_MODEL}"
)


# =========================================================
# BASIC CLOUDFLARE AI REQUEST
# =========================================================

def ask_cloudflare_ai(
    prompt: str,
) -> str:

    if not CLOUDFLARE_ACCOUNT_ID:
        raise ValueError(
            "CLOUDFLARE_ACCOUNT_ID is missing from .env"
        )

    if not CLOUDFLARE_API_TOKEN:
        raise ValueError(
            "CLOUDFLARE_API_TOKEN is missing from .env"
        )

    headers = {
        "Authorization": (
            f"Bearer {CLOUDFLARE_API_TOKEN}"
        ),
        "Content-Type": "application/json",
    }

    payload = {
        "prompt": prompt,
        "max_tokens": 192,
    }

    response = requests.post(
        CLOUDFLARE_AI_URL,
        headers=headers,
        json=payload,
        timeout=60,
    )

    response.raise_for_status()

    data = response.json()

    if not data.get("success"):
        raise RuntimeError(
            "Cloudflare AI request failed: "
            f"{data.get('errors')}"
        )

    result = data.get(
        "result",
        {},
    )

    # -----------------------------------------------------
    # Standard text completion response
    # -----------------------------------------------------

    if "response" in result:

        return result[
            "response"
        ]

    # -----------------------------------------------------
    # Choices response
    # -----------------------------------------------------

    choices = result.get(
        "choices",
        [],
    )

    if choices:

        return choices[0].get(
            "text",
            "",
        )

    return str(result)


# =========================================================
# JSON EXTRACTION
# =========================================================

def _extract_json(
    text: str,
) -> dict:

    if not text:

        raise ValueError(
            "Cloudflare AI returned an empty response."
        )

    text = text.strip()

    # -----------------------------------------------------
    # Remove Markdown JSON fences
    # -----------------------------------------------------

    text = re.sub(
        r"^```(?:json)?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(
        r"\s*```$",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = text.strip()

    # -----------------------------------------------------
    # Try direct JSON
    # -----------------------------------------------------

    try:

        result = json.loads(
            text
        )

        if isinstance(
            result,
            dict,
        ):

            return result

    except json.JSONDecodeError:
        pass

    # -----------------------------------------------------
    # Try JSON inside extra text
    # -----------------------------------------------------

    start = text.find(
        "{"
    )

    end = text.rfind(
        "}"
    )

    if (
        start != -1
        and end != -1
        and end > start
    ):

        json_text = text[
            start:end + 1
        ]

        try:

            result = json.loads(
                json_text
            )

            if isinstance(
                result,
                dict,
            ):

                return result

        except json.JSONDecodeError:
            pass

    raise ValueError(
        "Cloudflare AI did not return valid JSON."
    )


# =========================================================
# RAKSHAK VULNERABILITY ANALYSIS
# =========================================================

def analyze_with_cloudflare(
    finding: dict,
) -> dict:

    vulnerability_id = finding.get(
        "vulnerability_id",
        "UNKNOWN",
    )

    title = finding.get(
        "title",
        "",
    )

    description = finding.get(
        "description",
        "",
    )

    severity = finding.get(
        "severity",
        "UNKNOWN",
    )

    priority = finding.get(
        "priority",
        "LOW",
    )

    risk_score = finding.get(
        "risk_score",
        0,
    )

    exploitability = finding.get(
        "exploitability",
        0,
    )

    affected_packages = finding.get(
        "affected_packages",
        [],
    )

    fixed_version = finding.get(
        "fixed_version",
        "",
    )

    production = finding.get(
        "production",
        False,
    )

    scanner_type = finding.get("scanner_type", "")
    target = finding.get("target", "")
    package_name = finding.get("package_name", "")
    installed_version = finding.get("installed_version", "")
    evidence = (
        finding.get("evidence")
        or finding.get("code_snippet")
        or finding.get("snippet")
        or ""
    )
    file_path = finding.get("file_path", "") or target
    line_number = finding.get("line_number", "") or finding.get("line", "")

    fixed_version_text = (
        fixed_version
        if fixed_version
        else "No fixed version available"
    )

    packages_text = (
        ", ".join(
            str(package)
            for package in affected_packages
        )
        if affected_packages
        else "Unknown"
    )

    # =====================================================
    # COMPACT SECURITY PROMPT
    # =====================================================

    prompt = f"""
You are Rakshak, a DevSecOps vulnerability analyst.

Analyze ONLY the supplied vulnerability data.
Do not invent facts.
Do not change severity, priority, risk score, or exploitability.
Do not invent a fixed version.
Do not identify a different vulnerability.

Vulnerability ID: {vulnerability_id}

Title: {title}

Description: {description}

Severity: {severity}

Priority: {priority}

Risk Score: {risk_score}/100

Exploitability: {exploitability}

Affected Packages: {packages_text}

Scanner Type: {scanner_type or "Unknown"}

Affected Component: {package_name or target or "Unknown"}

Installed Version: {installed_version or "Unknown"}

Fixed Version: {fixed_version_text}

File: {file_path or "Unknown"}

Line: {line_number or "Unknown"}

Evidence: {evidence or "Not supplied"}

Production: {production}

Return ONLY valid JSON with exactly these four keys:

{{
  "ai_explanation": "Interpret the security mechanism: what is vulnerable, what is the underlying problem, how could it be abused, what is the practical consequence. Do NOT repeat the vulnerability ID, title, or description.",
  "potential_impact": "Describe the concrete security consequence of THIS specific finding. Use conditional language when exploitability depends on context. Do not use generic phrases like 'could affect the affected component'.",
  "recommended_action": "Provide specific remediation for THIS vulnerability type. For code findings: code-level fix. For dependencies: package upgrade with version if available. For secrets: revoke/rotate. Do not give generic advice.",
  "risk_summary": "Concise interpretation: severity, priority, risk score, exploitability, and main consequence. Do NOT repeat the full title."
}}

Rules:
- JSON only. No Markdown. No code fences. No text before/after JSON.
- Each field must be materially specific to this finding, not interchangeable severity text.
- Do NOT copy or paraphrase the Title or Description. Interpret the security mechanism, practical impact, and remediation using the supplied evidence.
- Use the vulnerability ID, package/component, file, line, or evidence when those values are supplied.
- Do not invent CVSS data, exploits, package versions, production exposure, internet exposure, exploit availability, active exploitation, affected user counts, or CIA impact unless the finding data supports it.
- Represent the provided risk_score ({risk_score}/100) and exploitability ({exploitability}) accurately. Do not reinterpret them.
"""

    # =====================================================
    # CALL CLOUDFLARE
    # =====================================================

    raw_response = ask_cloudflare_ai(
        prompt
    )

    # =====================================================
    # PARSE JSON
    # =====================================================

    result = _extract_json(
        raw_response
    )

    # =====================================================
    # VALIDATE REQUIRED FIELDS
    # =====================================================

    required_fields = [
        "ai_explanation",
        "potential_impact",
        "recommended_action",
        "risk_summary",
    ]

    for field in required_fields:

        if field not in result:

            raise ValueError(
                "Cloudflare AI JSON missing field: "
                f"{field}"
            )

        if not str(
            result[field]
        ).strip():

            raise ValueError(
                "Cloudflare AI returned empty field: "
                f"{field}"
            )

    # =====================================================
    # RETURN CLEAN ANALYSIS
    # =====================================================

    return {
        "ai_explanation": str(
            result["ai_explanation"]
        ).strip(),

        "potential_impact": str(
            result["potential_impact"]
        ).strip(),

        "recommended_action": str(
            result["recommended_action"]
        ).strip(),

        "risk_summary": str(
            result["risk_summary"]
        ).strip(),
    }