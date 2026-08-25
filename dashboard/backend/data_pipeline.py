"""Build the analytics SQLite database from the UN Comtrade CSV export.

The source contains both TOTAL rows and HS6 detail rows. They represent
overlapping grains and must never be summed together. Macro indicators use
TOTAL rows, while commodity indicators use detailed Export rows only.
"""

from __future__ import annotations

import argparse
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent.parent
CSV_FILE = REPO_ROOT / "data" / "commodity_trade_statistics_data.csv"
DB_FILE = BASE_DIR / "trade_data.db"

REQUIRED_COLUMNS = {
    "country_or_area",
    "year",
    "comm_code",
    "commodity",
    "flow",
    "trade_usd",
    "category",
}

AGGREGATE_REPORTERS = {
    "EU-28",
    "World",
    "Other Asia, nes",
    "So. African Customs Union",
}
VALID_FLOWS = {"Export", "Import"}


def _combine_partial_frames(frames: list[pd.DataFrame], keys: list[str]) -> pd.DataFrame:
    """Combine chunk-level aggregates into a single aggregate frame."""
    if not frames:
        return pd.DataFrame(columns=[*keys, "trade_usd"])
    combined = pd.concat(frames, ignore_index=True)
    return combined.groupby(keys, as_index=False, observed=True)["trade_usd"].sum()


def aggregate_csv(csv_file: Path, chunk_size: int = 500_000) -> tuple[dict[str, pd.DataFrame], dict[str, int]]:
    """Stream and aggregate the source CSV without mixing analytical grains."""
    header = set(pd.read_csv(csv_file, nrows=0).columns)
    missing = REQUIRED_COLUMNS - header
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")

    yearly_parts: list[pd.DataFrame] = []
    country_parts: list[pd.DataFrame] = []
    commodity_parts: list[pd.DataFrame] = []
    metrics = {
        "source_rows": 0,
        "invalid_rows": 0,
        "macro_rows": 0,
        "detail_export_rows": 0,
    }

    reader = pd.read_csv(
        csv_file,
        chunksize=chunk_size,
        usecols=sorted(REQUIRED_COLUMNS),
        dtype={
            "country_or_area": "string",
            "comm_code": "string",
            "commodity": "string",
            "flow": "string",
            "category": "string",
        },
    )

    for chunk_number, chunk in enumerate(reader, start=1):
        metrics["source_rows"] += len(chunk)
        print(f"  Processing chunk {chunk_number:,} ({metrics['source_rows']:,} rows read)...")

        for column in ("country_or_area", "comm_code", "commodity", "flow", "category"):
            chunk[column] = chunk[column].str.strip()
        chunk["year"] = pd.to_numeric(chunk["year"], errors="coerce")
        chunk["trade_usd"] = pd.to_numeric(chunk["trade_usd"], errors="coerce")

        valid_mask = (
            chunk[list(REQUIRED_COLUMNS - {"trade_usd", "year"})].notna().all(axis=1)
            & chunk["year"].notna()
            & chunk["trade_usd"].notna()
            & chunk["trade_usd"].ge(0)
        )
        metrics["invalid_rows"] += int((~valid_mask).sum())
        chunk = chunk.loc[valid_mask].copy()
        chunk["year"] = chunk["year"].astype("int16")
        chunk["comm_code"] = chunk["comm_code"].str.upper()

        macro = chunk[
            chunk["comm_code"].eq("TOTAL")
            & chunk["flow"].isin(VALID_FLOWS)
            & ~chunk["country_or_area"].isin(AGGREGATE_REPORTERS)
        ]
        details = chunk[
            ~chunk["comm_code"].eq("TOTAL")
            & chunk["flow"].eq("Export")
        ]

        metrics["macro_rows"] += len(macro)
        metrics["detail_export_rows"] += len(details)
        yearly_parts.append(
            macro.groupby(["year", "flow"], as_index=False, observed=True)["trade_usd"].sum()
        )
        country_parts.append(
            macro.groupby(["country_or_area", "flow"], as_index=False, observed=True)["trade_usd"].sum()
        )
        commodity_parts.append(
            details.groupby(
                ["comm_code", "commodity", "category", "flow"],
                as_index=False,
                observed=True,
            )["trade_usd"].sum()
        )

    tables = {
        "trade_by_year_flow": _combine_partial_frames(yearly_parts, ["year", "flow"]),
        "top_countries": _combine_partial_frames(country_parts, ["country_or_area", "flow"]),
        "top_commodities": _combine_partial_frames(
            commodity_parts,
            ["comm_code", "commodity", "category", "flow"],
        ),
    }
    return tables, metrics


