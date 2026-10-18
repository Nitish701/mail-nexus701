from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
CSV_PATH = PROCESSED_DIR / "phishing_legit_real_v1.csv"
HOLDOUT_PATH = PROCESSED_DIR / "real_holdout_test.csv"
MODEL_PATH = BACKEND_DIR / "models" / "body_model_exp_v2_real.joblib"


def train_real_exp_model() -> dict[str, int | float]:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    required = {"text", "label"}
    if not required.issubset(df.columns):
        raise ValueError(f"Dataset must contain columns: {', '.join(sorted(required))}")
    df = df.dropna(subset=["text", "label"]).copy()
    df["text"] = df["text"].astype(str)
    df = df[df["text"].str.strip().ne("")]
    labels = pd.to_numeric(df["label"], errors="raise")
    if not labels.isin([0, 1]).all():
        raise ValueError("Training labels must be binary: 0=ham and 1=phishing.")
    df["label"] = labels.astype(int)
    if set(df["label"].unique()) != {0, 1}:
        raise ValueError("Training data must contain both label=0 ham and label=1 phishing.")
    if "source" in df.columns:
        synthetic = df[df["source"] == "synthetic_v2"]
        real_data = df[df["source"] != "synthetic_v2"]
    else:
        synthetic = df.iloc[0:0]
        real_data = df
    if set(real_data["label"].unique()) != {0, 1}:
        raise ValueError("The real-only split requires both Nazario phishing and legitimate ham rows.")
    counts = real_data["label"].value_counts()
    if (counts < 7).any():
        raise ValueError(
            "At least 7 examples per class are required for stratified 70/15/15 splits; "
            f"found {counts.to_dict()}."
        )

    train_validation, test = train_test_split(
        real_data, test_size=0.15, random_state=42, stratify=real_data["label"]
    )
    train, validation = train_test_split(
        train_validation,
        test_size=0.15 / 0.85,
        random_state=42,
        stratify=train_validation["label"],
    )
    if not synthetic.empty:
        train = pd.concat([train, synthetic], ignore_index=True).sample(
            frac=1, random_state=42
        ).reset_index(drop=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    HOLDOUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    test.to_csv(HOLDOUT_PATH, index=False)

    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=30000),
            ),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ]
    )
    pipeline.fit(train["text"], train["label"])
    validation_accuracy = float(pipeline.score(validation["text"], validation["label"]))
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)

    summary: dict[str, int | float] = {
        "total": int(len(df)),
        "train": int(len(train)),
        "validation": int(len(validation)),
        "test": int(len(test)),
        "train_phishing": int((train["label"] == 1).sum()),
        "train_ham": int((train["label"] == 0).sum()),
        "validation_accuracy": validation_accuracy,
    }
    print(
        f"Real-only split sizes: train={len(train) - len(synthetic)}, "
        f"validation={len(validation)}, test={len(test)}"
    )
    print(f"Training rows including optional synthetic minority: {len(train)}")
    print("Validation and held-out test contain no synthetic rows.")
    print(f"Validation accuracy: {validation_accuracy:.4f}")
    print(f"Holdout test saved: {HOLDOUT_PATH}")
    print(f"Experimental model saved: {MODEL_PATH}")
    print("Production model was not modified.")
    return summary


if __name__ == "__main__":
    result = train_real_exp_model()
    print(f"Training summary: {result}")
