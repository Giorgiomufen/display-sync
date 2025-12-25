/**
 * Display Sync - Control Panel
 */

// Constants
var SCENES = [
  { id: "gradient", icon: "&#127752;", name: "Gradient" },
  { id: "waves", icon: "&#127754;", name: "Waves" },
  { id: "particles", icon: "&#10024;", name: "Particles" },
  { id: "matrix", icon: "&#128223;", name: "Matrix" },
  { id: "solid", icon: "&#9724;", name: "Solid" },
  { id: "text", icon: "Aa", name: "Text" }
];

var COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
  "#8b5cf6", "#ec4899", "#f43f5e", "#06b6d4", "#84cc16", "#ffffff"
];

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
  canvasMode: false,
  canvasLayout: {}
};
var connectedDisplays = [];
var library = [];
var serverInfo = { lanIP: "", httpPort: 3000 };
var pendingDeleteId = null;
var currentMode = "builtin"; // "builtin" or "custom"
var currentViewMode = "scenes"; // "scenes" or "canvas"
var draggedDisplay = null;
var dragOffset = { x: 0, y: 0 };
var isCtrlPressed = false;

// Helpers
function $(id) {
  return document.getElementById(id);
}

// Mode Switching
function switchViewMode(mode) {
  currentViewMode = mode;

  // Update tabs
  document.querySelectorAll(".mode-tab").forEach(function(tab) {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });

  // Show/hide sections
  if (mode === "scenes") {
    $("scenesMode").style.display = "block";
    $("canvasMode").style.display = "none";
    state.canvasMode = false;
  } else if (mode === "canvas") {
    $("scenesMode").style.display = "none";
    $("canvasMode").style.display = "block";
    state.canvasMode = true;
    initCanvas();
  }

  // Send to server
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "set_canvas_mode", canvasMode: state.canvasMode }));
  }
}

// Canvas Editor
var canvasElements = [];
var selectedElement = null;
var draggingElement = null;
var resizingElement = null;
var editorScale = 0.1;

function initCanvas() {
  var viewport = $("canvasViewport");
  viewport.innerHTML = "";

  // Calculate total canvas size from display layout
  var totalW = state.displayCount * 1920;
  var totalH = 1080;

  // Set viewport size
  viewport.style.width = totalW + "px";
  viewport.style.height = totalH + "px";

  // Create display outlines
  for (var i = 1; i <= state.displayCount; i++) {
    var key = "d" + i;
    var offset = state.canvasLayout[key] || { x: (i-1) * 1920, y: 0 };

    // Set default layout if not set
    if (!state.canvasLayout[key]) {
      state.canvasLayout[key] = offset;
    }

    var disp = document.createElement("div");
    disp.className = "canvas-display";
    disp.style.left = offset.x + "px";
    disp.style.top = offset.y + "px";
    disp.style.width = "1920px";
    disp.style.height = "1080px";
    disp.textContent = "D" + i;
    viewport.appendChild(disp);
  }

  // Re-add existing elements
  canvasElements.forEach(function(el) {
    addElementToViewport(el);
  });

  // Bind editor events
  bindEditorEvents();
}

function bindEditorEvents() {
  var editor = $("canvasEditor");
  var viewport = $("canvasViewport");

  editor.onmousemove = function(e) {
    var rect = viewport.getBoundingClientRect();
    var x = Math.round((e.clientX - rect.left) / editorScale);
    var y = Math.round((e.clientY - rect.top) / editorScale);
    $("cursorInfo").textContent = "x: " + x + ", y: " + y;

    if (draggingElement) {
      draggingElement.x = x - dragOffset.x;
      draggingElement.y = y - dragOffset.y;
      updateElementPosition(draggingElement);
      broadcastElements();
    }
    if (resizingElement) {
      resizingElement.w = Math.max(100, x - resizingElement.x);
      resizingElement.h = Math.max(100, y - resizingElement.y);
      updateElementPosition(resizingElement);
      broadcastElements();
    }
  };

  editor.onmouseup = function() {
    draggingElement = null;
    resizingElement = null;
  };

  editor.onclick = function(e) {
    if (e.target === editor || e.target === viewport) {
      selectElement(null);
    }
  };
}

function addElement(type, options) {
  var el = {
    id: Date.now(),
    type: type,
    x: 100,
    y: 100,
    w: options.w || 800,
    h: options.h || 600,
    color: options.color || "#ff0000",
    src: options.src || null
  };
  canvasElements.push(el);
  addElementToViewport(el);
  selectElement(el);
  broadcastElements();
}

