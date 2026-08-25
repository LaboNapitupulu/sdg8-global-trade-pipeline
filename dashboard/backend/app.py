"""Read-only Flask API for the pre-aggregated Trade8 SQLite database."""

from __future__ import annotations

import os
import sqlite3
from contextlib import closing
from pathlib import Path
from statistics import fmean

from flask import Flask, jsonify, make_response
from flask_cors import CORS
from werkzeug.exceptions import HTTPException


BASE_DIR = Path(__file__).resolve().parent
DB_FILE = Path(os.getenv("TRADE8_DB_FILE", BASE_DIR / "trade_data.db")).resolve()
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("TRADE8_ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

app = Flask(__name__)
if ALLOWED_ORIGINS:
    CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})


@app.errorhandler(HTTPException)
def handle_http_exception(error: HTTPException):
    return jsonify({"error": error.name, "status": error.code}), error.code


@app.errorhandler(Exception)
def handle_unexpected_exception(error: Exception):
    app.logger.exception("Unhandled API exception: %s", error)
    return jsonify({"error": "Internal server error", "status": 500}), 500


def get_db_connection() -> sqlite3.Connection:
    if not DB_FILE.is_file():
        raise FileNotFoundError("Analytics database is unavailable")
    uri = f"file:{DB_FILE.as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True, timeout=5)
    connection.row_factory = sqlite3.Row
    return connection


def fetch_all(query: str, parameters: tuple = ()) -> list[dict]:
    with closing(get_db_connection()) as connection:
        return [dict(row) for row in connection.execute(query, parameters).fetchall()]


def cached_response(data, browser_max_age: int = 60, cdn_max_age: int = 300):
    response = make_response(jsonify(data))
    response.headers["Cache-Control"] = (
        f"public, max-age={browser_max_age}, s-maxage={cdn_max_age}, "
        "stale-while-revalidate=86400"
    )
    return response


@app.get("/api/trade-by-year")
def api_trade_by_year():
    rows = fetch_all(
        """
        SELECT year, flow, trade_usd AS total_trade
        FROM trade_by_year_flow
        WHERE year >= 1990
        ORDER BY year, flow
        """
    )
    by_year = {row["year"]: {} for row in rows}
    for row in rows:
        by_year[row["year"]][row["flow"]] = row["total_trade"]
    years = sorted(by_year)
    return cached_response(
        {
            "years": years,
            "exports": [by_year[year].get("Export", 0) for year in years],
            "imports": [by_year[year].get("Import", 0) for year in years],
        }
    )


@app.get("/api/top-countries")
def api_top_countries():
    exports = fetch_all(
        """
        SELECT country_or_area, trade_usd AS total_export
        FROM top_countries
        WHERE flow = 'Export'
        ORDER BY trade_usd DESC
        LIMIT 10
        """
    )
    imports = fetch_all(
        """
        SELECT country_or_area, trade_usd AS total_import
        FROM top_countries
        WHERE flow = 'Import'
        ORDER BY trade_usd DESC
        LIMIT 10
        """
    )
    return cached_response({"exports": exports, "imports": imports})


@app.get("/api/top-commodities")
def api_top_commodities():
    return cached_response(
        fetch_all(
            """
            SELECT comm_code, commodity, category, trade_usd AS total_trade
            FROM top_commodities
            WHERE flow = 'Export'
            ORDER BY trade_usd DESC
            LIMIT 10
            """
        )
    )


@app.get("/api/trade-by-category")
def api_trade_by_category():
    rows = fetch_all(
        """
        SELECT category, SUM(trade_usd) AS total_trade
        FROM top_commodities
        WHERE flow = 'Export'
        GROUP BY category
        ORDER BY total_trade DESC
        LIMIT 8
        """
    )
    for row in rows:
        _, _, label = row["category"].partition("_")
        row["category"] = (label or row["category"]).replace("_", " ").title()
    return cached_response(rows)


