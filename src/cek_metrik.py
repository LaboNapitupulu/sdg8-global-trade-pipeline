import pandas as pd

def tampilkan_metrik():
    try:
        # Membaca file output dari Pandas
        df = pd.read_parquet('gold_data_quality_pandas.parquet')
        
        print("\n" + "="*55)
        print(" LAPORAN KUALITAS DATA (SILVER LAYER) ")
        print("="*55)
        
        # Mencetak data dengan rapi
        for index, row in df.iterrows():
            print("{:<42} : {:,.2f}".format(row['metrik'], row['nilai']))
            
        print("="*55 + "\n")
        
    except FileNotFoundError:
        print("File parquet tidak ditemukan. Jalankan pipeline Pandas dulu.")

if __name__ == "__main__":
    tampilkan_metrik()
