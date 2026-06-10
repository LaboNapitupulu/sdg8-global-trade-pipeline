from pyspark.sql import SparkSession
from pyspark.sql.functions import col, lower, initcap, sum as _sum, round as _round
import time

def run_medallion_pipeline():
    print("=== MEMULAI PIPELINE MEDALLION ARCHITECTURE (SPARK) ===")
    start_time = time.time()

    # Inisialisasi Spark Session dengan dukungan Hive Terpusat
    spark = SparkSession.builder \
        .appName("SDG8_Global_Trade_Medallion") \
        .config("spark.sql.warehouse.dir", "hdfs://namenode:9000/user/hive/warehouse") \
        .config("hive.metastore.uris", "thrift://hive-metastore:9083") \
        .enableHiveSupport() \
        .getOrCreate()

    # Pastikan database Hive tersedia
    spark.sql("CREATE DATABASE IF NOT EXISTS trade_db")


    # 1. BRONZE LAYER (Membaca Data Mentah dari HDFS)
    print("[1/3] Mengekstraksi data dari Bronze Layer HDFS...")
    bronze_df = spark.read.csv("hdfs://namenode:9000/data/bronze/trade/trade_data.csv", header=True, inferSchema=True)
    
    total_rows_bronze = bronze_df.count()
    print("      Total baris awal (Bronze): {}".format(total_rows_bronze))

    # 2. SILVER LAYER (Pembersihan & Standarisasi)
    print("[2/3] Memproses data di Silver Layer...")
    
    # Filter hanya untuk ekspor
    silver_df = bronze_df.filter(lower(col("flow")).contains("export"))
    total_export_raw = silver_df.count()

    # Membersihkan nilai kosong secara transparan (Mitigasi Etis)
    silver_df = silver_df.dropna(subset=["weight_kg", "trade_usd"])
    
    # Standarisasi teks nama negara
    silver_df = silver_df.withColumn("country_or_area", initcap(lower(col("country_or_area"))))
    
    total_rows_silver = silver_df.count()
    rows_dropped = total_export_raw - total_rows_silver
    # Casting float untuk mencegah error pembagian integer di Python 2/3 lama
    percentage_dropped = (rows_dropped / float(total_export_raw)) * 100 if total_export_raw > 0 else 0

    print("      Total baris bersih (Silver): {}".format(total_rows_silver))

    # 3. GOLD LAYER (Agregasi Bisnis & Metrik)
    print("[3/3] Membangun tabel analitik di Gold Layer Hive...")

    # GOLD TABLE 1: Tren Ekspor Global
    gold_trends_df = silver_df.groupBy("year", "country_or_area", "commodity") \
        .agg(
            _sum("trade_usd").alias("total_nilai_ekspor_usd"),
            _sum("weight_kg").alias("total_volume_kg")
        ).orderBy(col("year").desc(), col("total_nilai_ekspor_usd").desc())

    # Menyimpan Gold Table 1 ke Apache Hive (Format Parquet)
    gold_trends_df.write \
        .mode("overwrite") \
        .format("parquet") \
        .saveAsTable("trade_db.gold_global_trends")

    # GOLD TABLE 2: Metrik Transparansi Kualitas Data
    metrics_data = [
        ("Total Transaksi Ekspor Mentah", float(total_export_raw)),
        ("Transaksi Lolos Uji Kualitas (Silver)", float(total_rows_silver)),
        ("Transaksi Dihapus (Anomali)", float(rows_dropped)),
        ("Persentase Data Hilang (%)", round(percentage_dropped, 2))
    ]
    metrics_columns = ["metrik", "nilai"]
    gold_metrics_df = spark.createDataFrame(metrics_data, metrics_columns)

    # Menyimpan Gold Table 2 ke Apache Hive
    gold_metrics_df.write \
        .mode("overwrite") \
        .format("parquet") \
        .saveAsTable("trade_db.gold_data_quality")

    # Menghitung Performa
    end_time = time.time()
    latency = end_time - start_time
    throughput = total_rows_bronze / latency if latency > 0 else 0

    print("\n=== PIPELINE SELESAI ===")
    print("Latensi End-to-End : {:.2f} detik".format(latency))
    print("Throughput         : {:,.2f} baris/detik".format(throughput))
    print("Data telah tersimpan di Hive (trade_db) format Parquet.")

    spark.stop()

if __name__ == "__main__":
    run_medallion_pipeline()
