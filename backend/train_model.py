"""Train backend/models/body_model.joblib from a labeled CSV.

CSV columns: text,label where label is 0 for legitimate and 1 for phishing.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline


def _classifier():
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
			n_jobs=4,
		)
	except ImportError:
		from sklearn.linear_model import LogisticRegression

		return LogisticRegression(max_iter=1000, class_weight="balanced")


def train(dataset_path: Path, output_path: Path) -> None:
	csv.field_size_limit(10 * 1024 * 1024)
	texts: list[str] = []
	labels: list[int] = []
	with dataset_path.open(newline="", encoding="utf-8") as dataset:
		for row in csv.DictReader(dataset):
			texts.append(row["text"])
			labels.append(int(row["label"]))
	if len(set(labels)) < 2:
		raise ValueError("Dataset must contain both label 0 and label 1")

	model = Pipeline([
		("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=1, max_features=50000)),
		("classifier", _classifier()),
	])
	model.fit(texts, labels)
	output_path.parent.mkdir(parents=True, exist_ok=True)
	joblib.dump(model, output_path)
	print(f"Saved model to {output_path}")


if __name__ == "__main__":
	parser = argparse.ArgumentParser()
	parser.add_argument("dataset", type=Path, help="CSV file with text,label columns")
	parser.add_argument("--output", type=Path, default=Path("models/body_model.joblib"))
	args = parser.parse_args()
	train(args.dataset, args.output)