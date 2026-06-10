# 🌍 Analisis Data Perdagangan Global (SDG 8): Pipeline Big Data dengan Arsitektur Medallion

Proyek *Data Engineering* berskala *produksi* yang dirancang untuk memproses, membersihkan, dan menganalisis lebih dari **8,2 Juta baris** data transaksi perdagangan global. Proyek ini bertujuan untuk memantau indikator ekonomi makro yang sejalan dengan **SDG 8 (Pekerjaan Layak dan Pertumbuhan Ekonomi)**.

Sistem ini mengimplementasikan **Arsitektur Medallion (Bronze, Silver, Gold)** yang berjalan di atas klaster terdistribusi (Dockerized) menggunakan Apache Hadoop (HDFS), Apache Spark, Apache Hive, dan divisualisasikan secara *real-time* melalui Apache Superset.

---

## 🏗️ Arsitektur Medallion (Alur Data)

Pipeline ini memproses data mentah yang masif dengan membaginya ke dalam tiga lapisan analitik terstruktur:

1. **🥉 Bronze Layer (Ingesti Mentah):** Menyerap data CSV perdagangan global mentah ke dalam sistem penyimpanan terdistribusi HDFS (*Hadoop Distributed File System*) tanpa modifikasi apa pun.
2. **🥈 Silver Layer (Pembersihan & Jaminan Kualitas):** Menggunakan **Apache Spark** untuk melakukan pembersihan data berbasis aturan yang ketat:
   - Memfilter transaksi hanya untuk tipe *Export*.
   - Menghapus baris yang memiliki anomali/nilai kosong (*null*) pada kolom krusial seperti nilai dolar (`trade_usd`) dan volume fisik (`weight_kg`).
   - Menstandardisasi tipografi nama negara (*Title Case*).
   - Mencatat anomali ke dalam tabel metadata kualitas data.
3. **🥇 Gold Layer (Agregasi Bisnis):** Menghitung agregasi tingkat bisnis (tren perdagangan global berdasarkan negara, tahun, dan jenis komoditas). Hasil akhirnya disimpan di **Apache Hive** menggunakan format **Parquet** yang sangat terkompresi dan efisien untuk di-kueri.

---

## 🛠️ Teknologi & Ekosistem yang Digunakan

- **Core Data Engine:** Apache Spark 3.0.0 (PySpark)
- **Data Lake Storage:** Apache Hadoop HDFS 2.7.4
- **Metastore & Query Layer:** Apache Hive 2.3.7 (HiveServer2 & PostgreSQL Metastore)
- **Data Visualization:** Apache Superset
- **Infrastructure & Orchestration:** Docker & Docker-Compose
- **Baseline Engine (Untuk Perbandingan):** Python Pandas

---

## 📂 Struktur Repositori

```text
sdg8-global-trade-pipeline/
│
├── src/
│   ├── etl_medallion_spark.py    # Skrip utama pipeline terdistribusi (PySpark)
│   ├── etl_medallion_pandas.py   # Skrip pembanding single-thread (Pandas)
│   └── cek_metrik.py             # Utilitas ekstraksi log kualitas data
│
├── assets/
│   └── dashboard_superset.png    # Tangkapan layar hasil visualisasi
│
├── docker-compose.yml            # Konfigurasi klaster Big Data
├── .gitignore                    # Pengecualian file berukuran besar
└── README.md                     # Dokumentasi proyek ini

```

---

## 📊 Hasil Eksperimen & Benchmark Performa

### 1. Matriks Performa Komputasi (Pandas vs Spark)

Tabel di bawah ini menunjukkan perbandingan *benchmark* nyata antara menjalankan skrip Python *single-threaded* (Pandas) melawan *Distributed Computing Framework* (Apache Spark Cluster):

