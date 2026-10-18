"""Build a safe phishing-vs-legitimate dataset from verified source classes."""

from __future__ import annotations

import argparse
import csv
from email import policy
from email.parser import BytesParser
from pathlib import Path
import random
import re
import sys


ROOT = Path(__file__).resolve().parent
DEFAULT_RAW_DIR = ROOT / "datasets" / "phishing_email_dataset" / "raw"
DEFAULT_HAM_DIR = ROOT / "data" / "raw" / "spamassassin"
DEFAULT_OUTPUT = ROOT / "datasets" / "phishing_email_dataset" / "phishing_legit_v1.csv"
NAZARIO_INTERNAL_SUBJECT = "DON'T DELETE THIS MESSAGE -- FOLDER INTERNAL DATA"
csv.field_size_limit(10 * 1024 * 1024)


def _field_text(value: str | None) -> str:
    return (value or "").replace("\x00", "").strip()


def _record(subject: str, body: str, label: int, source: str, category: str) -> dict[str, str | int] | None:
    subject = _field_text(subject)
    body = _field_text(body)
    text = f"{subject}\n{body}".strip()
    if not text:
        return None
    return {
        "subject": subject,
        "body": body,
        "text": text,
        "label": label,
        "source": source,
        "category": category,
    }


def _read_csv_rows(path: Path):
    with path.open("r", newline="", encoding="utf-8-sig", errors="replace") as handle:
        yield from csv.DictReader(handle)


def _read_nazario(path: Path) -> tuple[list[dict[str, str | int]], int]:
    rows: list[dict[str, str | int]] = []
    excluded = 0
    for item in _read_csv_rows(path):
        if str(item.get("label", "")).strip() != "1":
            excluded += 1
            continue
        subject = _field_text(item.get("subject"))
        if subject.upper().startswith(NAZARIO_INTERNAL_SUBJECT):
            excluded += 1
            continue
        row = _record(subject, item.get("body", ""), 1, "nazario", "phishing")
        if row is None:
            excluded += 1
            continue
        rows.append(row)
    return rows, excluded


def _read_ham_csv(path: Path, source: str) -> tuple[list[dict[str, str | int]], int]:
    rows: list[dict[str, str | int]] = []
    excluded = 0
    for item in _read_csv_rows(path):
        if str(item.get("label", "")).strip() != "0":
            excluded += 1
            continue
        row = _record(item.get("subject", ""), item.get("body", ""), 0, source, "ham")
        if row is None:
            excluded += 1
            continue
        rows.append(row)
    return rows, excluded


def _email_parts(raw_message: bytes) -> tuple[str, str]:
    message = BytesParser(policy=policy.default).parsebytes(raw_message)
    body_parts: list[str] = []
    for part in message.walk():
        if part.is_multipart() or part.get_content_type() != "text/plain":
            continue
        try:
            content = part.get_content()
        except (LookupError, UnicodeError):
            payload = part.get_payload(decode=True)
            content = payload.decode("utf-8", errors="replace") if payload else ""
        if isinstance(content, str) and content.strip():
            body_parts.append(content.strip())
    return str(message.get("Subject", "")), "\n".join(body_parts)


def _read_local_easy_ham(root: Path) -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    for corpus in ("easy_ham", "easy_ham_2"):
        corpus_dir = root / corpus
        if not corpus_dir.is_dir():
            continue
        for path in sorted(corpus_dir.rglob("*")):
            if not path.is_file():
                continue
            subject, body = _email_parts(path.read_bytes())
            row = _record(subject, body, 0, "spamassassin_easy_ham", "ham")
            if row is not None:
                rows.append(row)
    return rows


def _deduplicate(rows: list[dict[str, str | int]]) -> tuple[list[dict[str, str | int]], int, int]:
    label_by_text: dict[str, set[int]] = {}
    for row in rows:
        label_by_text.setdefault(str(row["text"]), set()).add(int(row["label"]))
    conflicts = {text for text, labels in label_by_text.items() if len(labels) > 1}

    seen: set[str] = set()
    result: list[dict[str, str | int]] = []
    duplicates = 0
    for row in rows:
        text = str(row["text"])
        if text in conflicts:
            continue
        if text in seen:
            duplicates += 1
            continue
        seen.add(text)
        result.append(row)
    return result, duplicates, len(conflicts)


def build_dataset(raw_dir: Path, ham_dir: Path, output: Path) -> list[dict[str, str | int]]:
    nazario_path = raw_dir / "Nazario.csv"
    if not nazario_path.is_file():
        raise FileNotFoundError(f"Phishing-positive source is missing: {nazario_path}")
    rows: list[dict[str, str | int]] = []
    nazario, nazario_excluded = _read_nazario(nazario_path)
    rows.extend(nazario)
    ham_stats: list[tuple[str, int, int]] = []
    for filename, source in (
        ("SpamAssasin.csv", "spamassassin_ham"),
        ("Enron.csv", "enron_ham"),
    ):
        source_path = raw_dir / filename
        if not source_path.is_file():
            print(f"Skipping unavailable optional source: {source_path}")
            continue
        ham_rows, excluded = _read_ham_csv(source_path, source)
        rows.extend(ham_rows)
        ham_stats.append((source, len(ham_rows), excluded))
    local_ham = _read_local_easy_ham(ham_dir)
    rows.extend(local_ham)

    rows, duplicate_count, conflict_count = _deduplicate(rows)
    if {int(row["label"]) for row in rows} != {0, 1}:
        raise ValueError("Prepared dataset must contain both verified ham and phishing examples")
    random.Random(42).shuffle(rows)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=["subject", "body", "text", "label", "source", "category"]
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output}")
    print(f"Nazario: accepted={len(nazario)}, excluded={nazario_excluded}")
    for source, accepted, excluded in ham_stats:
        print(f"{source}: accepted={accepted}, excluded non-ham/empty={excluded}")
    print(f"Local easy_ham/easy_ham_2: parsed={len(local_ham)}")
    print(f"Exact duplicates removed={duplicate_count}; conflicting-label texts removed={conflict_count}")
    for label, name in ((1, "phishing"), (0, "ham")):
        print(f"Class {label} ({name}): {sum(int(row['label']) == label for row in rows)}")
    for source in sorted({str(row["source"]) for row in rows}):
        print(f"Source {source}: {sum(str(row['source']) == source for row in rows)}")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--ham-dir", type=Path, default=DEFAULT_HAM_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    rows = build_dataset(args.raw_dir, args.ham_dir, args.output)
    for label in (1, 0):
        row = next(item for item in rows if int(item["label"]) == label)
        sample = re.sub(r"\s+", " ", str(row["text"]))[:180]
        print(
            f"Sample [{row['source']}, label={row['label']}]: "
            f"{sample!r}"
        )


if __name__ == "__main__":
    try:
        main()
    except (OSError, csv.Error, ValueError) as exc:
        print(f"Dataset preparation failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
