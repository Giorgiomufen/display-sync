# display-sync - feature ideas

analysis by parallel claude agents for creative dev / cybersecurity expert enhancements.

## ux priority (giorgio's ideas)

### unified scene library
- custom html uploads should be part of the same library as built-in scenes
- demo scenes (gradient, waves, particles, matrix, solid, text) should appear in library
- one unified list instead of separate "built-in" and "custom" modes

### delete protection
- no single-button delete - require confirmation
- options: hold to delete, double-click, or confirm dialog
- maybe "trash" system with undo instead of instant delete

## security/hacking aesthetic

| feature | why it's cool |
|---------|---------------|
| terminal/console mode | inject live command output, logs, htop-style displays |
| network visualizer | real-time packet flow, connection graphs across displays |
| honeypot dashboard | show fake "intrusion attempts" for demos/presentations |
| glitch effects | chromatic aberration, scan lines, crt flicker |
| data rain variants | binary, hex dumps, packet headers (not just matrix katakana) |

## sync & precision gaps

| gap | impact |
|-----|--------|
| no timestamp-based sync | displays drift over time |
| frame-count based animation | different refresh rates = desync |
| no latency compensation | network jitter causes stuttering |
| no shared clock | can't sync to music/external events |

see sync-notes.md for solution.

## creative power tools

| feature | description |
|---------|-------------|
| per-display content | send different html to /d1 vs /d2 vs /d3 |
| panoramic mode | one image/video split across all displays seamlessly |
| audio reactive | mic input -> fft -> visuals respond to sound |
| midi input | control scenes from hardware controllers |
| osc protocol | integration with vj software (resolume, touchdesigner) |
| shader support | webgl fragment shaders for gpu-accelerated visuals |
| scene sequencer | timeline-based scene transitions |
| trigger system | keyboard/api triggers for live performances |

## cybersecurity demo features

| feature | use case |
|---------|----------|
| fake terminal | scrolling "hacking" output for presentations |
| ip/traffic sim | animated world map with fake attack vectors |
| password crack sim | visual brute-force animation |
| encryption viz | show data being encrypted/decrypted |
| payload injection demo | safe xss/injection visualization |
| ctf scoreboard | live competition scores across displays |

## infrastructure gaps

| gap | risk/limitation |
|-----|-----------------|
| no auth | anyone on network can hijack displays |
| no https/wss | traffic is plaintext |
| no api | can't trigger from scripts/webhooks |
| no state persistence | server restart = lost config |
| no display naming | just /d1, /d2... no custom labels |

## top 5 quick wins

1. webgl/shader mode - gpu-powered visuals
2. per-display targeting - /d1 gets left third, /d2 gets center
3. audio input - mic -> fft -> visuals
4. api endpoint - post /api/broadcast for scripts
5. shared clock sync - performance.now() + serveroffset

## injectable code snippets

### audio reactive
```html
<canvas id="c"></canvas>
<script>
const c=document.getElementById('c'),ctx=c.getContext('2d');
c.width=innerWidth;c.height=innerHeight;
navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{
  const a=new AudioContext(),n=a.createAnalyser();
  a.createMediaStreamSource(s).connect(n);n.fftSize=256;
  const d=new Uint8Array(n.frequencyBinCount);
  (function draw(){
    n.getByteFrequencyData(d);
    ctx.fillStyle='rgba(0,0,0,0.1)';ctx.fillRect(0,0,c.width,c.height);
    d.forEach((v,i)=>{
      ctx.fillStyle=`hsl(${i*2},100%,50%)`;
      ctx.fillRect(i*(c.width/d.length),c.height-(v/255)*c.height,c.width/d.length-1,(v/255)*c.height);
    });
    requestAnimationFrame(draw);
  })();
});
</script>
```

### fake terminal
```html
<div id="t" style="background:#0a0a0a;color:#0f0;font:14px monospace;padding:20px;height:100vh;overflow:hidden"></div>
<script>
const l=['$ nmap -sS 192.168.1.0/24','Scanning 256 hosts...','Host 192.168.1.42 is up','  22/tcp open ssh','  80/tcp open http','$ ssh root@192.168.1.42','Password: ********','Access granted.','# whoami','root'];
let i=0,t=document.getElementById('t');
setInterval(()=>{t.innerHTML+=l[i++%l.length]+'<br>';t.scrollTop=t.scrollHeight},500);
</script>
```

### glitch effect
```html
<canvas id="c"></canvas>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
c.width=innerWidth;c.height=innerHeight;
(function g(){
  for(let i=0;i<10;i++){
    x.fillStyle=`rgba(${Math.random()*255|0},${Math.random()*255|0},${Math.random()*255|0},0.8)`;
    x.fillRect(Math.random()*c.width,Math.random()*c.height,Math.random()*200+50,Math.random()*20+5);
  }
  for(let y=0;y<c.height;y+=4){x.fillStyle='rgba(0,0,0,0.1)';x.fillRect(0,y,c.width,2);}
  setTimeout(g,50+Math.random()*100);
})();
</script>
```
