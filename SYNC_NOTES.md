# Millisecond-Level Sync Implementation Notes

From the other Claude Code instance - sharing research on achieving true synchronized displays.

## Current Problem

Each display runs its own `requestAnimationFrame()` loop independently. They drift apart because:
- Network latency varies per client
- Frame rates differ between devices
- Animation state is synced, but TIME is not

## Solution: Time-Based Rendering

**Don't sync frames, sync TIME.** All displays should calculate "what should be shown at time T" using a shared clock reference.

## Implementation

### 1. Add latency measurement on connect

```javascript
// Client-side: measure round-trip time
function measureLatency() {
  const pingTime = performance.now();
  ws.send(JSON.stringify({ type: 'ping', t: pingTime }));
}

// When pong received:
function handlePong(serverTime, originalT) {
  const now = performance.now();
  const roundTrip = now - originalT;
  const latency = roundTrip / 2;
  const serverOffset = serverTime - now + latency;
  // serverOffset = how far ahead/behind we are from server
}
```

### 2. Server echoes pings immediately

```python
elif msg_type == "ping":
    await websocket.send(json.dumps({
        "type": "pong",
        "serverTime": time.time() * 1000,  # ms
        "clientT": msg.get("t")
    }))
```

### 3. Animation uses synced time

```javascript
// OLD (drifts):
let frame = 0;
function animate() {
  frame++;
  const x = Math.sin(frame * 0.01) * 100;
}

// NEW (synced):
function animate() {
  const syncedTime = performance.now() + serverOffset;
  const x = Math.sin(syncedTime * 0.001 * speed) * 100;
  // All displays with same serverOffset show identical frame
}
```

### 4. Periodic re-sync

Re-measure latency every 5-10 seconds to handle drift:

```javascript
setInterval(measureLatency, 5000);
```

## Precision Levels

| Method | Precision | Notes |
|--------|-----------|-------|
| `Date.now()` | ~10-50ms | Easy but imprecise |
| `performance.now()` | ~1-5ms | Good balance |
| `AudioContext.currentTime` | <1ms | Best precision, requires audio context |

## Quick Win

For a quick improvement without full refactor:
1. Server broadcasts `{ type: 'tick', t: Date.now() }` every 100ms
2. Clients store `serverOffset = serverT - Date.now()`
3. Animations use `Date.now() + serverOffset` as time base

This gets you to ~20-50ms sync with minimal code changes.

## Files to Modify

- `server.py`: Add ping/pong handler, optional tick broadcast
- `display.html`: Add latency measurement, change animation to time-based

---

*Note from parallel Claude instance - feel free to implement or ignore!*
