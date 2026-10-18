from __future__ import annotations

import csv
import json
import logging
import re
import unicodedata
from email import policy
from email.message import Message
from email.parser import BytesParser
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BACKEND_DIR / "data" / "raw"
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
OUTPUT_PATH = PROCESSED_DIR / "phishing_legit_real_v1.csv"
BUILD_STATUS_PATH = PROCESSED_DIR / "real_dataset_build_status.json"
SYNTHETIC_PATH = BACKEND_DIR / "data" / "synthetic_phishing_v2.csv"
OUTPUT_COLUMNS = ["subject", "body", "text", "label", "source", "category"]
HEADER_PATTERN = re.compile(rb"(?im)^(from|to|subject|date|received|message-id):\s*")
logger = logging.getLogger("corpus_builder")
READ_ERRORS: list[dict[str, str]] = []


class PlainTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        cleaned = data.strip()
        if cleaned:
            self.parts.append(cleaned)


def decode_payload(payload: bytes, charset: str | None) -> str:
    try:
        return payload.decode(charset or "utf-8", errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def clean_text(value: str) -> str:
    return "".join(
        character
        if character in "\r\n\t" or not unicodedata.category(character).startswith("C")
        else ""
        for character in value
    )


def message_body(message: Message) -> str:
    plain_parts: list[str] = []
    html_parts: list[str] = []
    for part in message.walk():
        if part.is_multipart():
            continue
        content_type = part.get_content_type().lower()
        if content_type not in {"text/plain", "text/html"}:
            continue
        try:
            content: Any = part.get_content()
        except (LookupError, UnicodeError, AttributeError):
            payload = part.get_payload(decode=True)
            content = decode_payload(payload, part.get_content_charset()) if payload else ""
        if not isinstance(content, str):
            continue
        if "\x00" in content or (content and content.count("\ufffd") / len(content) > 0.05):
            continue
        if content_type == "text/plain":
            plain_parts.append(clean_text(content))
        else:
            parser = PlainTextExtractor()
            parser.feed(content)
            html_parts.append(clean_text(" ".join(parser.parts)))
    return "\n".join(plain_parts or html_parts).strip()


def parse_message(raw_message: bytes) -> tuple[str, str] | None:
    if not HEADER_PATTERN.search(raw_message[:32768]):
        return None
    try:
        message = BytesParser(policy=policy.default).parsebytes(raw_message)
        subject = str(message.get("Subject", "") or "").strip()
        if subject and subject.count("\ufffd") / len(subject) > 0.1:
            subject = ""
        subject = clean_text(subject)
        body = message_body(message)
    except (ValueError, TypeError, UnicodeError) as exc:
        logger.warning("Could not parse email message: %s: %s", type(exc).__name__, exc)
        return None
    if not subject and not body:
        return None
    return subject, body


def iter_file_messages(path: Path):
    try:
        raw_message = path.read_bytes()
    except OSError as exc:
        logger.warning("Could not read %s: %s", path, exc)
        READ_ERRORS.append({"path": str(path), "error": f"{type(exc).__name__}: {exc}"})
        return
    if path.suffix.lower() == ".mbox":
        boundaries = re.split(rb"(?m)^From [^\r\n]*\r?\n", raw_message)
        for message_bytes in boundaries:
            if message_bytes.strip() and HEADER_PATTERN.search(message_bytes[:32768]):
                yield message_bytes
    elif raw_message:
        yield raw_message


def row_from_message(raw_message: bytes, label: int, source: str, category: str) -> dict[str, Any] | None:
    parsed = parse_message(raw_message)
    if parsed is None:
        return None
    subject, body = parsed
    if source == "nazario" and subject.upper().startswith(
        "DON'T DELETE THIS MESSAGE -- FOLDER INTERNAL DATA"
    ):
        return None
    text = f"{subject}\n{body}"
    if not text.strip():
        return None
    return {
        "subject": subject,
        "body": body,
        "text": text,
        "label": label,
        "source": source,
        "category": category,
    }


def read_nazario() -> list[dict[str, Any]]:
    root = RAW_DIR / "nazario"
    rows: list[dict[str, Any]] = []
    if not root.exists():
        return rows
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() in {".json", ".html", ".htm", ".part"} or path.name.endswith(
            (".tar.bz2", ".tar.gz", ".tgz", ".zip", ".gz")
        ):
            continue
        for raw_message in iter_file_messages(path):
            row = row_from_message(raw_message, 1, "nazario", "phishing")
            if row:
                rows.append(row)
    return rows


def read_spamassassin() -> list[dict[str, Any]]:
    root = RAW_DIR / "spamassassin"
    rows: list[dict[str, Any]] = []
    if not root.exists():
        return rows
    for corpus_name in ("easy_ham", "easy_ham_2", "easy_ham2"):
        corpus_dir = root / corpus_name
        if not corpus_dir.is_dir():
            continue
        for path in sorted(corpus_dir.rglob("*")):
            if not path.is_file() or path.suffix.lower() in {".json", ".html", ".htm", ".part"} or path.name.endswith(
                (".tar.bz2", ".tar.gz", ".tgz", ".zip", ".gz")
            ):
                continue
            for raw_message in iter_file_messages(path):
                row = row_from_message(raw_message, 0, "spamassassin_ham", "ham")
                if row:
                    rows.append(row)
    return rows


def downsample_real_data(df: pd.DataFrame) -> pd.DataFrame:
    if len(df) <= 20000:
        return df
    target_size = 10000
    class_counts = df["label"].value_counts().to_dict()
    allocations = {label: min(class_counts.get(label, 0), target_size // 2) for label in (0, 1)}
    remaining = target_size - sum(allocations.values())
    for label in sorted((0, 1), key=lambda value: class_counts.get(value, 0), reverse=True):
        additional = min(remaining, class_counts.get(label, 0) - allocations[label])
        allocations[label] += additional
        remaining -= additional
    samples = [
        df[df["label"] == label].sample(n=count, random_state=42)
        for label, count in allocations.items()
        if count > 0
    ]
    logger.info("Downsampled real data from %d to approximately %d rows", len(df), sum(map(len, samples)))
    return pd.concat(samples, ignore_index=True)


def append_synthetic_minority(df: pd.DataFrame) -> pd.DataFrame:
    if not SYNTHETIC_PATH.exists() or df.empty:
        if SYNTHETIC_PATH.exists() and df.empty:
            logger.warning("Skipping synthetic rows because no real corpus rows are available.")
        return df
    synthetic = pd.read_csv(SYNTHETIC_PATH)
    if not {"subject", "body", "text", "label"}.issubset(synthetic.columns):
        logger.warning("Skipping synthetic data with unexpected columns in %s", SYNTHETIC_PATH)
        return df
    synthetic = synthetic[synthetic["label"].isin([0, 1])].copy()
    synthetic["subject"] = synthetic["subject"].fillna("").astype(str)
    synthetic["body"] = synthetic["body"].fillna("").astype(str)
    synthetic["text"] = synthetic["text"].fillna("").astype(str)
    synthetic["text"] = synthetic.apply(
        lambda row: f"{row['subject']}\n{row['body']}"
        if row["subject"] or row["body"]
        else str(row["text"] or ""),
        axis=1,
    )
    synthetic = synthetic[synthetic["text"].str.strip().ne("")]
    selected: list[pd.DataFrame] = []
    for label in (0, 1):
        real_label_count = int((df["label"] == label).sum())
        allowed = min(len(synthetic[synthetic["label"] == label]), int(real_label_count * 0.1))
        if allowed:
            sample = synthetic[synthetic["label"] == label].sample(n=allowed, random_state=42).copy()
            sample["label"] = label
            sample["source"] = "synthetic_v2"
            sample["category"] = "ham" if label == 0 else "phishing"
            selected.append(sample[OUTPUT_COLUMNS])
    if not selected:
        logger.info("No synthetic rows selected; source remains a minority.")
        return df
    combined = pd.concat([df, *selected], ignore_index=True)
    logger.info(
        "Added %d optional synthetic rows (%0.1f%% of dataset).",
        len(combined) - len(df),
        100 * (len(combined) - len(df)) / len(combined),
    )
    return combined


def build_csv() -> pd.DataFrame:
    READ_ERRORS.clear()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    real_rows = read_nazario() + read_spamassassin()
    real_df = pd.DataFrame(real_rows, columns=OUTPUT_COLUMNS)
    if not real_df.empty:
        real_df = real_df.dropna(subset=["text"])
        real_df = real_df[real_df["text"].astype(str).str.strip().ne("")]
        real_df = real_df.drop_duplicates(subset=["text"])
        real_df = downsample_real_data(real_df)
    df = append_synthetic_minority(real_df)
    if not df.empty:
        df = df.dropna(subset=["text"])
        df = df[df["text"].astype(str).str.strip().ne("")]
        df = df.drop_duplicates(subset=["text"])
        df["label"] = df["label"].astype(int)
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    else:
        df = pd.DataFrame(columns=OUTPUT_COLUMNS)
    df[OUTPUT_COLUMNS].to_csv(OUTPUT_PATH, index=False, quoting=csv.QUOTE_MINIMAL)
    BUILD_STATUS_PATH.write_text(
        json.dumps({"unreadable_files": READ_ERRORS}, indent=2),
        encoding="utf-8",
    )
    print(f"Dataset written: {OUTPUT_PATH}")
    print(f"Total rows: {len(df)}")
    print("Class counts (label=1 phishing, label=0 ham):")
    print(df["label"].value_counts().sort_index().to_string() if len(df) else "(none)")
    print("Per-source counts:")
    print(df.groupby(["source", "label"]).size().to_string() if len(df) else "(none)")
    if len(df):
        synthetic_share = float((df["source"] == "synthetic_v2").mean())
        if synthetic_share > 0.2:
            raise ValueError(f"Synthetic share {synthetic_share:.1%} exceeds the 20% limit.")
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    build_csv()
