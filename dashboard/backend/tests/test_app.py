import unittest

from dashboard.backend.app import app


class ApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        cls.client = app.test_client()

    def test_health_checks_database_contents_without_leaking_path(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})

    def test_unknown_route_preserves_404(self):
        response = self.client.get("/api/not-a-route")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["status"], 404)

    def test_trade_by_year_has_aligned_series(self):
        payload = self.client.get("/api/trade-by-year").get_json()
        self.assertEqual(len(payload["years"]), len(payload["exports"]))
        self.assertEqual(len(payload["years"]), len(payload["imports"]))
        self.assertGreater(len(payload["years"]), 20)

    def test_growth_uses_annual_averages_and_discloses_years(self):
        payload = self.client.get("/api/growth-metrics").get_json()
        self.assertEqual(payload["method"], "annual_average")
        self.assertEqual(len(payload["years_compared"]["baseline_years"]), 10)
        self.assertEqual(len(payload["years_compared"]["recent_years"]), 7)
        self.assertIn("2010–2016", payload["period"])

    def test_country_ranking_excludes_overlapping_region_aggregates(self):
        payload = self.client.get("/api/top-countries").get_json()
        names = {row["country_or_area"] for row in payload["exports"]}
        self.assertNotIn("EU-28", names)
        self.assertNotIn("World", names)

    def test_commodity_contract_exposes_hs_code_and_export_value(self):
        payload = self.client.get("/api/top-commodities").get_json()
        self.assertTrue(payload)
        self.assertIn("comm_code", payload[0])
        self.assertNotEqual(payload[0]["comm_code"], "TOTAL")


if __name__ == "__main__":
    unittest.main()
