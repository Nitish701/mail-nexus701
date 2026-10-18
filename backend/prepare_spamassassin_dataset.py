"""Extract legitimate-only SpamAssassin messages.

SpamAssassin spam is generic spam, not a phishing label. Use
prepare_phishing_email_dataset.py to build a phishing-vs-legitimate dataset.
"""

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


def read_archive(archive_path: Path) -> list[tuple[str, int]]:
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
				rows.append((text, 0))
	return rows


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("ham_archive", type=Path, help="SpamAssassin easy_ham archive")
	parser.add_argument("output", type=Path)
	args = parser.parse_args()
	rows = read_archive(args.ham_archive)
	args.output.parent.mkdir(parents=True, exist_ok=True)
	with args.output.open("w", newline="", encoding="utf-8") as output:
		writer = csv.writer(output)
		writer.writerow(["text", "label"])
		writer.writerows(rows)
	print(
		f"Wrote {len(rows)} legitimate-only messages to {args.output}. "
		"Spam archives are intentionally not mapped to the phishing class."
	)


if __name__ == "__main__":
	main()