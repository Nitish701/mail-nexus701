from __future__ import annotations

import json
import gzip
import logging
import os
import tarfile
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests


BACKEND_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BACKEND_DIR / "data" / "raw"
TIMEOUT = (15, 45)
USER_AGENT = "Mail-Nexus-Research-Data-Fetch/1.0"
ARCHIVE_SUFFIXES = (".tar.bz2", ".tar.gz", ".tgz", ".zip", ".gz")
EMAIL_SUFFIXES = (".eml", ".mbox", ".mail", ".txt")
logger = logging.getLogger("corpus_fetch")


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)


def download(url: str, destination: Path, attempts: list[dict[str, str]]) -> bool:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file() and destination.stat().st_size > 0:
        logger.info("Reusing existing download %s", destination)
        attempts.append({"url": url, "status": "already-present", "path": str(destination)})
        return True
    temporary_path = destination.with_suffix(destination.suffix + ".part")
    logger.info("Downloading %s", url)
    try:
        with requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
            stream=True,
        ) as response:
            response.raise_for_status()
            with temporary_path.open("wb") as output:
                for chunk in response.iter_content(chunk_size=1024 * 64):
                    if chunk:
                        output.write(chunk)
        os.replace(temporary_path, destination)
        logger.info("Saved %s", destination)
        attempts.append({"url": url, "status": "downloaded", "path": str(destination)})
        return True
    except (requests.RequestException, OSError) as exc:
        temporary_path.unlink(missing_ok=True)
        message = f"{type(exc).__name__}: {exc}"
        logger.error("Failed to download %s: %s", url, message)
        attempts.append({"url": url, "status": "failed", "error": message})
        return False


def safe_extract_tar(archive_path: Path, destination: Path) -> int:
    extracted = 0
    with tarfile.open(archive_path, "r:*") as archive:
        root = destination.resolve()
        for member in archive.getmembers():
            target = (destination / member.name).resolve()
            if not target.is_relative_to(root):
                logger.warning("Skipping unsafe archive member %s", member.name)
                continue
            if member.isfile():
                archive.extract(member, destination)
                extracted += 1
    return extracted


def extract_archive(archive_path: Path, destination: Path) -> int:
    if archive_path.name.endswith((".tar.bz2", ".tar.gz", ".tgz")):
        return safe_extract_tar(archive_path, destination)
    if archive_path.suffix == ".zip":
        extracted = 0
        root = destination.resolve()
        with zipfile.ZipFile(archive_path) as archive:
            for member in archive.infolist():
                target = (destination / member.filename).resolve()
                if not target.is_relative_to(root) or member.is_dir():
                    continue
                archive.extract(member, destination)
                extracted += 1
        return extracted
    if archive_path.suffix == ".gz":
        extracted_path = archive_path.with_suffix("")
        with gzip.open(archive_path, "rb") as compressed, extracted_path.open("wb") as output:
            output.write(compressed.read())
        return 1
    return 0


def unpack_downloaded_archives(folder: Path) -> None:
    for archive_path in sorted(folder.rglob("*")):
        if not archive_path.is_file() or archive_path.name.endswith(".part"):
            continue
        if archive_path.name.endswith(ARCHIVE_SUFFIXES):
            try:
                count = extract_archive(archive_path, folder)
                logger.info("Extracted %d files from %s", count, archive_path)
            except (OSError, tarfile.TarError, zipfile.BadZipFile) as exc:
                logger.error("Failed to extract %s: %s: %s", archive_path, type(exc).__name__, exc)


