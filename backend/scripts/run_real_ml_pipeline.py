from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SCRIPTS_DIR = BACKEND_DIR / "scripts"
MODELS_DIR = BACKEND_DIR / "models"
HOLDOUT_PATH = PROCESSED_DIR / "real_holdout_test.csv"
DATASET_PATH = PROCESSED_DIR / "phishing_legit_real_v1.csv"
COMPARISON_PATH = SCRIPTS_DIR / "eval_compare_real_exp_v2.md"


def run_script(script_name: str, args: list[str] | None = None) -> bool:
    script_path = SCRIPTS_DIR / script_name
    command = [sys.executable, str(script_path), *(args or [])]
    print(f"\n$ {' '.join(command)}", flush=True)
    result = subprocess.run(command, cwd=BACKEND_DIR, check=False)
    if result.returncode:
        print(f"FAILED ({result.returncode}): {script_name}", flush=True)
        return False
    return True


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Could not read {path}: {type(exc).__name__}: {exc}")
        return None
    return value if isinstance(value, dict) else None


def run_evaluations(training_succeeded: bool) -> dict[str, Path | None]:
    report_paths: dict[str, Path | None] = {
        "Production": None,
        "Experimental v2 real": None,
        "Experimental v1": None,
    }
    if not training_succeeded or not HOLDOUT_PATH.exists() or HOLDOUT_PATH.stat().st_size == 0:
        print(f"Skipping model evaluations: no usable holdout at {HOLDOUT_PATH}")
        return report_paths

    evaluator = SCRIPTS_DIR / "evaluate_body_model.py"
    models = [
        ("Production", MODELS_DIR / "body_model.joblib", "eval_report_prod_real_holdout.json"),
        (
            "Experimental v2 real",
            MODELS_DIR / "body_model_exp_v2_real.joblib",
            "eval_report_exp_v2_real_holdout.json",
        ),
        ("Experimental v1", MODELS_DIR / "body_model_exp_v1.joblib", "eval_report_exp_v1_real_holdout.json"),
    ]
    for label, model_path, report_name in models:
        if not model_path.exists():
            print(f"Skipping {label}: model not found at {model_path}")
            continue
        report_path = SCRIPTS_DIR / report_name
        succeeded = run_script(
            evaluator.name,
            [
                "--model-path",
                str(model_path),
                "--data-csv",
                str(HOLDOUT_PATH),
                "--report-out",
                str(report_path),
            ],
        )
        if succeeded and report_path.exists():
            report_paths[label] = report_path
    return report_paths


def metrics_table(report_paths: dict[str, Path | None]) -> tuple[str, dict[str, dict[str, Any]]]:
    rows: list[str] = []
    loaded: dict[str, dict[str, Any]] = {}
    for name, path in report_paths.items():
        report = load_json(path) if path else None
        if report:
            loaded[name] = report
            metrics = report.get("metrics", {})
            cm = report.get("confusion_matrix", {})
            rows.append(
                "| {name} | {acc:.3f} | {precision:.3f} | {recall:.3f} | {f1:.3f} | "
                "{tn} / {fp} / {fn} / {tp} |".format(
                    name=name,
                    acc=metrics.get("accuracy", 0),
                    precision=metrics.get("precision", 0),
                    recall=metrics.get("recall", 0),
                    f1=metrics.get("f1_score", 0),
                    tn=cm.get("tn", "N/A"),
                    fp=cm.get("fp", "N/A"),
                    fn=cm.get("fn", "N/A"),
                    tp=cm.get("tp", "N/A"),
                )
            )
        else:
            rows.append(f"| {name} | N/A | N/A | N/A | N/A | Not evaluated |")
    return "\n".join(rows), loaded


