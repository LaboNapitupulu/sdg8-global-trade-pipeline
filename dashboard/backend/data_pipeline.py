import pandas as pd
import sqlite3
import os

# --- Path Resolution (Relatif dari lokasi file ini) ---
# Menggunakan path relatif agar skrip bisa dijalankan dari mana saja
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..', '..'))

CSV_FILE = os.path.join(REPO_ROOT, 'data', 'commodity_trade_statistics_data.csv')
DB_FILE = os.path.join(BASE_DIR, 'trade_data.db')


def build_database():
    # Validasi file CSV tersedia sebelum memulai proses panjang
    if not os.path.exists(CSV_FILE):
        print(f"ERROR: File dataset tidak ditemukan di:\n  {CSV_FILE}")
        print("Pastikan file CSV berada di dalam folder 'data/' di root repositori.")
        return

    print("Starting data pipeline... This might take a few minutes for 1.2 GB data.")
    print(f"  Sumber CSV : {CSV_FILE}")
    print(f"  Output DB  : {DB_FILE}")

    conn = sqlite3.connect(DB_FILE)

    trade_by_year_flow = pd.DataFrame()
    top_countries = pd.DataFrame()
    top_commodities = pd.DataFrame()

    chunk_size = 1_000_000
    chunk_count = 0

    for chunk in pd.read_csv(
        CSV_FILE,
        chunksize=chunk_size,
        usecols=['country_or_area', 'year', 'commodity', 'flow', 'trade_usd', 'category']
    ):
        chunk_count += 1
        print(f"  Processing chunk {chunk_count}...")

        # 1. Trade by year and flow
        y_f = chunk.groupby(['year', 'flow'])['trade_usd'].sum().reset_index()
        trade_by_year_flow = pd.concat([trade_by_year_flow, y_f])

        # 2. Top Countries (Export/Import)
        t_c = chunk.groupby(['country_or_area', 'flow'])['trade_usd'].sum().reset_index()
        top_countries = pd.concat([top_countries, t_c])

        # 3. Top Commodities
        t_comm = chunk.groupby(['commodity', 'category'])['trade_usd'].sum().reset_index()
        top_commodities = pd.concat([top_commodities, t_comm])

    print("Aggregating chunks...")

    # Final aggregation
    trade_by_year_flow = trade_by_year_flow.groupby(['year', 'flow'])['trade_usd'].sum().reset_index()
    top_countries = top_countries.groupby(['country_or_area', 'flow'])['trade_usd'].sum().reset_index()
    top_commodities = top_commodities.groupby(['commodity', 'category'])['trade_usd'].sum().reset_index()

    print("Saving to SQLite database...")
    trade_by_year_flow.to_sql('trade_by_year_flow', conn, if_exists='replace', index=False)
    top_countries.to_sql('top_countries', conn, if_exists='replace', index=False)
    top_commodities.to_sql('top_commodities', conn, if_exists='replace', index=False)

    conn.close()
    print(f"Data pipeline completed successfully! DB tersimpan di: {DB_FILE}")


if __name__ == '__main__':
    build_database()