function addElementToViewport(el) {
  var viewport = $("canvasViewport");
  var div = document.createElement("div");
  div.className = "canvas-element " + el.type;
  div.dataset.id = el.id;

  if (el.type === "rect") {
    div.style.background = el.color;
  } else if (el.type === "image" && el.src) {
    var img = document.createElement("img");
    img.src = el.src;
    div.appendChild(img);
  }

  // Resize handle
  var handle = document.createElement("div");
  handle.className = "resize-handle se";
  handle.onmousedown = function(e) {
    e.stopPropagation();
    resizingElement = el;
  };
  div.appendChild(handle);

  div.onmousedown = function(e) {
    if (e.target.className.includes("resize-handle")) return;
    e.stopPropagation();
    selectElement(el);
    draggingElement = el;
    var rect = $("canvasViewport").getBoundingClientRect();
    dragOffset.x = (e.clientX - rect.left) / editorScale - el.x;
    dragOffset.y = (e.clientY - rect.top) / editorScale - el.y;
  };

  el.dom = div;
  updateElementPosition(el);
  viewport.appendChild(div);
}

function updateElementPosition(el) {
  if (!el.dom) return;
  el.dom.style.left = el.x + "px";
  el.dom.style.top = el.y + "px";
  el.dom.style.width = el.w + "px";
  el.dom.style.height = el.h + "px";
}

function selectElement(el) {
  if (selectedElement && selectedElement.dom) {
    selectedElement.dom.classList.remove("selected");
  }
  selectedElement = el;
  if (el && el.dom) {
    el.dom.classList.add("selected");
  }
}

function broadcastElements() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: "canvas_elements",
    elements: canvasElements.map(function(el) {
      return { type: el.type, x: el.x, y: el.y, w: el.w, h: el.h, color: el.color, src: el.src };
    }),
    canvasLayout: state.canvasLayout
  }));
}

// Image Upload Functions
function uploadCanvasImage(file) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "canvas_upload",
        image: ev.target.result,
        canvasLayout: state.canvasLayout
      }));
    }
  };
  reader.readAsDataURL(file);
}

function loadCanvasImageUrl() {
  var url = $("canvasUrlInput").value.trim();
  console.log("loadCanvasImageUrl called with URL:", url);
  if (url && ws && ws.readyState === 1) {
    console.log("Sending canvas_upload with URL to server");
    ws.send(JSON.stringify({
      type: "canvas_upload",
      url: url
    }));
    $("canvasUrlInput").value = "";
  } else {
    console.log("URL empty or WebSocket not ready");
  }
}

// Build scene grid with built-in + custom items
function buildSceneGrid() {
  var grid = $("sceneGrid");
  grid.innerHTML = "";

  // Built-in scenes
  SCENES.forEach(function(s) {
    var d = document.createElement("div");
    d.className = "scene" + (state.mode === "builtin" && state.scene === s.id ? " active" : "");
    d.dataset.type = "builtin";
    d.dataset.scene = s.id;
    d.innerHTML = '<div class="scene-icon">' + s.icon + '</div><div class="scene-name">' + s.name + '</div>';
    d.onclick = function() { selectBuiltinScene(s.id); };
    grid.appendChild(d);
  });

  // Custom items from library
  library.forEach(function(item) {
    var d = document.createElement("div");
    d.className = "scene custom-scene";
    d.dataset.type = "custom";
    d.dataset.id = item.id;
    d.innerHTML = '<div class="scene-icon">&#128196;</div><div class="scene-name">' + item.name + '</div><span class="scene-delete" title="Delete">x</span>';
    d.querySelector(".scene-name").onclick = function() { loadAndBroadcastCustom(item.id); };
    d.querySelector(".scene-delete").onclick = function(e) {
      e.stopPropagation();
      confirmDelete(item.id, item.name);
    };
    grid.appendChild(d);
  });
}

// Select built-in scene
function selectBuiltinScene(sceneId) {
  currentMode = "builtin";
  state.mode = "builtin";
  state.scene = sceneId;

  // Update UI
  document.querySelectorAll(".scene").forEach(function(el) {
    el.classList.remove("active");
    if (el.dataset.type === "builtin" && el.dataset.scene === sceneId) {
      el.classList.add("active");
    }
  });

  $("builtinControls").style.display = "block";
  $("customControls").style.display = "none";

  broadcast();
}

// Load custom item and broadcast
function loadAndBroadcastCustom(id) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "load_from_library", id: id }));
  }

  currentMode = "custom";
  $("builtinControls").style.display = "none";
  $("customControls").style.display = "block";

  // Remove active from all scenes
  document.querySelectorAll(".scene").forEach(function(el) {
    el.classList.remove("active");
  });
}

