import requests
import json
import time
from pathlib import Path

DRUGS = [
    "semaglutide",
    "tirzepatide"
]

API_URL = "https://api.fda.gov/drug/event.json"
PAGE_SIZE = 100
SAVE_PATH = Path("data/raw_openfda_events.json")

all_results = {drug: [] for drug in DRUGS}

def fetch_all_events(drug):
    print(f"Fetching all events for: {drug}")
    skip = 0
    total = None
    while True:
        params = {
            "search": f"patient.drug.medicinalproduct:{drug}",
            "limit": PAGE_SIZE,
            "skip": skip,
            "sort": "receivedate:asc"
        }
        try:
            response = requests.get(API_URL, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            if not results:
                break

            for report in results:
                patient = report.get("patient", {})
                drugs = patient.get("drug", [])
                drug_names = set(
                    d.get("medicinalproduct", "").strip().lower() for d in drugs if d.get("medicinalproduct")
                )
                if len(drug_names) == 1 and drug_names.pop() == drug.lower():
                    all_results[drug].append(report)
            skip += PAGE_SIZE
            print(f"{drug}: fetched {skip} records...")
            time.sleep(0.5) 
        except Exception as e:
            print(f"Error fetching {drug} at skip={skip}: {e}")
            break

for drug in DRUGS:
    fetch_all_events(drug)

with open(SAVE_PATH, "w") as f:
    json.dump(all_results, f, indent=2)

print(f"All data saved to {SAVE_PATH}") 