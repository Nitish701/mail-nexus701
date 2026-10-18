import unittest

from app.fingerprint.pii_sanitizer import redact_sensitive_message
from app.services.llm_summarizer import (
	AdvisoryResult,
	_fallback_advisory,
	_explanation_basis,
	_parse_advisory_response,
	_safe_evidence,
	enforce_risk_disposition,
)
from app.services.report_generator import build_email_report


class EnforceRiskDispositionTests(unittest.TestCase):
	def test_review_overrides_advisory_and_disallows_auto_quarantine(self) -> None:
		advisory = AdvisoryResult("high", "Quarantine now", ["Quarantine"])

		result = enforce_risk_disposition(advisory, "review", 13, 0.992)

		self.assertEqual(result.status, "review")
		self.assertIn("independent signals", result.summary)
		self.assertIn("Do not quarantine solely on the ML score", result.recommended_actions)

	def test_advisory_cannot_elevate_a_low_combined_score(self) -> None:
		advisory = AdvisoryResult("high", "High risk", ["Quarantine"])

		result = enforce_risk_disposition(advisory, "low", 13, 0.2)

		self.assertEqual(result.status, "low")
		self.assertIn("deterministic scoring policy", result.summary)
		self.assertEqual(result.recommended_actions, ["Allow delivery with monitoring"])

	def test_review_disposition_is_preserved_in_saved_report(self) -> None:
		report = build_email_report(
			{
				"base_score": 13,
				"risk_disposition": "review",
				"threat_advisory": {
					"status": "review",
					"detailed_report": "System decision: REVIEW. Review the supplied evidence.",
				},
			},
			"RPT-test",
		)

		self.assertEqual(report["severity"], "review")
		self.assertEqual(report["risk"]["severity"], "review")
		self.assertEqual(report["risk"]["score_band"], "low")
		self.assertEqual(report["risk"]["status"], "review")
		self.assertEqual(report["risk"]["disposition"], "review")
		self.assertIn("System decision: REVIEW", report["advisory"]["detailed_report"])

	def test_detailed_fallback_explains_evidence_for_nontechnical_reader(self) -> None:
		result = _fallback_advisory(
			13,
			["ML body signal was high"],
			{
				"authentication": {"spf": {"status": "pass", "reason": "SPF passed"}},
				"message": {
					"subject": "Verify account",
					"sender_domain": "example.com",
					"urls": ["https://example.com/login?token=secret"],
					"attachments": [{"filename": "invoice.pdf", "content_type": "application/pdf", "size_bytes": 42}],
				},
				"layers": {
					"ml": {"score": 30, "probability": 0.91, "reason": "Body scored by model"},
					"infrastructure": {"suspicious": False, "country": "US"},
				},
			},
		)

		self.assertIn("Message overview", result.detailed_report)
		self.assertIn("What the checks found", result.detailed_report)
		self.assertIn("Why this decision", result.detailed_report)
		self.assertIn("Uncertainty", result.detailed_report)
		self.assertIn("Recommended next steps", result.detailed_report)
		self.assertIn("SPF passed", result.detailed_report)
		self.assertIn("https://example.com/login", result.detailed_report)
		self.assertIn("invoice.pdf", result.detailed_report)
		self.assertIn("model signal 0.91 (not calibrated)", result.detailed_report)
		self.assertIn("no suspicious indicator reported; country US", result.detailed_report)
		self.assertEqual(result.ai_status, "pending")

	def test_ai_context_redacts_otp_pii_and_secret_url_parameters(self) -> None:
		raw = (
			"Google verification code is 123456. "
			"Password is Sample-Secret-007. Contact me at user@example.com"
		)
		context = _safe_evidence(
			{"message": {"url": "https://example.com/login?token=abc123"}},
			raw,
		)

		self.assertNotIn("123456", context["email_body_redacted"])
		self.assertNotIn("user@example.com", context["email_body_redacted"])
		self.assertNotIn("Sample-Secret-007", context["email_body_redacted"])
		self.assertNotIn("abc123", context["message"]["url"])
		self.assertIn("[REDACTED_CODE]", context["email_body_redacted"])

	def test_ai_explanation_cannot_replace_or_change_deterministic_report(self) -> None:
		fallback = _fallback_advisory(
			34,
			["Unusual urgent request"],
			{
				"authentication": {"spf": {"status": "pass", "reason": "SPF passed"}},
				"final_system_decision": {"disposition": "medium"},
			},
		)

		result = _parse_advisory_response(
			{"explanation": "This message needs a closer look before you decide whether to trust it."},
			fallback,
		)

		self.assertEqual(result.summary, fallback.summary)
		self.assertEqual(result.recommended_actions, fallback.recommended_actions)
		self.assertIn("Plain-language explanation", result.detailed_report)
		self.assertIn("Verified scan evidence and recommended next steps", result.detailed_report)
		self.assertIn("SPF passed", result.detailed_report)
		self.assertIn("34/70", result.detailed_report)
		self.assertEqual(result.ai_status, "complete")

	def test_ai_explanation_is_rejected_when_invalid_or_too_long(self) -> None:
		fallback = _fallback_advisory(13, [])

		with self.assertRaisesRegex(ValueError, "outside the allowed length"):
			_parse_advisory_response({"explanation": "Safe."}, fallback)

		with self.assertRaisesRegex(ValueError, "outside the allowed length"):
			_parse_advisory_response({"explanation": "x" * 401}, fallback)

	def test_ai_receives_only_fixed_disposition_basis(self) -> None:
		basis = _explanation_basis("medium", 34)

		self.assertIn("medium", basis)
		self.assertIn("34/70", basis)
		self.assertNotIn("sender", basis)
		self.assertNotIn("email body", basis)

	def test_reviewer_disposition_is_used_in_deterministic_fallback(self) -> None:
		result = _fallback_advisory(
			13,
			[],
			{"final_system_decision": {"disposition": "review"}},
		)

		self.assertEqual(result.status, "review")

	def test_redactor_masks_labeled_and_standalone_codes(self) -> None:
		result = redact_sensitive_message("Code: 123456 and login pin 4321")

		self.assertNotIn("123456", result.text)
		self.assertIn("[REDACTED_CODE]", result.text)


if __name__ == "__main__":
	unittest.main()
