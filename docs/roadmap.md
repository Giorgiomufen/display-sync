# Roadmap

## Canvas Mode

Arrange displays spatially, span content across them.

- Drag displays to position on grid
- Drop image/video/HTML that spans across
- Each display gets cropped portion
- Sync playback for video

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
