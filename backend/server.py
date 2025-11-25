import asyncio
import json
import time
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI()
# Serve frontend files from the frontend folder
app.mount("/", StaticFiles(directory="drone_voice_sim/frontend", html=True), name="static")

# Drone state and simulation
class DroneState:
    def __init__(self):
        self.armed = False
        self.motors_on = False
        self.altitude = 0.0  # meters
        self.target_altitude = 0.0
        self.climb_rate = 1.0  # m/s
        self.last_update = time.time()

    def to_dict(self):
        return {
            "armed": self.armed,
            "motors_on": self.motors_on,
            "altitude": round(self.altitude, 3),
            "target_altitude": self.target_altitude,
        }

    def set_arm(self):
        self.armed = True
        self.motors_on = True

    def set_disarm(self):
        self.armed = False
        self.motors_on = False
        self.target_altitude = 0.0

    def takeoff(self, alt: float):
        if not self.armed:
            self.set_arm()
        self.target_altitude = max(0.0, float(alt))
        self.motors_on = True

    def hover(self):
        # Hold current altitude
        self.target_altitude = float(self.altitude)
        self.motors_on = True

    def set_altitude(self, alt: float):
        # Similar to takeoff but keeps semantics explicit
        if not self.armed:
            self.set_arm()
        self.target_altitude = max(0.0, float(alt))
        self.motors_on = True

    def land(self):
        # Begin descent to zero altitude
        self.target_altitude = 0.0
        self.motors_on = True

    def update(self, dt: float):
        if not self.motors_on:
            return
        # simple vertical motion towards target altitude
        diff = self.target_altitude - self.altitude
        if abs(diff) < 0.001:
            # reached target
            self.altitude = self.target_altitude
            if self.target_altitude == 0.0:
                # landed: stop motors and disarm
                self.motors_on = False
                self.armed = False
            return
        direction = 1 if diff > 0 else -1
        change = direction * min(abs(diff), self.climb_rate * dt)
        self.altitude += change
        # clamp
        if self.altitude < 0:
            self.altitude = 0.0


drone = DroneState()

# Manage connected websocket clients
connections: Set[WebSocket] = set()


async def broadcast_state():
    payload = json.dumps({"type": "state", "state": drone.to_dict()})
    to_remove = []
    for ws in list(connections):
        try:
            await ws.send_text(payload)
        except Exception:
            to_remove.append(ws)
    for ws in to_remove:
        connections.discard(ws)


@app.on_event("startup")
async def start_simulation_loop():
    async def sim_loop():
        last = time.time()
        while True:
            now = time.time()
            dt = now - last
            last = now
            drone.update(dt)
            await broadcast_state()
            await asyncio.sleep(0.1)

    asyncio.create_task(sim_loop())


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.add(websocket)
    # Send initial state
    await websocket.send_text(json.dumps({"type": "state", "state": drone.to_dict()}))
    try:
        while True:
            text = await websocket.receive_text()
            try:
                payload = json.loads(text)
            except Exception:
                continue
            # Expected payload: {"cmd": "arm"} or {"cmd":"takeoff", "alt": 3}
            cmd = payload.get("cmd", "").lower()
            if cmd == "arm":
                drone.set_arm()
            elif cmd == "disarm":
                drone.set_disarm()
            elif cmd == "takeoff":
                alt = payload.get("alt", 2.0)
                try:
                    drone.takeoff(float(alt))
                except Exception:
                    drone.takeoff(2.0)
            elif cmd == "hover":
                drone.hover()
            elif cmd == "set_altitude":
                alt = payload.get("alt", None)
                if alt is not None:
                    try:
                        drone.set_altitude(float(alt))
                    except Exception:
                        pass
            elif cmd == "land":
                drone.land()
            # immediately broadcast new state
            await broadcast_state()
    except WebSocketDisconnect:
        connections.discard(websocket)
    except Exception:
        connections.discard(websocket)


if __name__ == "__main__":
    uvicorn.run("drone_voice_sim.backend.server:app", host="0.0.0.0", port=8000, reload=True)
