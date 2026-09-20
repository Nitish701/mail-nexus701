"""Convert SpamAssassin public corpus archives into text,label CSV data."""

from __future__ import annotations

import argparse
import codecs
import csv
from email import policy
from email.parser import BytesParser
from pathlib import Path
import tarfile


def message_text(raw_message: bytes) -> str:
	message = BytesParser(policy=policy.default).parsebytes(raw_message)
	parts: list[str] = [str(message.get("Subject", ""))]
	for part in message.walk():
		if part.is_multipart() or part.get_content_type() not in {"text/plain", "text/html"}:
			continue
		payload = part.get_payload(decode=True)
		if payload:
			charset = part.get_content_charset() or "utf-8"
			try:
				codecs.lookup(charset)
			except LookupError:
				charset = "utf-8"
			parts.append(payload.decode(charset, errors="replace"))
	return "\n".join(part for part in parts if part).strip()


def read_archive(archive_path: Path, label: int) -> list[tuple[str, int]]:
	rows: list[tuple[str, int]] = []
	with tarfile.open(archive_path, "r:bz2") as archive:
		for member in archive.getmembers():
			if not member.isfile():
				continue
			file_object = archive.extractfile(member)
			if file_object is None:
				continue
			text = message_text(file_object.read())
			if text:
				rows.append((text, label))
	return rows


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("ham_archive", type=Path)
	parser.add_argument("spam_archive", type=Path)
	parser.add_argument("output", type=Path)
	args = parser.parse_args()
	rows = read_archive(args.ham_archive, 0) + read_archive(args.spam_archive, 1)
	args.output.parent.mkdir(parents=True, exist_ok=True)
	with args.output.open("w", newline="", encoding="utf-8") as output:
		writer = csv.writer(output)
		writer.writerow(["text", "label"])
		writer.writerows(rows)
	print(f"Wrote {len(rows)} labeled messages to {args.output}")


if __name__ == "__main__":
	main()