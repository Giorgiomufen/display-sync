# Custom HTML Snippets

Ready-to-use examples for the custom/ folder.

## Audio Reactive

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

## Fake Terminal

```html
<div id="t" style="background:#0a0a0a;color:#0f0;font:14px monospace;padding:20px;height:100vh;overflow:hidden"></div>
<script>
const l=['$ nmap -sS 192.168.1.0/24','Scanning...','Host 192.168.1.42 is up','  22/tcp open ssh','$ ssh root@192.168.1.42','Access granted.','# whoami','root'];
let i=0,t=document.getElementById('t');
setInterval(()=>{t.innerHTML+=l[i++%l.length]+'<br>';t.scrollTop=t.scrollHeight},500);
</script>
```

## Glitch Effect

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
