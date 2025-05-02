import subprocess
import sys
from pathlib import Path

ETL_DIR = Path(__file__).parent

steps = [
    [sys.executable, str(ETL_DIR / "extract_openfda.py")],
    [sys.executable, str(ETL_DIR / "transform_flatten.py")],
    [sys.executable, str(ETL_DIR / "load_sqlite.py")],
]

for step in steps:
    print(f"Running: {' '.join(step)}")
    result = subprocess.run(step)
    if result.returncode != 0:
        print(f"Step failed: {' '.join(step)}")
        sys.exit(result.returncode)
print("ETL pipeline completed successfully.") 