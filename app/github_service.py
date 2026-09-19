import io
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

import requests


GITHUB_API_BASE = "https://api.github.com"


def _safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
    destination = destination.resolve()
    for member in archive.infolist():
        member_path = (destination / member.filename).resolve()
        if member_path != destination and destination not in member_path.parents:
            raise RuntimeError("Repository archive contains an unsafe path")
        if member.is_dir():
            continue
        member_path.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(member, "r") as source, member_path.open("wb") as target:
            target.write(source.read())


def get_github_headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def get_repository(access_token: str, owner: str, repo: str) -> dict:
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"

    response = requests.get(
        url,
        headers=get_github_headers(access_token),
        timeout=30,
    )

    if response.status_code != 200:
        raise RuntimeError(f"Failed to fetch repository: HTTP {response.status_code}")

    return response.json()


def download_repository(
    access_token: str,
    owner: str,
    repo: str,
    ref: str | None = None,
) -> tuple[TemporaryDirectory, str]:
    """
    Download a GitHub repository as a ZIP archive.

    Returns:
        (temporary_directory, extracted_repository_path)

    The caller is responsible for keeping the TemporaryDirectory
    alive while the repository is being scanned.
    """

    if ref:
        url = (
            f"{GITHUB_API_BASE}/repos/"
            f"{owner}/{repo}/zipball/{ref}"
        )
    else:
        url = (
            f"{GITHUB_API_BASE}/repos/"
            f"{owner}/{repo}/zipball"
        )

    response = requests.get(
        url,
        headers=get_github_headers(access_token),
        timeout=120,
    )

    if response.status_code != 200:
        raise RuntimeError(f"Failed to download repository: HTTP {response.status_code}")

    temp_dir = TemporaryDirectory()

    archive_path = Path(temp_dir.name) / "repository.zip"

    archive_path.write_bytes(response.content)

    extract_path = Path(temp_dir.name) / "repository"

    extract_path.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        _safe_extract(archive, extract_path)

    extracted_items = list(extract_path.iterdir())

    if len(extracted_items) == 1 and extracted_items[0].is_dir():
        repository_path = extracted_items[0]
    else:
        repository_path = extract_path

    return temp_dir, str(repository_path)