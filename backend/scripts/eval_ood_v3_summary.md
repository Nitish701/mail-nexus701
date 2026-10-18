# Out-of-Distribution (OOD) Validation Summary: V3 Synthetic Set

## Goal
Validate if the experimental model (`body_model_exp_v1.joblib`) is overfit to the v1/v2 synthetic datasets by testing it against a stylistically different "Out-of-Distribution" (OOD) synthetic set (v3).

## OOD Dataset (v3) Composition
- **Size**: 100 samples (50 Legitimate, 50 Phishing).
- **Phishing Style**: Brief SMS-style, broken English, HTML-like markers, and new scenarios (package fees, tax refunds, alumni portals).
- **Legitimate Style**: Club announcements, lab safety, and campus administrative notices.
- **Uniqueness**: Guaranteed no text overlap with v1, v2, or previous holdout sets.

## Metrics Comparison (V3 OOD)

| Metric | Production Model | Experimental v1 | Delta |
|---|---|---|---|
| **Accuracy** | 60.00% | **95.00%** | +35.00% |
| **Precision** | 100.00% | 90.91% | -9.09% |
| **Recall** | 20.00% | **100.00%** | +80.00% |
| **F1-Score** | 33.33% | **95.24%** | +61.91% |

### Confusion Matrix (V3 OOD)

| Model | TN | FP | FN | TP |
|---|---|---|---|---|
| **Production** | 50 | 0 | 40 | 10 |
| **Experimental v1** | 45 | 5 | 0 | 50 |

## Comparison to Previous Results
- **Previous Synthetic Holdout (v1/v2)**: Experimental v1 scored **100%** across all metrics.
- **V3 OOD Results**: Experimental v1 scored **95%** Accuracy and **95%** F1.
- **Observation**: There is a slight dip from perfect scores, but the performance remains exceptionally high and far exceeds the production model.

## Conclusion
The experimental model does **not** appear to be severely overfit to the specific phrases of v1/v2. It successfully generalized the concept of "phishing" (links, urgency, reward/threat) across different styles (SMS, HTML-ish) and scenarios.

While the production model is highly precise on v3 (0 false positives), it has an unacceptably low recall (20%), missing 80% of the phishing attempts in this new distribution.

**Verdict**: The experimental model is robust across multiple synthetic distributions. However, since all tests have been performed on synthetic data, we still cannot claim real-world production readiness.

**Recommendation**: The experimental model is a significantly better candidate than the production model. The next and final step before considering a production replacement must be evaluation against a **verified real-world phishing corpus** (e.g., Nazario or IWSPA-AP).
