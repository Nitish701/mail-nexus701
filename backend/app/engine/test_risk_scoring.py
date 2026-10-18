import unittest

from app.engine.risk_scoring import calculate_risk_score, classify_risk_disposition


class RiskScoringTests(unittest.TestCase):
	def setUp(self) -> None:
		self.clean_authentication = {
			"spf": {"status": "pass", "score": 0},
			"dkim": {"status": "pass", "score": 0},
			"alignment": {"status": "pass", "score": 0},
		}

	def test_ml_only_score_is_damped_and_has_no_critical_floor(self) -> None:
		self.assertEqual(calculate_risk_score({}, 0, 30, 0), 13)

	def test_strong_authentication_reduces_ml_contribution(self) -> None:
		self.assertEqual(calculate_risk_score(self.clean_authentication, 0, 30, 0), 13)
		self.assertEqual(
			calculate_risk_score(
				self.clean_authentication, 0, 30, 0, authentication_trusted=True
			),
			5,
		)

	def test_trusted_sender_requires_strong_authentication(self) -> None:
		self.assertEqual(
			calculate_risk_score(
				self.clean_authentication,
				0,
				30,
				0,
				sender_domain="alerts.github.com",
				authentication_trusted=True,
			),
			1,
		)
		self.assertEqual(
			calculate_risk_score(
				{"spf": {"status": "fail", "score": 15}},
				0,
				30,
				0,
				sender_domain="github.com",
				authentication_trusted=True,
			),
			24,
		)

	def test_missing_authentication_is_not_considered_strong(self) -> None:
		self.assertEqual(
			calculate_risk_score(
				{"spf": {"status": "pass", "score": 0}, "dkim": {"status": "pass", "score": 0}},
				0,
				30,
				0,
				sender_domain="google.com",
			),
			13,
		)

	def test_multiple_layers_raise_score_without_a_single_layer_override(self) -> None:
		self.assertLess(calculate_risk_score({}, 0, 30, 0), 50)
		self.assertEqual(calculate_risk_score({}, 40, 30, 30), 55)
		self.assertEqual(
			calculate_risk_score({"spf": {"status": "fail", "score": 35}}, 1000, 1000, 1000, True),
			70,
		)

	def test_score_is_bounded_for_negative_inputs(self) -> None:
		self.assertEqual(calculate_risk_score({}, -10, -10, -10), 0)

	def test_high_ml_probability_routes_to_review_not_low_or_high(self) -> None:
		self.assertEqual(classify_risk_disposition(13, 0.99), "review")
		self.assertEqual(classify_risk_disposition(49, 0.99), "review")
		self.assertEqual(classify_risk_disposition(50, 0.99), "high")

	def test_lower_or_missing_ml_probability_uses_combined_score(self) -> None:
		self.assertEqual(classify_risk_disposition(13, 0.97), "low")
		self.assertEqual(classify_risk_disposition(30, 0.97), "medium")
		self.assertEqual(classify_risk_disposition(30, None), "medium")

if __name__ == "__main__":
	unittest.main()
