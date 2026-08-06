import os
import sys
import warnings
import joblib
import pandas as pd
from datetime import datetime
from typing import Dict, Any, Tuple

# Suppress non-critical version mismatch warnings during unpickling
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", message=".*InconsistentVersionWarning.*")

# Backwards-compatibility shim for unpickling scikit-learn pipeline objects
try:
    import sklearn.compose._column_transformer
    if not hasattr(sklearn.compose._column_transformer, '_RemainderColsList'):
        class _RemainderColsList(list):
            pass
        sklearn.compose._column_transformer._RemainderColsList = _RemainderColsList
except Exception:
    pass

try:
    from backend.config import (
        MODEL_PATH,
        RUL_HEALTHY_THRESHOLD,
        RUL_MONITOR_THRESHOLD,
        RUL_PLAN_REPLACEMENT_THRESHOLD
    )
    from backend.models.telemetry_schema import MLInputSchema, PredictionResult
except ImportError:
    from config import (
        MODEL_PATH,
        RUL_HEALTHY_THRESHOLD,
        RUL_MONITOR_THRESHOLD,
        RUL_PLAN_REPLACEMENT_THRESHOLD
    )
    from models.telemetry_schema import MLInputSchema, PredictionResult


class LifecyclePredictor:
    """
    Object-Oriented Lifecycle Predictor Service.
    Loads trained xgboost_rul_model.pkl and executes inference with fail-safe heuristic fallback.
    """

    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.load_error = None
        self.load_model()

    def load_model(self):
        target_path = self.model_path
        if not os.path.exists(target_path):
            try:
                from backend.config import candidate_model_paths
            except ImportError:
                from config import candidate_model_paths

            for p in candidate_model_paths:
                if os.path.exists(p):
                    target_path = p
                    break

        if not os.path.exists(target_path):
            self.load_error = f"Model file not found in searched paths"
            self.model = None
            return

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self.model = joblib.load(target_path)
                self.model_path = target_path
                self.load_error = None
                print(f"[+] Successfully loaded ML RUL predictor model from {target_path}")
        except Exception as e:
            self.load_error = str(e)
            print(f"[!] Warning: Failed to load model from {target_path}: {e}. Fallback heuristic active.")
            self.model = None

    def prepare_dataframe(self, ml_input: MLInputSchema) -> pd.DataFrame:
        """
        Builds a single-row pandas DataFrame with exact 11 column names required by model:
        ['device_model', 'usage_profile', 'age', 'usage_hours', 'battery_cycles',
         'battery_health', 'ssd_health', 'temperature', 'performance_score',
         'shutdown_count', 'edhi']
        """
        data_dict = ml_input.to_dict()
        df = pd.DataFrame([data_dict])
        return df

    def calculate_heuristic_rul(self, ml_input: MLInputSchema) -> float:
        """Calculates robust heuristic Remaining Useful Life (RUL) in months based on EDHI and device age."""
        base_life = 48.0
        edhi_factor = max(0.1, ml_input.edhi / 100.0)
        remaining = max(1.0, (base_life - ml_input.age) * edhi_factor)
        return round(remaining, 2)

    def predict(self, ml_input: MLInputSchema) -> PredictionResult:
        if self.model is None:
            self.load_model()

        if self.model is not None:
            try:
                df = self.prepare_dataframe(ml_input)
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    raw_pred = self.model.predict(df)[0]
                rul_months = round(float(raw_pred), 2)
            except Exception as e:
                print(f"[!] Warning: Model prediction failed ({e}), using heuristic RUL fallback.")
                rul_months = self.calculate_heuristic_rul(ml_input)
        else:
            rul_months = self.calculate_heuristic_rul(ml_input)

        recommendation, status_level, status_color = self.get_recommendation(rul_months)

        return PredictionResult(
            rul_months=rul_months,
            recommendation=recommendation,
            status_level=status_level,
            status_color=status_color,
            ml_input=ml_input.to_dict(),
            timestamp=datetime.now().isoformat()
        )

    @staticmethod
    def get_recommendation(rul_months: float) -> Tuple[str, str, str]:
        """
        Maps Remaining Useful Life (RUL) to enterprise recommendations:
        - RUL > 36: Healthy Device
        - 24 - 36: Monitor Device
        - 12 - 24: Plan Replacement
        - < 12: Replace Soon
        """
        if rul_months > RUL_HEALTHY_THRESHOLD:
            return "Healthy Device", "healthy", "#10B981"  # Emerald Green
        elif RUL_MONITOR_THRESHOLD <= rul_months <= RUL_HEALTHY_THRESHOLD:
            return "Monitor Device", "monitor", "#3B82F6"  # Royal Blue
        elif RUL_PLAN_REPLACEMENT_THRESHOLD <= rul_months < RUL_MONITOR_THRESHOLD:
            return "Plan Replacement", "plan_replacement", "#F59E0B"  # Amber Orange
        else:
            return "Replace Soon", "replace_soon", "#EF4444"  # Rose Red
