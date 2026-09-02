import unittest
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

from app.api.clusters import get_clusters


class _Query:
    def __init__(self, rows):
        self.rows = rows
        self.selected_columns = None

    def select(self, columns):
        self.selected_columns = columns
        return self

    def order(self, _column, desc=False):
        return self

    def execute(self):
        return SimpleNamespace(data=deepcopy(self.rows))


class _Supabase:
    def __init__(self, animals, predictions):
        self.queries = {
            "animals": _Query(animals),
            "predictions": _Query(predictions),
        }

    def table(self, name):
        return self.queries[name]


class ClusterTests(unittest.IsolatedAsyncioTestCase):
    async def test_geotagged_animals_form_valid_geojson_clusters(self):
        database = _Supabase(
            animals=[
                {
                    "id": "cow-1",
                    "tag_number": "COW-101",
                    "latitude": 12.3251,
                    "longitude": 76.6991,
                },
                {
                    "id": "cow-2",
                    "tag_number": "COW-102",
                    "latitude": 12.3260,
                    "longitude": 76.7010,
                },
                {
                    "id": "cow-3",
                    "tag_number": "COW-103",
                    "latitude": 12.3440,
                    "longitude": 76.7200,
                },
                {
                    "id": "cow-without-location",
                    "tag_number": "COW-104",
                    "latitude": None,
                    "longitude": None,
                },
            ],
            predictions=[
                {"animal_id": "cow-1", "risk_category": "LOW"},
                {"animal_id": "cow-2", "risk_category": "HIGH"},
                {"animal_id": "cow-3", "risk_category": "MODERATE"},
                {"animal_id": "cow-without-location", "risk_category": "HIGH"},
            ],
        )

        with patch("app.api.clusters.supabase", database):
            result = await get_clusters()

        self.assertEqual(result["type"], "FeatureCollection")
        self.assertEqual(len(result["features"]), 2)
        self.assertIn("latitude", database.queries["animals"].selected_columns)
        self.assertIn("longitude", database.queries["animals"].selected_columns)

        grouped = next(
            feature
            for feature in result["features"]
            if set(feature["properties"]["affected_cows"])
            == {"COW-101", "COW-102"}
        )
        self.assertEqual(grouped["geometry"]["coordinates"], [76.7, 12.33])
        self.assertEqual(grouped["properties"]["risk_level"], "HIGH")
        self.assertEqual(grouped["properties"]["affected_count"], 2)
        self.assertTrue(all(
            "COW-104" not in feature["properties"]["affected_cows"]
            for feature in result["features"]
        ))

        for feature in result["features"]:
            self.assertEqual(feature["type"], "Feature")
            self.assertEqual(feature["geometry"]["type"], "Point")
            self.assertEqual(len(feature["geometry"]["coordinates"]), 2)
            self.assertTrue(all(
                isinstance(coordinate, (int, float))
                for coordinate in feature["geometry"]["coordinates"]
            ))
            self.assertEqual(feature["properties"]["location_source"], "demo")
            self.assertFalse(
                feature["properties"]["environment_data_available"]
            )
            self.assertNotIn("environment", feature["properties"])


if __name__ == "__main__":
    unittest.main()
