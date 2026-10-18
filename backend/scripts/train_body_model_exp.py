import pandas as pd
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import json

def train_experimental_model():
    # Paths
    data_dir = Path("Mail-nexus/backend/data")
    models_dir = Path("Mail-nexus/backend/models")
    scripts_dir = Path("Mail-nexus/backend/scripts")

    v1_path = data_dir / "synthetic_phishing_v1.csv"
    v2_path = data_dir / "synthetic_phishing_v2.csv"
    holdout_path = data_dir / "synthetic_holdout_test.csv"
    exp_model_path = models_dir / "body_model_exp_v1.joblib"

    print("Loading datasets...")
    df1 = pd.read_csv(v1_path)
    df2 = pd.read_csv(v2_path)
    df = pd.concat([df1, df2], ignore_index=True)

    print(f"Initial dataset size: {len(df)}")

    # Preprocessing
    # Drop empty text or invalid labels
    df = df.dropna(subset=['text', 'label'])
    df = df[df['label'].isin([0, 1])]

    # Drop exact duplicate text rows to prevent leakage
    df = df.drop_duplicates(subset=['text'])

    print(f"Dataset size after cleaning: {len(df)}")

    # Stratified split: 80% train / 20% test
    X = df['text']
    y = df['label']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"Split counts:")
    print(f"  Total: {len(df)}")
    print(f"  Train: {len(X_train)} (Pos: {sum(y_train)}, Neg: {len(y_train)-sum(y_train)})")
    print(f"  Test:  {len(X_test)} (Pos: {sum(y_test)}, Neg: {len(y_test)-sum(y_test)})")

    # Save holdout set for evaluation
    holdout_df = pd.DataFrame({'text': X_test, 'label': y_test})
    holdout_df.to_csv(holdout_path, index=False)
    print(f"Holdout set saved to {holdout_path}")

    # Model Pipeline
    # matching the requested baseline/production style
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=20000)),
        ('clf', LogisticRegression(max_iter=2000, class_weight='balanced'))
    ])

    print("Training experimental model...")
    pipeline.fit(X_train, y_train)

    # Save experimental artifact
    joblib.dump(pipeline, exp_model_path)
    print(f"Experimental model saved to {exp_model_path}")

    return {
        "total": len(df),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "pos_train": int(sum(y_train)),
        "neg_train": int(len(y_train)-sum(y_train)),
        "pos_test": int(sum(y_test)),
        "neg_test": int(len(y_test)-sum(y_test)),
    }

if __name__ == "__main__":
    results = train_experimental_model()
    print("\nTraining Summary:")
    print(json.dumps(results, indent=2))
