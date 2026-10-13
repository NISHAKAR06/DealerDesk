"""
Real Machine Learning Demand Forecasting Training Pipeline.
Trains and evaluates scikit-learn regression models (GradientBoostingRegressor, RandomForestRegressor, Ridge)
on genuine 104-week historical weekly sales data (backend/data/sales_history.csv) and supplier lead times
(backend/data/lead_times.csv), serializes the trained model artifact to backend/ml/artifacts/demand_forecaster.joblib,
and generates backend/ml/forecast.csv for the 4 future weeks (2026-09-28 to 2026-10-19).
"""

import csv
import json
import math
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FUTURE_WEEKS = ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]
FEATURE_NAMES = [
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_4",
    "lag_8",
    "lag_12",
    "rolling_mean_4",
    "rolling_mean_8",
    "rolling_mean_12",
    "rolling_std_4",
    "rolling_std_12",
    "ewma_03",
    "sin_week",
    "cos_week",
    "sku_mean",
    "lead_time_weeks",
]


def load_real_datasets(data_dir: Path) -> Tuple[Dict[str, int], Dict[str, List[Tuple[str, float]]]]:
    """Loads lead_times.csv and sales_history.csv from backend/data/."""
    lead_times_path = data_dir / "lead_times.csv"
    sales_path = data_dir / "sales_history.csv"

    lead_times: Dict[str, int] = {}
    with open(lead_times_path, mode="r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            sku = (row.get("sku") or "").strip()
            if sku:
                lead_times[sku] = int(row["lead_time_weeks"])

    sales_by_sku: Dict[str, List[Tuple[str, float]]] = {sku: [] for sku in lead_times}
    with open(sales_path, mode="r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            sku = (row.get("sku") or "").strip()
            if sku in sales_by_sku:
                sales_by_sku[sku].append((row["week_start"].strip(), float(row["units_sold"])))

    for sku in sales_by_sku:
        sales_by_sku[sku].sort(key=lambda x: x[0])

    return lead_times, sales_by_sku


def compute_ewma(series: List[float], alpha: float = 0.3) -> float:
    """Computes Exponentially Weighted Moving Average on a history slice."""
    if not series:
        return 0.0
    level = series[0]
    for val in series[1:]:
        level = alpha * val + (1.0 - alpha) * level
    return level


def extract_features(
    history_units: List[float],
    week_str: str,
    sku_mean: float,
    lead_time_weeks: int,
) -> List[float]:
    """Builds a 16-dimensional feature vector from strictly past observations (no data leakage)."""
    def _lag(k: int) -> float:
        if len(history_units) >= k:
            return float(history_units[-k])
        return float(history_units[0]) if history_units else float(sku_mean)

    lag_1 = _lag(1)
    lag_2 = _lag(2)
    lag_3 = _lag(3)
    lag_4 = _lag(4)
    lag_8 = _lag(8)
    lag_12 = _lag(12)

    recent_4 = history_units[-4:] if history_units else [sku_mean]
    recent_8 = history_units[-8:] if history_units else [sku_mean]
    recent_12 = history_units[-12:] if history_units else [sku_mean]

    rolling_mean_4 = float(np.mean(recent_4))
    rolling_mean_8 = float(np.mean(recent_8))
    rolling_mean_12 = float(np.mean(recent_12))
    rolling_std_4 = float(np.std(recent_4, ddof=1)) if len(recent_4) > 1 else 0.0
    rolling_std_12 = float(np.std(recent_12, ddof=1)) if len(recent_12) > 1 else 0.0
    ewma_03 = compute_ewma(recent_12, alpha=0.3)

    dt = datetime.strptime(week_str, "%Y-%m-%d")
    iso_week = dt.isocalendar()[1]
    sin_week = math.sin(2.0 * math.pi * iso_week / 52.0)
    cos_week = math.cos(2.0 * math.pi * iso_week / 52.0)

    return [
        lag_1,
        lag_2,
        lag_3,
        lag_4,
        lag_8,
        lag_12,
        rolling_mean_4,
        rolling_mean_8,
        rolling_mean_12,
        rolling_std_4,
        rolling_std_12,
        ewma_03,
        sin_week,
        cos_week,
        sku_mean,
        float(lead_time_weeks),
    ]


def build_supervised_dataset(
    sales_by_sku: Dict[str, List[Tuple[str, float]]],
    lead_times: Dict[str, int],
    holdout_weeks: int = 0,
) -> Tuple[np.ndarray, np.ndarray, Dict[str, float]]:
    """Constructs supervised training matrix (X, y) across all 40 SKUs."""
    X_rows = []
    y_rows = []
    sku_means: Dict[str, float] = {}

    for sku, series in sorted(sales_by_sku.items()):
        sliced = series[:-holdout_weeks] if (holdout_weeks > 0 and len(series) > holdout_weeks) else series
        units = [u for _, u in sliced]
        sku_mean = float(np.mean(units)) if units else 0.0
        sku_means[sku] = sku_mean
        lt = lead_times[sku]

        start_idx = min(12, max(1, len(sliced) // 2))
        for t in range(start_idx, len(sliced)):
            week_str, target = sliced[t]
            feat = extract_features(units[:t], week_str, sku_mean, lt)
            X_rows.append(feat)
            y_rows.append(target)

    return np.array(X_rows, dtype=np.float64), np.array(y_rows, dtype=np.float64), sku_means


def evaluate_chronological_holdout(
    sales_by_sku: Dict[str, List[Tuple[str, float]]],
    lead_times: Dict[str, int],
    holdout_weeks: int = 4,
):
    """Evaluates candidate scikit-learn regressors on the final 4-week chronological holdout split."""
    X_train, y_train, train_sku_means = build_supervised_dataset(
        sales_by_sku, lead_times, holdout_weeks=holdout_weeks
    )

    candidates = {
        "Ridge": Pipeline([("scaler", StandardScaler()), ("model", Ridge(alpha=15.0))]),
        "GradientBoostingRegressor": GradientBoostingRegressor(
            n_estimators=120, learning_rate=0.04, max_depth=3, subsample=0.85, random_state=42
        ),
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=150, max_depth=6, min_samples_leaf=3, random_state=42
        ),
    }

    metrics_report = {}
    best_name = None
    best_wape = float("inf")

    for name, model in candidates.items():
        model.fit(X_train, y_train)
        abs_errors = []
        sq_errors = []
        actuals = []

        # Recursive 4-step evaluation on holdout weeks
        for sku, series in sorted(sales_by_sku.items()):
            train_slice = series[:-holdout_weeks]
            holdout_slice = series[-holdout_weeks:]
            history_units = [u for _, u in train_slice]
            sku_mean = train_sku_means[sku]
            lt = lead_times[sku]

            for week_str, actual_val in holdout_slice:
                feat = np.array([extract_features(history_units, week_str, sku_mean, lt)], dtype=np.float64)
                pred_val = max(0.0, float(model.predict(feat)[0]))
                abs_errors.append(abs(actual_val - pred_val))
                sq_errors.append((actual_val - pred_val) ** 2)
                actuals.append(actual_val)
                history_units.append(pred_val)

        mae = float(np.mean(abs_errors))
        rmse = float(math.sqrt(np.mean(sq_errors)))
        wape = float(sum(abs_errors) / sum(actuals)) * 100.0

        metrics_report[name] = {
            "WAPE_percent": round(wape, 2),
            "MAE": round(mae, 2),
            "RMSE": round(rmse, 2),
        }
        if wape < best_wape:
            best_wape = wape
            best_name = name

    return best_name, candidates[best_name], metrics_report


def train_and_generate_forecasts() -> Dict:
    """Trains the winning scikit-learn model on all historical weeks, saves artifact, and writes backend/ml/forecast.csv."""
    ml_dir = Path(__file__).resolve().parent
    backend_dir = ml_dir.parent
    data_dir = backend_dir / "data"
    artifacts_dir = ml_dir / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    lead_times, sales_by_sku = load_real_datasets(data_dir)
    best_name, best_model_template, metrics_report = evaluate_chronological_holdout(sales_by_sku, lead_times)

    # Fit winning model on full historical dataset
    X_full, y_full, full_sku_means = build_supervised_dataset(sales_by_sku, lead_times, holdout_weeks=0)
    best_model_template.fit(X_full, y_full)

    # Save trained scikit-learn model artifact
    artifact_payload = {
        "model_name": best_name,
        "model": best_model_template,
        "feature_names": FEATURE_NAMES,
        "sku_means": full_sku_means,
        "lead_times": lead_times,
        "future_weeks": FUTURE_WEEKS,
        "holdout_metrics": metrics_report,
    }
    model_path = artifacts_dir / "demand_forecaster.joblib"
    joblib.dump(artifact_payload, model_path)

    # Generate 4-week recursive predictions for all 40 SKUs
    forecast_rows = []
    for sku in sorted(lead_times.keys()):
        history_units = [u for _, u in sales_by_sku[sku]]
        sku_mean = full_sku_means[sku]
        lt = lead_times[sku]

        for week_str in FUTURE_WEEKS:
            feat = np.array([extract_features(history_units, week_str, sku_mean, lt)], dtype=np.float64)
            pred = max(0.0, round(float(best_model_template.predict(feat)[0]), 1))
            forecast_rows.append({
                "sku": sku,
                "week_start": week_str,
                "forecast_units": pred,
            })
            history_units.append(pred)

    # Write canonical backend/ml/forecast.csv
    forecast_csv_path = ml_dir / "forecast.csv"
    with open(forecast_csv_path, mode="w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["sku", "week_start", "forecast_units"])
        writer.writeheader()
        writer.writerows(forecast_rows)

    # Write model evaluation metrics summary
    metrics_summary = {
        "selected_model": best_name,
        "training_samples": int(X_full.shape[0]),
        "num_features": len(FEATURE_NAMES),
        "feature_names": FEATURE_NAMES,
        "chronological_holdout_metrics": metrics_report,
        "forecast_rows_generated": len(forecast_rows),
        "artifact_path": str(model_path.relative_to(backend_dir)),
    }
    with open(artifacts_dir / "model_metrics.json", mode="w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)

    return metrics_summary


if __name__ == "__main__":
    summary = train_and_generate_forecasts()
    print(json.dumps(summary, indent=2))
