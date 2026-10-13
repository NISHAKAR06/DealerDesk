# Track 2: Dedicated AI & Machine Learning Django App (`backend/ml/`)

This Django application (`ml`) implements **Track 2 (AI Assistant, Demand Forecasting, and Reorder Suggestions)** strictly inside `backend/ml/`, cleanly separated from the Track 1 Django Core application (`backend/core/`).

## Structure

- **`train_model.py`**: Real `scikit-learn` machine learning training and chronological holdout evaluation pipeline.
  - Engineers 16 time-series features (`lag_1`, `lag_2`, `lag_3`, `lag_4`, `lag_8`, `lag_12`, `rolling_mean_4`, `rolling_mean_8`, `rolling_mean_12`, `rolling_std_4`, `rolling_std_12`, `ewma_03`, `sin_week`, `cos_week`, `sku_mean`, `lead_time_weeks`) on the 104-week historical demand dataset (`backend/data/sales_history.csv`) and supplier lead times (`backend/data/lead_times.csv`).
  - Evaluates `Ridge`, `GradientBoostingRegressor`, and `RandomForestRegressor` on a 4-week chronological holdout split, saves the winning serialized model to `artifacts/demand_forecaster.joblib` and metrics to `artifacts/model_metrics.json`, and outputs `forecast.csv` (160 rows = 40 SKUs $\times$ 4 future weeks: `2026-09-28` to `2026-10-19`).
- **`services/forecasting_service.py`**: Loads the trained `scikit-learn` model (`artifacts/demand_forecaster.joblib`), serves 4-week SKU demand forecasts, and computes safety stock, reorder point, and reorder quantity against live PostgreSQL `Product.stock`.
- **`services/assistant_service.py`**: Multi-step Google Gemini (`gemini-flash-lite-latest`) function-calling assistant (`search_parts`, `check_stock`, `create_draft_order`) backed strictly by live PostgreSQL data with isolated per-`session_id` conversation memory.
- **`views.py` & `urls.py`**: Exposes `POST /api/assistant/chat/`, `GET /api/forecast/<sku>/`, and `GET /api/reorder-suggestions/`.
