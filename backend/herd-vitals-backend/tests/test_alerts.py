import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.api.alerts import _elevated_alert_payload, create_elevated_risk_alert
from app.api.predictions import process_live_risk_alerts


class ElevatedAlertPayloadTests(unittest.TestCase):
    def test_moderate_prediction_creates_moderate_alert_payload(self):
        payload = _elevated_alert_payload(
            "cow-1",
            {"category": "MODERATE", "risk_7day": 0.55, "tag_number": "COW-101"},
        )

        self.assertIsNotNone(payload)
        self.assertEqual(payload["severity"], "MODERATE")
        self.assertIn("clinical check within 48 hours", payload["message"])

    def test_high_prediction_creates_urgent_alert_payload(self):
        payload = _elevated_alert_payload(
            "cow-1", {"category": "HIGH", "risk_7day": 0.85}
        )

        self.assertIsNotNone(payload)
        self.assertEqual(payload["severity"], "HIGH")
        self.assertIn("Inspect the animal now", payload["message"])

    def test_low_prediction_does_not_create_alert_payload(self):
        self.assertIsNone(
            _elevated_alert_payload("cow-1", {"category": "LOW", "risk_7day": 0.2})
        )

    @patch("app.api.alerts.supabase")
    def test_existing_moderate_alert_is_escalated_to_high(self, database):
        alerts_table = database.table.return_value
        alerts_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "alert-1", "severity": "MODERATE"}]
        )

        create_elevated_risk_alert(
            "cow-1", {"category": "HIGH", "risk_7day": 0.85}
        )

        update = alerts_table.update.call_args.args[0]
        self.assertEqual(update["severity"], "HIGH")
        alerts_table.insert.assert_not_called()

    @patch("app.api.predictions.create_elevated_risk_alert")
    @patch("app.api.predictions._save_prediction")
    @patch("app.api.predictions._compute_prediction")
    def test_live_ingestion_creates_an_in_app_alert_for_moderate_risk(
        self,
        compute_prediction,
        save_prediction,
        create_alert,
    ):
        prediction = {"category": "MODERATE", "data_source": "live"}
        compute_prediction.return_value = prediction

        process_live_risk_alerts(["cow-1", "cow-1"])

        compute_prediction.assert_called_once_with("cow-1", live_only=True)
        save_prediction.assert_called_once_with("cow-1", prediction)
        create_alert.assert_called_once_with("cow-1", prediction)


if __name__ == "__main__":
    unittest.main()
