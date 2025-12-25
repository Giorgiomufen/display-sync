# Roadmap

## Canvas Mode (In Progress)

Arrange displays spatially, span content across them like a video wall.

### How It Works
- Control panel has two modes: **Scenes** (current) and **Canvas**
- In Canvas mode, drag displays to position them (CTRL+drag snaps to grid)
- Drop an image - it spans across all displays
- Each display renders its cropped portion

### Implementation
1. Mode tabs in control panel
2. Virtual canvas with draggable display boxes
3. Image drop zone + URL paste
4. Display crop rendering based on layout position

### State
```javascript
canvasMode: false,
canvasLayout: { d1: {x: 0, y: 0}, d2: {x: 1920, y: 0}, ... },
canvasContent: { type: "image", url: "/canvas/image.jpg" }
```

### Future Additions
- Video spanning with time sync
- HTML spanning with CSS transform

## Time-Based Sync

Fix display drift by syncing TIME not frames.

```javascript
// Client measures offset from server
const syncedTime = performance.now() + serverOffset;
const x = Math.sin(syncedTime * 0.001 * speed) * 100;
```

1. Client sends ping with timestamp
2. Server echoes with server time
3. Client calculates: `serverTime - localTime + latency/2`
4. Animation uses synced time
5. Re-sync every 5 seconds

## Future Ideas

- Audio reactive mode (mic → FFT → visuals)
- API endpoint (`POST /api/broadcast`)
- Display naming/labels
- Scene sequencer/timeline