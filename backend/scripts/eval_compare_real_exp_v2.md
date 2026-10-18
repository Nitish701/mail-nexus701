# Real-Corpus Experimental Model Evaluation (v2)

## Sources and acquisition

- Nazario phishing corpus: available; only parsed email messages are labeled phishing.
- SpamAssassin `easy_ham` / `easy_ham_2`: available; ham packages only are labeled legitimate.
- Enron: not attempted; no confidently verified local AUEB ham-only layout was available.
- Optional `synthetic_v2` rows are kept at or below 20% of the final dataset and are included only when real corpus rows exist.
- Validation and test are real-corpus-only; optional synthetic examples are added to training only.

### Download failures or skips

- No failed download was recorded.
- `C:\Users\Nitis\Downloads\mail nexus\Mail-nexus\backend\data\raw\nazario\phishing3.mbox` was reported downloaded but was unavailable during report generation.
- Could not parse `C:\Users\Nitis\Downloads\mail nexus\Mail-nexus\backend\data\raw\nazario\phishing3.mbox`: OSError: [Errno 22] Invalid argument: 'C:\\Users\\Nitis\\Downloads\\mail nexus\\Mail-nexus\\backend\\data\\raw\\nazario\\phishing3.mbox'.
- Could not parse `C:\Users\Nitis\Downloads\mail nexus\Mail-nexus\backend\data\raw\nazario\private-phishing4.mbox`: OSError: [Errno 22] Invalid argument: 'C:\\Users\\Nitis\\Downloads\\mail nexus\\Mail-nexus\\backend\\data\\raw\\nazario\\private-phishing4.mbox'.

## Dataset summary

- Dataset rows: 5735
- Held-out test rows: 825
- Held-out source counts:
- `spamassassin_ham`: 580
- `nazario`: 245

### Counts by source and label

- `nazario` / label=1 (phishing): 1634
- `spamassassin_ham` / label=0 (ham): 3861
- `synthetic_v2` / label=0 (ham): 120
- `synthetic_v2` / label=1 (phishing): 120

### Counts by label

- label=0 (ham): 3981
- label=1 (phishing): 1754

## Held-out metrics

Positive class is phishing (`label=1`); negative class is legitimate ham (`label=0`).
Confusion matrix order: TN / FP / FN / TP.

| Model | Accuracy | Precision | Recall | F1 | TN / FP / FN / TP |
|---|---:|---:|---:|---:|---:|
| Production | 0.959 | 0.973 | 0.886 | 0.927 | 574 / 6 / 28 / 217 |
| Experimental v2 real | 0.982 | 1.000 | 0.939 | 0.968 | 580 / 0 / 15 / 230 |
| Experimental v1 | 0.899 | 0.807 | 0.869 | 0.837 | 529 / 51 / 32 / 213 |

## Recommendation

**REPLACE production is supported by this holdout: experimental v2 real improves both F1 and recall, and precision remains at least max(0.50, production precision minus 10 percentage points). Complete operational validation before deployment.**

The classic corpora used here are older and do not provide full AI-era phishing coverage. A successful offline holdout comparison is not, by itself, sufficient evidence for immediate deployment.
