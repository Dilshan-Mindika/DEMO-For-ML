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

from backend.config import (
    MODEL_PATH,
    RUL_HEALTHY_THRESHOLD,
    RUL_MONITOR_THRESHOLD,
    RUL_PLAN_REPLACEMENT_THRESHOLD
)
from backend.models.telemetry_schema import MLInputSchema, PredictionResult


class LifecyclePredictor:
    """
    Object-Oriented Lifecycle Predictor Service.
    Loads trained xgboost_rul_model.pkl and executes inference.
    """

    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.load_model()

    def load_model(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Trained XGBoost model file not found at: {self.model_path}")

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self.model = joblib.load(self.model_path)
        except Exception as e:
            raise RuntimeError(f"Failed to load model from {self.model_path}: {str(e)}")

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

    def predict(self, ml_input: MLInputSchema) -> PredictionResult:
        if self.model is None:
            self.load_model()

        df = self.prepare_dataframe(ml_input)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            raw_pred = self.model.predict(df)[0]

        rul_months = round(float(raw_pred), 2)
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
