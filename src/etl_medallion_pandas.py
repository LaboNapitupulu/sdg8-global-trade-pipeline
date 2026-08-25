"""Memory-conscious Pandas implementation of the export medallion pipeline."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = BASE_DIR.parent / "data" / "commodity_trade_statistics_data.csv"
DETAIL_COLUMNS = ["country_or_area", "year", "comm_code", "commodity", "flow", "trade_usd", "weight_kg"]


def _compact(parts: list[pd.DataFrame]) -> list[pd.DataFrame]:
    combined = pd.concat(parts, ignore_index=True)
    compacted = combined.groupby(
        ["year", "country_or_area", "comm_code", "commodity"],
        as_index=False,
        observed=True,
    ).agg(
        total_nilai_ekspor_usd=("total_nilai_ekspor_usd", "sum"),
        total_volume_kg=("total_volume_kg", lambda values: values.sum(min_count=1)),
    )
    return [compacted]


def run_pandas_pipeline(input_file: Path = DEFAULT_INPUT, chunk_size: int = 500_000) -> None:
    if not input_file.exists():
        raise FileNotFoundError(f"Dataset not found: {input_file}")

    print("=== PANDAS MEDALLION PIPELINE ===")
    print(f"Source: {input_file}")
    try:
        import psutil

        available_gb = psutil.virtual_memory().available / 1e9
        print(f"Available RAM: {available_gb:.1f} GB")
    except ImportError:
        print("Install psutil for a pre-flight memory report.")

    started = time.perf_counter()
    totals = {
        "source_rows": 0,
        "raw_export_rows": 0,
        "valid_export_rows": 0,
        "missing_trade_value": 0,
        "missing_weight": 0,
    }
    gold_parts: list[pd.DataFrame] = []

    reader = pd.read_csv(
        input_file,
        chunksize=chunk_size,
        usecols=DETAIL_COLUMNS,
        dtype={
            "country_or_area": "string",
            "comm_code": "string",
            "commodity": "string",
            "flow": "string",
        },
    )

    for chunk_number, chunk in enumerate(reader, start=1):
        totals["source_rows"] += len(chunk)
        chunk["flow"] = chunk["flow"].str.strip()
        chunk["comm_code"] = chunk["comm_code"].str.strip().str.upper()
        exports = chunk[chunk["flow"].eq("Export") & ~chunk["comm_code"].eq("TOTAL")].copy()
        totals["raw_export_rows"] += len(exports)
        totals["missing_trade_value"] += int(exports["trade_usd"].isna().sum())
        totals["missing_weight"] += int(exports["weight_kg"].isna().sum())

        exports.dropna(subset=["year", "country_or_area", "comm_code", "commodity", "trade_usd"], inplace=True)
        exports = exports[exports["trade_usd"].ge(0)]
        exports["country_or_area"] = exports["country_or_area"].str.strip()
        exports["commodity"] = exports["commodity"].str.strip()
        totals["valid_export_rows"] += len(exports)

        partial = exports.groupby(
            ["year", "country_or_area", "comm_code", "commodity"],
            as_index=False,
            observed=True,
        ).agg(
            total_nilai_ekspor_usd=("trade_usd", "sum"),
            total_volume_kg=("weight_kg", lambda values: values.sum(min_count=1)),
        )
        gold_parts.append(partial)
        if len(gold_parts) >= 6:
            gold_parts = _compact(gold_parts)
        print(f"  Chunk {chunk_number}: {totals['source_rows']:,} rows read")

    if not gold_parts:
        raise ValueError("No valid Export detail rows were found")
    gold_trends = _compact(gold_parts)[0]
    gold_trends.sort_values(
        by=["year", "total_nilai_ekspor_usd"],
        ascending=[False, False],
        inplace=True,
    )

    output_trends = BASE_DIR / "gold_global_trends_pandas.parquet"
    output_quality = BASE_DIR / "gold_data_quality_pandas.parquet"
    gold_trends.to_parquet(output_trends, index=False)

    quality = pd.DataFrame(
        {
            "metrik": [
                "Total source rows",
                "Raw HS-detail Export rows",
                "Valid Export rows",
                "Rows missing trade value",
                "Rows missing weight (retained for value analysis)",
            ],
            "nilai": [float(value) for value in totals.values()],
        }
    )
    quality.to_parquet(output_quality, index=False)

    latency = time.perf_counter() - started
    throughput = totals["source_rows"] / latency if latency else 0
    print("=== PIPELINE COMPLETE ===")
    print(f"Latency: {latency:.2f} seconds")
    print(f"Throughput: {throughput:,.2f} rows/second")
    print(f"Gold rows: {len(gold_trends):,}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--chunk-size", type=int, default=500_000)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_pandas_pipeline(args.input, args.chunk_size)