// Show custom editor for new HTML
function showCustomEditor() {
  currentMode = "custom";
  $("builtinControls").style.display = "none";
  $("customControls").style.display = "block";
  $("htmlEditor").value = "";
  $("htmlName").value = "";

  document.querySelectorAll(".scene").forEach(function(el) {
    el.classList.remove("active");
  });
}

// Color selection
function selectColor(c) {
  state.color = c;
  document.querySelectorAll(".color-btn").forEach(function(el) {
    el.classList.toggle("active", el.style.background === c);
  });
  broadcast();
}

// Build color grid
function buildColorGrid() {
  var grid = $("colorGrid");
  grid.innerHTML = "";
  COLORS.forEach(function(c) {
    var d = document.createElement("div");
    d.className = "color-btn" + (c === state.color ? " active" : "");
    d.style.background = c;
    d.onclick = function() { selectColor(c); };
    grid.appendChild(d);
  });
}

// Preview & Displays
function updatePreview() {
  var p = $("preview");
  p.innerHTML = "";
  for (var i = 1; i <= state.displayCount; i++) {
    var d = document.createElement("div");
    d.className = "preview-screen" + (connectedDisplays.indexOf(i) >= 0 ? " connected" : "");
    d.textContent = "D" + i;
    p.appendChild(d);
  }
  updateDisplaysList();
}

function updateDisplaysList() {
  var l = $("displaysList");
  if (!l) return;
  l.innerHTML = "";
  for (var i = 1; i <= state.displayCount; i++) {
    var c = connectedDisplays.indexOf(i) >= 0;
    var a = document.createElement("a");
    a.className = "display-link" + (c ? " connected" : "");
    a.href = "/d" + i;
    a.target = "_blank";
    a.innerHTML = '<span>Display ' + i + '</span><span class="status">' + (c ? "Connected" : "Open") + '</span>';
    l.appendChild(a);
  }
}

// WebSocket
function broadcast() {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "update_state", state: state }));
  }
}

function broadcastHtml() {
  var h = $("htmlEditor").value;
  var n = $("htmlName").value || "Live";
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "broadcast_html", html: h, name: n }));
  }
}

function saveToLibrary() {
  var h = $("htmlEditor").value;
  var n = $("htmlName").value || "Untitled";
  if (h && ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "save_to_library", html: h, name: n }));
  }
}

function confirmDelete(id, name) {
  pendingDeleteId = id;
  $("deleteItemName").textContent = name;
  $("deleteModal").classList.add("show");
}

function deleteFromLibrary() {
  if (pendingDeleteId && ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "delete_from_library", id: pendingDeleteId }));
    pendingDeleteId = null;
    $("deleteModal").classList.remove("show");
  }
}

