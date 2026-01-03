# HOWTO: Deploy to PythonAnywhere

This guide details the steps to deploy the Papeterie Engine to PythonAnywhere.
**Prerequisites**:
- A PythonAnywhere account (Paid account recommended for custom domains, but free works for testing).
- Local environment set up with `uv`.

## 1. Prepare the Codebase
Ensure your local code is committed and pushed to GitHub.
```bash
git push origin master
```

## 2. PythonAnywhere Setup

### Clone Repository
Open a Bash console on PythonAnywhere and clone your repo:
```bash
git clone https://github.com/yourusername/papeterie-engine.git
cd papeterie-engine
```

### Virtual Environment
Create a virtual environment using `uv` (if available) or standard `virtualenv`.
```bash
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install a2wsgi  # Required for WSGI adapter
```
*Note: You may need to export your `uv` lockfile to `requirements.txt` first locally:*
```bash
uv export --format requirements-txt > requirements.txt
```

## 3. Backend Configuration

### Create WSGI Config
In the PythonAnywhere "Web" tab, create a new web app. Choose **Manual Configuration** (Python 3.10).
Edit the **WSGI configuration file**:

```python
import sys
import os

# Add your project directory to the sys.path
project_home = '/home/yourusername/papeterie-engine'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Activate virtualenv
activate_this = os.path.join(project_home, '.venv/bin/activate_this.py')
with open(activate_this) as file_:
    exec(file_.read(), dict(__file__=activate_this))

# Import FastAPI app and wrap with a2wsgi
from src.server.main import app as application_
from a2wsgi import ASGIMiddleware
application = ASGIMiddleware(application_)
```

### Environment Variables
Set up your `.env` file in the project root on PythonAnywhere:
```bash
cp .env.example .env
nano .env
# Fill in GEMINI_API_KEY, etc.
```

## 4. Frontend Configuration

### Build Locally
Build the React app locally:
```bash
cd src/web
npm install
npm run build
```

### Upload Assets
Upload the content of `src/web/dist` to PythonAnywhere, typically to `/home/yourusername/papeterie-engine/src/web/dist`.

### Serve Static Files
In the PythonAnywhere "Web" tab, go to **Static Files**:

| URL | Directory |
| :--- | :--- |
| `/static` | `/home/yourusername/papeterie-engine/src/web/dist/assets` |
| `/` | `/home/yourusername/papeterie-engine/src/web/dist` |

*Note: You may need to configure the index.html serving specifically if the root URL doesn't pick it up automatically.*

## 5. Verify

Reload the web app in the PythonAnywhere console.
Visit `yourusername.pythonanywhere.com`.
- The frontend should load.
- API calls to `/api/...` should succeed.

For deeper architectural details, see [Deployment Design](design/deployment.md).
