"""Display Sync Server - Custom HTML broadcast system for multi-display control."""

import asyncio
import json
import socket
import threading
import time
import uuid
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs

try:
    import websockets
except ImportError:
    import subprocess
    subprocess.check_call(["pip", "install", "websockets", "-q"])
    import websockets

PORT_HTTP = 3000
PORT_WS = 3001
BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"


class State:
    """Global application state."""
    def __init__(self):
        self.mode = "builtin"  # "builtin" or "custom"
        self.scene = "gradient"
        self.color = "#3b82f6"
        self.speed = 1.0
        self.intensity = 1.0
        self.text = ""
        self.display_count = 3
        self.custom_html = ""
        self.custom_name = ""

    def to_dict(self):
        return {
            "mode": self.mode,
            "scene": self.scene,
            "color": self.color,
            "speed": self.speed,
            "intensity": self.intensity,
            "text": self.text,
            "displayCount": self.display_count,
            "customHtml": self.custom_html,
            "customName": self.custom_name
        }

    def update(self, data):
        if "mode" in data: self.mode = data["mode"]
        if "scene" in data: self.scene = data["scene"]
        if "color" in data: self.color = data["color"]
        if "speed" in data: self.speed = float(data["speed"])
        if "intensity" in data: self.intensity = float(data["intensity"])
        if "text" in data: self.text = data["text"]
        if "displayCount" in data: self.display_count = int(data["displayCount"])
        if "customHtml" in data: self.custom_html = data["customHtml"]
        if "customName" in data: self.custom_name = data["customName"]


state = State()
clients = {}