function connect() {
  ws = new WebSocket((location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.hostname + ":3001");

  ws.onopen = function() {
    $("connBadge").className = "badge connected";
    $("connBadge").querySelector("span:last-child").textContent = "Online";
    ws.send(JSON.stringify({ type: "register_control" }));
  };

  ws.onclose = function() {
    $("connBadge").className = "badge";
    $("connBadge").querySelector("span:last-child").textContent = "Offline";
    setTimeout(connect, 2000);
  };

  ws.onmessage = function(e) {
    var msg = JSON.parse(e.data);

    if (msg.type === "init" || msg.type === "state_update") {
      if (msg.lanIP) {
        serverInfo.lanIP = msg.lanIP;
        serverInfo.httpPort = msg.httpPort || 3000;
        $("helpUrl").textContent = "http://" + serverInfo.lanIP + ":" + serverInfo.httpPort + "/d1";
      }
      if (msg.state) {
        Object.assign(state, msg.state);
        $("displayCount").value = state.displayCount;
        $("speed").value = state.speed;
        $("intensity").value = state.intensity;
        $("speedVal").textContent = state.speed.toFixed(1);
        $("intensityVal").textContent = state.intensity.toFixed(1);
        if (state.customHtml) $("htmlEditor").value = state.customHtml;
        if (state.customName) $("htmlName").value = state.customName;

        // Update canvas mode if needed
        if (state.canvasMode && currentViewMode === "canvas") {
          initCanvas();
        }
      }
      if (msg.connectedDisplays) connectedDisplays = msg.connectedDisplays;
      if (msg.library) {
        library = msg.library;
        buildSceneGrid();
      }
      updatePreview();
    }

    if (msg.type === "displays_update") {
      connectedDisplays = msg.connectedDisplays || [];
      updatePreview();
      // Refresh canvas if in canvas mode
      if (currentViewMode === "canvas") {
        initCanvas();
      }
    }

    if (msg.type === "library_update") {
      library = msg.library || [];
      buildSceneGrid();
    }
  };
}

// Event Bindings
function bindEvents() {
  $("speed").oninput = function(e) {
    state.speed = parseFloat(e.target.value);
    $("speedVal").textContent = state.speed.toFixed(1);
    broadcast();
  };

  $("intensity").oninput = function(e) {
    state.intensity = parseFloat(e.target.value);
    $("intensityVal").textContent = state.intensity.toFixed(1);
    broadcast();
  };

  $("displayCount").onchange = function(e) {
    var val = parseInt(e.target.value) || 1;
    state.displayCount = Math.max(1, val);
    e.target.value = state.displayCount;
    updatePreview();
    if (currentViewMode === "canvas") {
      initCanvas();
    }
    broadcast();
  };

  $("sendText").onclick = function() {
    state.text = $("textInput").value;
    selectBuiltinScene("text");
  };

  $("broadcastHtml").onclick = broadcastHtml;
  $("saveLibrary").onclick = saveToLibrary;
  $("confirmDelete").onclick = deleteFromLibrary;

  $("newCustomBtn").onclick = showCustomEditor;

  $("uploadFileBtn").onclick = function() {
    $("fileInput").click();
  };

  $("fileInput").onchange = function(e) {
    var f = e.target.files[0];
    if (f) {
      var r = new FileReader();
      r.onload = function(ev) {
        showCustomEditor();
        $("htmlEditor").value = ev.target.result;
        $("htmlName").value = f.name.replace(/\.[^.]+$/, "");
      };
      r.readAsText(f);
    }
  };

  $("helpBtn").onclick = function() {
    $("helpModal").classList.add("show");
  };

  document.querySelectorAll(".modal-overlay").forEach(function(m) {
    m.onclick = function(e) {
      if (e.target === m) m.classList.remove("show");
    };
  });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay").forEach(function(m) {
        m.classList.remove("show");
      });
      closeAddPopup();
    }
    if (e.key === "Control") {
      isCtrlPressed = true;
    }
    // A key to open add popup in canvas mode
    if (e.key === "a" || e.key === "A") {
      if (currentViewMode === "canvas") {
        e.preventDefault();
        showAddPopup();
      }
    }
  });

  document.addEventListener("keyup", function(e) {
    if (e.key === "Control") {
      isCtrlPressed = false;
    }
  });

  // Mode tabs
  document.querySelectorAll(".mode-tab").forEach(function(tab) {
    tab.onclick = function() {
      switchViewMode(tab.dataset.mode);
    };
  });

  // Canvas editor buttons
  $("addRectBtn").onclick = function() {
    var color = prompt("Color:", "#ff0000");
    if (color) {
      addElement("rect", { color: color, w: 1920, h: 1080 });
    }
  };

  $("addImageBtn").onclick = function() {
    $("canvasFileInput").click();
  };

  $("canvasFileInput").onchange = function(e) {
    var file = e.target.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        addElement("image", { src: ev.target.result, w: 1920, h: 1080 });
      };
      reader.readAsDataURL(file);
    }
  };

  // Delete key removes selected element
  document.addEventListener("keydown", function(e) {
    if (e.key === "Delete" && selectedElement) {
      canvasElements = canvasElements.filter(function(el) { return el !== selectedElement; });
      if (selectedElement.dom) selectedElement.dom.remove();
      selectedElement = null;
      broadcastElements();
    }
  });
}

// Popup Functions
function showAddPopup() {
  $("addPopup").classList.add("show");
}

function closeAddPopup() {
  $("addPopup").classList.remove("show");
}

function handleAddAction(action) {
  closeAddPopup();

  if (action === "image-file") {
    // Trigger file input
    $("canvasFileInput").click();
  } else if (action === "image-url") {
    var url = prompt("Enter image URL:");
    if (url && url.trim() && ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "canvas_upload",
        url: url.trim(),
        canvasLayout: state.canvasLayout
      }));
    }
  } else if (action === "solid-color") {
    var color = prompt("Enter hex color (e.g., #ff0000):", "#ff0000");
    if (color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color.trim())) {
      var x = parseInt(prompt("X position:", "0")) || 0;
      var y = parseInt(prompt("Y position:", "0")) || 0;
      var w = parseInt(prompt("Width:", "1920")) || 1920;
      var h = parseInt(prompt("Height:", "1080")) || 1080;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: "canvas_content",
          content: { type: "rect", color: color.trim(), x: x, y: y, w: w, h: h },
          canvasLayout: state.canvasLayout
        }));
      }
    }
  } else if (action === "text") {
    // Placeholder for text
    alert("Text feature coming soon!");
  }
}

// Initialize
function init() {
  buildColorGrid();
  buildSceneGrid();
  bindEvents();
  updatePreview();
  connect();
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
