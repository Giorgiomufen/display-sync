/**
 * Display Sync - Display Client
 * Loads scenes from /scenes/default/ or /scenes/custom/ folders
 */

// Elements
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var customContainer = document.getElementById("customContainer");
var sceneIframe = null;
var currentSceneSrc = "";

// Get display ID from URL
var displayId = parseInt(window.location.pathname.replace("/d", "")) || 1;
document.getElementById("label").textContent = "D" + displayId;

// State
var ws = null;
var state = {
  mode: "builtin",
  scene: "none",
  color: "#3b82f6",
  speed: 1,
  intensity: 1,
  text: "",
  displayCount: 3,
  customHtml: "",
  canvasMode: false,
  canvasLayout: {},
  canvasElements: [],
  imageUrl: "",
  labelMode: "hidden"
};
var labelTimeout = null;
var elementImages = {};

// Resize handler
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// Load scene from file
function loadScene(sceneName) {
  // Try default folder first, then custom
  var src = "/scenes/default/" + sceneName + ".html";

  if (currentSceneSrc === src) {
    // Same scene, just update params
    sendStateToScene();
    return;
  }

  currentSceneSrc = src;
  canvas.style.display = "none";
  document.getElementById("textOverlay").style.display = "none";
  customContainer.innerHTML = "";
  customContainer.classList.add("active");

  sceneIframe = document.createElement("iframe");
  sceneIframe.style.cssText = "width:100%;height:100%;border:none;";
  sceneIframe.src = src;
  sceneIframe.onload = function() {
    sendStateToScene();
  };
  customContainer.appendChild(sceneIframe);
}

// Send current state to scene iframe
function sendStateToScene() {
  if (sceneIframe && sceneIframe.contentWindow) {
    sceneIframe.contentWindow.postMessage({
      displayId: displayId,
      displayCount: state.displayCount,
      color: state.color,
      speed: state.speed,
      intensity: state.intensity,
      text: state.text,
      imageUrl: state.imageUrl
    }, "*");
  }
}

// Render custom HTML (inline)
function renderCustomHtml() {
  currentSceneSrc = "";
  canvas.style.display = "none";
  document.getElementById("textOverlay").style.display = "none";
  customContainer.innerHTML = "";
  customContainer.classList.add("active");

  sceneIframe = document.createElement("iframe");
  sceneIframe.style.cssText = "width:100%;height:100%;border:none;";
  sceneIframe.srcdoc = "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;overflow:hidden;}</style></head><body>" + state.customHtml + "</body></html>";
  customContainer.appendChild(sceneIframe);
}

// Render canvas mode (multi-display spanning)
function renderCanvas() {
  var myKey = "d" + displayId;
  var offset = state.canvasLayout[myKey] || { x: 0, y: 0 };

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.canvasElements.forEach(function(el) {
    var x = el.x - offset.x;
    var y = el.y - offset.y;

    if (el.type === "rect") {
      ctx.fillStyle = el.color;
      ctx.fillRect(x, y, el.w, el.h);
    } else if (el.type === "image" && el.src) {
      if (!elementImages[el.src]) {
        var img = new Image();
        var src = el.src;
        if (src.startsWith("/")) {
          src = window.location.protocol + "//" + window.location.hostname + ":3000" + src;
        }
        img.src = src;
        elementImages[el.src] = img;
      }
      var img = elementImages[el.src];
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x, y, el.w, el.h);
      }
    }
  });
}

// Main render loop
var lastScene = "";
var lastMode = "";

function render() {
  if (state.canvasMode) {
    // Canvas mode - multi-display spanning
    canvas.style.display = "block";
    document.getElementById("textOverlay").style.display = "none";
    customContainer.classList.remove("active");
    customContainer.innerHTML = "";
    currentSceneSrc = "";
    sceneIframe = null;
    renderCanvas();
  } else if (state.mode === "custom" && state.customHtml) {
    // Custom HTML mode
    if (lastMode !== "custom") {
      renderCustomHtml();
      lastMode = "custom";
    }
  } else {
    // Scene mode - load from file
    lastMode = "scene";
    if (state.scene !== lastScene) {
      loadScene(state.scene);
      lastScene = state.scene;
    }
  }

  requestAnimationFrame(render);
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
      if (msg.state) {
        Object.assign(state, msg.state);
        updateLabel();
        sendStateToScene();
      }
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

// Label visibility
function updateLabel() {
  var label = document.getElementById("label");
  var dot = document.getElementById("dot");
  if (state.labelMode === "hidden") {
    label.style.display = "none";
    dot.style.display = "none";
  } else if (state.labelMode === "always") {
    label.style.display = "";
    dot.style.display = "";
  }
}

function showLabelTemporarily() {
  if (state.labelMode !== "interact") return;
  var label = document.getElementById("label");
  var dot = document.getElementById("dot");
  label.style.display = "";
  dot.style.display = "";
  clearTimeout(labelTimeout);
  labelTimeout = setTimeout(function() {
    label.style.display = "none";
    dot.style.display = "none";
  }, 3000);
}

// Auto-hide cursor
var cursorTimer;
document.body.addEventListener("mousemove", function() {
  document.body.style.cursor = "default";
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(function() {
    document.body.style.cursor = "none";
  }, 2000);
  showLabelTemporarily();
});

document.body.addEventListener("click", showLabelTemporarily);
document.body.addEventListener("keydown", showLabelTemporarily);

// Start
connect();
render();
updateLabel();
