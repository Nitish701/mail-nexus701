"""Evaluate a trained email model against an independent labeled CSV."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import joblib
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score


def _false_positive_rate(false_positives: int, true_negatives: int) -> float:
	negative_count = false_positives + true_negatives
	return false_positives / negative_count if negative_count else 0.0


def evaluate(model_path: Path, dataset_path: Path, threshold: float = 0.5) -> dict[str, Any]:
	if not 0 <= threshold <= 1:
		raise ValueError("Threshold must be between 0 and 1")

	csv.field_size_limit(10 * 1024 * 1024)
	with dataset_path.open(newline="", encoding="utf-8") as dataset:
		reader = csv.DictReader(dataset)
		if reader.fieldnames is None or not {"text", "label"}.issubset(reader.fieldnames):
			raise ValueError("Dataset must have text,label columns")
		rows = list(reader)

	texts = [row["text"] for row in rows]
	try:
		labels = [int(row["label"]) for row in rows]
	except (KeyError, TypeError, ValueError) as error:
		raise ValueError("Every dataset row must have a 0 or 1 label") from error
	if not texts or set(labels) != {0, 1}:
		raise ValueError("Evaluation dataset must contain both labels 0 and 1")
	if any(label not in {0, 1} for label in labels):
		raise ValueError("Labels must be 0 for legitimate and 1 for phishing")

	evaluated_model_path = model_path.resolve()
	model = joblib.load(evaluated_model_path)
	if not hasattr(model, "predict_proba"):
		raise ValueError("The trained model must support predict_proba")
	classes = list(model.classes_)
	if not classes or classes[-1] != 1:
		raise ValueError("The model's final probability column must represent phishing label 1, as in runtime scoring")
	probabilities = model.predict_proba(texts)[:, -1]
	predictions = [int(probability >= threshold) for probability in probabilities]
	matrix = confusion_matrix(labels, predictions, labels=[0, 1])
	true_negatives, false_positives = int(matrix[0, 0]), int(matrix[0, 1])
	false_positive_rate = _false_positive_rate(false_positives, true_negatives)

	return {
		"model_path": str(evaluated_model_path),
		"samples": len(labels),
		"threshold": threshold,
		"accuracy": float(accuracy_score(labels, predictions)),
		"precision": float(precision_score(labels, predictions, zero_division=0)),
		"recall": float(recall_score(labels, predictions, zero_division=0)),
		"f1": float(f1_score(labels, predictions, zero_division=0)),
		"roc_auc": float(roc_auc_score(labels, probabilities)),
		"false_positive_rate": float(false_positive_rate),
		"confusion_matrix": [[int(value) for value in row] for row in matrix.tolist()],
	}


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("dataset", type=Path, help="Independent CSV with text,label columns")
	parser.add_argument("--model", type=Path, default=Path("models/body_model.joblib"))
	parser.add_argument("--threshold", type=float, default=0.5)
	args = parser.parse_args()
	try:
		print(json.dumps(evaluate(args.model, args.dataset, args.threshold), indent=2))
	except (OSError, ValueError) as error:
		parser.error(str(error))


if __name__ == "__main__":
	main()