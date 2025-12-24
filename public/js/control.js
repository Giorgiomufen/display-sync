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
  displayCount: 3
};
var connectedDisplays = [];
var library = [];
var serverInfo = { lanIP: "", httpPort: 3000 };
var pendingDeleteId = null;
var currentSelection = { type: "builtin", id: "gradient" };

// Helpers
function $(id) {
  return document.getElementById(id);
}

// UI Initialization
function initUI() {
  COLORS.forEach(function(c) {
    var d = document.createElement("div");
    d.className = "color-btn" + (c === state.color ? " active" : "");
    d.style.background = c;
    d.onclick = function() { selectColor(c); };
    $("colorGrid").appendChild(d);
  });
  updateLibraryList();
}

// Library
function updateLibraryList() {
  var l = $("libraryList");
  l.innerHTML = "";

  // Built-in section
  l.innerHTML += '<div class="library-divider">Built-in</div>';
  SCENES.forEach(function(s) {
    var d = document.createElement("div");
    d.className = "library-item builtin" + (currentSelection.type === "builtin" && currentSelection.id === s.id ? " active" : "");
    d.innerHTML = '<span class="icon">' + s.icon + '</span><span class="name">' + s.name + '</span>';
    d.onclick = function() { selectBuiltin(s.id, s.name); };
    l.appendChild(d);
  });

  // Custom section
  if (library.length > 0) {
    l.innerHTML += '<div class="library-divider">Custom</div>';
    library.forEach(function(item) {
      var d = document.createElement("div");
      d.className = "library-item" + (currentSelection.type === "custom" && currentSelection.id === item.id ? " active" : "");
      d.innerHTML = '<span class="icon">&#128196;</span><span class="name">' + item.name + '</span><span class="delete">x</span>';
      d.querySelector(".name").onclick = function() { loadFromLibrary(item.id, item.name); };
      d.querySelector(".delete").onclick = function(e) { e.stopPropagation(); confirmDelete(item.id, item.name); };
      l.appendChild(d);
    });
  }

  // New button
  l.innerHTML += '<div class="library-divider">New</div>';
  var newBtn = document.createElement("div");
  newBtn.className = "library-item";
  newBtn.innerHTML = '<span class="icon">+</span><span class="name">Create Custom HTML</span>';
  newBtn.onclick = function() { showCustomEditor(); };
  l.appendChild(newBtn);
}

// Selection handlers
function selectBuiltin(id, name) {
  currentSelection = { type: "builtin", id: id };
  state.mode = "builtin";
  state.scene = id;
  $("modeTitle").textContent = name;
  $("builtinControls").style.display = "block";
  $("customControls").style.display = "none";
  updateLibraryList();
  broadcast();
}

function showCustomEditor() {
  currentSelection = { type: "custom", id: null };
  $("modeTitle").textContent = "Custom HTML";
  $("builtinControls").style.display = "none";
  $("customControls").style.display = "block";
  $("htmlEditor").value = "";
  $("htmlName").value = "";
  updateLibraryList();
  updateDisplaysList2();
}

function selectColor(c) {
  state.color = c;
  document.querySelectorAll(".color-btn").forEach(function(el) {
    el.classList.toggle("active", el.style.background === c);
  });
  broadcast();
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
  updateDisplaysList2();
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

function updateDisplaysList2() {
  var l = $("displaysList2");
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

function loadFromLibrary(id, name) {
  currentSelection = { type: "custom", id: id };
  $("modeTitle").textContent = name;
  $("builtinControls").style.display = "none";
  $("customControls").style.display = "block";
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "load_from_library", id: id }));
  }
  updateLibraryList();
  updateDisplaysList2();
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
      }
      if (msg.connectedDisplays) connectedDisplays = msg.connectedDisplays;
      if (msg.library) {
        library = msg.library;
        updateLibraryList();
      }
      updatePreview();
    }

    if (msg.type === "displays_update") {
      connectedDisplays = msg.connectedDisplays || [];
      updatePreview();
    }

    if (msg.type === "library_update") {
      library = msg.library || [];
      updateLibraryList();
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
    broadcast();
  };

  $("sendText").onclick = function() {
    state.text = $("textInput").value;
    selectBuiltin("text", "Text");
  };

  $("broadcastHtml").onclick = broadcastHtml;
  $("saveLibrary").onclick = saveToLibrary;
  $("confirmDelete").onclick = deleteFromLibrary;

  $("uploadFile").onclick = function() {
    $("fileInput").click();
  };

  $("fileInput").onchange = function(e) {
    var f = e.target.files[0];
    if (f) {
      var r = new FileReader();
      r.onload = function(ev) {
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
    }
  });
}

// Initialize
function init() {
  initUI();
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
