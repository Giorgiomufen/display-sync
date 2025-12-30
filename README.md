# Display Sync

Multi-display control system. Broadcast synchronized visuals across multiple screens.

## Quick Start

```bash
pip install websockets
python server.py
```

Open http://localhost:3000/

## URLs

| URL | Purpose |
|-----|---------|
| `/` | Control Panel |
| `/d1`, `/d2`, `/d3`... | Display clients |

## Features

- **Scenes**: None, Gradient, Waves, Particles, Matrix, Solid, Text, Image, Audio, Glitch
- **Canvas Mode**: Arrange displays spatially, span content across them like a video wall
- **Custom HTML**: Broadcast any HTML/CSS/JS to displays
- **Color Picker**: Blender-style wheel with RGB/HSV/HEX tabs and draggable sliders
- **Real-time sync**: WebSocket-based instant updates
- **LAN support**: Access from any device on same network

## Structure

```
display-sync/
├── server.py
├── public/
│   ├── control.html
│   ├── display.html
│   ├── css/styles.css
│   └── js/
├── scenes/
│   ├── default/         # Built-in scenes
│   └── custom/          # Your custom scenes (gitignored)
└── custom/              # Saved HTML library
```

## Canvas Mode

Arrange displays spatially, span content across them like a video wall.

```
┌─────────┬─────────┬─────────┐
│   D1    │   D2    │   D3    │
└─────────┴─────────┴─────────┘
      ↑ drag elements here ↑
```

- Add rectangles and images to the canvas
- Each display shows its portion based on x/y offset
- Drag to position, resize with handles

## LAN Access

Server prints your IP on startup. Windows firewall:

```powershell
New-NetFirewallRule -DisplayName "Display Sync" -Direction Inbound -LocalPort 3000,3001 -Protocol TCP -Action Allow
```
