import sys
import os

# Add application directory to Python path
sys.path.insert(0, os.path.dirname(__file__))
 
# Import Flask application
from backend.app import app as application 