def get_local_ip():
    """Get local IP address for LAN access."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_connected_displays():
    """Get list of connected display IDs."""
    return sorted([
        info["displayId"]
        for info in clients.values()
        if info.get("type") == "display" and info.get("displayId")
    ])


def get_library():
    """Get list of saved HTML files."""
    UPLOADS_DIR.mkdir(exist_ok=True)
    items = []
    for f in UPLOADS_DIR.glob("*.html"):
        meta_file = f.with_suffix(".json")
        meta = {"name": f.stem, "created": f.stat().st_mtime}
        if meta_file.exists():
            try:
                meta.update(json.loads(meta_file.read_text()))
            except Exception:
                pass
        items.append({"id": f.stem, "name": meta.get("name", f.stem), "created": meta.get("created")})
    return sorted(items, key=lambda x: x.get("created", 0), reverse=True)


def save_to_library(name, html_content):
    """Save HTML content to library."""
    UPLOADS_DIR.mkdir(exist_ok=True)
    file_id = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    html_file = UPLOADS_DIR / f"{file_id}.html"
    meta_file = UPLOADS_DIR / f"{file_id}.json"
    html_file.write_text(html_content, encoding="utf-8")
    meta_file.write_text(json.dumps({"name": name, "created": time.time()}), encoding="utf-8")
    return file_id


def load_from_library(file_id):
    """Load HTML content from library."""
    html_file = UPLOADS_DIR / f"{file_id}.html"
    meta_file = UPLOADS_DIR / f"{file_id}.json"
    if html_file.exists():
        name = file_id
        if meta_file.exists():
            try:
                name = json.loads(meta_file.read_text()).get("name", file_id)
            except Exception:
                pass
        return {"name": name, "html": html_file.read_text(encoding="utf-8")}
    return None


def delete_from_library(file_id):
    """Delete HTML content from library."""
    html_file = UPLOADS_DIR / f"{file_id}.html"
    meta_file = UPLOADS_DIR / f"{file_id}.json"
    deleted = False
    if html_file.exists():
        html_file.unlink()
        deleted = True
    if meta_file.exists():
        meta_file.unlink()
    return deleted


async def broadcast_to(client_type, message):
    """Broadcast message to all clients of a specific type."""
    msg = json.dumps(message)
    for ws, info in list(clients.items()):
        if info.get("type") == client_type:
            try:
                await ws.send(msg)
            except Exception:
                pass


async def handle_client(websocket):
    """Handle WebSocket client connection."""
    client_info = {"type": None, "displayId": None}
    clients[websocket] = client_info

    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "register_control":
                client_info["type"] = "control"
                await websocket.send(json.dumps({
                    "type": "init",
                    "state": state.to_dict(),
                    "connectedDisplays": get_connected_displays(),
                    "library": get_library(),
                    "lanIP": get_local_ip(),
                    "httpPort": PORT_HTTP
                }))

            elif msg_type == "register_display":
                display_id = int(data.get("displayId", 1))
                client_info["type"] = "display"
                client_info["displayId"] = display_id
                await websocket.send(json.dumps({
                    "type": "init",
                    "displayId": display_id,
                    "state": state.to_dict()
                }))
                await broadcast_to("control", {
                    "type": "displays_update",
                    "connectedDisplays": get_connected_displays()
                })

            elif msg_type == "update_state":
                state.update(data.get("state", {}))
                await broadcast_to("display", {
                    "type": "state_update",
                    "state": state.to_dict()
                })
                await broadcast_to("control", {
                    "type": "state_update",
                    "state": state.to_dict()
                })

            elif msg_type == "save_to_library":
                name = data.get("name", "Untitled")
                html = data.get("html", "")
                file_id = save_to_library(name, html)
                await broadcast_to("control", {
                    "type": "library_update",
                    "library": get_library()
                })

            elif msg_type == "load_from_library":
                file_id = data.get("id")
                content = load_from_library(file_id)
                if content:
                    state.mode = "custom"
                    state.custom_html = content["html"]
                    state.custom_name = content["name"]
                    await broadcast_to("display", {
                        "type": "state_update",
                        "state": state.to_dict()
                    })
                    await broadcast_to("control", {
                        "type": "state_update",
                        "state": state.to_dict()
                    })

            elif msg_type == "delete_from_library":
                file_id = data.get("id")
                delete_from_library(file_id)
                await broadcast_to("control", {
                    "type": "library_update",
                    "library": get_library()
                })

            elif msg_type == "broadcast_html":
                state.mode = "custom"
                state.custom_html = data.get("html", "")
                state.custom_name = data.get("name", "Live")
                await broadcast_to("display", {
                    "type": "state_update",
                    "state": state.to_dict()
                })
                await broadcast_to("control", {
                    "type": "state_update",
                    "state": state.to_dict()
                })

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        clients.pop(websocket, None)
        await broadcast_to("control", {
            "type": "displays_update",
            "connectedDisplays": get_connected_displays()
        })


class HTTPHandler(BaseHTTPRequestHandler):
    """HTTP request handler for static files."""

    def log_message(self, *args):
        pass

    def do_GET(self):
        public = BASE_DIR / "public"

        if self.path == "/" or self.path == "/control":
            self._serve_file(public / "control.html", "text/html")
        elif self.path.startswith("/d"):
            self._serve_file(public / "display.html", "text/html")
        elif self.path == "/api/library":
            self._json_response(get_library())
        else:
            file_path = public / self.path.lstrip("/")
            if file_path.exists() and file_path.is_file():
                self._serve_file(file_path, self._get_content_type(file_path))
            else:
                self.send_error(404)

    def _serve_file(self, path, content_type):
        try:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.end_headers()
            self.wfile.write(path.read_bytes())
        except Exception:
            self.send_error(404)

    def _json_response(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _get_content_type(self, path):
        suffix = path.suffix.lower()
        return {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
        }.get(suffix, "application/octet-stream")


def run_http_server():
    """Run HTTP server in background thread."""
    HTTPServer(("0.0.0.0", PORT_HTTP), HTTPHandler).serve_forever()


async def main():
    """Main entry point."""
    UPLOADS_DIR.mkdir(exist_ok=True)
    ip = get_local_ip()

    print(f"""
{'='*50}
  DISPLAY SYNC SERVER
{'='*50}

  Control Panel:  http://localhost:{PORT_HTTP}/
  Displays:       http://localhost:{PORT_HTTP}/d1, /d2, /d3...

  LAN Access:     http://{ip}:{PORT_HTTP}/

  Library:        {UPLOADS_DIR}

{'='*50}
""")

    threading.Thread(target=run_http_server, daemon=True).start()

    async with websockets.serve(handle_client, "0.0.0.0", PORT_WS):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")
