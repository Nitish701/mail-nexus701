from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any
import re


@dataclass
class MLResult:
	status: str
	score: int
	probability: float | None
	reason: str


class BodyTextModel:
	def __init__(self, model_path: Path):
		self.model_path = model_path
		self._model: Any = None
		self._load_error: str | None = None
		self._lock = Lock()

	def _load(self) -> Any:
		if self._model is not None or self._load_error is not None:
			return self._model
		with self._lock:
			if self._model is not None or self._load_error is not None:
				return self._model
			try:
				import joblib

				self._model = joblib.load(self.model_path)
			except Exception as error:  # Optional model; ingestion must remain available.
				self._load_error = str(error)
		return self._model

	def score(self, body_text: str) -> MLResult:
		model = self._load()
		if model is None:
			return self._fallback_score(body_text)

		try:
			if hasattr(model, "predict_proba"):
				probability = float(model.predict_proba([body_text])[0][-1])
			else:
				probability = float(model.predict([body_text])[0])
			probability = max(0.0, min(probability, 1.0))
			return MLResult("pass" if probability < 0.5 else "suspicious", round(probability * 30), probability, "Body text scored by XGBoost model")
		except Exception as error:
			return MLResult("error", 0, None, f"ML model could not score body text: {error}")

	@staticmethod
	def _fallback_score(body_text: str) -> MLResult:
		patterns = (
			r"\burgent\b",
			r"\bverify\b.{0,40}\b(account|password|login)\b",
			r"\b(reset|unlock)\b.{0,40}\b(account|password)\b",
			r"\b(gift card|wire transfer|bitcoin|crypto)\b",
		)
		matches = sum(bool(re.search(pattern, body_text, re.IGNORECASE | re.DOTALL)) for pattern in patterns)
		probability = min(matches / len(patterns), 1.0)
		return MLResult(
			"fallback",
			round(probability * 30),
			probability,
			"XGBoost model unavailable; lexical fallback used",
		)
