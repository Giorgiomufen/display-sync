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
CUSTOM_DIR = BASE_DIR / "custom"
CANVAS_DIR = BASE_DIR / "canvas"
SCENES_DIR = BASE_DIR / "scenes"


class State:
    """Global application state."""
    def __init__(self):
        self.mode = "builtin"  # "builtin" or "custom"
        self.scene = "none"
        self.color = "#3b82f6"
        self.speed = 1.0
        self.intensity = 1.0
        self.text = ""
        self.display_count = 3
        self.custom_html = ""
        self.custom_name = ""
        self.canvas_mode = False
        self.canvas_layout = {}
        self.canvas_content = None
        self.canvas_elements = []
        self.image_url = ""
        self.label_mode = "hidden"

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
            "customName": self.custom_name,
            "canvasMode": self.canvas_mode,
            "canvasLayout": self.canvas_layout,
            "canvasContent": self.canvas_content,
            "canvasElements": self.canvas_elements,
            "imageUrl": self.image_url,
            "labelMode": self.label_mode
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
        if "canvasMode" in data: self.canvas_mode = data["canvasMode"]
        if "canvasLayout" in data: self.canvas_layout = data["canvasLayout"]
        if "canvasContent" in data: self.canvas_content = data["canvasContent"]
        if "canvasElements" in data: self.canvas_elements = data["canvasElements"]
        if "imageUrl" in data: self.image_url = data["imageUrl"]
        if "labelMode" in data: self.label_mode = data["labelMode"]


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
    CUSTOM_DIR.mkdir(exist_ok=True)
    items = []
    for f in CUSTOM_DIR.glob("*.html"):
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
    CUSTOM_DIR.mkdir(exist_ok=True)
    file_id = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    html_file = CUSTOM_DIR / f"{file_id}.html"
    meta_file = CUSTOM_DIR / f"{file_id}.json"
    html_file.write_text(html_content, encoding="utf-8")
    meta_file.write_text(json.dumps({"name": name, "created": time.time()}), encoding="utf-8")
    return file_id


