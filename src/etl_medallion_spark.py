"""Spark implementation of the same Export HS-detail contract as Pandas."""

from __future__ import annotations

import time

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, lower, sum as sum_, trim, upper, when
from pyspark.sql.types import DoubleType, IntegerType, LongType, StringType, StructField, StructType


SOURCE_SCHEMA = StructType(
    [
        StructField("country_or_area", StringType(), True),
        StructField("year", IntegerType(), True),
        StructField("comm_code", StringType(), True),
        StructField("commodity", StringType(), True),
        StructField("flow", StringType(), True),
        StructField("trade_usd", LongType(), True),
        StructField("weight_kg", DoubleType(), True),
        StructField("quantity_name", StringType(), True),
        StructField("quantity", DoubleType(), True),
        StructField("category", StringType(), True),
    ]
)


def run_medallion_pipeline() -> None:
    print("=== SPARK MEDALLION PIPELINE ===")
    started = time.perf_counter()
    spark = (
        SparkSession.builder.appName("SDG8_Global_Trade_Medallion")
        .config("spark.sql.warehouse.dir", "hdfs://namenode:9000/user/hive/warehouse")
        .config("hive.metastore.uris", "thrift://hive-metastore:9083")
        .enableHiveSupport()
        .getOrCreate()
    )

    try:
        spark.sql("CREATE DATABASE IF NOT EXISTS trade_db")
        bronze = spark.read.csv(
            "hdfs://namenode:9000/data/bronze/trade/trade_data.csv",
            header=True,
            schema=SOURCE_SCHEMA,
        )
        source_rows = bronze.count()

        raw_exports = bronze.filter(
            (lower(trim(col("flow"))) == "export")
            & (upper(trim(col("comm_code"))) != "TOTAL")
        )
        quality = raw_exports.agg(
            count("*").alias("raw_export_rows"),
            sum_(when(col("trade_usd").isNull(), 1).otherwise(0)).alias("missing_trade_value"),
            sum_(when(col("weight_kg").isNull(), 1).otherwise(0)).alias("missing_weight"),
        ).first()

        silver = (
            raw_exports.dropna(
                subset=["year", "country_or_area", "comm_code", "commodity", "trade_usd"]
            )
            .filter(col("trade_usd") >= 0)
            .withColumn("country_or_area", trim(col("country_or_area")))
            .withColumn("commodity", trim(col("commodity")))
            .withColumn("comm_code", upper(trim(col("comm_code"))))
            .cache()
        )
        valid_export_rows = silver.count()

        gold_trends = silver.groupBy("year", "country_or_area", "comm_code", "commodity").agg(
            sum_("trade_usd").alias("total_nilai_ekspor_usd"),
            sum_("weight_kg").alias("total_volume_kg"),
        )
        (
            gold_trends.write.mode("overwrite")
            .format("parquet")
            .saveAsTable("trade_db.gold_global_trends")
        )

        metrics_data = [
            ("Total source rows", float(source_rows)),
            ("Raw HS-detail Export rows", float(quality.raw_export_rows)),
            ("Valid Export rows", float(valid_export_rows)),
            ("Rows missing trade value", float(quality.missing_trade_value)),
            ("Rows missing weight (retained for value analysis)", float(quality.missing_weight)),
        ]
        (
            spark.createDataFrame(metrics_data, ["metrik", "nilai"])
            .write.mode("overwrite")
            .format("parquet")
            .saveAsTable("trade_db.gold_data_quality")
        )
        silver.unpersist()

        latency = time.perf_counter() - started
        print(f"Latency: {latency:.2f} seconds")
        print(f"Throughput: {source_rows / latency:,.2f} rows/second")
    finally:
        spark.stop()


if __name__ == "__main__":
    run_medallion_pipeline()
