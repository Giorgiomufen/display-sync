/**
 * Display Sync - Display Client
 */

// Elements
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var customContainer = document.getElementById("customContainer");

// Get display ID from URL
var displayId = parseInt(window.location.pathname.replace("/d", "")) || 1;
document.getElementById("label").textContent = "D" + displayId;

// State
var ws = null;
var state = {
  mode: "builtin",
  scene: "gradient",
  color: "#3b82f6",
  speed: 1,
  intensity: 1,
  text: "",
  displayCount: 3,
  customHtml: ""
};
var time = 0;
var particles = [];
var matrixDrops = null;
var lastCustomHtml = "";
var animationId = null;

// Resize handler
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  matrixDrops = null;
}
resize();
window.addEventListener("resize", resize);

// Color utilities
function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function hslToRgb(h, s, l) {
  var r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    var hue2rgb = function(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

// Scene renderers
function renderGradient() {
  var offset = (displayId - 1) / state.displayCount;
  var hue = ((time * 0.02 * state.speed) + offset) % 1;
  var grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  var c1 = hslToRgb(hue, 0.8, 0.5 * state.intensity);
  var c2 = hslToRgb((hue + 0.3) % 1, 0.8, 0.4 * state.intensity);
  var c3 = hslToRgb((hue + 0.6) % 1, 0.8, 0.5 * state.intensity);
  grad.addColorStop(0, "rgb(" + c1.r + "," + c1.g + "," + c1.b + ")");
  grad.addColorStop(0.5, "rgb(" + c2.r + "," + c2.g + "," + c2.b + ")");
  grad.addColorStop(1, "rgb(" + c3.r + "," + c3.g + "," + c3.b + ")");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderWaves() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  var c = hexToRgb(state.color);
  for (var i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (var x = 0; x <= canvas.width; x += 5) {
      var gx = x + (displayId - 1) * canvas.width;
      var y = canvas.height/2 +
              Math.sin(gx * 0.005 + time * 0.03 * state.speed + i) * 50 * state.intensity +
              Math.sin(gx * 0.01 + time * 0.02 * state.speed + i * 2) * 30 * state.intensity;
      ctx.lineTo(x, y + i * 40);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = "rgba(" + c.r + "," + c.g + "," + c.b + "," + ((0.3 - i * 0.05) * state.intensity) + ")";
    ctx.fill();
  }
}

function renderParticles() {
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  var c = hexToRgb(state.color);
  if (particles.length < 100 && Math.random() < 0.3) {
    particles.push({
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      vx: (Math.random() - 0.5) * 2,
      vy: -Math.random() * 3 - 1,
      size: Math.random() * 4 + 2,
      life: 1
    });
  }
  particles = particles.filter(function(p) {
    p.x += p.vx * state.speed;
    p.y += p.vy * state.speed;
    p.life -= 0.005 * state.speed;
    if (p.life > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * state.intensity, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + c.r + "," + c.g + "," + c.b + "," + p.life + ")";
      ctx.fill();
      return true;
    }
    return false;
  });
}

function renderMatrix() {
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  var c = hexToRgb(state.color);
  var fontSize = 14;
  var columns = Math.floor(canvas.width / fontSize);
  if (!matrixDrops || matrixDrops.length !== columns) {
    matrixDrops = [];
    for (var i = 0; i < columns; i++) {
      matrixDrops[i] = Math.random() * canvas.height / fontSize;
    }
  }
  ctx.font = fontSize + "px monospace";
  ctx.fillStyle = "rgba(" + c.r + "," + c.g + "," + c.b + "," + state.intensity + ")";
  for (var i = 0; i < columns; i++) {
    var char = String.fromCharCode(0x30A0 + Math.random() * 96);
    ctx.fillText(char, i * fontSize, matrixDrops[i] * fontSize);
    if (matrixDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
      matrixDrops[i] = 0;
    }
    matrixDrops[i] += state.speed * 0.5;
  }
}

function renderSolid() {
  ctx.fillStyle = state.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderText() {
  var c = hexToRgb(state.color);
  ctx.fillStyle = "rgb(" + Math.floor(c.r*0.1) + "," + Math.floor(c.g*0.1) + "," + Math.floor(c.b*0.1) + ")";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  var overlay = document.getElementById("textOverlay");
  var content = document.getElementById("textContent");
  overlay.style.display = "flex";
  content.style.color = state.color;
  content.textContent = state.text || "Hello";
}

function renderCustomHtml() {
  if (state.customHtml !== lastCustomHtml) {
    lastCustomHtml = state.customHtml;
    customContainer.innerHTML = "";
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    iframe.srcdoc = "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;overflow:hidden;}</style></head><body>" + state.customHtml + "</body></html>";
    customContainer.appendChild(iframe);
  }
}

// Main render loop
function render() {
  time++;

  if (state.mode === "custom" && state.customHtml) {
    canvas.style.display = "none";
    document.getElementById("textOverlay").style.display = "none";
    customContainer.classList.add("active");
    renderCustomHtml();
  } else {
    canvas.style.display = "block";
    customContainer.classList.remove("active");
    customContainer.innerHTML = "";
    lastCustomHtml = "";

    if (state.scene !== "text") {
      document.getElementById("textOverlay").style.display = "none";
    }

    switch (state.scene) {
      case "gradient": renderGradient(); break;
      case "waves": renderWaves(); break;
      case "particles": renderParticles(); break;
      case "matrix": renderMatrix(); break;
      case "solid": renderSolid(); break;
      case "text": renderText(); break;
      default: renderGradient();
    }
  }

  animationId = requestAnimationFrame(render);
}

// WebSocket connection
function connect() {
  ws = new WebSocket((location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.hostname + ":3001");

  ws.onopen = function() {
    document.getElementById("dot").classList.add("on");
    ws.send(JSON.stringify({ type: "register_display", displayId: displayId }));
  };

  ws.onclose = function() {
    document.getElementById("dot").classList.remove("on");
    setTimeout(connect, 2000);
  };

  ws.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.type === "init" || msg.type === "state_update") {
      if (msg.state) Object.assign(state, msg.state);
    }
  };
}

// Fullscreen on double-click
document.body.addEventListener("dblclick", function() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
});

// Auto-hide cursor
var cursorTimer;
document.body.addEventListener("mousemove", function() {
  document.body.style.cursor = "default";
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(function() {
    document.body.style.cursor = "none";
  }, 2000);
});

// Start
connect();
render();
