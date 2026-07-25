import pandas as pd
import time
import os

def run_pandas_pipeline():
    print("=== MEMULAI PIPELINE MEDALLION ARCHITECTURE (PANDAS) ===")
    print("PERINGATAN: Memori RAM sedang bekerja keras. Jangan buka aplikasi berat...")

    # --- Path Resolution ---
    # Menggunakan path relatif dari lokasi skrip ini agar bisa dijalankan dari mana saja
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    REPO_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
    file_path = os.path.join(REPO_ROOT, 'data', 'commodity_trade_statistics_data.csv')

    if not os.path.exists(file_path):
        print(f"ERROR: File dataset tidak ditemukan di:\n  {file_path}")
        print("Pastikan file CSV berada di dalam folder 'data/' di root repositori.")
        return

    # --- Pengecekan Ketersediaan Memori ---
    try:
        import psutil
        available_gb = psutil.virtual_memory().available / 1e9
        print(f"RAM tersedia: {available_gb:.1f} GB")
        if available_gb < 5.0:
            print(f"PERINGATAN: RAM tersedia hanya {available_gb:.1f} GB. Risiko Out-of-Memory (OOM) sangat tinggi!")
            print("Pertimbangkan untuk menutup aplikasi lain terlebih dahulu.")
    except ImportError:
        print("(Info: Install 'psutil' untuk cek ketersediaan memori sebelum proses.)")

    start_time = time.time()


    # 1. BRONZE LAYER
    print("\n[1/3] Mengekstraksi data dari Bronze Layer (File Lokal)...")
    print(f"      Memuat: {file_path}")

    # Pandas memuat SELURUH baris ke dalam RAM sekaligus (Single-Thread)
    bronze_df = pd.read_csv(file_path, low_memory=False)

    total_rows_bronze = len(bronze_df)
    print("      Total baris awal (Bronze): {:,}".format(total_rows_bronze))

    # 2. SILVER LAYER
    print("[2/3] Memproses data di Silver Layer...")

    # Filter hanya untuk ekspor
    silver_df = bronze_df[bronze_df['flow'].str.lower().str.contains('export', na=False)].copy()
    total_export_raw = len(silver_df)

    # Membersihkan nilai kosong
    silver_df.dropna(subset=['weight_kg', 'trade_usd'], inplace=True)

    # Standarisasi teks nama negara
    silver_df['country_or_area'] = silver_df['country_or_area'].str.title()

    total_rows_silver = len(silver_df)
    rows_dropped = total_export_raw - total_rows_silver
    percentage_dropped = (rows_dropped / float(total_export_raw)) * 100 if total_export_raw > 0 else 0

    print("      Total baris bersih (Silver): {:,}".format(total_rows_silver))

    # 3. GOLD LAYER
    print("[3/3] Membangun tabel analitik di Gold Layer...")

    gold_trends_df = silver_df.groupby(['year', 'country_or_area', 'commodity'], as_index=False).agg(
        total_nilai_ekspor_usd=('trade_usd', 'sum'),
        total_volume_kg=('weight_kg', 'sum')
    )

    gold_trends_df.sort_values(by=['year', 'total_nilai_ekspor_usd'], ascending=[False, False], inplace=True)

    # Simpan output ke direktori yang sama dengan skrip ini
    output_trends = os.path.join(BASE_DIR, 'gold_global_trends_pandas.parquet')
    output_quality = os.path.join(BASE_DIR, 'gold_data_quality_pandas.parquet')

    gold_trends_df.to_parquet(output_trends, index=False)

    metrics_data = {
        "metrik": [
            "Total Transaksi Ekspor Mentah",
            "Transaksi Lolos Uji Kualitas (Silver)",
            "Transaksi Dihapus (Anomali)",
            "Persentase Data Hilang (%)"
        ],
        "nilai": [
            float(total_export_raw),
            float(total_rows_silver),
            float(rows_dropped),
            round(percentage_dropped, 2)
        ]
    }
    gold_metrics_df = pd.DataFrame(metrics_data)
    gold_metrics_df.to_parquet(output_quality, index=False)

    # Kalkulasi Performa
    end_time = time.time()
    latency = end_time - start_time
    throughput = total_rows_bronze / latency if latency > 0 else 0

    print("\n=== PIPELINE PANDAS SELESAI ===")
    print("Latensi End-to-End : {:.2f} detik".format(latency))
    print("Throughput         : {:,.2f} baris/detik".format(throughput))
    print(f"Data telah tersimpan di:\n  {output_trends}\n  {output_quality}")

if __name__ == "__main__":
    run_pandas_pipeline()