@app.get("/api/export-import-ratio")
def api_export_import_ratio():
    return cached_response(
        fetch_all(
            """
            SELECT flow, SUM(trade_usd) AS total_trade
            FROM trade_by_year_flow
            WHERE flow IN ('Export', 'Import')
            GROUP BY flow
            ORDER BY flow
            """
        )
    )


COUNTRY_NAME_MAP = {
    "USA": "United States of America",
    "Russian Federation": "Russia",
    "Rep. of Korea": "South Korea",
    "China, Hong Kong SAR": "Hong Kong",
    "Viet Nam": "Vietnam",
    "United Rep. of Tanzania": "Tanzania",
    "Czech Rep.": "Czechia",
    "Lao People's Dem. Rep.": "Laos",
    "Brunei Darussalam": "Brunei",
    "Iran (Islamic Rep. of)": "Iran",
    "Dem. People's Rep. of Korea": "North Korea",
    "Bolivia (Plurinational State of)": "Bolivia",
    "Bosnia Herzegovina": "Bosnia and Herz.",
    "Rep. of Moldova": "Moldova",
    "Solomon Isds": "Solomon Is.",
    "State of Palestine": "Palestine",
    "Swaziland": "eSwatini",
    "TFYR of Macedonia": "Macedonia",
}


@app.get("/api/all-countries-trade")
def api_all_countries_trade():
    rows = fetch_all(
        """
        SELECT country_or_area, trade_usd AS total_trade
        FROM top_countries
        WHERE flow = 'Export'
        ORDER BY country_or_area
        """
    )
    return cached_response(
        {
            COUNTRY_NAME_MAP.get(row["country_or_area"], row["country_or_area"]): row["total_trade"]
            for row in rows
        }
    )


def annual_average_growth(rows: list[dict], flow: str) -> tuple[float | None, dict]:
    baseline = [row for row in rows if row["flow"] == flow and 2000 <= row["year"] <= 2009]
    recent = [row for row in rows if row["flow"] == flow and 2010 <= row["year"] <= 2019]
    if not baseline or not recent:
        return None, {"baseline_years": [], "recent_years": []}

    baseline_average = fmean(row["trade_usd"] for row in baseline)
    recent_average = fmean(row["trade_usd"] for row in recent)
    growth = ((recent_average - baseline_average) / baseline_average) * 100 if baseline_average else None
    return (
        round(growth, 1) if growth is not None else None,
        {
            "baseline_years": [row["year"] for row in baseline],
            "recent_years": [row["year"] for row in recent],
        },
    )


@app.get("/api/growth-metrics")
def api_growth_metrics():
    rows = fetch_all(
        """
        SELECT year, flow, trade_usd
        FROM trade_by_year_flow
        WHERE year BETWEEN 2000 AND 2019
        ORDER BY year, flow
        """
    )
    export_growth, export_periods = annual_average_growth(rows, "Export")
    import_growth, import_periods = annual_average_growth(rows, "Import")
    recent_years = export_periods["recent_years"] or import_periods["recent_years"]
    period = (
        f"Annual average: 2000–2009 vs {min(recent_years)}–{max(recent_years)}"
        if recent_years
        else "Insufficient data"
    )
    return cached_response(
        {
            "export_growth_pct": export_growth,
            "import_growth_pct": import_growth,
            "period": period,
            "method": "annual_average",
            "years_compared": export_periods,
        }
    )


@app.get("/api/metadata")
def api_metadata():
    return cached_response(
        {row["key"]: row["value"] for row in fetch_all("SELECT key, value FROM pipeline_metadata")},
        browser_max_age=300,
        cdn_max_age=3600,
    )


@app.get("/api/health")
def health_check():
    try:
        with closing(get_db_connection()) as connection:
            integrity = connection.execute("PRAGMA quick_check").fetchone()[0]
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
            }
            required = {
                "trade_by_year_flow",
                "top_countries",
                "top_commodities",
                "pipeline_metadata",
            }
            healthy = integrity == "ok" and required.issubset(tables)
    except (OSError, sqlite3.Error):
        healthy = False
    return jsonify({"status": "ok" if healthy else "degraded"}), 200 if healthy else 503


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG") == "1", host="127.0.0.1", port=5000)
