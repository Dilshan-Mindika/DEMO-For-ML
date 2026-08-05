import os
import sys

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import unittest
import pandas as pd

from backend.core.collector import HardwareCollector
from backend.core.agent import DeviceHealthAgent
from backend.core.model_service import LifecyclePredictor
from backend.core.component_manager import ComponentMaintenanceManager
from backend.core.fleet_manager import FleetManager
from backend.models.telemetry_schema import TelemetryData, MLInputSchema


class TestEnterprisePipeline(unittest.TestCase):

    def setUp(self):
        self.collector = HardwareCollector()
        self.agent = DeviceHealthAgent()
        self.maintenance_mgr = ComponentMaintenanceManager()
        self.fleet_mgr = FleetManager()

    def test_hardware_collector_non_blocking(self):
        telemetry = self.collector.collect_all()
        self.assertIsNotNone(telemetry.device_name)
        self.assertIsNotNone(telemetry.device_model)
        self.assertGreaterEqual(telemetry.battery_health, 0.0)
        self.assertLessEqual(telemetry.battery_health, 100.0)

    def test_agent_usage_profile_classification(self):
        self.assertEqual(self.agent.calculate_usage_profile(3.0), "Light")
        self.assertEqual(self.agent.calculate_usage_profile(6.5), "Normal")
        self.assertEqual(self.agent.calculate_usage_profile(9.0), "Heavy")

    def test_agent_performance_score(self):
        score = self.agent.calculate_performance_score(cpu_usage=10.0, ram_usage=20.0, disk_usage=30.0)
        self.assertGreaterEqual(score, 70.0)

    def test_agent_edhi_calculation(self):
        edhi = self.agent.calculate_edhi(
            battery_health=90.0,
            ssd_health=95.0,
            temperature=45.0,
            shutdown_count=0,
            performance_score=85.0
        )
        self.assertGreaterEqual(edhi, 80.0)
        self.assertLessEqual(edhi, 100.0)

    def test_component_maintenance_battery_reset(self):
        initial_input = MLInputSchema(
            device_model="Dell XPS 15",
            usage_profile="Normal",
            age=24.0,
            usage_hours=4000.0,
            battery_cycles=450,
            battery_health=65.0,
            ssd_health=90.0,
            temperature=50.0,
            performance_score=80.0,
            shutdown_count=1,
            edhi=70.0
        )
        updated = self.maintenance_mgr.replace_battery(initial_input)
        self.assertEqual(updated.battery_health, 100.0)
        self.assertEqual(updated.battery_cycles, 0)
        self.assertEqual(updated.age, 24.0)

    def test_fleet_manager_registration(self):
        telemetry = self.collector.collect_all()
        ml_in = self.agent.process_telemetry(telemetry)
        predictor = LifecyclePredictor()
        pred = predictor.predict(ml_in)

        rec = self.fleet_mgr.register_or_update(telemetry, pred)
        self.assertIsNotNone(rec["device_id"])
        
        all_devs = self.fleet_mgr.get_all_devices()
        self.assertGreaterEqual(len(all_devs), 1)

        summary = self.fleet_mgr.get_fleet_summary()
        self.assertGreaterEqual(summary["total_devices"], 1)


if __name__ == "__main__":
    unittest.main()
