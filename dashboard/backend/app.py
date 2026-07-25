from flask import Flask, jsonify, make_response
from flask_cors import CORS
import sqlite3
import pandas as pd
import os

app = Flask(__name__)
# Izinkan semua origin agar bisa diakses dari localhost:5173 (Vite)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Path database relatif terhadap lokasi file ini
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "trade_data.db")


# --- Global Error Handler ---
@app.errorhandler(Exception)
def handle_exception(e):
    """Mengembalikan JSON yang informatif untuk setiap error yang tidak tertangani."""
    app.logger.error(f"Unhandled exception: {e}", exc_info=True)
    return jsonify({"error": "Terjadi kesalahan internal.", "detail": str(e)}), 500


def get_db_connection():
    """Membuat koneksi SQLite dengan validasi ketersediaan file DB."""
    if not os.path.exists(DB_FILE):
        raise FileNotFoundError(
            f"Database tidak ditemukan di: {DB_FILE}. "
            "Jalankan data_pipeline.py terlebih dahulu."
        )
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def cached_response(data, max_age=300):
    """Membungkus respons JSON dengan header caching (default: 5 menit)."""
    response = make_response(jsonify(data))
    response.headers['Cache-Control'] = f'public, max-age={max_age}'
    return response


# --- API Endpoints ---

@app.route('/api/trade-by-year')
def api_trade_by_year():
    conn = get_db_connection()
    query = """
        SELECT year, flow, SUM(trade_usd) as total_trade
        FROM trade_by_year_flow
        WHERE year >= 1990
        GROUP BY year, flow
        ORDER BY year ASC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    years = sorted(df['year'].unique().tolist())
    exports = []
    imports = []

    for year in years:
        exp_val = df[(df['year'] == year) & (df['flow'] == 'Export')]['total_trade'].sum()
        imp_val = df[(df['year'] == year) & (df['flow'] == 'Import')]['total_trade'].sum()
        exports.append(float(exp_val) if pd.notnull(exp_val) else 0)
        imports.append(float(imp_val) if pd.notnull(imp_val) else 0)

    return cached_response({'years': years, 'exports': exports, 'imports': imports})


@app.route('/api/top-countries')
def api_top_countries():
    conn = get_db_connection()
    query_exp = """
        SELECT country_or_area, SUM(trade_usd) as total_export
        FROM top_countries
        WHERE flow = 'Export'
        GROUP BY country_or_area
        ORDER BY total_export DESC
        LIMIT 10
    """
    df_exp = pd.read_sql_query(query_exp, conn)

    query_imp = """
        SELECT country_or_area, SUM(trade_usd) as total_import
        FROM top_countries
        WHERE flow = 'Import'
        GROUP BY country_or_area
        ORDER BY total_import DESC
        LIMIT 10
    """
    df_imp = pd.read_sql_query(query_imp, conn)
    conn.close()

    return cached_response({
        'exports': df_exp.to_dict(orient='records'),
        'imports': df_imp.to_dict(orient='records')
    })


@app.route('/api/top-commodities')
def api_top_commodities():
    conn = get_db_connection()
    query = """
        SELECT commodity, category, SUM(trade_usd) as total_trade
        FROM top_commodities
        WHERE commodity != 'ALL COMMODITIES'
        GROUP BY commodity, category
        ORDER BY total_trade DESC
        LIMIT 10
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    return cached_response(df.to_dict(orient='records'))


@app.route('/api/trade-by-category')
def api_trade_by_category():
    conn = get_db_connection()
    query = """
        SELECT category, SUM(trade_usd) as total_trade
        FROM top_commodities
        WHERE category != 'all_commodities'
        GROUP BY category
        ORDER BY total_trade DESC
        LIMIT 8
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    df['category'] = df['category'].apply(
        lambda x: ' '.join(x.split('_')[1:4]).title() + '...' if '_' in x else x.title()
    )
    return cached_response(df.to_dict(orient='records'))


@app.route('/api/export-import-ratio')
def api_export_import_ratio():
    conn = get_db_connection()
    query = """
        SELECT flow, SUM(trade_usd) as total_trade
        FROM trade_by_year_flow
        GROUP BY flow
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    return cached_response(df.to_dict(orient='records'))


@app.route('/api/all-countries-trade')
def api_all_countries_trade():
    conn = get_db_connection()
    query = """
        SELECT country_or_area, SUM(trade_usd) as total_trade
        FROM top_countries
        WHERE flow = 'Export'
          AND country_or_area NOT IN ('EU-28', 'World', 'Other Asia, nes', 'So. African Customs Union')
        GROUP BY country_or_area
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    # Normalisasi nama negara agar kompatibel dengan Google GeoChart
    name_map = {
        'USA': 'United States',
        'Russian Federation': 'Russia',
        'Rep. of Korea': 'South Korea',
        'China, Hong Kong SAR': 'Hong Kong',
        'Viet Nam': 'Vietnam',
        'United Rep. of Tanzania': 'Tanzania',
        'Czech Rep.': 'Czech Republic',
        'Central African Rep.': 'Central African Republic',
        'Dominican Rep.': 'Dominican Republic',
        "Lao People's Dem. Rep.": 'Laos',
        'Brunei Darussalam': 'Brunei',
        'Iran (Islamic Rep. of)': 'Iran',
        "Dem. People's Rep. of Korea": 'North Korea',
        'Bolivia (Plurinational State of)': 'Bolivia',
        "Côte d'Ivoire": 'Ivory Coast',
    }
    df['country_or_area'] = df['country_or_area'].replace(name_map)

    data = dict(zip(df['country_or_area'], df['total_trade']))
    return cached_response(data)


@app.route('/api/growth-metrics')
def api_growth_metrics():
    """
    Menghitung pertumbuhan Year-over-Year (YoY) antara dekade 2000-2009 vs 2010-2019.
    Ini menggantikan nilai tren hardcoded di frontend.
    """
    conn = get_db_connection()
    query = """
        SELECT year, flow, SUM(trade_usd) as total_trade
        FROM trade_by_year_flow
        WHERE year BETWEEN 2000 AND 2019
        GROUP BY year, flow
        ORDER BY year ASC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    def pct_growth(df, flow, decade_a, decade_b):
        """Hitung pertumbuhan dari dekade A ke dekade B."""
        val_a = df[(df['year'].isin(decade_a)) & (df['flow'] == flow)]['total_trade'].sum()
        val_b = df[(df['year'].isin(decade_b)) & (df['flow'] == flow)]['total_trade'].sum()
        if val_a == 0:
            return 0.0
        return round(((val_b - val_a) / val_a) * 100, 1)

    decade_2000s = list(range(2000, 2010))
    decade_2010s = list(range(2010, 2020))

    export_growth = pct_growth(df, 'Export', decade_2000s, decade_2010s)
    import_growth = pct_growth(df, 'Import', decade_2000s, decade_2010s)

    return cached_response({
        'export_growth_pct': export_growth,
        'import_growth_pct': import_growth,
        'period': '2000s vs 2010s'
    })


@app.route('/api/health')
def health_check():
    """Endpoint health check untuk memverifikasi API dan DB berjalan."""
    db_ok = os.path.exists(DB_FILE)
    return jsonify({
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "not found",
        "db_path": DB_FILE
    }), 200 if db_ok else 503


if __name__ == '__main__':
    print(f"Starting UN Trade API...")
    print(f"Database: {DB_FILE}")
    print(f"DB exists: {os.path.exists(DB_FILE)}")
    app.run(debug=True, host='0.0.0.0', port=5000)
