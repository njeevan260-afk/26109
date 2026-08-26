import unittest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from pydantic import ValidationError

from app.api.mastitis_events import _migration_missing
from app.models.mastitis_event import MastitisEventInput


class MastitisEventInputTests(unittest.TestCase):
    def base_payload(self):
        return {
            "animal_id": uuid4(),
            "event_time": datetime.now(timezone.utc) - timedelta(hours=1),
            "status": "CONFIRMED",
            "diagnosis_method": "CLINICAL_EXAM",
            "diagnosis_result": "clinical mastitis",
            "confirmed_by": "Dr Example",
        }

    def test_accepts_supported_confirmed_event(self):
        event = MastitisEventInput(**self.base_payload())
        payload = event.to_database_payload()
        self.assertEqual(payload["status"], "CONFIRMED")
        self.assertTrue(payload["event_time"].endswith("+00:00"))

    def test_confirmed_event_requires_provenance(self):
        payload = self.base_payload()
        payload.pop("confirmed_by")
        with self.assertRaises(ValidationError):
            MastitisEventInput(**payload)

    def test_scc_method_requires_scc_value(self):
        payload = self.base_payload()
        payload["diagnosis_method"] = "SCC"
        with self.assertRaises(ValidationError):
            MastitisEventInput(**payload)

    def test_rejects_timezone_naive_event(self):
        payload = self.base_payload()
        payload["event_time"] = datetime.now() - timedelta(hours=1)
        with self.assertRaises(ValidationError):
            MastitisEventInput(**payload)

    def test_recognizes_missing_migration_error(self):
        error = Exception(
            "PGRST205 Could not find the table 'public.mastitis_events' in the schema cache"
        )
        self.assertTrue(_migration_missing(error))


if __name__ == "__main__":
    unittest.main()
