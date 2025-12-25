/**
 * Display Sync - Control Panel
 */

// Constants
var SCENES = [
  { id: "none", icon: "&#9676;", name: "None" },
  { id: "gradient", icon: "&#127752;", name: "Gradient" },
  { id: "waves", icon: "&#127754;", name: "Waves" },
  { id: "particles", icon: "&#10024;", name: "Particles" },
  { id: "matrix", icon: "&#128223;", name: "Matrix" },
  { id: "solid", icon: "&#9724;", name: "Solid" },
  { id: "text", icon: "Aa", name: "Text" },
  { id: "image", icon: "&#128247;", name: "Image" }
];

var COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
  "#8b5cf6", "#ec4899", "#f43f5e", "#06b6d4", "#84cc16", "#ffffff"
];

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
  canvasMode: false,
  canvasLayout: {},
  imageUrl: "",
  labelMode: "hidden"  // "always", "interact", "hidden"
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
var pendingImageElement = null;
var pendingSceneImage = false;

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
  return el;
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
  // Image scene triggers file picker
  if (sceneId === "image") {
    pendingSceneImage = true;
    $("sceneImageInput").click();
    return;
  }

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
  // Custom color picker button - opens round picker
  var custom = document.createElement("div");
  custom.className = "color-btn custom";
  custom.title = "Custom color";
  custom.onclick = function() { showColorPicker(); };
  grid.appendChild(custom);
}

// =============================================
// Color Picker using iro.js library
// =============================================
var colorPicker = null;
var pickerColor = { r: 255, g: 0, b: 0, h: 0, s: 100, v: 100, a: 100 };
var activeSlider = null;

function showColorPicker() {
  $("colorPickerOverlay").classList.add("show");
  if (colorPicker) {
    colorPicker.color.hexString = state.color;
  }
  var rgb = hexToRgbPicker(state.color);
  pickerColor.r = rgb.r;
  pickerColor.g = rgb.g;
  pickerColor.b = rgb.b;
  var hsv = rgbToHsvPicker(rgb.r, rgb.g, rgb.b);
  pickerColor.h = hsv.h;
  pickerColor.s = hsv.s;
  pickerColor.v = hsv.v;
  updateAllSliders();
}

function hideColorPicker() {
  $("colorPickerOverlay").classList.remove("show");
}

