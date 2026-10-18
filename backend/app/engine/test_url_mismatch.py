import unittest
from dataclasses import dataclass
from app.engine.layer2_heuristics import scan_heuristics
from app.engine.parser import ParsedEmail

@dataclass
class MockEmail:
    subject_and_body: str = ""
    urls: list[str] = None
    html_links: list[tuple[str, str]] = None
    attachments: list = None
    # Add other necessary fields to satisfy ParsedEmail if needed
    message_id: str = None
    from_address: str = None
    from_domain: str = None
    return_path: str = None
    source_ip: str = None
    private_relay_ips: list = None
    to_addresses: list = None
    subject: str = None
    headers: dict = None

def create_email(html_links=None):
    return ParsedEmail(
        message_id="1", from_address="test@test.com", from_domain="test.com",
        return_path="test@test.com", source_ip="1.1.1.1", private_relay_ips=[],
        to_addresses=["to@test.com"], cc_addresses=[], bcc_addresses=[],
        subject="test", headers={},
        urls=[], html_links=html_links or [], attachments=[], subject_and_body="test"
    )

class TestURLMismatch(unittest.TestCase):
    def test_matching_links(self):
        email = create_email(html_links=[("google.com", "https://google.com/path")])
        findings, score = scan_heuristics(email)
        self.assertFalse(any("URL mismatch" in f for f in findings))

    def test_subdomain_matching(self):
        email = create_email(html_links=[("google.com", "https://mail.google.com")])
        findings, score = scan_heuristics(email)
        self.assertFalse(any("URL mismatch" in f for f in findings))

    def test_deceptive_mismatch(self):
        email = create_email(html_links=[("paypal.com", "https://pay-pal-security.com")])
        findings, score = scan_heuristics(email)
        self.assertTrue(any("URL mismatch" in f for f in findings))
        self.assertGreaterEqual(score, 12)

    def test_malformed_links(self):
        email = create_email(html_links=[("!!!", "not-a-url")])
        findings, score = scan_heuristics(email)
        self.assertFalse(any("URL mismatch" in f for f in findings))

    def test_no_html_links(self):
        email = create_email(html_links=[])
        findings, score = scan_heuristics(email)
        self.assertFalse(any("URL mismatch" in f for f in findings))

if __name__ == '__main__':
    unittest.main()
