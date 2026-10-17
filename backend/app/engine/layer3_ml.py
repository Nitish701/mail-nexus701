from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path
from threading import Lock
from typing import Any
import re

logger = logging.getLogger(__name__)


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
		self.model_artifact_name: str | None = None
		self._lock = Lock()

	def _load(self) -> Any:
		if self._model is not None or self._load_error is not None:
			return self._model
		with self._lock:
			if self._model is not None or self._load_error is not None:
				return self._model
			try:
				import joblib
				from .. import config

				mode = config.BODY_MODEL_MODE
				candidates: list[Path]
				if mode == "experimental":
					candidates = [self.model_path.parent / "body_model_exp_v2_real.joblib"]
				elif mode == "production":
					candidates = [self.model_path, self.model_path.parent / "body_model.backup.joblib"]
				elif mode == "auto":
					candidates = [
						self.model_path.parent / "body_model_exp_v2_real.joblib",
						self.model_path,
						self.model_path.parent / "body_model.backup.joblib",
					]
				else:
					raise ValueError(
						"MAIL_NEXUS_BODY_MODEL_MODE must be auto, experimental, or production"
					)

				loaded_model = None
				actual_path: Path | None = None

				for path in candidates:
					if path.exists():
						try:
							loaded_model = joblib.load(path)
							actual_path = path
							break
						except Exception as error:
							logger.warning("Failed to load model from %s: %s", path, error)

				if loaded_model is None:
					raise RuntimeError("No usable body text ML model found in candidates")

				self._model = loaded_model
				self.model_artifact_name = actual_path.name
				logger.info("BodyTextModel loaded artifact: %s", self.model_artifact_name)

			except Exception as error:
				self._load_error = str(error)
				logger.error("BodyTextModel could not load an artifact: %s", error)
		return self._model

	def score(self, body_text: str) -> MLResult:
		model = self._load()
		if model is None:
			return self._fallback_score(body_text)

		try:
			if hasattr(model, "predict_proba"):
				classes = list(getattr(model, "classes_", []))
				if 1 not in classes:
					raise ValueError(f"Model classes do not contain phishing class 1: {classes}")
				probability = float(model.predict_proba([body_text])[0][classes.index(1)])
			else:
				probability = float(model.predict([body_text])[0])
			probability = max(0.0, min(probability, 1.0))
			return MLResult("pass" if probability < 0.5 else "suspicious", round(probability * 30), probability, "Body text scored by ML model")
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
			"Body text model unavailable; lexical fallback used",
		)
