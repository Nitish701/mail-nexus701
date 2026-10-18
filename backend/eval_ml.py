import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import confusion_matrix, classification_report, precision_score, recall_score, f1_score
from pathlib import Path
from app.config import MODEL_PATH, BODY_MODEL_MODE
from app.engine.layer3_ml import BodyTextModel

def run_eval(dataset_path):
    print(f"\n--- Evaluating Dataset: {dataset_path} ---")
    df = pd.read_csv(dataset_path)

    # Handle different schemas
    if 'text' not in df.columns and 'body' in df.columns:
        texts = df['body'].fillna("").astype(str).tolist()
    elif 'text' in df.columns:
        texts = df['text'].fillna("").astype(str).tolist()
    else:
        print("Invalid schema")
        return

    labels = df['label'].tolist()

    # Use the logic in layer3_ml to load the correct model
    model_wrapper = BodyTextModel(MODEL_PATH)
    model = model_wrapper._load()

    if model is None:
        print("Failed to load model")
        return

    print(f"Using model artifact: {model_wrapper.model_artifact_name}")

    # Predict probabilities
    # We use the same logic as in layer3_ml.py: predict_proba if available
    try:
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(texts)[:, 1]
        else:
            probs = model.predict(texts)
    except Exception as e:
        print(f"Prediction error: {e}")
        return

    # Convert probability to binary prediction (threshold 0.5 as per layer3_ml.py)
    preds = (probs >= 0.5).astype(int)

    cm = confusion_matrix(labels, preds)
    tn, fp, fn, tp = cm.ravel()

    precision = precision_score(labels, preds)
    recall = recall_score(labels, preds)
    f1 = f1_score(labels, preds)
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0

    print(f"Dataset Size: {len(labels)}")
    print(f"Label Distribution: 0={labels.count(0)}, 1={labels.count(1)}")
    print(f"Confusion Matrix:\n{cm}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall: {recall:.4f}")
    print(f"F1 Score: {f1:.4f}")
    print(f"False Positive Rate (FPR): {fpr:.4f}")
    print(f"False Negative Rate (FNR): {fnr:.4f}")
    print(f"TP: {tp}, FP: {fp}, TN: {tn}, FN: {fn}")

if __name__ == "__main__":
    run_eval("data/synthetic_holdout_test.csv")
    run_eval("data/processed/real_holdout_test.csv")
