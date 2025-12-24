# Display Sync

Synchronized multi-display control system. Control visual effects across multiple screens from one dashboard.

## Quick Start

```bash
cd display-sync
pip install websockets
python server.py
```

## URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:3000/` | Control Panel |
| `http://localhost:3000/d1` | Display 1 |
| `http://localhost:3000/d2` | Display 2 |
| `http://localhost:3000/d3` | Display 3 |

## LAN Access

Connect any device on the same WiFi network using your PC's local IP:

```
http://192.168.x.x:3000/d1
```

The server prints your LAN IP on startup. Click **?** in the control panel to see the URL to share.

### Windows Firewall Setup

Run in PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "Display Sync - HTTP In" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "Display Sync - WS In" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow -Profile Any
```

### Troubleshooting LAN

1. **Verify same network** - Phone and PC must be on same WiFi (same `192.168.x.x` subnet)
2. **Test connectivity** - Run `ping <phone-ip>` from PC
3. **Check firewall** - Rules must allow ports 3000 and 3001 for "Any" profile
4. **Router AP isolation** - Must be disabled (Router > Wireless > Professional > Set AP Isolated = No)

## Features

- **Built-in Scenes**: Gradient, Waves, Particles, Matrix, Solid Color, Text
- **Custom HTML Broadcast**: Paste or upload any HTML and broadcast to all displays
- **Library System**: Save custom HTML to disk, load and manage saved content
- **Unlimited Displays**: Set any number of displays (d1, d2, d3... no limit)
- **12 Colors**: Quick color picker
- **Speed/Intensity**: Adjustable animation settings
- **Text Messages**: Send text to all displays
- **Real-time Sync**: All displays update instantly via WebSocket
- **LAN Support**: Dynamic IP detection for accessing from other devices

## Controls

| Action | How |
|--------|-----|
| Help/Setup | Click **?** button |
| Fullscreen | Double-click any display |
| Close modal | Click outside or press Escape |

## Custom HTML

Switch to "Custom HTML" mode in the sidebar to:

1. **Paste HTML** directly into the editor
2. **Upload .html files** using the Upload button
3. **Broadcast** to all connected displays instantly
4. **Save** to library for later use

Supports CSS, JavaScript, Canvas, SVG, and animations.

## Project Structure

```
display-sync/
├── server.py           # Python server (HTTP + WebSocket)
├── public/
│   ├── control.html    # Control dashboard
│   └── display.html    # Display client
├── uploads/            # Saved HTML library (auto-created)
├── LICENSE
└── README.md
```

## Requirements

- Python 3.8+
- websockets library
- Ports 3000 (HTTP) and 3001 (WebSocket) open

## Uninstall

Remove firewall rules:

```powershell
Remove-NetFirewallRule -DisplayName "Display Sync*"
```

Delete the project folder to fully remove.

