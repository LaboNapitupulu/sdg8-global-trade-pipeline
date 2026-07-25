import pandas as pd
import os
import sys

def tampilkan_metrik(source: str = 'pandas'):
    """
    Menampilkan laporan kualitas data dari output pipeline.

    Argumen:
      --source pandas  : Membaca dari file parquet lokal (hasil etl_medallion_pandas.py)
    """
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    if source == 'pandas':
        file_path = os.path.join(BASE_DIR, 'gold_data_quality_pandas.parquet')
    else:
        print(f"ERROR: Sumber '{source}' tidak dikenal. Gunakan 'pandas'.")
        return

    try:
        df = pd.read_parquet(file_path)

        print("\n" + "="*55)
        print("  LAPORAN KUALITAS DATA (SILVER LAYER)")
        print("  Sumber: {}".format(file_path))
        print("="*55)

        for _, row in df.iterrows():
            print("{:<42} : {:>12,.2f}".format(row['metrik'], row['nilai']))

        print("="*55 + "\n")

    except FileNotFoundError:
        print(f"File parquet tidak ditemukan di: {file_path}")
        print("Jalankan pipeline Pandas terlebih dahulu dengan: python etl_medallion_pandas.py")

if __name__ == "__main__":
    # Mendukung argumen CLI: python cek_metrik.py --source pandas
    source = 'pandas'
    if '--source' in sys.argv:
        idx = sys.argv.index('--source')
        if idx + 1 < len(sys.argv):
            source = sys.argv[idx + 1]

    tampilkan_metrik(source=source)
