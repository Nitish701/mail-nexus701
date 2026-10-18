from __future__ import annotations

import re

from app.config import ML_REVIEW_PROBABILITY_THRESHOLD

AUTHENTICATION_MAX = 35
HEURISTICS_MAX = 40
ML_MAX = 30
STATIC_MAX = 30

# Per-layer contributions are normalized and capped at these weights.
AUTH_WEIGHT = 10
HEUR_WEIGHT = 15
ML_WEIGHT = 20
STATIC_WEIGHT = 20
INFRA_WEIGHT = 5

AUTHENTICATED_ML_FACTOR = 0.35
TRUSTED_SENDER_ML_FACTOR = 0.20
ML_ONLY_DAMPING_FACTOR = 0.65
ML_ONLY_HEURISTICS_MAX = 5
ML_ONLY_STATIC_MAX = 5

TRUSTED_SENDER_DOMAINS = frozenset({
	"google.com",
	"googlemail.com",
	"microsoft.com",
	"microsoftonline.com",
	"github.com",
})


def _strong_authentication(authentication: dict[str, dict[str, str | int]]) -> bool:
	required_checks = ("spf", "dkim", "alignment")
	return all(
		authentication.get(check, {}).get("status") == "pass"
		and int(authentication.get(check, {}).get("score", 0)) == 0
		for check in required_checks
	)


def _is_trusted_sender(sender_domain: str | None) -> bool:
	if not sender_domain:
		return False
	domain = sender_domain.strip().lower().rstrip(".")
	if not re.fullmatch(r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", domain):
		return False
	return any(
		domain == trusted_domain or domain.endswith(f".{trusted_domain}")
		for trusted_domain in TRUSTED_SENDER_DOMAINS
	)


def calculate_risk_score(
	authentication: dict[str, dict[str, str | int]],
	heuristic_score: int,
	ml_score: int,
	static_score: int,
	suspicious_infrastructure: bool = False,
	sender_domain: str | None = None,
	authentication_trusted: bool = False,
) -> int:
	"""Combine capped layer contributions into a context-aware score from 0 to 70.

	Trusted-domain and authentication discounts affect only the ML contribution.
	A sender domain is trusted only when all three authentication checks pass.
	"""
	authentication_score = sum(int(result.get("score", 0)) for result in authentication.values())
	authentication_contribution = (
		min(max(authentication_score, 0), AUTHENTICATION_MAX)
		/ AUTHENTICATION_MAX
		* AUTH_WEIGHT
	)
	heuristic_contribution = (
		min(max(heuristic_score, 0), HEURISTICS_MAX)
		/ HEURISTICS_MAX
		* HEUR_WEIGHT
	)
	ml_contribution = min(max(ml_score, 0), ML_MAX) / ML_MAX * ML_WEIGHT
	static_contribution = (
		min(max(static_score, 0), STATIC_MAX)
		/ STATIC_MAX
		* STATIC_WEIGHT
	)

	if authentication_trusted and _strong_authentication(authentication):
		ml_contribution *= AUTHENTICATED_ML_FACTOR
		if _is_trusted_sender(sender_domain):
			ml_contribution *= TRUSTED_SENDER_ML_FACTOR

	if (
		heuristic_score <= ML_ONLY_HEURISTICS_MAX
		and static_score <= ML_ONLY_STATIC_MAX
		and authentication_score == 0
		and not suspicious_infrastructure
	):
		ml_contribution *= ML_ONLY_DAMPING_FACTOR

	weighted_score = (
		authentication_contribution
		+ heuristic_contribution
		+ ml_contribution
		+ static_contribution
		+ (INFRA_WEIGHT if suspicious_infrastructure else 0)
	)
	return min(max(round(weighted_score), 0), 70)


def classify_risk_disposition(score: int, ml_probability: float | None) -> str:
	"""Keep very high ML-only confidence visible for review, not auto-high risk.

	The model probability is not currently calibrated, so the configurable
	threshold is a conservative operational guardrail pending blind-set validation.
	"""
	if ml_probability is not None and ml_probability >= ML_REVIEW_PROBABILITY_THRESHOLD:
		if score < 50:
			return "review"
	if score >= 50:
		return "high"
	if score >= 25:
		return "medium"
	return "low"