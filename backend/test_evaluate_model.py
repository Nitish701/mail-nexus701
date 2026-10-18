import csv
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np

from evaluate_model import _false_positive_rate, evaluate


class _ProbabilityModel:
	def __init__(self, probabilities: list[float], classes: list[int] | None = None) -> None:
		self.classes_ = np.array(classes or [0, 1])
		self._probabilities = np.array(probabilities)

	def predict_proba(self, texts: list[str]) -> np.ndarray:
		return np.column_stack((1 - self._probabilities, self._probabilities))


class EvaluateModelTests(unittest.TestCase):
	def _write_dataset(self, directory: str, labels: list[int]) -> Path:
		dataset_path = Path(directory) / "holdout.csv"
		with dataset_path.open("w", newline="", encoding="utf-8") as output:
			writer = csv.writer(output)
			writer.writerow(["text", "label"])
			writer.writerows((f"message {index}", label) for index, label in enumerate(labels))
		return dataset_path

	def test_reports_false_positive_rate_and_resolved_model_path(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			model_path = Path(directory) / "model.joblib"
			dataset_path = self._write_dataset(directory, [0, 0, 1, 1])
			model = _ProbabilityModel([0.1, 0.8, 0.9, 0.2])

			with patch("evaluate_model.joblib.load", return_value=model) as load_model:
				result = evaluate(model_path, dataset_path)

		self.assertEqual(result["confusion_matrix"], [[1, 1], [1, 1]])
		self.assertEqual(result["false_positive_rate"], 0.5)
		self.assertEqual(result["model_path"], str(model_path.resolve()))
		load_model.assert_called_once_with(model_path.resolve())

	def test_zero_negative_denominator_returns_zero_fpr(self) -> None:
		self.assertEqual(_false_positive_rate(false_positives=0, true_negatives=0), 0.0)

	def test_rejects_class_order_inconsistent_with_runtime(self) -> None:
		with tempfile.TemporaryDirectory() as directory:
			model_path = Path(directory) / "model.joblib"
			dataset_path = self._write_dataset(directory, [0, 1])
			model = _ProbabilityModel([0.1, 0.9], classes=[1, 0])

			with patch("evaluate_model.joblib.load", return_value=model):
				with self.assertRaisesRegex(ValueError, "final probability column"):
					evaluate(model_path, dataset_path)


if __name__ == "__main__":
	unittest.main()
