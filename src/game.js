const missions = [
  {
    name: "Glass Orchid",
    corp: "Kuroda Biolabs",
    objective: "Extract gene vault",
    reward: 1800,
    difficulty: 1,
    size: 24
  },
  {
    name: "Silent Dividend",
    corp: "Apex Meridian Bank",
    objective: "Ghost the audit ledger",
    reward: 3200,
    difficulty: 2,
    size: 30
  },
  {
    name: "Black Aurora",
    corp: "Helix Arcology",
    objective: "Steal orbital key shard",
    reward: 5200,
    difficulty: 3,
    size: 36
  }
];

const state = {
  selectedMission: 0,
  active: false,
  tool: "spoof",
  currentNode: 0,
  cleared: new Set(),
  trace: 0,
  stealth: 100,
  credits: 0,
  cipherTarget: null,
  map: []
};

const els = {
  missionList: document.querySelector("#mission-list"),
  missionTitle: document.querySelector("#mission-title"),
  targetName: document.querySelector("#target-name"),
  objectiveTitle: document.querySelector("#objective-title"),
  startButton: document.querySelector("#start-mission-button"),
  networkMap: document.querySelector("#network-map"),
  trace: document.querySelector("#trace-value"),
  credits: document.querySelector("#credits-value"),
  stealth: document.querySelector("#stealth-value"),
  terminal: document.querySelector("#terminal-output"),
  cipherCard: document.querySelector("#cipher-card"),
  cipherLabel: document.querySelector("#cipher-label"),
  cipherCode: document.querySelector("#cipher-code"),
  cipherInput: document.querySelector("#cipher-input"),
  cipherSubmit: document.querySelector("#cipher-submit"),
  toast: document.querySelector("#toast"),
  newRun: document.querySelector("#new-run-button")
};

const nodeTypes = {
  open: { label: "Relay", tool: "spoof", risk: 4 },
  locked: { label: "Cipher", tool: "decrypt", risk: 8 },
  firewall: { label: "Wall", tool: "pulse", risk: 12 },
  objective: { label: "Vault", tool: "decrypt", risk: 16 }
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addLog(text, tone = "normal") {
  const line = document.createElement("p");
  line.textContent = `> ${text}`;
  if (tone === "danger") line.style.color = "var(--red)";
  if (tone === "success") line.style.color = "var(--lime)";
  els.terminal.prepend(line);
}

function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 1900);
}

