# SDG 8 Global Trade Pipeline: Decent Work & Economic Growth

A full-stack data engineering pipeline and interactive dashboard analyzing global commodity trade statistics (1990-present) to support UN Sustainable Development Goal 8.

**🌍 [Live Dashboard on Vercel](https://sdg8-global-trade-pipeline-bkef3fx9x-nowell.vercel.app/)** | **📊 [UN Comtrade Dataset (Kaggle)](https://www.kaggle.com/datasets/unitednations/global-commodity-trade-statistics)**

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?style=flat-square&logo=python)
![Apache Spark](https://img.shields.io/badge/Apache_Spark-Data_Processing-E25A1C?style=flat-square&logo=apache-spark)
![Pandas](https://img.shields.io/badge/Pandas-ETL-150458?style=flat-square&logo=pandas)
![Flask](https://img.shields.io/badge/Flask-API-000000?style=flat-square&logo=flask)
![React](https://img.shields.io/badge/React-Vite-61DAFB?style=flat-square&logo=react)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=flat-square&logo=sqlite)

---

## Project Overview

This project analyzes the UN Global Commodity Trade Statistics dataset to uncover trends, growth metrics, and geopolitical trade dynamics. It features a Medallion Architecture (Bronze -> Silver -> Gold) data pipeline built with Apache Spark and Pandas, exposing insights through a lightning-fast Flask API, and visualized in a modern, interactive React dashboard.

---

## Core Features

- **Interactive Global Map:** A zoomable, drag-able world map highlighting trade volumes per country using a dynamic heatmap.
- **Advanced Data Pipeline:** Implements the Medallion Architecture. Raw CSV data is ingested, cleaned, and aggregated into highly optimized `.parquet` and `.db` formats.
- **Exploded 3D Pie Charts:** Analyzes category distributions without visual clutter, solving common z-fighting issues in web visualizations.
- **Real-Time Analytics Dashboard:** A responsive, dark-mode React UI that fetches pre-computed data from the Flask API instantly.
- **Vercel Ready:** Architected to be deployed directly to Vercel as a serverless monorepo (Frontend Vite + Backend Python).

---

## Technical Stack

- **Data Processing:** Apache Spark (PySpark), Pandas
- **Backend API:** Python, Flask, SQLite
- **Frontend:** React, Vite, Recharts, React Simple Maps, React Google Charts
- **Deployment:** Vercel (Serverless Functions)

---

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+

### Installation & Setup

**1. Clone the repository:**
```bash
git clone https://github.com/LaboNapitupulu/sdg8-global-trade-pipeline.git
cd sdg8-global-trade-pipeline
```

**2. Process the Data (ETL):**
Ensure your raw UN Comtrade dataset (`commodity_trade_statistics_data.csv`) is placed in the `data/` directory. Run the pipeline to generate Gold data and the SQLite database.
```bash
python src/etl_medallion_pandas.py
python dashboard/backend/data_pipeline.py
```

**3. Start the Backend API:**
```bash
cd dashboard/backend
pip install -r requirements.txt
flask run --port=5000
```

**4. Launch the Frontend Dashboard:**
Open a new terminal window.
```bash
cd dashboard/frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Vercel Deployment

This project includes a native `vercel.json` configuration for zero-config deployments. Simply import this repository into Vercel, leave all settings as default, and Vercel will automatically build the React frontend and deploy the Flask API as Serverless Functions.
