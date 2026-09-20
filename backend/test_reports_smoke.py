"""Smoke test for the report-generation feature (no network required)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

RAW_EMAIL = (
	b"From: attacker@evil.example\r\n"
	b"To: victim@victim.example\r\n"
	b"Return-Path: <bounce@other.example>\r\n"
	b"Subject: URGENT verify your account\r\n"
	b"Message-ID: <smoke-test-1@evil.example>\r\n"
	b"Authentication-Results: mx; spf=fail; dkim=none\r\n"
	b"Content-Type: text/plain; charset=utf-8\r\n"
	b"\r\n"
	b"Please verify your account password immediately and wire transfer bitcoin.\r\n"
	b"Visit http://192.168.1.5/login and download invoice.exe\r\n"
)


def main() -> None:
	response = client.post(
		"/api/v1/inbound",
		content=RAW_EMAIL,
		headers={"Content-Type": "message/rfc822"},
	)
	assert response.status_code == 200, response.text
	body = response.json()
	report_id = body.get("report_id")
	assert report_id, "report_id missing from scan response"
	assert body["base_score"] > 0
	print("scan ok, report_id =", report_id, "score =", body["base_score"])

	# list
	listed = client.get("/api/reports")
	assert listed.status_code == 200, listed.text
	assert any(r["report_id"] == report_id for r in listed.json()["reports"])
	print("list ok")

	# fetch
	one = client.get(f"/api/reports/{report_id}")
	assert one.status_code == 200, one.text
	assert one.json()["report_type"] == "email"
	print("get ok, findings =", len(one.json()["findings"]))

	# download each format
	for fmt in ("json", "csv", "md", "html"):
		download = client.get(f"/api/reports/{report_id}/download", params={"format": fmt})
		assert download.status_code == 200, (fmt, download.text)
		assert download.content, f"empty {fmt}"
		disposition = download.headers.get("content-disposition", "")
		assert "attachment" in disposition
		print(f"download {fmt} ok ({len(download.content)} bytes)")

	# campaign report for a missing campaign -> 404
	missing = client.post("/api/reports/campaign/CMP-does-not-exist")
	assert missing.status_code == 404, missing.text
	print("campaign 404 ok")

	print("ALL SMOKE TESTS PASSED")


if __name__ == "__main__":
	main()