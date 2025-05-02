import json
import sqlite3
from pathlib import Path
from etl.models import DrugEventRow

DB_PATH = Path("data/openfda_events.db")
JSON_PATH = Path("data/openfda_events_flat.json")
TABLE_NAME = "drug_adverse_events"

# 读取数据
with open(JSON_PATH, "r") as f:
    rows = json.load(f)

# 获取字段及类型（全部转为TEXT，数值型可后续优化）
fields = DrugEventRow.model_fields.keys()

# SQLite建表语句
columns_sql = ",\n    ".join([f'"{field}" TEXT' for field in fields])
create_table_sql = f"""
CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    {columns_sql}
);
"""

# 连接数据库并建表
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute(create_table_sql)

# 插入数据
placeholders = ", ".join([f':{field}' for field in fields])
insert_sql = f"INSERT INTO {TABLE_NAME} ({', '.join(fields)}) VALUES ({placeholders})"

c.executemany(insert_sql, rows)
conn.commit()

# 建立常用字段索引
for idx_field in ["top_safetyreportid", "drug_medicinalproduct", "reaction_reactionmeddrapt", "top_receivedate"]:
    try:
        c.execute(f'CREATE INDEX IF NOT EXISTS idx_{TABLE_NAME}_{idx_field} ON {TABLE_NAME} ("{idx_field}")')
    except Exception as e:
        print(f"Index creation failed for {idx_field}: {e}")

conn.commit()
conn.close()

print(f"Loaded {len(rows)} rows into {DB_PATH} ({TABLE_NAME})") 