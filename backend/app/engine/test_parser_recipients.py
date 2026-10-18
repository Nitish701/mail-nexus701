import unittest
from app.engine.parser import parse_mime, ParsedEmail

class TestParserRecipients(unittest.TestCase):
    def test_multiple_recipients(self):
        raw = (
            b"From: sender@example.com\n"
            b"To: to1@example.com, to2@example.com\n"
            b"Cc: cc1@example.com, cc2@example.com\n"
            b"Bcc: bcc1@example.com, bcc2@example.com\n"
            b"Subject: Test\n\n"
            b"Body"
        )
        parsed = parse_mime(raw)
        self.assertEqual(parsed.to_addresses, ["to1@example.com", "to2@example.com"])
        self.assertEqual(parsed.cc_addresses, ["cc1@example.com", "cc2@example.com"])
        self.assertEqual(parsed.bcc_addresses, ["bcc1@example.com", "bcc2@example.com"])

    def test_missing_headers(self):
        raw = (
            b"From: sender@example.com\n"
            b"To: to1@example.com\n"
            b"Subject: Test\n\n"
            b"Body"
        )
        parsed = parse_mime(raw)
        self.assertEqual(parsed.to_addresses, ["to1@example.com"])
        self.assertEqual(parsed.cc_addresses, [])
        self.assertEqual(parsed.bcc_addresses, [])

    def test_duplicate_addresses(self):
        raw = (
            b"From: sender@example.com\n"
            b"To: to1@example.com\n"
            b"Cc: cc1@example.com, cc1@example.com, cc2@example.com\n"
            b"Bcc: bcc1@example.com, bcc1@example.com\n"
            b"Subject: Test\n\n"
            b"Body"
        )
        parsed = parse_mime(raw)
        self.assertEqual(parsed.cc_addresses, ["cc1@example.com", "cc2@example.com"])
        self.assertEqual(parsed.bcc_addresses, ["bcc1@example.com"])

    def test_malformed_headers(self):
        raw = (
            b"From: sender@example.com\n"
            b"To: valid@example.com, not-an-email, <invalid>\n"
            b"Cc: <cc1@example.com>, malformed\n"
            b"Bcc: bcc1@example.com, , bcc2@example.com\n"
            b"Subject: Test\n\n"
            b"Body"
        )
        parsed = parse_mime(raw)
        # getaddresses usually extracts the email part if possible or ignores
        self.assertIn("valid@example.com", parsed.to_addresses)
        self.assertIn("cc1@example.com", parsed.cc_addresses)
        self.assertIn("bcc1@example.com", parsed.bcc_addresses)
        self.assertIn("bcc2@example.com", parsed.bcc_addresses)

    def test_to_parsing_unchanged(self):
        # Verify that To addresses are NOT deduplicated as per constraints
        raw = (
            b"From: sender@example.com\n"
            b"To: to1@example.com, to1@example.com\n"
            b"Subject: Test\n\n"
            b"Body"
        )
        parsed = parse_mime(raw)
        self.assertEqual(parsed.to_addresses, ["to1@example.com", "to1@example.com"])

    def test_forwarded_for_header_extracts_public_ip(self):
        raw = (
            b"From: sender@example.com\n"
            b"To: recipient@example.com\n"
            b"X-Forwarded-For: 192.168.1.2, 8.8.8.8\n"
            b"Subject: Test\n\n"
            b"Body"
        )
        parsed = parse_mime(raw)
        self.assertEqual(parsed.source_ip, "8.8.8.8")
        self.assertEqual(parsed.private_relay_ips, ["192.168.1.2"])

if __name__ == "__main__":
    unittest.main()
