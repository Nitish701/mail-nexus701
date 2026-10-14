from __future__ import annotations


AUTHENTICATION_MAX = 35
HEURISTICS_MAX = 40
ML_MAX = 30
STATIC_MAX = 30


def calculate_risk_score(
	authentication: dict[str, dict[str, str | int]],
	heuristic_score: int,
	ml_score: int,
	static_score: int,
	suspicious_infrastructure: bool = False,
) -> int:
	"""Normalize independent signals into a weighted 0-70 risk score."""
	authentication_score = sum(int(result.get("score", 0)) for result in authentication.values())
	weighted_score = (
		min(max(authentication_score, 0), AUTHENTICATION_MAX) / AUTHENTICATION_MAX * 20
		+ min(max(heuristic_score, 0), HEURISTICS_MAX) / HEURISTICS_MAX * 15
		+ min(max(ml_score, 0), ML_MAX) / ML_MAX * 15
		+ min(max(static_score, 0), STATIC_MAX) / STATIC_MAX * 15
		+ (5 if suspicious_infrastructure else 0)
	)
	return min(max(round(weighted_score), 0), 70)