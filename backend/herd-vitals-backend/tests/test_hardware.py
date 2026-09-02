import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from app.api.hardware import hardware_status


class _Response:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, data):
        self.data = data
        self.filters = []

    def select(self, _columns):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def order(self, _column, desc=False):
        return self

    def limit(self, _limit):
        return self

    def execute(self):
        return _Response(self.data)


class _Supabase:
    def __init__(self, data):
        self.query = _Query(data)

    def table(self, _name):
        return self.query


class HardwareStatusTests(unittest.IsolatedAsyncioTestCase):
    async def test_status_uses_only_physical_readings(self):
        database = _Supabase([])

        with patch("app.api.hardware.supabase", database):
            result = await hardware_status()

        self.assertEqual(database.query.filters, [("is_simulated", False)])
        self.assertEqual(result["status"], "offline")
        self.assertEqual(result["data_source"], "unavailable")

    async def test_recent_physical_reading_marks_device_online(self):
        database = _Supabase(
            [
                {
                    "device_id": "ESP8266-BARN-A",
                    "reading_time": datetime.now(timezone.utc).isoformat(),
                    "is_simulated": False,
                }
            ]
        )

        with patch("app.api.hardware.supabase", database):
            result = await hardware_status()

        self.assertEqual(result["status"], "online")
        self.assertEqual(result["device_id"], "ESP8266-BARN-A")
        self.assertEqual(result["data_source"], "live")


if __name__ == "__main__":
    unittest.main()
