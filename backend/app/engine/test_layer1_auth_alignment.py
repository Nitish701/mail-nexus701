import unittest

from app.engine.layer1_auth import has_trusted_authentication, validate_authentication
from app.engine.parser import parse_mime


class AuthenticationAlignmentTests(unittest.TestCase):
	def test_alignment_is_unknown_when_return_path_is_missing(self) -> None:
		email = parse_mime(
			b"From: alerts@example.com\r\n"
			b"Authentication-Results: mx; spf=pass; dkim=pass\r\n"
			b"\r\n"
			b"An ordinary message."
		)

		self.assertEqual(validate_authentication(email)["alignment"]["status"], "unknown")

	def test_trusted_authentication_requires_allowlisted_authserv_id(self) -> None:
		email = parse_mime(
			b"From: alerts@example.com\r\n"
			b"Return-Path: <alerts@example.com>\r\n"
			b"Authentication-Results: mx.example.net; spf=pass; dkim=pass\r\n"
			b"\r\n"
			b"An ordinary message."
		)

		self.assertFalse(has_trusted_authentication(email, frozenset()))
		self.assertTrue(
			has_trusted_authentication(email, frozenset({"mx.example.net"}))
		)


if __name__ == "__main__":
	unittest.main()
