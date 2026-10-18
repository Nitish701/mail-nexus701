import argparse
import csv
import json
from pathlib import Path
from typing import Any

import joblib
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score

def get_model_probability(model: Any, text: str) -> float:
    if hasattr(model, "predict_proba"):
        classes = list(getattr(model, "classes_", []))
        if 1 not in classes:
            raise ValueError(f"Model classes must include phishing class 1; found {classes}")
        probability = float(model.predict_proba([text])[0][classes.index(1)])
    else:
        prediction = int(model.predict([text])[0])
        if prediction not in {0, 1}:
            raise ValueError(f"Model returned invalid binary prediction: {prediction}")
        probability = float(prediction)
    return max(0.0, min(probability, 1.0))

def evaluate_model(
    model_path: Path,
    data_csv: Path,
    text_col: str,
    label_col: str,
    threshold: float
) -> dict[str, Any]:
    if not data_csv.exists():
        raise FileNotFoundError(f"Dataset file not found: {data_csv}")

    # Load and validate data
    texts = []
    labels = []

    with data_csv.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or text_col not in reader.fieldnames or label_col not in reader.fieldnames:
            raise ValueError(f"CSV must contain columns: {text_col}, {label_col}")

        for row in reader:
            try:
                label = int(row[label_col])
                if label not in {0, 1}:
                    raise ValueError(f"Invalid label {label}; must be 0 or 1")
                texts.append(row[text_col])
                labels.append(label)
            except (ValueError, TypeError) as e:
                raise ValueError(f"Invalid data in row: {e}")

    if not texts:
        raise ValueError("Dataset is empty")

    # Load model
    model = joblib.load(model_path.resolve())

    # Inference
    probabilities = [get_model_probability(model, t) for t in texts]
    predictions = [1 if p >= threshold else 0 for p in probabilities]

    # Metrics
    acc = accuracy_score(labels, predictions)
    prec = precision_score(labels, predictions, zero_division=0)
    rec = recall_score(labels, predictions, zero_division=0)
    f1 = f1_score(labels, predictions, zero_division=0)
    cm = confusion_matrix(labels, predictions, labels=[0, 1])

    return {
        "model_path": str(model_path.resolve()),
        "dataset": str(data_csv.resolve()),
        "threshold": threshold,
        "samples": len(labels),
        "metrics": {
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1_score": float(f1),
        },
        "confusion_matrix": {
            "tn": int(cm[0, 0]),
            "fp": int(cm[0, 1]),
            "fn": int(cm[1, 0]),
            "tp": int(cm[1, 1]),
        }
    }

def write_markdown_summary(results: dict[str, Any], output_path: Path):
    metrics = results["metrics"]
    cm = results["confusion_matrix"]

    summary = f"""# BodyTextModel Evaluation Summary

| Metric | Value |
|---|---|
| Accuracy | {metrics['accuracy']:.2%} |
| Precision | {metrics['precision']:.2%} |
| Recall | {metrics['recall']:.2%} |
| F1-Score | {metrics['f1_score']:.2%} |

**Confusion Matrix:**
- True Negatives: {cm['tn']}
- False Positives: {cm['fp']}
- False Negatives: {cm['fn']}
- True Positives: {cm['tp']}

**Model:** `{results['model_path']}`
**Dataset:** `{results['dataset']}`
**Threshold:** {results['threshold']}

> Real phishing evaluation requires IWSPA-AP or Nazario+clean-ham, not spam corpora.
"""
    summary_path = output_path.with_suffix(".md")
    summary_path.write_text(summary, encoding="utf-8")
    return summary_path

def main():
    parser = argparse.ArgumentParser(description="Evaluate the BodyTextModel against a labeled CSV.")
    parser.add_argument("--model-path", type=Path, required=True, help="Path to .joblib model")
    parser.add_argument("--data-csv", type=Path, required=True, help="Path to labeled CSV dataset")
    parser.add_argument("--text-col", type=str, default="text", help="Column name for email text")
    parser.add_argument("--label-col", type=str, default="label", help="Column name for binary labels")
    parser.add_argument("--report-out", type=Path, default=Path("evaluation_report.json"), help="Path to output JSON report")
    parser.add_argument("--threshold", type=float, default=0.5, help="Decision threshold for phishing")

    args = parser.parse_args()

    results = evaluate_model(
        args.model_path,
        args.data_csv,
        args.text_col,
        args.label_col,
        args.threshold
    )

    args.report_out.parent.mkdir(parents=True, exist_ok=True)
    with args.report_out.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    summary_file = write_markdown_summary(results, args.report_out)
    print("Evaluation complete.")
    print(f"JSON report: {args.report_out}")
    print(f"Markdown summary: {summary_file}")

if __name__ == "__main__":
    main()
