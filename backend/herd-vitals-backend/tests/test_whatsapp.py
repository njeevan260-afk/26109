import hashlib
import hmac
import unittest
from unittest.mock import patch

from app.services.whatsapp_service import (
    _template_parameters,
    send_risk_alerts,
    verify_webhook_signature,
)
from app.api.predictions import process_live_risk_alerts


class WhatsAppAlertTests(unittest.TestCase):
    def test_template_contains_only_the_affected_cow_details(self):
        parameters = _template_parameters(
            {
                "category": "HIGH",
                "risk_7day": 0.85,
                "latest_ec": 6.2,
                "latest_temp": 39.7,
                "recommendations": ["Inspect the udder", "Contact a veterinarian"],
            },
            {"id": "cow-1", "tag_number": "COW-101", "breed": "Gir"},
        )
        values = [parameter["text"] for parameter in parameters]
        self.assertEqual(values[:4], ["High", "COW-101", "Gir", "85%"])
        self.assertIn("Inspect the udder", values[6])

    def test_low_and_simulated_predictions_are_never_sent(self):
        self.assertEqual(
            send_risk_alerts("cow-1", {"category": "LOW", "data_source": "live"})[
                "skipped"
            ],
            "risk_not_elevated_or_not_live",
        )
        self.assertEqual(
            send_risk_alerts(
                "cow-1", {"category": "HIGH", "data_source": "simulated"}
            )["skipped"],
            "risk_not_elevated_or_not_live",
        )

    def test_webhook_signature_and_timestamp_are_verified(self):
        payload = b'{"type":"whatsapp.message.updated"}'
        timestamp = "1788372000"
        secret = "webhook-secret"
        signature = hmac.new(
            secret.encode(), timestamp.encode() + b"." + payload, hashlib.sha256
        ).hexdigest()
        header = f"t={timestamp},s={signature}"
        with patch.dict("os.environ", {"YCLOUD_WEBHOOK_SECRET": secret}), patch(
            "app.services.whatsapp_service.time.time", return_value=1788372000
        ):
            self.assertTrue(verify_webhook_signature(payload, header))
            self.assertFalse(verify_webhook_signature(payload + b" ", header))

    @patch("app.services.whatsapp_service.send_risk_alerts")
    @patch("app.api.predictions.create_elevated_risk_alert")
    @patch("app.api.predictions._save_prediction")
    @patch("app.api.predictions._compute_prediction")
    def test_live_ingestion_uses_only_physical_readings_and_sends_elevated_risk(
        self,
        compute_prediction,
        save_prediction,
        create_alert,
        send_alerts,
    ):
        prediction = {"category": "MODERATE", "data_source": "live"}
        compute_prediction.return_value = prediction

        process_live_risk_alerts(["cow-1", "cow-1"])

        compute_prediction.assert_called_once_with("cow-1", live_only=True)
        save_prediction.assert_called_once_with("cow-1", prediction)
        create_alert.assert_called_once_with("cow-1", prediction)
        send_alerts.assert_called_once_with("cow-1", prediction)


if __name__ == "__main__":
    unittest.main()
