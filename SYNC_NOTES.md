# Time-Based Sync

Current issue: displays drift because each runs independent animation loops.

## Solution

Sync TIME, not frames. All displays calculate "what to show at time T" using shared clock.

```javascript
// Client measures offset from server
const syncedTime = performance.now() + serverOffset;
const x = Math.sin(syncedTime * 0.001 * speed) * 100;
```

## Implementation

1. Client sends ping with timestamp
2. Server echoes with server time
3. Client calculates offset: `serverTime - localTime + latency/2`
4. Animation uses `performance.now() + offset` as time base
5. Re-sync every 5 seconds

## Precision

| Method | Precision |
|--------|-----------|
| `Date.now()` | ~10-50ms |
| `performance.now()` | ~1-5ms |
| `AudioContext.currentTime` | <1ms |