function hexToRgbPicker(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHexPicker(r, g, b) {
  return "#" + [r, g, b].map(function(x) {
    var hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function rgbToHsvPicker(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, v = max;
  var d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) { h = 0; }
  else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function hsvToRgbPicker(h, s, v) {
  s /= 100; v /= 100;
  var c = v * s;
  var x = c * (1 - Math.abs((h / 60) % 2 - 1));
  var m = v - c;
  var r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function updateAllSliders() {
  // Update preview
  var hex = rgbToHexPicker(pickerColor.r, pickerColor.g, pickerColor.b);
  $("colorPreviewBox").style.background = hex;
  $("hexInput").value = hex;

  // RGB sliders
  updateSliderGradient("sliderR", "rgb(" + pickerColor.r + ",0,0)", "rgb(" + pickerColor.r + ",0,0)", pickerColor.r / 255);
  updateSliderGradient("sliderG", "rgb(0," + pickerColor.g + ",0)", "rgb(0," + pickerColor.g + ",0)", pickerColor.g / 255);
  updateSliderGradient("sliderB", "rgb(0,0," + pickerColor.b + ")", "rgb(0,0," + pickerColor.b + ")", pickerColor.b / 255);
  $("sliderR").style.background = "linear-gradient(to right, #000, #f00)";
  $("sliderG").style.background = "linear-gradient(to right, #000, #0f0)";
  $("sliderB").style.background = "linear-gradient(to right, #000, #00f)";
  $("sliderA_rgb").style.background = "linear-gradient(to right, transparent, " + hex + ")";
  setSliderHandle("sliderR", pickerColor.r / 255);
  setSliderHandle("sliderG", pickerColor.g / 255);
  setSliderHandle("sliderB", pickerColor.b / 255);
  setSliderHandle("sliderA_rgb", pickerColor.a / 100);
  $("valR").value = pickerColor.r;
  $("valG").value = pickerColor.g;
  $("valB").value = pickerColor.b;
  $("valA_rgb").value = pickerColor.a;

  // HSV sliders
  $("sliderH").style.background = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";
  var pureColor = hsvToRgbPicker(pickerColor.h, 100, 100);
  $("sliderS").style.background = "linear-gradient(to right, #fff, rgb(" + pureColor.r + "," + pureColor.g + "," + pureColor.b + "))";
  $("sliderV").style.background = "linear-gradient(to right, #000, rgb(" + pureColor.r + "," + pureColor.g + "," + pureColor.b + "))";
  setSliderHandle("sliderH", pickerColor.h / 360);
  setSliderHandle("sliderS", pickerColor.s / 100);
  setSliderHandle("sliderV", pickerColor.v / 100);
  $("valH").value = pickerColor.h;
  $("valS").value = pickerColor.s;
  $("valV").value = pickerColor.v;

  // Alpha hex
  $("sliderA_hex").style.background = "linear-gradient(to right, transparent, " + hex + ")";
  setSliderHandle("sliderA_hex", pickerColor.a / 100);
  $("valA_hex").value = pickerColor.a;

  // Live update
  selectColor(hex);
  if (colorPicker) colorPicker.color.hexString = hex;
}

function setSliderHandle(sliderId, pct) {
  var slider = $(sliderId);
  var handle = slider.querySelector(".color-slider-handle");
  if (!handle) {
    handle = document.createElement("div");
    handle.className = "color-slider-handle";
    slider.appendChild(handle);
  }
  handle.style.left = (pct * 100) + "%";
}

function updateSliderGradient(id, from, to, pct) {
  // placeholder for gradient update
}

function createSliderEvents(sliderId, onChange) {
  var slider = $(sliderId);
  var dragging = false;

  function update(e) {
    var rect = slider.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(pct);
    updateAllSliders();
  }

  slider.addEventListener("mousedown", function(e) {
    dragging = true;
    activeSlider = sliderId;
    update(e);
  });

  document.addEventListener("mousemove", function(e) {
    if (dragging && activeSlider === sliderId) update(e);
  });

  document.addEventListener("mouseup", function() {
    if (activeSlider === sliderId) {
      dragging = false;
      activeSlider = null;
    }
  });
}

function initColorPicker() {
  var overlay = $("colorPickerOverlay");

  // Create iro.js color picker wheel
  colorPicker = new iro.ColorPicker("#colorWheelContainer", {
    width: 180,
    color: state.color,
    borderWidth: 2,
    borderColor: "#333",
    layout: [{ component: iro.ui.Wheel }]
  });

  colorPicker.on("color:change", function(color) {
    pickerColor.r = color.red;
    pickerColor.g = color.green;
    pickerColor.b = color.blue;
    var hsv = rgbToHsvPicker(color.red, color.green, color.blue);
    pickerColor.h = hsv.h;
    pickerColor.s = hsv.s;
    pickerColor.v = hsv.v;
    updateAllSliders();
  });

  // Tab switching
  document.querySelectorAll(".color-tab").forEach(function(tab) {
    tab.addEventListener("click", function() {
      document.querySelectorAll(".color-tab").forEach(function(t) { t.classList.remove("active"); });
      document.querySelectorAll(".color-tab-content").forEach(function(c) { c.classList.remove("active"); });
      tab.classList.add("active");
      $("tab-" + tab.dataset.tab).classList.add("active");
    });
  });

  // RGB sliders
  createSliderEvents("sliderR", function(p) { pickerColor.r = Math.round(p * 255); syncHsvFromRgb(); });
  createSliderEvents("sliderG", function(p) { pickerColor.g = Math.round(p * 255); syncHsvFromRgb(); });
  createSliderEvents("sliderB", function(p) { pickerColor.b = Math.round(p * 255); syncHsvFromRgb(); });
  createSliderEvents("sliderA_rgb", function(p) { pickerColor.a = Math.round(p * 100); });

  // HSV sliders
  createSliderEvents("sliderH", function(p) { pickerColor.h = Math.round(p * 360); syncRgbFromHsv(); });
  createSliderEvents("sliderS", function(p) { pickerColor.s = Math.round(p * 100); syncRgbFromHsv(); });
  createSliderEvents("sliderV", function(p) { pickerColor.v = Math.round(p * 100); syncRgbFromHsv(); });

  // Alpha hex
  createSliderEvents("sliderA_hex", function(p) { pickerColor.a = Math.round(p * 100); });

  // Number inputs
  $("valR").addEventListener("input", function() { pickerColor.r = parseInt(this.value) || 0; syncHsvFromRgb(); updateAllSliders(); });
  $("valG").addEventListener("input", function() { pickerColor.g = parseInt(this.value) || 0; syncHsvFromRgb(); updateAllSliders(); });
  $("valB").addEventListener("input", function() { pickerColor.b = parseInt(this.value) || 0; syncHsvFromRgb(); updateAllSliders(); });
  $("valA_rgb").addEventListener("input", function() { pickerColor.a = parseInt(this.value) || 0; updateAllSliders(); });
  $("valH").addEventListener("input", function() { pickerColor.h = parseInt(this.value) || 0; syncRgbFromHsv(); updateAllSliders(); });
  $("valS").addEventListener("input", function() { pickerColor.s = parseInt(this.value) || 0; syncRgbFromHsv(); updateAllSliders(); });
  $("valV").addEventListener("input", function() { pickerColor.v = parseInt(this.value) || 0; syncRgbFromHsv(); updateAllSliders(); });
  $("valA_hex").addEventListener("input", function() { pickerColor.a = parseInt(this.value) || 0; updateAllSliders(); });

  // Hex input
  $("hexInput").addEventListener("input", function() {
    var val = this.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      var rgb = hexToRgbPicker(val);
      pickerColor.r = rgb.r;
      pickerColor.g = rgb.g;
      pickerColor.b = rgb.b;
      syncHsvFromRgb();
      updateAllSliders();
    }
  });

  // Close on overlay click
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) hideColorPicker();
  });
}

function syncHsvFromRgb() {
  var hsv = rgbToHsvPicker(pickerColor.r, pickerColor.g, pickerColor.b);
  pickerColor.h = hsv.h;
  pickerColor.s = hsv.s;
  pickerColor.v = hsv.v;
}

function syncRgbFromHsv() {
  var rgb = hsvToRgbPicker(pickerColor.h, pickerColor.s, pickerColor.v);
  pickerColor.r = rgb.r;
  pickerColor.g = rgb.g;
  pickerColor.b = rgb.b;
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

    if (msg.type === "sync_status") {
      var el = $("syncStatus");
      if (msg.status === "syncing") {
        el.className = "sync-status syncing";
        el.textContent = "Syncing " + msg.ready + "/" + msg.total;
      } else if (msg.status === "synced") {
        el.className = "sync-status synced";
        el.textContent = "Synced";
      }
    }

    if (msg.type === "server_log") {
      addLog(msg.message, msg.category);
    }

    if (msg.type === "image_uploaded" && msg.url) {
      if (pendingImageElement) {
        addElement("image", { src: msg.url, w: pendingImageElement.w, h: pendingImageElement.h });
        pendingImageElement = null;
      }
    }

    if (msg.type === "scene_image_uploaded" && msg.url) {
      state.scene = "image";
      state.imageUrl = msg.url;
      state.mode = "builtin";
      currentMode = "builtin";
      document.querySelectorAll(".scene").forEach(function(el) {
        el.classList.remove("active");
        if (el.dataset.scene === "image") el.classList.add("active");
      });
      $("builtinControls").style.display = "block";
      $("customControls").style.display = "none";
      broadcast();
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

  $("labelMode").onchange = function(e) {
    state.labelMode = e.target.value;
    broadcast();
  };

  $("sendText").onclick = function() {
    state.text = $("textInput").value;
    selectBuiltinScene("text");
  };

  $("textInput").onkeydown = function(e) {
    if (e.key === "Enter") {
      state.text = $("textInput").value;
      selectBuiltinScene("text");
    }
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
      hideColorPicker();
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
        var base64 = ev.target.result;
        if (ws && ws.readyState === 1) {
          pendingImageElement = { base64: base64, w: 1920, h: 1080 };
          ws.send(JSON.stringify({
            type: "upload_image",
            image: base64
          }));
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset so same file can be selected again
    e.target.value = "";
  };

  // Scene image upload
  $("sceneImageInput").onchange = function(e) {
    var file = e.target.files[0];
    if (file && pendingSceneImage) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "upload_scene_image",
            image: ev.target.result
          }));
        }
      };
      reader.readAsDataURL(file);
    }
    pendingSceneImage = false;
    e.target.value = "";
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

// Sidebar Log
function addLog(message, category) {
  var body = $("logBody");
  if (!body) return;
  var entry = document.createElement("div");
  entry.className = "log-entry " + (category || "");
  entry.textContent = message;
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;
  // Limit to 50 entries
  while (body.children.length > 50) {
    body.removeChild(body.firstChild);
  }
}

// Initialize
function init() {
  buildColorGrid();
  buildSceneGrid();
  bindEvents();
  initColorPicker();
  updatePreview();
  connect();
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
