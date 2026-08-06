import os
import sys
import json
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core.model_service import LifecyclePredictor

print("[+] Generating synthetic dataset for high-accuracy tree model export...")
np.random.seed(42)
n = 25000

models = np.random.choice(['Dell XPS 15', 'Lenovo ThinkPad X1', 'HP EliteBook 840', 'MacBook Pro 16', 'Standard Laptop'], n)
profiles = np.random.choice(['Light', 'Normal', 'Heavy'], n)
age = np.random.uniform(1, 60, n)
usage_hours = age * 30 * np.random.uniform(2, 12, n)
battery_cycles = (age * np.random.uniform(5, 20, n)).astype(int)
battery_health = np.clip(100 - (age * np.random.uniform(0.5, 1.5, n)), 30, 100)
ssd_health = np.clip(100 - (age * np.random.uniform(0.2, 1.0, n)), 40, 100)
temp = np.random.uniform(35, 85, n)
perf = np.random.uniform(40, 99, n)
shutdowns = np.random.poisson(1, n)
edhi = np.clip(100 - (age*0.8 + shutdowns*5 + (80-perf)*0.3), 10, 100)

df = pd.DataFrame({
    'device_model': models,
    'usage_profile': profiles,
    'age': age,
    'usage_hours': usage_hours,
    'battery_cycles': battery_cycles,
    'battery_health': battery_health,
    'ssd_health': ssd_health,
    'temperature': temp,
    'performance_score': perf,
    'shutdown_count': shutdowns,
    'edhi': edhi
})

# Generate ground-truth RUL targets based on physics & EDHI formula
base_life = 48.0
y = np.clip((base_life - age) * (edhi / 100.0) * np.random.uniform(0.95, 1.05, n), 1.0, 60.0)

from sklearn.ensemble import GradientBoostingRegressor
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

pre = ColumnTransformer([
    ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), ['device_model', 'usage_profile'])
], remainder='passthrough')

X_trans = pre.fit_transform(df)
gbr = GradientBoostingRegressor(n_estimators=150, learning_rate=0.08, max_depth=6, random_state=42)
gbr.fit(X_trans, y)

trees_data = []
for estimator in gbr.estimators_.ravel():
    tree = estimator.tree_
    trees_data.append({
        'children_left': tree.children_left.tolist(),
        'children_right': tree.children_right.tolist(),
        'feature': tree.feature.tolist(),
        'threshold': tree.threshold.tolist(),
        'value': tree.value.ravel().tolist()
    })

model_json = {
    'init_value': float(gbr.init_.constant_[0][0]),
    'learning_rate': float(gbr.learning_rate),
    'cat_categories': {
        'device_model': pre.named_transformers_['cat'].categories_[0].tolist(),
        'usage_profile': pre.named_transformers_['cat'].categories_[1].tolist()
    },
    'num_features': ['age', 'usage_hours', 'battery_cycles', 'battery_health', 'ssd_health', 'temperature', 'performance_score', 'shutdown_count', 'edhi'],
    'trees': trees_data
}

json_path = os.path.join(os.path.dirname(__file__), "..", "models", "model.json")
json_path = os.path.abspath(json_path)

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(model_json, f)

print(f"[+] Successfully exported pure JSON Decision Tree Model to: {json_path}")
print(f"[+] JSON File Size: {round(os.path.getsize(json_path)/(1024*1024), 2)} MB")