def load_from_library(file_id):
    """Load HTML content from library."""
    html_file = CUSTOM_DIR / f"{file_id}.html"
    meta_file = CUSTOM_DIR / f"{file_id}.json"
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
    html_file = CUSTOM_DIR / f"{file_id}.html"
    meta_file = CUSTOM_DIR / f"{file_id}.json"
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
            print(f"[MSG] {msg_type} from {client_info.get('type', 'unknown')}")

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

            elif msg_type == "set_canvas_mode":
                state.canvas_mode = data.get("canvasMode", False)
                await broadcast_to("display", {
                    "type": "state_update",
                    "state": state.to_dict()
                })
                await broadcast_to("control", {
                    "type": "state_update",
                    "state": state.to_dict()
                })

            elif msg_type == "update_canvas_layout":
                state.canvas_layout = data.get("canvasLayout", {})
                await broadcast_to("display", {
                    "type": "state_update",
                    "state": state.to_dict()
                })
                await broadcast_to("control", {
                    "type": "state_update",
                    "state": state.to_dict()
                })

            elif msg_type == "upload_image":
                try:
                    import base64
                    CANVAS_DIR.mkdir(exist_ok=True)
                    image_data = data.get("image", "")
                    print(f"[UPLOAD] Received image data: {len(image_data)} chars")
                    if image_data:
                        ext = ".png"
                        if image_data.startswith("data:image"):
                            header, image_data = image_data.split(",", 1)
                            if "jpeg" in header or "jpg" in header: ext = ".jpg"
                            elif "gif" in header: ext = ".gif"
                            elif "webp" in header: ext = ".webp"
                        file_id = f"{int(time.time())}_{uuid.uuid4().hex[:6]}{ext}"
                        image_path = CANVAS_DIR / file_id
                        image_path.write_bytes(base64.b64decode(image_data))
                        url = f"/canvas/{file_id}"
                        print(f"[UPLOAD] Saved to {image_path}, URL: {url}")
                        await websocket.send(json.dumps({
                            "type": "image_uploaded",
                            "url": url
                        }))
                        print(f"[UPLOAD] Response sent")
                except Exception as e:
                    import traceback
                    print(f"[UPLOAD ERROR] {e}")
                    traceback.print_exc()

            elif msg_type == "upload_scene_image":
                try:
                    import base64
                    CANVAS_DIR.mkdir(exist_ok=True)
                    image_data = data.get("image", "")
                    if image_data:
                        ext = ".png"
                        if image_data.startswith("data:image"):
                            header, image_data = image_data.split(",", 1)
                            if "jpeg" in header or "jpg" in header: ext = ".jpg"
                        file_id = f"scene_{int(time.time())}_{uuid.uuid4().hex[:6]}{ext}"
                        image_path = CANVAS_DIR / file_id
                        image_path.write_bytes(base64.b64decode(image_data))
                        url = f"/canvas/{file_id}"
                        await websocket.send(json.dumps({
                            "type": "scene_image_uploaded",
                            "url": url
                        }))
                except Exception as e:
                    print(f"[SCENE IMAGE ERROR] {e}")

            elif msg_type == "canvas_elements":
                state.canvas_elements = data.get("elements", [])
                if "canvasLayout" in data:
                    state.canvas_layout = data["canvasLayout"]
                await broadcast_to("display", {
                    "type": "state_update",
                    "state": state.to_dict()
                })

            elif msg_type == "canvas_content":
                state.canvas_content = data.get("content")
                if "canvasLayout" in data:
                    state.canvas_layout = data["canvasLayout"]
                await broadcast_to("display", {
                    "type": "state_update",
                    "state": state.to_dict()
                })

            elif msg_type == "canvas_upload":
                import base64
                CANVAS_DIR.mkdir(exist_ok=True)
                print(f"[DEBUG] Canvas upload received")

                # Update canvas layout if provided
                if "canvasLayout" in data:
                    state.canvas_layout = data["canvasLayout"]
                    print(f"[DEBUG] Canvas layout updated: {state.canvas_layout}")

                url = data.get("url", "")
                print(f"[DEBUG] URL from message: {url}")

                # Handle base64 image upload
                image_data = data.get("image", "")
                print(f"[DEBUG] Image data received: {len(image_data) if image_data else 0} chars")

                if image_data:
                    # Detect image format from data URL
                    extension = ".png"
                    if image_data.startswith("data:image"):
                        print(f"[DEBUG] Stripping data:image prefix")
                        header, image_data = image_data.split(",", 1)
                        # Extract format (e.g., "data:image/jpeg;base64" -> ".jpeg")
                        if "image/jpeg" in header or "image/jpg" in header:
                            extension = ".jpg"
                        elif "image/png" in header:
                            extension = ".png"
                        elif "image/gif" in header:
                            extension = ".gif"
                        elif "image/webp" in header:
                            extension = ".webp"

                    file_id = f"{int(time.time())}_{uuid.uuid4().hex[:6]}{extension}"
                    image_path = CANVAS_DIR / file_id
                    print(f"[DEBUG] Saving to: {image_path}")

                    try:
                        image_bytes = base64.b64decode(image_data)
                        image_path.write_bytes(image_bytes)
                        url = f"/canvas/{file_id}"
                        print(f"[DEBUG] Image saved successfully, URL: {url}")
                    except Exception as e:
                        print(f"[ERROR] Failed to save image: {e}")
                        url = ""

                # Set canvas content and broadcast to all displays
                if url:
                    state.canvas_content = {"type": "image", "url": url}
                    print(f"[CANVAS] Broadcasting image to ALL displays: {state.canvas_content}")
                    print(f"[CANVAS] Connected displays: {get_connected_displays()}")
                    await broadcast_to("display", {
                        "type": "state_update",
                        "state": state.to_dict()
                    })
                    await broadcast_to("control", {
                        "type": "state_update",
                        "state": state.to_dict()
                    })
                    print(f"[CANVAS] Broadcast complete")
                else:
                    print(f"[ERROR] No URL to broadcast")

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
        elif self.path.startswith("/scenes/"):
            # Serve scene files from scenes/default or scenes/custom
            rel_path = self.path.replace("/scenes/", "")
            file_path = SCENES_DIR / rel_path
            if file_path.exists() and file_path.is_file():
                self._serve_file(file_path, self._get_content_type(file_path))
            else:
                self.send_error(404)
        elif self.path.startswith("/canvas/"):
            # Serve canvas images
            file_name = self.path.replace("/canvas/", "")
            file_path = CANVAS_DIR / file_name
            if file_path.exists() and file_path.is_file():
                self._serve_file(file_path, self._get_content_type(file_path))
            else:
                self.send_error(404)
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
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
        }.get(suffix, "application/octet-stream")


def run_http_server():
    """Run HTTP server in background thread."""
    HTTPServer(("0.0.0.0", PORT_HTTP), HTTPHandler).serve_forever()


async def main():
    """Main entry point."""
    CUSTOM_DIR.mkdir(exist_ok=True)
    CANVAS_DIR.mkdir(exist_ok=True)
    (SCENES_DIR / "custom").mkdir(parents=True, exist_ok=True)
    ip = get_local_ip()

    print(f"""
{'='*50}
  DISPLAY SYNC SERVER
{'='*50}

  Control Panel:  http://localhost:{PORT_HTTP}/
  Displays:       http://localhost:{PORT_HTTP}/d1, /d2, /d3...

  LAN Access:     http://{ip}:{PORT_HTTP}/

  Library:        {CUSTOM_DIR}

{'='*50}
""")

    threading.Thread(target=run_http_server, daemon=True).start()

    async with websockets.serve(handle_client, "0.0.0.0", PORT_WS, max_size=50*1024*1024):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")