function renderMissions() {
  els.missionList.innerHTML = "";
  missions.forEach((mission, index) => {
    const button = document.createElement("button");
    button.className = `mission-card ${index === state.selectedMission ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `<strong>${mission.name}</strong><span>${mission.corp} / Risk ${mission.difficulty} / ${mission.reward} cr</span>`;
    button.addEventListener("click", () => {
      if (state.active) return toast("Finish or reset the active breach first.");
      state.selectedMission = index;
      render();
    });
    els.missionList.append(button);
  });
}

function buildMap(mission) {
  const map = [];
  for (let i = 0; i < mission.size; i += 1) {
    const roll = Math.random();
    let type = "open";
    if (roll > 0.74 - mission.difficulty * 0.06) type = "locked";
    if (roll > 0.88 - mission.difficulty * 0.05) type = "firewall";
    map.push({
      id: i,
      type,
      cipher: String(randomInt(1000, 9999))
    });
  }
  map[0].type = "open";
  map[mission.size - 1].type = "objective";
  return map;
}

function startMission() {
  const mission = missions[state.selectedMission];
  state.active = true;
  state.currentNode = 0;
  state.cleared = new Set([0]);
  state.trace = 0;
  state.stealth = 100;
  state.cipherTarget = null;
  state.map = buildMap(mission);
  els.terminal.innerHTML = "";
  addLog(`Uplink established with ${mission.corp}.`);
  addLog("Entry relay spoofed. Move adjacent, keep trace below 100%.");
  hideCipher();
  render();
}

function resetRun() {
  state.active = false;
  state.currentNode = 0;
  state.cleared = new Set();
  state.trace = 0;
  state.stealth = 100;
  state.cipherTarget = null;
  state.map = [];
  els.terminal.innerHTML = "";
  hideCipher();
  render();
  addLog("Deck scrubbed. Pick a contract.");
}

function isAdjacent(id) {
  const width = getGridWidth();
  const current = state.currentNode;
  const currentRow = Math.floor(current / width);
  const row = Math.floor(id / width);
  const colDelta = Math.abs((current % width) - (id % width));
  const rowDelta = Math.abs(currentRow - row);
  return colDelta + rowDelta === 1;
}

function getGridWidth() {
  if (window.matchMedia("(max-width: 760px)").matches) return 4;
  return 6;
}

function handleNode(id) {
  if (!state.active) return toast("Start a breach first.");
  if (state.cleared.has(id)) {
    state.currentNode = id;
    render();
    return;
  }
  if (!isAdjacent(id)) return toast("Node is out of signal range.");

  const node = state.map[id];
  const type = nodeTypes[node.type];
  const correctTool = state.tool === type.tool;

  if (node.type === "locked" || node.type === "objective") {
    if (state.tool !== "decrypt") {
      increaseTrace(type.risk);
      addLog("Cipher touched with the wrong tool. Trace spike.", "danger");
      return render();
    }
    showCipher(id);
    return;
  }

  if (!correctTool) {
    increaseTrace(type.risk);
    state.stealth = Math.max(0, state.stealth - type.risk);
    addLog(`${type.label} resisted ${state.tool}. Security noticed.`, "danger");
  } else {
    clearNode(id);
    addLog(`${type.label} bypassed with ${state.tool}.`, "success");
  }
  render();
}

function showCipher(id) {
  const node = state.map[id];
  state.cipherTarget = id;
  els.cipherCard.classList.remove("hidden");
  els.cipherLabel.textContent = node.type === "objective" ? "Vault key" : "Cipher key";
  els.cipherCode.textContent = scrambleCipher(node.cipher);
  els.cipherInput.value = "";
  els.cipherInput.focus();
  addLog("Cipher challenge opened. Decode the reversed key.");
}

function hideCipher() {
  state.cipherTarget = null;
  els.cipherCard.classList.add("hidden");
}

function scrambleCipher(value) {
  return value.split("").reverse().join("");
}

function submitCipher() {
  if (state.cipherTarget === null) return;
  const node = state.map[state.cipherTarget];
  const answer = els.cipherInput.value.trim();
  if (answer === node.cipher) {
    clearNode(state.cipherTarget);
    addLog("Cipher cracked. Access token minted.", "success");
    hideCipher();
    render();
    return;
  }
  increaseTrace(nodeTypes[node.type].risk + 6);
  state.stealth = Math.max(0, state.stealth - 10);
  addLog("Bad key. ICE backwash hit the deck.", "danger");
  render();
}

function clearNode(id) {
  state.cleared.add(id);
  state.currentNode = id;
  const node = state.map[id];
  if (node.type === "objective") completeMission();
}

function completeMission() {
  const mission = missions[state.selectedMission];
  const bonus = Math.max(0, state.stealth * 8 - state.trace * 4);
  const payout = mission.reward + bonus;
  state.credits += payout;
  state.active = false;
  addLog(`${mission.objective} complete. Payout: ${payout} credits.`, "success");
  toast("Heist complete.");
}

function increaseTrace(amount) {
  state.trace = Math.min(100, state.trace + amount);
  if (state.trace >= 100) {
    state.active = false;
    hideCipher();
    addLog("Trace hit 100%. Corporate counter-hack burned the route.", "danger");
    toast("Breach failed.");
  }
}

function renderMap() {
  els.networkMap.innerHTML = "";
  if (!state.map.length) {
    for (let i = 0; i < 24; i += 1) {
      const node = document.createElement("button");
      node.className = "node";
      node.disabled = true;
      node.textContent = "Idle";
      els.networkMap.append(node);
    }
    return;
  }

  state.map.forEach((node) => {
    const button = document.createElement("button");
    const type = nodeTypes[node.type];
    const cleared = state.cleared.has(node.id);
    const reachable = cleared || isAdjacent(node.id);
    button.type = "button";
    button.className = `node ${node.type} ${cleared ? "cleared" : ""} ${node.id === state.currentNode ? "current" : ""}`;
    button.disabled = !state.active && !cleared;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${type.label} node ${node.id + 1}`);
    button.textContent = cleared ? "Clear" : reachable ? type.label : "Ghost";
    button.addEventListener("click", () => handleNode(node.id));
    els.networkMap.append(button);
  });
}

