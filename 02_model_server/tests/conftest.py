import sys
from pathlib import Path

# Run the tests from 02_model_server/ or from anywhere: make `import app` work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
