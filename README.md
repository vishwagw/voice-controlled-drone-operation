Drone Voice Control Simulator

Overview
- A simple local simulation that accepts voice commands (via the browser Web Speech API) and controls a simulated drone.
- Commands supported by voice and manual input: `arm`, `take off` (or `takeoff`), and `land`.

Structure
- `drone_voice_sim/backend/server.py` - FastAPI backend, WebSocket endpoint and simple physics simulation.
- `drone_voice_sim/frontend/` - Static frontend files (index.html, app.js, styles.css).
- `drone_voice_sim/requirements.txt` - Python dependencies.

Run locally
1. Create a Python venv and install dependencies:

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r ./drone_voice_sim/requirements.txt
```

2. Start the backend server (from project root):

```powershell
python drone_voice_sim/backend/server.py
# or use uvicorn directly:
uvicorn "drone_voice_sim.backend.server:app" --reload --host 0.0.0.0 --port 8000
```

3. Open a browser and navigate to `http://localhost:8000/`.

Notes
- Voice recognition requires a browser that supports the Web Speech API (Chrome / Edge). Allow microphone access.
- The simulation is intentionally simple: altitude is simulated linearly towards a target.
- This is a simulator only — no real drone control is performed.

Next steps (suggested)
- Add authentication or safe command confirmation.
- Add more flight commands (hover, goto, yaw, etc.) and more realistic physics.
- Add tests and CI for the backend.