function renderStatus() {
  const mission = missions[state.selectedMission];
  els.missionTitle.textContent = mission.name;
  els.targetName.textContent = state.active ? mission.corp : "No active breach";
  els.objectiveTitle.textContent = state.active ? mission.objective : "Awaiting uplink";
  els.startButton.disabled = state.active;
  els.trace.textContent = `${state.trace}%`;
  els.credits.textContent = String(state.credits);
  els.stealth.textContent = `Stealth: ${state.stealth}`;
}

function render() {
  renderMissions();
  renderStatus();
  renderMap();
}

function initTools() {
  document.querySelectorAll(".tool-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      document.querySelectorAll(".tool-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      addLog(`${state.tool.toUpperCase()} module armed.`);
    });
  });
}

function initCityCanvas() {
  const canvas = document.querySelector("#city-canvas");
  const ctx = canvas.getContext("2d");
  const towers = [];
  const signs = ["DATA", "ICE", "VOID", "NEON", "ROOT", "NOVA"];

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    towers.length = 0;
    const count = Math.ceil(window.innerWidth / 42);
    for (let i = 0; i < count; i += 1) {
      towers.push({
        x: i * 42 + randomInt(-8, 8),
        w: randomInt(24, 52),
        h: randomInt(120, 360),
        color: Math.random() > 0.52 ? "rgba(40,231,255," : "rgba(255,61,189,"
      });
    }
  }

  function draw(time) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);
    const horizon = height * 0.62;
    ctx.fillStyle = "rgba(2, 5, 10, 0.74)";
    ctx.fillRect(0, horizon, width, height - horizon);

    towers.forEach((tower, index) => {
      const x = tower.x;
      const y = horizon - tower.h;
      ctx.fillStyle = "rgba(4, 10, 20, 0.82)";
      ctx.fillRect(x, y, tower.w, tower.h);
      ctx.strokeStyle = `${tower.color}0.35)`;
      ctx.strokeRect(x + 0.5, y + 0.5, tower.w - 1, tower.h - 1);
      for (let row = 12; row < tower.h - 8; row += 18) {
        const lit = (row + index * 7 + Math.floor(time / 180)) % 5 !== 0;
        ctx.fillStyle = lit ? `${tower.color}0.42)` : "rgba(255,255,255,0.04)";
        ctx.fillRect(x + 6, y + row, Math.max(6, tower.w - 12), 3);
      }
      if (index % 5 === 0) {
        ctx.save();
        ctx.translate(x + tower.w / 2, y + 24);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = `${tower.color}0.8)`;
        ctx.font = "13px Consolas";
        ctx.fillText(signs[index % signs.length], 0, 0);
        ctx.restore();
      }
    });

    ctx.strokeStyle = "rgba(40,231,255,0.14)";
    for (let i = 0; i < 18; i += 1) {
      const y = horizon + i * 22 + ((time / 80) % 22);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
}

els.startButton.addEventListener("click", startMission);
els.newRun.addEventListener("click", resetRun);
els.cipherSubmit.addEventListener("click", submitCipher);
els.cipherInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitCipher();
});
window.addEventListener("resize", renderMap);

initTools();
initCityCanvas();
render();
addLog("Cyberdeck online. Choose a contract.");
