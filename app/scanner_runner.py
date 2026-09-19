import json
import shutil
import subprocess
from pathlib import Path
from typing import Optional


def run_command(
    command: list[str],
    cwd: Optional[str] = None,
) -> tuple[int, str, str]:
    """
    Run a security scanner command and return:
    exit_code, stdout, stderr
    """

    try:
        process = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300,
                check=False,
        )

        return (
            process.returncode,
            process.stdout,
            process.stderr,
        )

    except subprocess.TimeoutExpired:
        return (
            -1,
            "",
            "Scanner timed out after 300 seconds.",
        )

    except FileNotFoundError:
        return (
            -1,
            "",
            f"Scanner executable not found: {command[0]}",
        )

    except Exception as exc:
        return (
            -1,
            "",
            str(exc),
        )


def check_scanner_installed(scanner: str) -> bool:
    """
    Check whether a scanner executable exists.
    """

    return shutil.which(scanner) is not None


def run_trivy_filesystem(
    target_directory: str,
    output_file: str,
) -> dict:
    """
    Run a fresh Trivy filesystem scan.
    """

    if not check_scanner_installed("trivy"):
        return {
            "success": False,
            "scanner": "Trivy",
            "error": "Trivy is not installed or not available in PATH.",
        }

    output_path = Path(output_file)
    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    command = [
        "trivy",
        "fs",
        "--format",
        "json",
        "--output",
        str(output_path),
        "--scanners",
        "vuln",
        "--ignore-unfixed",
        target_directory,
    ]

    exit_code, stdout, stderr = run_command(command)

    return {
        "success": output_path.exists(),
        "scanner": "Trivy",
        "exit_code": exit_code,
        "output_file": str(output_path),
        "stdout": stdout,
        "stderr": stderr,
    }


def run_gitleaks(
    target_directory: str,
    output_file: str,
) -> dict:
    """
    Run a fresh Gitleaks secret scan.
    """

    if not check_scanner_installed("gitleaks"):
        return {
            "success": False,
            "scanner": "Gitleaks",
            "error": (
                "Gitleaks is not installed "
                "or not available in PATH."
            ),
        }

    output_path = Path(output_file)
    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    command = [
        "gitleaks",
        "dir",
        target_directory,
        "--report-format",
        "json",
        "--report-path",
        str(output_path),
        "--exit-code",
        "0",
    ]

    exit_code, stdout, stderr = run_command(command)

    return {
        "success": output_path.exists(),
        "scanner": "Gitleaks",
        "exit_code": exit_code,
        "output_file": str(output_path),
        "stdout": stdout,
        "stderr": stderr,
    }


def run_code_scanner(
    target_directory: str,
) -> dict:
    """
    Run Rakshak's lightweight static code scanner.
    """

    from app.code_scanner import scan_files

    source_extensions = {
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".java",
        ".c",
        ".cpp",
        ".h",
        ".hpp",
        ".go",
        ".php",
        ".rb",
        ".rs",
    }

    files_to_scan = []

    target = Path(target_directory)

    for path in target.rglob("*"):
        if not path.is_file():
            continue

        # Skip common dependency/build directories.
        if any(
            part in {
                "node_modules",
                ".git",
                "venv",
                ".venv",
                "__pycache__",
                "dist",
                "build",
            }
            for part in path.parts
        ):
            continue

        if path.suffix.lower() in source_extensions:
            files_to_scan.append(str(path))

    findings = scan_files(files_to_scan)

    return {
        "success": True,
        "scanner": "Code Scanner",
        "files_scanned": len(files_to_scan),
        "findings": findings,
    }


def run_all_selected_scanners(
    target_directory: str,
    output_directory: str,
    dependency_scanning: bool = False,
    secret_detection: bool = False,
    code_scanning: bool = False,
) -> dict:
    """
    Execute the selected real-time security scanners.
    """

    output_path = Path(output_directory)
    output_path.mkdir(
        parents=True,
        exist_ok=True,
    )

    results = {
        "dependency_scanning": None,
        "secret_detection": None,
        "code_scanning": None,
    }

    if dependency_scanning:
        results["dependency_scanning"] = run_trivy_filesystem(
            target_directory=target_directory,
            output_file=str(
                output_path / "trivy-results.json"
            ),
        )

    if secret_detection:
        results["secret_detection"] = run_gitleaks(
            target_directory=target_directory,
            output_file=str(
                output_path / "gitleaks-results.json"
            ),
        )

    if code_scanning:
        results["code_scanning"] = run_code_scanner(
            target_directory=target_directory,
        )

    return results