# Known Issues & Defects

Use this file to track "nits", minor bugs, and design weak spots that need attention but aren't currently prioritized in the main backlog.

## Template
```markdown
### [Issue Title]
- **Status**: [Open/Resolved]
- **Severity**: [Low/Medium/High]
- **Description**: Brief description of the issue.
- **Location**: (Optional) File or Component.
- **Resolution**: (If resolved) How it was fixed.
```

## Active Issues

### layer issues
- **Description**: 
* layer numbers are not shown in timeline (like 20, 60, etc)

### Timeline issues
- **Description**: 
* selecting and icon in the timeline changes location
* timeline should allow going negative by a small amount (like -10 or -20)
* when sprite is selected it needs to pop to the top in the main view and timeline

### Double Fetching of Sprite Assets
- **Status**: Resolved
- **Severity**: Medium
- **Description**: `Theatre.js` was fetching the same sprite image multiple times (checked via network logs).
- **Location**: `src/web/src/engine/Theatre.js`
- **Resolution**: Implemented `spriteCache` (Map) in `Theatre` class to store and reuse load promises.

### 404 Logs for Missing Prompt Files
- **Status**: Resolved
- **Severity**: Low
- **Description**: Frontend logs 404 errors when `.prompt.json` files are missing (which is a valid state).
- **Location**: `src/server/main.py`
- **Resolution**: Added a specific API route to intercept `.prompt.json` requests; returns empty JSON `{}` if file is missing instead of 404.

### Sprite Loading Regression (Community Scenes)
- **Status**: In Progress
- **Severity**: High
- **Description**: Sprites for community scenes (e.g., Sailboat) fail to load, showing 404s for the 'default' user path. Backend correctly sets `is_community` but user has a local copy of sailboat scene that shadows the community version.
- **Location**: `src/web/src/engine/Theatre.js`, `src/server/routers/scenes.py`
- **Resolution**: Need to either remove user's local sailboat scene or update backend logic to prefer community scenes when both exist.

### CORS Origin Mismatch (localhost vs 127.0.0.1)
- **Status**: Resolved
- **Severity**: Medium
- **Description**: Accessing the frontend via `127.0.0.1` while the backend assumed `localhost` caused CORS blocks and hardcoded URL failures.
- **Location**: `src/web/src/config.js`, `src/server/main.py`
- **Resolution**: Implemented dynamic hostname detection in the frontend and robust origin reflection on the backend.
