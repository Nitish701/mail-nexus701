# ML Evaluation Scripts

This directory contains utilities for evaluating the Machine Learning models used in the Mail-Nexus backend.

## BodyTextModel Evaluation

The `evaluate_body_model.py` script allows you to test the `body_model.joblib` against a labeled dataset of legitimate and phishing emails.

### Usage

```bash
python Mail-nexus/backend/scripts/evaluate_body_model.py \
    --model-path Mail-nexus/backend/models/body_model.joblib \
    --data-csv Mail-nexus/backend/tests/fixtures/ml_smoke_phishing_legit.csv \
    --report-out Mail-nexus/backend/scripts/eval_report.json
```

### Arguments

- `--model-path`: Path to the `.joblib` model file.
- `--data-csv`: Path to the CSV file containing labeled data.
- `--text-col`: The name of the column containing the email text (default: `text`).
- `--label-col`: The name of the column containing the binary labels (default: `label`).
- `--report-out`: Path where the JSON evaluation report will be saved.
- `--threshold`: Probability threshold for classifying an email as phishing (default: `0.5`).

### Reporting

The script generates two files:
1. **JSON Report**: A detailed machine-readable report containing all metrics.
2. **Markdown Summary**: A human-readable summary beside the JSON report, using the same file stem.

## Real-corpus Layer 3 experiment

Run the complete optional-data workflow from any working directory:

```bash
python Mail-nexus/backend/scripts/run_real_ml_pipeline.py
```

The runner attempts to fetch the Nazario phishing corpus and SpamAssassin `easy_ham` and `easy_ham_2` only. It then builds `backend/data/processed/phishing_legit_real_v1.csv`, trains a stratified real-data experiment, evaluates the production and experimental artifacts on the same held-out split, and writes `eval_compare_real_exp_v2.md`.

All script paths are resolved relative to this directory. The experimental artifact is written to `backend/models/body_model_exp_v2_real.joblib`; `backend/models/body_model.joblib` is never written. Download failures are retained in `backend/data/raw/fetch_status.json` and do not prevent processing available local corpus files.