def write_comparison(
    report_paths: dict[str, Path | None],
    fetch_succeeded: bool,
    build_succeeded: bool,
    training_succeeded: bool,
) -> str:
    dataset = (
        pd.read_csv(DATASET_PATH)
        if build_succeeded and DATASET_PATH.exists()
        else pd.DataFrame()
    )
    source_counts: list[str] = []
    label_counts: list[str] = []
    if not dataset.empty and {"label", "source"}.issubset(dataset.columns):
        for (source, label), count in dataset.groupby(["source", "label"]).size().items():
            role = "phishing" if label == 1 else "ham"
            source_counts.append(f"- `{source}` / label={label} ({role}): {count}")
        label_counts = [
            f"- label={label} ({'phishing' if label == 1 else 'ham'}): {count}"
            for label, count in dataset["label"].value_counts().sort_index().items()
        ]
    else:
        source_counts.append("- No labeled source rows were available.")

    fetch_status = (
        load_json(RAW_DIR / "fetch_status.json") or {}
        if fetch_succeeded
        else {}
    )
    failed_downloads = [
        attempt
        for attempt in fetch_status.get("attempts", [])
        if attempt.get("status") in {"failed", "extract-failed", "unavailable"}
    ]
    if failed_downloads:
        failure_lines = [
            f"- `{item.get('url', 'unknown URL')}` — {item.get('error', 'unavailable')}"
            for item in failed_downloads
        ]
    else:
        failure_lines = [
            "- No failed download was recorded."
            if fetch_succeeded
            else "- Fetch did not complete; no current fetch status is available."
        ]
    missing_downloads = [
        attempt
        for attempt in fetch_status.get("attempts", [])
        if attempt.get("status") in {"downloaded", "already-present"}
        and attempt.get("path")
        and not Path(attempt["path"]).exists()
    ]
    if missing_downloads:
        failure_lines.extend(
            f"- `{item['path']}` was reported downloaded but was unavailable during report generation."
            for item in missing_downloads
        )
    build_status = load_json(PROCESSED_DIR / "real_dataset_build_status.json") or {}
    unreadable_files = build_status.get("unreadable_files", [])
    failure_lines.extend(
        f"- Could not parse `{item.get('path', 'unknown file')}`: {item.get('error', 'read failed')}."
        for item in unreadable_files
    )

    table, loaded = metrics_table(report_paths)
    prod = loaded.get("Production", {}).get("metrics", {})
    exp = loaded.get("Experimental v2 real", {}).get("metrics", {})
    if prod and exp:
        precision_floor = max(0.5, float(prod["precision"]) - 0.10)
        if (
            float(exp["f1_score"]) > float(prod["f1_score"])
            and float(exp["recall"]) > float(prod["recall"])
            and float(exp["precision"]) >= precision_floor
        ):
            recommendation = (
                "REPLACE production is supported by this holdout: experimental v2 real improves both "
                "F1 and recall, and precision remains at least max(0.50, production precision minus "
                "10 percentage points). "
                "Complete operational validation before deployment."
            )
        else:
            recommendation = (
                "KEEP production. Experimental v2 real does not satisfy the required simultaneous "
                "F1 and recall improvement without a severe precision collapse."
            )
    else:
        recommendation = (
            "KEEP production. A like-for-like real holdout comparison could not be completed because "
            "one or more required model evaluations were unavailable."
        )

    test_count = 0
    test_sources: list[str] = []
    if training_succeeded and HOLDOUT_PATH.exists() and HOLDOUT_PATH.stat().st_size:
        try:
            test_df = pd.read_csv(HOLDOUT_PATH)
            test_count = len(test_df)
            if "source" in test_df.columns:
                test_sources = [
                    f"- `{source}`: {count}"
                    for source, count in test_df["source"].value_counts().items()
                ]
        except (OSError, pd.errors.ParserError):
            pass
    report = f"""# Real-Corpus Experimental Model Evaluation (v2)

## Sources and acquisition

- Nazario phishing corpus: {'available' if fetch_status.get('nazario_available') else 'not available'}; only parsed email messages are labeled phishing.
- SpamAssassin `easy_ham` / `easy_ham_2`: {'available' if fetch_status.get('spamassassin_ham_available') else 'not available'}; ham packages only are labeled legitimate.
- Enron: not attempted; no confidently verified local AUEB ham-only layout was available.
- Optional `synthetic_v2` rows are kept at or below 20% of the final dataset and are included only when real corpus rows exist.
- Validation and test are real-corpus-only; optional synthetic examples are added to training only.

### Download failures or skips

{chr(10).join(failure_lines)}

## Dataset summary

- Dataset rows: {len(dataset)}
- Held-out test rows: {test_count}
- Held-out source counts:
{chr(10).join(test_sources) if test_sources else '- Not available.'}

### Counts by source and label

{chr(10).join(source_counts)}

### Counts by label

{chr(10).join(label_counts) if label_counts else '- Not available.'}

## Held-out metrics

Positive class is phishing (`label=1`); negative class is legitimate ham (`label=0`).
Confusion matrix order: TN / FP / FN / TP.

| Model | Accuracy | Precision | Recall | F1 | TN / FP / FN / TP |
|---|---:|---:|---:|---:|---:|
{table}

## Recommendation

**{recommendation}**

The classic corpora used here are older and do not provide full AI-era phishing coverage. A successful offline holdout comparison is not, by itself, sufficient evidence for immediate deployment.
"""
    COMPARISON_PATH.write_text(report, encoding="utf-8")
    print(f"\nComparison report: {COMPARISON_PATH}")
    print(recommendation)
    return recommendation


def main() -> int:
    print("=== Mail-Nexus Layer 3 real-corpus experiment ===")
    print("Production artifact is read-only; only the dedicated experimental model path is written.")
    fetch_ok = run_script("fetch_phishing_legit_corpora.py")
    build_ok = run_script("build_phishing_legit_csv.py")
    train_ok = run_script("train_body_model_real_exp.py") if build_ok else False
    report_paths = run_evaluations(train_ok)
    recommendation = write_comparison(report_paths, fetch_ok, build_ok, train_ok)
    summary = {
        "fetch_script_succeeded": fetch_ok,
        "build_script_succeeded": build_ok,
        "training_succeeded": train_ok,
        "evaluation_reports": {
            name: str(path) if path else None for name, path in report_paths.items()
        },
        "recommendation": recommendation,
    }
    print("\nPipeline final summary:")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
