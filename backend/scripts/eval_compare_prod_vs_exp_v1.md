# Layer 3 Body Model Comparison: Production vs. Experimental v1

## Dataset Composition
- **Sources**: Synthetic phishing datasets v1 and v2.
- **Preprocessing**:
  - Removed empty text and invalid labels.
  - Dropped exact duplicate text rows to prevent data leakage.
- **Split**: Stratified 80% Train / 20% Test (random_state=42).
- **Holdout Set**: `backend/data/synthetic_holdout_test.csv` (72 samples).

## Metrics Comparison

| Metric | Production Model | Experimental v1 | Delta |
|---|---|---|---|
| **Accuracy** | 77.78% | 100.00% | +22.22% |
| **Precision** | 83.33% | 100.00% | +16.67% |
| **Recall** | 69.44% | 100.00% | +30.56% |
| **F1-Score** | 75.76% | 100.00% | +24.24% |

### Confusion Matrix (Holdout Set)

| Model | True Negatives | False Positives | False Negatives | True Positives |
|---|---|---|---|---|
| **Production** | 31 | 5 | 11 | 25 |
| **Experimental v1** | 36 | 0 | 0 | 36 |

## Analysis
The experimental model (`body_model_exp_v1.joblib`) significantly outperforms the production model on the synthetic holdout set, achieving perfect scores across all primary metrics. Specifically, it eliminated both false positives and false negatives that were present in the production model.

**Key Findings:**
- **Recall Improvement**: Increased from ~69% to 100%.
- **Precision Stability**: Increased from ~83% to 100%.
- **F1-Score**: Significant jump to 1.0.

## Important Note
**This evaluation was performed using synthetic data only.** Performance on synthetic datasets often overestimates real-world capabilities due to the relative simplicity and consistency of synthetic patterns compared to actual adversarial phishing emails. This is not a production-ready proof.

## Recommendation
**Replace production model ONLY if this performance is validated against a diverse, real-world dataset.**

While the experimental model is clearly superior on this specific synthetic set, replacing the production artifact based solely on synthetic results carries a high risk of overfitting. We recommend a further evaluation phase using a verified real-world corpus (e.g., IWSPA-AP) before deployment.
