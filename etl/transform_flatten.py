import json
import pandas as pd
from pathlib import Path
from etl.models import DrugEventRow

RAW_PATH = Path("data/raw_openfda_events.json")
FLAT_JSON_PATH = Path("data/openfda_events_flat.json")
FLAT_CSV_PATH = Path("data/openfda_events_flat.csv")

with open(RAW_PATH, "r") as f:
    data = json.load(f)

rows = []
invalid_count = 0
invalid_examples = []

# 字段映射：点分隔转下划线
FIELD_MAP = lambda k: k.replace(".", "_")

def flatten_dict(d, parent_key="", sep="."):
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

for drug_name, reports in data.items():
    # 标准化药物名：首字母大写其余小写
    std_drug_name = drug_name.lower().capitalize()
    for report in reports:
        top_fields = {k: v for k, v in report.items() if k != "patient"}
        patient = report.get("patient", {})
        patient_fields = {k: v for k, v in patient.items() if k not in ["reaction", "drug"]}
        reactions = patient.get("reaction", [])
        drugs = patient.get("drug", [])
        drug = drugs[0] if drugs else {}
        if not reactions:
            reactions = [{}]
        for reaction in reactions:
            row = {}
            row.update(flatten_dict(top_fields, "top"))
            row.update(flatten_dict(patient_fields, "patient"))
            row.update(flatten_dict(reaction, "reaction"))
            row.update(flatten_dict(drug, "drug"))
            row["source_drug_name"] = std_drug_name
            # 字段名点转下划线
            row = {FIELD_MAP(k).lower(): v for k, v in row.items()}
            # 年龄单位转换为周岁整数
            age = row.get("patient_patientonsetage")
            age_unit = row.get("patient_patientonsetageunit")
            age_years = None
            try:
                if age is not None and age_unit is not None:
                    age = float(age)
                    if age_unit == "801":  # years
                        age_years = int(round(age))
                    elif age_unit == "802":  # months
                        age_years = int(age // 12)
                    elif age_unit == "803":  # weeks
                        age_years = int(age // 52)
                    elif age_unit == "804":  # days
                        age_years = int(age // 365)
                    elif age_unit == "800":  # decades
                        age_years = int(age * 10)
                    elif age_unit == "805":  # hours
                        age_years = 0
                    elif age_unit == "806":  # minutes
                        age_years = 0
                    elif age_unit == "807":  # seconds
                        age_years = 0
                if age_years is not None:
                    row["patient_patientonsetage"] = age_years
                else:
                    row["patient_patientonsetage"] = None
            except Exception:
                row["patient_patientonsetage"] = None
            # 去除unit字段
            if "patient_patientonsetageunit" in row:
                del row["patient_patientonsetageunit"]
            # 修正openfda相关字段类型
            for k in list(row.keys()):
                if k.startswith("drug_openfda_") and isinstance(row[k], list):
                    # 转为逗号拼接字符串
                    row[k] = ",".join(str(x) for x in row[k])
            # Pydantic数据验证
            try:
                validated = DrugEventRow(**row)
                rows.append(validated.dict())
            except Exception as e:
                invalid_count += 1
                if len(invalid_examples) < 5:
                    invalid_examples.append((row, str(e)))

print(f"Valid rows: {len(rows)}, Invalid rows: {invalid_count}")
if invalid_examples:
    print("Sample invalid rows and errors:")
    for r, err in invalid_examples:
        print(json.dumps(r, indent=2))
        print("Error:", err)
        print("-"*40)

# 保存为JSON
with open(FLAT_JSON_PATH, "w") as f:
    json.dump(rows, f, indent=2)

if rows:
    print(f"Flattened and validated data saved to {FLAT_JSON_PATH}, count: {len(rows)}")
else:
    print("No valid data to save.") 