def _validate_tables(tables: dict[str, pd.DataFrame]) -> None:
    for name, frame in tables.items():
        if frame.empty:
            raise ValueError(f"Generated table {name!r} is empty")
        if frame["trade_usd"].isna().any() or frame["trade_usd"].lt(0).any():
            raise ValueError(f"Generated table {name!r} contains invalid trade values")

    flows = set(tables["trade_by_year_flow"]["flow"])
    if flows != VALID_FLOWS:
        raise ValueError(f"Unexpected macro flows: {sorted(flows)}")
    if tables["top_commodities"]["comm_code"].eq("TOTAL").any():
        raise ValueError("Commodity table contains overlapping TOTAL rows")


def write_database(tables: dict[str, pd.DataFrame], metrics: dict[str, int], db_file: Path) -> None:
    """Write a complete temporary database, validate it, then replace atomically."""
    db_file.parent.mkdir(parents=True, exist_ok=True)
    temp_file = db_file.with_suffix(f"{db_file.suffix}.tmp")
    if temp_file.exists():
        temp_file.unlink()

    metadata = pd.DataFrame(
        [
            ("schema_version", "2"),
            ("built_at_utc", datetime.now(timezone.utc).isoformat()),
            ("source_rows", str(metrics["source_rows"])),
            ("invalid_rows", str(metrics["invalid_rows"])),
            ("macro_rows", str(metrics["macro_rows"])),
            ("detail_export_rows", str(metrics["detail_export_rows"])),
            ("macro_grain", "TOTAL rows; Export/Import; aggregate reporters excluded"),
            ("commodity_grain", "HS detail rows; Export only"),
        ],
        columns=["key", "value"],
    )

    try:
        with closing(sqlite3.connect(temp_file)) as conn:
            with conn:
                conn.execute("PRAGMA journal_mode=DELETE")
                conn.execute("PRAGMA synchronous=FULL")
                for name, frame in tables.items():
                    frame.to_sql(name, conn, if_exists="fail", index=False)
                metadata.to_sql("pipeline_metadata", conn, if_exists="fail", index=False)
                conn.execute("CREATE UNIQUE INDEX idx_year_flow ON trade_by_year_flow(year, flow)")
                conn.execute("CREATE UNIQUE INDEX idx_country_flow ON top_countries(country_or_area, flow)")
                conn.execute("CREATE INDEX idx_commodity_flow_value ON top_commodities(flow, trade_usd DESC)")
                conn.execute("CREATE INDEX idx_category_flow ON top_commodities(category, flow)")

                integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
                if integrity != "ok":
                    raise RuntimeError(f"SQLite integrity check failed: {integrity}")

        os.replace(temp_file, db_file)
    finally:
        if temp_file.exists():
            temp_file.unlink()


def build_database(csv_file: Path = CSV_FILE, db_file: Path = DB_FILE, chunk_size: int = 500_000) -> None:
    if not csv_file.exists():
        raise FileNotFoundError(
            f"Dataset not found: {csv_file}. Place commodity_trade_statistics_data.csv in data/."
        )

    print("Starting grain-safe analytics pipeline...")
    print(f"  Source: {csv_file}")
    print(f"  Output: {db_file}")
    tables, metrics = aggregate_csv(csv_file, chunk_size=chunk_size)
    _validate_tables(tables)
    write_database(tables, metrics, db_file)
    print("Pipeline completed successfully.")
    for name, frame in tables.items():
        print(f"  {name}: {len(frame):,} rows")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=CSV_FILE, help="Path to the source CSV")
    parser.add_argument("--db", type=Path, default=DB_FILE, help="Output SQLite path")
    parser.add_argument("--chunk-size", type=int, default=500_000)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    build_database(args.csv, args.db, args.chunk_size)
