# HOWTO: Deploy to PythonAnywhere

This guide provides a detailed, click-by-click walkthrough for deploying the Papeterie Engine to PythonAnywhere.

## 1. Prerequisites & Account Tiers

Before starting, verify your PythonAnywhere account tier:
*   **Free Tier ("Beginner")**: Supports **ONE** web app. NO custom domains.
*   **Hacker ($5/mo)**: Supports **ONE** web app. Custom domains enabled.
*   **Web Dev ($12/mo)**: Supports **TWO** web apps.

> [!WARNING]
> **Hosting Limit**: If you are on the Free or Hacker tier and already have a web app running, you **MUST DELETE** the old app configuration to deploy this one. (See "Phase 2: Step B" below).

## 2. Deployment Size

We deploy in **Lightweight Mode** to stay within disk quotas details:
*   **Source**: ~35MB
*   **Deps**: ~100MB (Core only).
*   **Excluded**: Heavy processing libraries (`numpy`, `opencv`, `scipy`) are omitted by default. The app will gracefully handle these missing features.

## 3. Step-by-Step Walkthrough

### Phase 1: Local Preparation (Do this on your computer)

1.  Open your project terminal locally.
2.  Run the preparation script:
    ```bash
    ./scripts/prepare_deploy.sh
    ```
3.  This generates `requirements.txt` (lite version) and builds the frontend.
4.  **Important**: Push the changes to GitHub:
    ```bash
    git add requirements.txt src/web/dist
    git commit -m "chore: prepare deployment artifacts"
    git push
    ```

### Phase 2: PythonAnywhere Dashboard

Log in to [pythonanywhere.com](https://www.pythonanywhere.com).

#### Step A: Console & Code
1.  Click the **"Consoles"** tab (top menu).
2.  Under "Start a new console:", click **"Bash"**.
3.  (A terminal window opens).
4.  Clone your code (replace `your-github-username`):
    ```bash
    git clone https://github.com/your-github-username/papeterie-engine.git papeterie
    cd papeterie
    ```
5.  Run the automated setup script:
    ```bash
    python3.10 scripts/setup_pythonAnywhere.py
    ```
    *   *This sets up the virtualenv and installs dependencies.*

#### Step B: Dealing with Existing Apps (Crucial)
1.  Click the **"Web"** tab.
2.  **Look at the left sidebar**.
3.  If you see an old project listed (e.g., `youruser.pythonanywhere.com`):
    *   Scroll to the bottom of the content area.
    *   Find the red **"Delete <yourapp>"** button.
    *   **Click it**. Confirm deletion.
    *   *Note: This only deletes the hosting config, not your files.*

#### Step C: Create New App
1.  Click **"Add a new web app"** (Blue button).
2.  **Click "Next"**.
3.  **Select "Manual configuration"** (Do NOT select Flask/Django).
4.  **Select "Python 3.10"**.
5.  **Click "Next"**.

#### Step D: Configure App Settings
You are now on the app configuration page.

1.  **Code Section**:
    *   **Source code**: Enter `/home/yourusername/papeterie`
    *   **Working directory**: Enter `/home/yourusername/papeterie`
2.  **Virtualenv Section**:
    *   Click the red path text.
    *   Enter: `/home/yourusername/papeterie/.venv`
    *   Click the checkmark to save.
3.  **WSGI Configuration File**:
    *   Click the link looking like `/var/www/..._wsgi.py`.
    *   **Delete entire file contents**.
    *   Paste the following (update `yourusername`!):
        ```python
        import sys
        import os
        from dotenv import load_dotenv

        path = '/home/yourusername/papeterie'
        if path not in sys.path:
            sys.path.append(path)

        # Load environment variables
        load_dotenv(os.path.join(path, '.env'))

        from src.wsgi import application
        ```
    *   **Save** (top right) and go back to **Web** tab.

#### Step E: Static Files (Performance)
Scroll to **Static files** table. Add these two rows:

| URL | Directory |
| :--- | :--- |
| `/assets` | `/home/yourusername/papeterie/assets` |
| `/ui_assets` | `/home/yourusername/papeterie/src/web/dist/ui_assets` |

#### Step F: Secrets
1.  Go to the **"Files"** tab.
2.  Navigate to `papeterie`.
3.  Create a new file named `.env`.
4.  Add your API key:
    ```
    GEMINI_API_KEY=your_key_here
    ```
5.  **Save**.

#### Step G: Upload Frontend Assets
1.  On the **"Files"** tab, verify `src/web/dist` exists.
2.  If the folders are empty (git doesn't sync build artifacts if they are ignored), you must upload them.
3.  **Pro Tip**: Zip your local `dist` folder -> `dist.zip`.
4.  Upload `dist.zip` to `papeterie/src/web/`.
5.  Open a Bash console and run: `unzip dist.zip -d papeterie/src/web/`.

### Phase 3: Launch
1.  Go to the **"Web"** tab.
2.  Click the big green **"Reload"** button.
3.  Visit your site URL.

## 4. Maintenance / Updates
To update your code later:
1.  Bash Console: `cd papeterie && git pull`.
2.  If dependencies changed: `python3.10 scripts/setup_pythonAnywhere.py`.
3.  Reload Web App.
