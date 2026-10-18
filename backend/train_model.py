"""Train a model from a labeled CSV without overwriting the production artifact.

CSV columns: text,label where label is 0 for legitimate and 1 for phishing.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline


def _classifier(positive_weight: float = 1.0):
	try:
		from xgboost import XGBClassifier

		return XGBClassifier(
			n_estimators=160,
			max_depth=6,
			learning_rate=0.08,
			subsample=0.85,
			colsample_bytree=0.85,
			objective="binary:logistic",
			eval_metric="logloss",
			scale_pos_weight=positive_weight,
			n_jobs=4,
		)
	except ImportError:
		from sklearn.linear_model import LogisticRegression

		return LogisticRegression(max_iter=1000, class_weight="balanced")


def train(dataset_path: Path, output_path: Path, balance_classes: bool = False) -> None:
	csv.field_size_limit(10 * 1024 * 1024)
	production_path = Path(__file__).resolve().parent / "models" / "body_model.joblib"
	if output_path.resolve() == production_path.resolve():
		raise ValueError(
			"Refusing to overwrite the production model; choose a separate experimental output path"
		)
	texts: list[str] = []
	labels: list[int] = []
	with dataset_path.open(newline="", encoding="utf-8") as dataset:
		for row in csv.DictReader(dataset):
			texts.append(row["text"])
			labels.append(int(row["label"]))
	if any(label not in (0, 1) for label in labels):
		raise ValueError("Labels must be 0 (legitimate) or 1 (phishing)")
	if len(set(labels)) < 2:
		raise ValueError("Dataset must contain both label 0 and label 1")
	negative_count = labels.count(0)
	positive_count = labels.count(1)
	positive_weight = negative_count / positive_count if balance_classes else 1.0

	model = Pipeline([
		("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=1, max_features=50000)),
		("classifier", _classifier(positive_weight)),
	])
	model.fit(texts, labels)
	output_path.parent.mkdir(parents=True, exist_ok=True)
	joblib.dump(model, output_path)
	print(
		f"Trained on {len(labels)} rows (ham={negative_count}, phishing={positive_count}); "
		f"positive-class weight={positive_weight:.3f}"
	)
	print(f"Saved model to {output_path}")


if __name__ == "__main__":
	parser = argparse.ArgumentParser()
	parser.add_argument("dataset", type=Path, help="CSV file with text,label columns")
	parser.add_argument(
		"--output",
		type=Path,
		default=Path("models/body_model_exp_dataset.joblib"),
		help="output artifact (defaults to an experimental path; production is protected)",
	)
	parser.add_argument(
		"--balance-classes",
		action="store_true",
		help="weight phishing examples by the ham-to-phishing ratio for XGBoost",
	)
	args = parser.parse_args()
	train(args.dataset, args.output, args.balance_classes)