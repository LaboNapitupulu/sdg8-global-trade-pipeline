import csv
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from dashboard.backend.data_pipeline import build_database


class DataPipelineTestCase(unittest.TestCase):
    def test_macro_and_hs_detail_grains_are_kept_separate(self):
        rows = [
            ["A", 2000, "TOTAL", "ALL COMMODITIES", "Export", 100, "all_commodities"],
            ["A", 2000, "TOTAL", "ALL COMMODITIES", "Import", 120, "all_commodities"],
            ["B", 2000, "TOTAL", "ALL COMMODITIES", "Export", 50, "all_commodities"],
            ["EU-28", 2000, "TOTAL", "ALL COMMODITIES", "Export", 1000, "all_commodities"],
            ["A", 2000, "010100", "Product one", "Export", 60, "01_products"],
            ["A", 2000, "010200", "Product two", "Export", 40, "01_products"],
            ["A", 2000, "010100", "Product one", "Import", 70, "01_products"],
            ["A", 2000, "010100", "Product one", "Re-Export", 99, "01_products"],
        ]
        headers = [
            "country_or_area",
            "year",
            "comm_code",
            "commodity",
            "flow",
            "trade_usd",
            "category",
        ]

        with tempfile.TemporaryDirectory() as directory:
            csv_file = Path(directory) / "trade.csv"
            db_file = Path(directory) / "trade.db"
            with csv_file.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(headers)
                writer.writerows(rows)

            build_database(csv_file, db_file, chunk_size=2)
            with closing(sqlite3.connect(db_file)) as connection:
                export_total = connection.execute(
                    "SELECT trade_usd FROM trade_by_year_flow WHERE flow = 'Export'"
                ).fetchone()[0]
                detail_total = connection.execute(
                    "SELECT SUM(trade_usd) FROM top_commodities"
                ).fetchone()[0]
                total_rows = connection.execute(
                    "SELECT COUNT(*) FROM top_commodities WHERE comm_code = 'TOTAL'"
                ).fetchone()[0]

            self.assertEqual(export_total, 150)
            self.assertEqual(detail_total, 100)
            self.assertEqual(total_rows, 0)


if __name__ == "__main__":
    unittest.main()
