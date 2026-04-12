import pandas as pd
import json

# Read the Excel file
file_path = r"F:\MotiBuddy1\用户调查问卷结果\351800066_按序号_MotiBuddy 用户体验调查问卷_41_41.xlsx"

try:
    # Read all sheets
    xls = pd.ExcelFile(file_path)
    print("Sheet names:", xls.sheet_names)
    
    # Read the first sheet
    df = pd.read_excel(file_path)
    
    print("\n=== 数据概览 ===")
    print(f"总记录数: {len(df)}")
    print(f"列名: {list(df.columns)}")
    
    print("\n=== 前5行数据 ===")
    print(df.head())
    
    print("\n=== 数据类型 ===")
    print(df.dtypes)
    
    # Save to JSON for easier viewing
    df.to_json(r"F:\MotiBuddy1\survey_results.json", orient='records', force_ascii=False, indent=2)
    print("\n✅ 数据已保存到 survey_results.json")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