| Metrik | Pandas (Baseline - Single Node) | Apache Spark (Distributed Cluster) |
| --- | --- | --- |
| **Throughput Ingesti** | 95.963 baris/dtk | **68.021 baris/dtk** |
| **Latensi End-to-End** | 85,72 detik | **120,94 detik (~2 menit)** |
| **Format Penyimpanan Output** | Parquet (Lokal) | **Parquet (HDFS / Apache Hive)** |
| **Kemampuan Scale-out** | ❌ Tidak (Terbatas oleh RAM laptop) | ✅ **Ya (Linearly scalable antar node)** |

> 💡 **Engineering Insight (The Spark Overhead Paradox):** > Meskipun pada skala data 1,8 GB (8,2 juta baris) Pandas mencatat waktu eksekusi yang sedikit lebih cepat karena tidak ada biaya birokrasi di dalam RAM utama (zero-overhead), Pandas sepenuhnya dibatasi oleh *bottleneck* memori perangkat. Sebaliknya, Apache Spark melakukan inisialisasi *Java Virtual Machine* (JVM) dan pemisahan blok (partitioning) di HDFS. Spark menjamin bahwa bahkan jika data bertambah menjadi **100 GB atau 1 Terabyte**, klaster akan memprosesnya dengan mulus, di saat Pandas akan langsung mengalami *crash* karena *Out-of-Memory* (OOM).

### 2. Metrik Kualitas Data (Silver Layer Log)

Sistem audit otomatis menangkap metrik berikut selama fase uji kualitas data (Data Quality Check) di dalam *runtime* eksekusi Spark:

| Metrik Kualitas Data | Nilai |
| --- | --- |
| **Total Transaksi Ekspor Mentah (Bronze)** | 3.223.315 baris |
| **Transaksi Lolos Uji Kualitas (Silver Layer)** | 3.171.052 baris |
| **Transaksi Dihapus (Anomali/Kosong)** | 52.263 baris |
| **Persentase Data Hilang (%)** | **1,62%** |

---

## 🚀 Cara Menjalankan Proyek

### Prasyarat

* Docker & Docker-Compose telah terinstal.
* Lingkungan Python 3.6+ dengan pustaka `pyspark`, `pandas`, dan `pyarrow`.

### Langkah 1: Nyalakan Klaster Big Data

Jalankan perintah berikut di terminal untuk menghidupkan seluruh layanan Hadoop, Spark, dan Superset:

```bash
docker-compose up -d
docker start superset

```

*(Tunggu sekitar 3-5 menit agar HiveServer2 selesai melakukan proses booting dan membuka port 10000).*

### Langkah 2: Eksekusi Pipeline PySpark Terdistribusi

Salin skrip ke dalam mesin *Master* Spark dan eksekusi tugasnya:

```bash
# Salin skrip ke container Spark Master
docker cp src/etl_medallion_spark.py spark-master:/app/

# Submit Job ke klaster Spark
docker exec -it spark-master /spark/bin/spark-submit --master local[*] /app/etl_medallion_spark.py

```

### Langkah 3: Verifikasi Data di Apache Hive

Anda dapat memverifikasi log kualitas data langsung dari terminal (tanpa membuka UI) dengan menembak *database* Hive:

```bash
docker exec -it hive-server hive -e "SELECT * FROM trade_db.gold_data_quality;"

```

---

## 📈 Visualisasi Dashboard Eksekutif

Tabel bersih yang dihasilkan di *Gold Layer* Apache Hive dihubungkan melalui *driver* **PyHive** (Port `10000`) secara langsung ke **Apache Superset**. Ini membuka pintu bagi pembuatan *dashboard* eksekutif interaktif yang merangkum:

* Total Nilai Ekspor Makro Ekonomi (Tren Triliunan USD).
* Total Volume Fisik Perdagangan (Triliunan KG).
* Top 10 Negara Pengekspor Terkuat di Dunia (Pendorong SDG 8).
* Komoditas Global dengan Permintaan Tertinggi.

