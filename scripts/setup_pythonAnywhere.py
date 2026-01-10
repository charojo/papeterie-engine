import getpass
import subprocess
import sys
from pathlib import Path


def main():
    print("=== Papeterie Engine: PythonAnywhere Setup ===")

    # 1. Detect Username
    username = getpass.getuser()
    print(f"Detected username: {username}")
    print("If this is incorrect, please edit this script or run as the correct user.")

    project_root = Path(__file__).resolve().parent.parent
    print(f"Project root: {project_root}")

    # 2. Virtualenv Setup
    venv_path = project_root / ".venv"
    if not venv_path.exists():
        print("\n--> Creating virtual environment...")
        # Use sys.executable to ensure we use the same python version for the venv
        subprocess.run([sys.executable, "-m", "venv", str(venv_path)], check=True)
    else:
        print("\n--> Virtual environment already exists.")

    # 3. Dependencies
    requirements_file = project_root / "requirements.txt"
    if not requirements_file.exists():
        print(f"\n[WARNING] {requirements_file} not found!")
        print("You generally need to upload 'requirements.txt' from your local machine:")
        print("  uv export --format requirements-txt > requirements.txt")
        print("Skipping dependency installation for now...")
    else:
        print("\n--> Installing dependencies...")
        try:
            # We use 'uv pip' to installs dependencies into the venv
            # This assumes 'uv' is installed on the system (which it is for this project)
            subprocess.run(["uv", "pip", "install", "-r", str(requirements_file)], check=True)
            # Ensure a2wsgi is definitely installed (it should be in requirements.txt)
            subprocess.run(["uv", "pip", "install", "a2wsgi"], check=True)
        except subprocess.CalledProcessError as e:
            print(f"Error installing dependencies: {e}")
            return

    # 4. WSGI Config
    # PythonAnywhere WSGI files are typically at /var/www/<username>_pythonanywhere_com_wsgi.py
    # We try to detect the domain.
    expected_wsgi_path = Path(f"/var/www/{username}_pythonanywhere_com_wsgi.py")

    # Check if the file exists or if we can write to the directory
    if expected_wsgi_path.parent.exists():
        if expected_wsgi_path.exists():
            overwrite = (
                input(f"\nWSGI file {expected_wsgi_path} exists. Overwrite? [y/N]: ")
                .strip()
                .lower()
            )
            if overwrite == "y":
                write_wsgi_file(expected_wsgi_path, project_root)
        else:
            write_wsgi_file(expected_wsgi_path, project_root)
    else:
        print("\n[INFO] /var/www/ not found. skipping WSGI generation (running locally?).")

    # 5. Instructions
    print_instructions(username, project_root)


def write_wsgi_file(path, project_root):
    print(f"\n--> Writing WSGI configuration to {path}...")
    content = f"""import sys
import os
from dotenv import load_dotenv

# Add your project directory to the sys.path
project_home = '{project_root}'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Load environment variables from .env file
project_folder = os.path.expanduser(project_home)
load_dotenv(os.path.join(project_folder, '.env'))

# Import the WSGI app directly from our adapter entry point
from src.wsgi import application
"""
    try:
        path.write_text(content)
        print("Success!")
    except Exception as e:
        print(f"Error writing WSGI file: {e}")


def print_instructions(username, project_root):
    print("\n" + "=" * 50)
    print("SETUP COMPLETE! Next Steps:")
    print("=" * 50)
    print("1. Go to the 'Web' tab in PythonAnywhere.")
    print("2. Verify 'Source code' path is correct.")
    print("3. Verify 'Virtualenv' path is set to .venv")
    print("4. Configure 'Static files':")
    ui_static_dir = project_root / "src" / "web" / "dist" / "ui_assets"
    assets_dir = project_root / "assets"
    print(f"   URL: /ui_assets   Path: {ui_static_dir}")
    print(f"   URL: /assets      Path: {assets_dir}")
    print("\n5. Don't forget to build your frontend locally and upload 'src/web/dist'!")
    print("6. RELOAD the web app.")
    print("=" * 50)


if __name__ == "__main__":
    main()