def fetch_nazario(attempts: list[dict[str, str]]) -> bool:
    destination = RAW_DIR / "nazario"
    destination.mkdir(parents=True, exist_ok=True)
    landing_pages = [
        "https://monkey.org/~jose/phishing/",
        "http://monkey.org/~jose/phishing/",
        "https://web.archive.org/web/20190101000000id_/http://monkey.org/~jose/phishing/",
    ]
    successful_page = False
    discovered_files: set[str] = set()

    for page_url in landing_pages:
        try:
            logger.info("Checking Nazario corpus index %s", page_url)
            response = requests.get(page_url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
            response.raise_for_status()
            parser = LinkParser()
            parser.feed(response.text)
            attempts.append({"url": page_url, "status": "index-read"})
            successful_page = True
            page_base = response.url
            base_path = urlparse(page_base).path.rsplit("/", 1)[0] + "/"
            subdirectories: list[str] = []
            for href in parser.links:
                linked_url = urljoin(page_base, href)
                parsed = urlparse(linked_url)
                if parsed.netloc != urlparse(page_base).netloc:
                    continue
                if not parsed.path.startswith(base_path):
                    continue
                if parsed.path.lower().endswith(EMAIL_SUFFIXES + ARCHIVE_SUFFIXES):
                    discovered_files.add(linked_url)
                elif parsed.path.endswith("/") and parsed.path != urlparse(page_base).path:
                    subdirectories.append(linked_url)
            for directory_url in subdirectories[:20]:
                try:
                    directory_response = requests.get(
                        directory_url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT
                    )
                    directory_response.raise_for_status()
                    directory_parser = LinkParser()
                    directory_parser.feed(directory_response.text)
                    attempts.append({"url": directory_url, "status": "index-read"})
                    for href in directory_parser.links:
                        linked_url = urljoin(directory_response.url, href)
                        parsed = urlparse(linked_url)
                        if (
                            parsed.netloc == urlparse(page_base).netloc
                            and parsed.path.startswith(base_path)
                            and parsed.path.lower().endswith(EMAIL_SUFFIXES + ARCHIVE_SUFFIXES)
                        ):
                            discovered_files.add(linked_url)
                except requests.RequestException as exc:
                    message = f"{type(exc).__name__}: {exc}"
                    logger.warning("Could not read Nazario sub-index %s: %s", directory_url, message)
                    attempts.append({"url": directory_url, "status": "failed", "error": message})
            if discovered_files:
                break
        except requests.RequestException as exc:
            message = f"{type(exc).__name__}: {exc}"
            logger.error("Failed to read Nazario index %s: %s", page_url, message)
            attempts.append({"url": page_url, "status": "failed", "error": message})

    downloaded = 0
    for url in sorted(discovered_files):
        name = Path(urlparse(url).path).name
        if name and download(url, destination / name, attempts):
            downloaded += 1

    unpack_downloaded_archives(destination)
    local_messages = any(
        item.is_file() and item.suffix.lower() in {".eml", ".mbox", ".mail", ".txt"}
        for item in destination.rglob("*")
    )
    if not discovered_files:
        note = "Index was reachable but no direct email/archive links were identified." if successful_page else "No Nazario index was reachable."
        logger.warning(note)
        attempts.append({"url": landing_pages[0], "status": "unavailable", "error": note})
    return downloaded > 0 or local_messages


def fetch_spamassassin(attempts: list[dict[str, str]]) -> bool:
    destination = RAW_DIR / "spamassassin"
    destination.mkdir(parents=True, exist_ok=True)
    packages = {
        "easy_ham": [
            "https://spamassassin.apache.org/old/publiccorpus/20030228_easy_ham.tar.bz2",
            "https://spamassassin.apache.org/old/publiccorpus/easy_ham.tar.bz2",
        ],
        "easy_ham_2": [
            "https://spamassassin.apache.org/old/publiccorpus/20030228_easy_ham_2.tar.bz2",
            "https://spamassassin.apache.org/old/publiccorpus/easy_ham_2.tar.bz2",
        ],
    }
    any_success = False
    for name, urls in packages.items():
        archive_path = destination / f"{name}.tar.bz2"
        corpus_success = False
        for url in urls:
            if not download(url, archive_path, attempts):
                continue
            try:
                count = extract_archive(archive_path, destination)
                logger.info("Extracted %d files from %s", count, archive_path)
                if count > 0:
                    any_success = True
                    corpus_success = True
                    break
                raise tarfile.ReadError("archive contained no extractable files")
            except (OSError, tarfile.TarError, zipfile.BadZipFile) as exc:
                logger.error("Failed to extract %s: %s: %s", archive_path, type(exc).__name__, exc)
                attempts.append(
                    {"url": url, "status": "extract-failed", "error": f"{type(exc).__name__}: {exc}"}
                )
        if not corpus_success:
            logger.warning("No usable SpamAssassin archive downloaded for %s", name)
    return any_success


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    attempts: list[dict[str, str]] = []
    nazario_ok = fetch_nazario(attempts)
    spamassassin_ok = fetch_spamassassin(attempts)
    status_path = RAW_DIR / "fetch_status.json"
    status_path.write_text(
        json.dumps(
            {
                "nazario_available": nazario_ok,
                "spamassassin_ham_available": spamassassin_ok,
                "attempts": attempts,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    logger.info("Fetch summary: Nazario=%s, SpamAssassin ham=%s", nazario_ok, spamassassin_ok)
    logger.info("Detailed fetch log: %s", status_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
