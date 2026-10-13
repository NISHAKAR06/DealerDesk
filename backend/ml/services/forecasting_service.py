"""
ML Demand Forecasting & Reorder Engine Service (Track 2 — §10).
Uses the trained scikit-learn regression artifact (backend/ml/artifacts/demand_forecaster.joblib),
genuine 104-week historical sales (backend/data/sales_history.csv), supplier lead times
(backend/data/lead_times.csv), and live PostgreSQL Product.stock.
"""

import csv
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from django.conf import settings
from core.models import Product
from ml.train_model import (
    FUTURE_WEEKS,
    extract_features,
    load_real_datasets,
    train_and_generate_forecasts,
)


class ForecastingService:
    _cached_artifact: Optional[Dict[str, Any]] = None

    @classmethod
    def _get_ml_dir(cls) -> Path:
        ml_dir = Path(settings.BASE_DIR) / "ml"
        if not ml_dir.exists() and (Path(settings.BASE_DIR).parent / "ml").exists():
            return Path(settings.BASE_DIR).parent / "ml"
        return ml_dir

    @classmethod
    def _get_data_dir(cls) -> Path:
        data_dir = getattr(settings, "DATA_DIR", None)
        if data_dir and Path(data_dir).exists():
            return Path(data_dir)
        if (Path(settings.BASE_DIR) / "data").exists():
            return Path(settings.BASE_DIR) / "data"
        if (Path(settings.BASE_DIR).parent / "data").exists():
            return Path(settings.BASE_DIR).parent / "data"
        return Path(settings.BASE_DIR) / "data"

    @classmethod
    def get_trained_artifact(cls) -> Dict[str, Any]:
        """Loads the serialized scikit-learn model artifact, training it on first run if absent."""
        if cls._cached_artifact is not None:
            return cls._cached_artifact

        artifact_path = cls._get_ml_dir() / "artifacts" / "demand_forecaster.joblib"
        if not artifact_path.exists():
            train_and_generate_forecasts()

        cls._cached_artifact = joblib.load(artifact_path)
        return cls._cached_artifact

    @classmethod
    def load_forecasts_by_sku(cls) -> Dict[str, List[Dict[str, Any]]]:
        """Reads 4-week forecasts from backend/ml/forecast.csv (or runs live model inference if missing)."""
        forecast_csv = cls._get_ml_dir() / "forecast.csv"
        if not forecast_csv.exists() and (Path(settings.BASE_DIR).parent / "ml" / "forecast.csv").exists():
            forecast_csv = Path(settings.BASE_DIR).parent / "ml" / "forecast.csv"
        elif not forecast_csv.exists():
            train_and_generate_forecasts()

        forecasts: Dict[str, List[Dict[str, Any]]] = {}
        with open(forecast_csv, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                sku = (row.get("sku") or "").strip()
                if not sku:
                    continue
                forecasts.setdefault(sku, []).append({
                    "week_start": row["week_start"].strip(),
                    "forecast_units": round(float(row["forecast_units"]), 1),
                })

        for sku in forecasts:
            forecasts[sku].sort(key=lambda x: x["week_start"])
        return forecasts

    @classmethod
    def predict_sku_live(cls, sku: str) -> Optional[List[Dict[str, Any]]]:
        """Runs live recursive 4-week inference using the trained scikit-learn regressor."""
        artifact = cls.get_trained_artifact()
        lead_times, sales_by_sku = load_real_datasets(cls._get_data_dir())
        if sku not in lead_times:
            return None

        model = artifact["model"]
        sku_mean = artifact["sku_means"][sku]
        lt = lead_times[sku]
        history_units = [u for _, u in sales_by_sku[sku]]

        predictions = []
        for week_str in FUTURE_WEEKS:
            feat = np.array([extract_features(history_units, week_str, sku_mean, lt)], dtype=np.float64)
            pred = max(0.0, round(float(model.predict(feat)[0]), 1))
            predictions.append({
                "week_start": week_str,
                "forecast_units": pred,
            })
            history_units.append(pred)
        return predictions

    @classmethod
    def get_sku_forecast(cls, sku: str) -> Optional[Dict[str, Any]]:
        """
        Returns 4-week forecast for a forecast SKU matching backend/ml/forecast.csv.
        Returns None if SKU is not in lead_times.csv.
        """
        sku_clean = (sku or "").strip().upper()
        lead_times, _ = load_real_datasets(cls._get_data_dir())
        if sku_clean not in lead_times:
            return None

        forecasts = cls.load_forecasts_by_sku()
        sku_forecast = forecasts.get(sku_clean)
        if not sku_forecast or len(sku_forecast) != 4:
            sku_forecast = cls.predict_sku_live(sku_clean)

        return {
            "sku": sku_clean,
            "forecast": sku_forecast,
        }

    @classmethod
    def _compute_sample_std_recent_12(cls, units: List[float]) -> float:
        """Computes sample standard deviation (ddof=1) over the most recent 12 weeks of historical sales."""
        recent_12 = units[-12:]
        n = len(recent_12)
        if n < 2:
            return 0.0
        mean_val = sum(recent_12) / n
        variance = sum((x - mean_val) ** 2 for x in recent_12) / (n - 1)
        return math.sqrt(variance)

    @classmethod
    def get_reorder_suggestions(cls) -> List[Dict[str, Any]]:
        """
        Calculates safety stock, reorder point, and reorder quantity for all 40 forecast SKUs
        using live PostgreSQL Product.stock and trained ML demand forecasts.
        """
        lead_times, sales_by_sku = load_real_datasets(cls._get_data_dir())
        forecasts = cls.load_forecasts_by_sku()

        # Fetch live stock from PostgreSQL in one query
        stock_by_sku = dict(
            Product.objects.filter(sku__in=lead_times.keys()).values_list("sku", "stock")
        )

        results: List[Dict[str, Any]] = []
        for sku in sorted(lead_times.keys()):
            L = lead_times[sku]
            current_stock = int(stock_by_sku.get(sku, 0))
            sku_forecasts = forecasts.get(sku) or cls.predict_sku_live(sku) or []

            # lead_time_demand = sum of forecast_units over the first L forecast weeks
            lead_time_demand = round(
                sum(float(w["forecast_units"]) for w in sku_forecasts[:L]), 2
            )

            # sigma = sample standard deviation of the SKU's weekly sales over the most recent 12 weeks
            history_units = [u for _, u in sales_by_sku.get(sku, [])]
            sigma = cls._compute_sample_std_recent_12(history_units)

            # safety_stock = ceil(1.65 * sigma * sqrt(L))
            safety_stock = int(math.ceil(1.65 * sigma * math.sqrt(L)))

            # reorder_point = lead_time_demand + safety_stock
            reorder_point = round(lead_time_demand + safety_stock, 2)

            # reorder_qty = max(0, ceil(reorder_point - current_stock))
            reorder_qty = max(0, int(math.ceil(reorder_point - current_stock)))

            results.append({
                "sku": sku,
                "current_stock": current_stock,
                "lead_time_weeks": L,
                "lead_time_demand": lead_time_demand,
                "safety_stock": safety_stock,
                "reorder_point": reorder_point,
                "reorder_qty": reorder_qty,
            })

        return results

