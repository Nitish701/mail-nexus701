# Layer 3 Body Model Versioning

## Model Hierarchy
The system uses a tiered loading strategy to prefer the most advanced validated model while maintaining stability.

### Load Order (Mode: `auto`)
1. **Primary**: `body_model_exp_v2_real.joblib` (Trained on real-world phishing/ham corpora)
2. **Fallback 1**: `body_model.joblib` (Standard production model)
3. **Fallback 2**: `body_model.backup.joblib` (Safe backup of the production model)

## Configuration
Control the loading behavior via the environment variable `MAIL_NEXUS_BODY_MODEL_MODE`:

| Value | Behavior |
|---|---|
| `auto` (default) | Tries experimental v2 $\rightarrow$ production $\rightarrow$ backup. |
| `experimental` | Forces use of `body_model_exp_v2_real.joblib`. |
| `production` | Forces use of `body_model.joblib` or backup. |

## Artifacts
- **Experimental**: `backend/models/body_model_exp_v2_real.joblib`
- **Production**: `backend/models/body_model.joblib`
- **Backup**: `backend/models/body_model.backup.joblib`
