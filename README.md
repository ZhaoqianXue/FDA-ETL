# Interactive Knowledge Graph for Semaglutide & Tirzepatide Adverse Events: An Automated FDA Data Pipeline

This report details the conception, development, and deployment of a comprehensive platform designed to automatically extract, process, analyze, and visualize adverse event (AE) data specifically associated with the GLP-1 receptor agonists Semaglutide and Tirzepatide (marketed under brand names like Ozempic, Wegovy, Mounjaro, Zepbound, etc.). Addressing the critical need for targeted safety signal detection amidst the rising popularity of these weight-loss medications, I engineered an end-to-end solution. The core challenge was isolating AEs reported *solely* in connection with either Semaglutide or Tirzepatide within individual FDA safety reports, filtering out confounding data from co-reported medications. This was achieved through a robust, automated Extract, Transform, Load (ETL) pipeline built with Python, leveraging the OpenFDA API and employing Pydantic for rigorous data validation before loading into an SQLite database. The ETL process is designed for idempotency and scheduled for daily execution, ensuring data freshness. Complementing the data pipeline, I developed a Flask-based backend API providing cached, filtered, and paginated access to the curated AE data, along with endpoints for metadata (medications, AE terms) and CSV export functionality. The user-facing component is a dynamic React frontend featuring interactive filters (drug, AE, date range), a configurable Top N% AE display, and crucially, a D3.js-powered knowledge graph visualizing the relationships between the drugs and their reported adverse events. The entire system is deployed on PythonAnywhere, configured for automated daily data updates and reliable access. This project delivers a powerful tool for proactive pharmacovigilance, enabling near real-time monitoring and deeper understanding of the safety profiles of these specific, high-profile medications.

- Website: [https://zx136.pythonanywhere.com/](https://zx136.pythonanywhere.com/)
- GitHub: [https://zx136.pythonanywhere.com/](https://zx136.pythonanywhere.com/)

## Components

1. **ETL Pipeline**: Extracts data from OpenFDA API, transforms it, and loads it into SQLite
2. **Flask Backend**: Provides API endpoints for the frontend with 24-hour caching
3. **React Frontend**: Interactive UI for filtering and viewing the data

## Deployment Instructions for cPanel

### 1. Preparing the Files

1. Build the React frontend:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Create a project directory on your local machine with:
   - The `backend` folder containing the Flask application
   - The `data` folder containing the SQLite database
   - The `etl` folder containing the ETL scripts
   - The `frontend/build` folder containing the compiled React app

### 2. Uploading to cPanel

1. Log in to your cPanel account
2. Go to File Manager and navigate to your website's root directory
3. Create a new directory for the project (e.g., `drug_dashboard`)
4. Upload all the files and directories from your local project directory to this new directory

### 3. Setting Up Python Application

1. In cPanel, go to "Setup Python App"
2. Create a new Python application:
   - Choose a name for the application
   - Select Python version (3.7+ recommended)
   - Set the application path to your uploaded project directory
   - Set the application startup file to `backend/app.py`
   - Set Application URL to your desired endpoint (e.g., `/drug-dashboard`)

3. Add the following packages to your requirements:
   ```
   flask==2.0.1
   flask-caching==1.10.1
   requests==2.25.1
   ```

4. Click "Setup" to create the Python application

### 4. Configuring the Application Entry Point

Create a `passenger_wsgi.py` file in the project root directory with the following content:

```python
import sys
import os

# Add application directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

# Import Flask application
from backend.app import app as application
```

### 5. Setting Up Cron Job for ETL Pipeline

1. In cPanel, go to "Cron Jobs"
2. Add a new cron job to run the ETL pipeline daily:
   - Set the schedule (e.g., once per day at 1:00 AM)
   - Command to run: `cd /home/username/drug_dashboard && python etl/main_etl.py` (replace username with your cPanel username)

### 6. Configuring Frontend for Production

1. Edit the `.htaccess` file in your project root:
   ```
   RewriteEngine On
   # API requests go to the Flask application
   RewriteRule ^api/(.*)$ /drug-dashboard/$1 [P,L]
   # All other requests serve the React app
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^ frontend/build/index.html [L]
   ```

2. Point the document root to the `frontend/build` directory for your subdomain

## Usage

1. Access the web application at your configured URL
2. Use the filter section to:
   - Select a specific medication from the dropdown
   - Select a specific adverse event from the dropdown
   - Choose a date range
3. View the paginated results in the table
4. Export the filtered data as CSV using the export button

## Maintenance

- The ETL pipeline will run daily via cron job
- The API results are cached for 24 hours to ensure response times < 2 seconds
- Monitor the SQLite database size periodically and consider archiving old data if needed 
