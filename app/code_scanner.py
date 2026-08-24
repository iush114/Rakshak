"""
Lightweight Code Scanner for Rakshak.

This module performs static code analysis to detect common
security vulnerabilities in source code.

Detected patterns:
- SQL Injection (string concatenation in queries)
- Remote Code Execution (eval, exec, pickle)
- Hardcoded secrets (AWS keys, API tokens, database credentials)
- Insecure cryptography (hardcoded encryption keys)
- Command injection (shell execution with unsanitized input)
- XXE vulnerabilities (unsafe XML parsing)
"""

import re
from pathlib import Path
from typing import List, Optional

from app.risk_engine import SecurityFinding


# =========================================================
# DETECTION PATTERNS
# =========================================================

PATTERNS = {
    "sql_injection": {
        "description": "SQL Injection vulnerability - string concatenation in query",
        "patterns": [
            r"(query|sql|execute)\s*=\s*(['\"])[^'\"]*\+",  # query = "SELECT" + var
            r"cursor\.execute\s*\(\s*['\"][^'\"]*\+",  # cursor.execute("... " +
            r"db\.query\s*\(\s*f['\"]",  # db.query(f"SELECT ...")
        ],
        "severity": "HIGH",
        "exploitability": 0.85,
    },
    "rce_eval": {
        "description": "Remote Code Execution - unsafe eval() usage",
        "patterns": [
            r"\beval\s*\(",
            r"\bexec\s*\(",
            r"\b__import__\s*\(",
        ],
        "severity": "CRITICAL",
        "exploitability": 0.95,
    },
    "rce_pickle": {
        "description": "Remote Code Execution - unsafe pickle usage",
        "patterns": [
            r"pickle\.loads\s*\(",
            r"pickle\.load\s*\(",
        ],
        "severity": "CRITICAL",
        "exploitability": 0.90,
    },
    "hardcoded_secret_aws": {
        "description": "Hardcoded AWS credential detected",
        "patterns": [
            r"AKIA[0-9A-Z]{16}",
            r"aws_access_key\s*=\s*['\"]",
            r"aws_secret_key\s*=\s*['\"]",
        ],
        "severity": "CRITICAL",
        "exploitability": 0.95,
    },
    "hardcoded_secret_stripe": {
        "description": "Hardcoded Stripe API key detected",
        "patterns": [
            r"sk_live_[0-9a-zA-Z]{20,}",
            r"pk_live_[0-9a-zA-Z]{20,}",
        ],
        "severity": "CRITICAL",
        "exploitability": 0.95,
    },
    "hardcoded_secret_token": {
        "description": "Hardcoded token or API key detected",
        "patterns": [
            r"(token|api_key|secret_key|password)\s*=\s*['\"][a-zA-Z0-9+/]{20,}['\"]",
            r"Authorization.*Bearer\s+[a-zA-Z0-9\-_.]+",
        ],
        "severity": "HIGH",
        "exploitability": 0.85,
    },
    "insecure_crypto": {
        "description": "Insecure cryptography - weak cipher or hardcoded key",
        "patterns": [
            r"(DES|MD5|SHA1)\s*\(",
            r"cipher\s*=\s*['\"]hardcoded",
            r"key\s*=\s*['\"][a-zA-Z0-9]{16,}['\"]",
        ],
        "severity": "MEDIUM",
        "exploitability": 0.60,
    },
    "command_injection": {
        "description": "Command Injection - shell execution with unsanitized input",
        "patterns": [
            r"os\.system\s*\(",
            r"subprocess\s*\.\s*call\s*\(\s*.*\+",
            r"shell\s*=\s*True",
        ],
        "severity": "CRITICAL",
        "exploitability": 0.90,
    },
    "xxe_vulnerability": {
        "description": "XXE (XML External Entity) vulnerability",
        "patterns": [
            r"etree\.parse\s*\(",
            r"xml\.dom\.minidom\.parse\s*\(",
            r"defusedxml" if False else None,  # placeholder
        ],
        "severity": "HIGH",
        "exploitability": 0.75,
    },
}


# =========================================================
# SCANNING FUNCTIONS
# =========================================================


def scan_code_content(
    content: str,
    file_path: str = "submitted_code",
    language: Optional[str] = None,
) -> List[SecurityFinding]:
    """
    Scan code content for security vulnerabilities.

    Args:
        content: Source code string
        file_path: Name/path of the file for reporting
        language: Programming language (python, javascript, etc.)

    Returns:
        List of SecurityFinding objects
    """

    findings = []
    lines = content.split("\n")

    # Skip very short content
    if len(content.strip()) < 10:
        return findings

    # Scan each pattern
    for pattern_key, pattern_config in PATTERNS.items():
        # Skip None values (placeholders)
        if pattern_config is None:
            continue

        patterns = pattern_config["patterns"]
        severity = pattern_config["severity"]
        description = pattern_config["description"]
        exploitability = pattern_config["exploitability"]

        # Filter None patterns
        patterns = [p for p in patterns if p is not None]

        # Check each line
        for line_num, line in enumerate(lines, start=1):
            for pattern in patterns:
                try:
                    if re.search(
                        pattern,
                        line,
                        re.IGNORECASE,
                    ):
                        # Found a match
                        vulnerability_id = (
                            f"CODE-{pattern_key.upper()}"
                        )

                        finding_title = (
                            f"{vulnerability_id}: {description}"
                        )

                        finding_desc = (
                            f"Pattern: {pattern_key}\n"
                            f"Target: {file_path}\n"
                            f"Line: {line_num}\n"
                            f"Detection: {description}\n\n"
                            f"Code snippet:\n{line.strip()}"
                        )

                        findings.append(
                            SecurityFinding(
                                tool="Code Scanner",
                                severity=severity,
                                title=finding_title,
                                description=finding_desc,
                                exploitability=exploitability,
                                production=True,
                                fix_available=True,
                            )
                        )
                        # Break to avoid duplicate detections
                        # on the same line for same pattern
                        break

                except re.error:
                    # Skip invalid regex patterns
                    pass

    return findings


def scan_files(
    file_paths: List[str],
) -> List[SecurityFinding]:
    """
    Scan multiple source files.

    Args:
        file_paths: List of file paths to scan

    Returns:
        List of SecurityFinding objects from all files
    """

    all_findings = []

    for file_path in file_paths:
        path = Path(file_path)

        # Skip non-existent files
        if not path.exists():
            continue

        # Skip large files (>1MB)
        if path.stat().st_size > 1024 * 1024:
            continue

        try:
            with path.open("r", encoding="utf-8") as f:
                content = f.read()

            file_findings = scan_code_content(
                content,
                file_path=str(path),
                language=path.suffix.lstrip("."),
            )

            all_findings.extend(file_findings)

        except (UnicodeDecodeError, OSError):
            # Skip files that can't be read as text
            pass

    return all_findings
