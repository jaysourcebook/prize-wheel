const COLORS = [
  "#FF3B30","#FF9500","#FFCC00","#34C759",
  "#5AC8FA","#007AFF","#5856D6","#AF52DE",
  "#FF2D55","#FF9F0A","#FFD60A","#30D158",
  "#64D2FF","#0A84FF","#5E5CE6","#BF5AF2"
];

const STORAGE_KEY = "prizewheelQuantities";
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

let CX, CY, R;
let allPrizes = [];
let prizes = [];
let angle = 0;
let spinning = false;

function sizeCanvas() {
  const size = Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.9);
  canvas.width = size;
  canvas.height = size;
  CX = size / 2;
  CY = size / 2;
  R = CX - 4;
  drawWheel();
}

window.addEventListener("resize", sizeCanvas);

function getSavedQuantities() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
  catch { return null; }
}

function saveQuantities() {
  const map = {};
  allPrizes.forEach(p => map[p.name] = p.quantity);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

async function loadPrizes() {
  const res = await fetch("prizes.json");
  const data = await res.json();
  const saved = getSavedQuantities();

  allPrizes = data.map(p => ({
    ...p,
    quantity: saved && saved[p.name] !== undefined ? saved[p.name] : p.quantity
  }));

  prizes = allPrizes.filter(p => p.quantity > 0);
  document.getElementById("empty-msg").style.display = prizes.length ? "none" : "block";
  document.getElementById("spinBtn").disabled = !prizes.length;
  drawWheel();
}

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!prizes.length) return;

  const arc = (2 * Math.PI) / prizes.length;
  const fontSize = Math.max(10, Math.floor(R / 14));

  for (let i = 0; i < prizes.length; i++) {
    const start = i * arc + angle;
    const end = start + arc;

    ctx.beginPath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, start, end);
    ctx.fill();

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(start + arc / 2);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "right";
    ctx.fillText(prizes[i].name, R - 16, 5);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(CX, CY, Math.max(18, R * 0.06), 0, 2 * Math.PI);
  ctx.fillStyle = "#0d0d0d";
  ctx.fill();
}

function pickWinner() {
  const totalWeight = prizes.reduce((sum, p) => sum + p.probability, 0);
  let rand = Math.random() * totalWeight;
  for (const prize of prizes) {
    rand -= prize.probability;
    if (rand <= 0) return prize;
  }
  return prizes[0];
}

// --- Drag-to-spin ---
let dragging = false;
let lastDragAngle = 0;
let lastDragTime = 0;
let dragVelocity = 0;

function getAngleFromCenter(x, y) {
  const rect = canvas.getBoundingClientRect();
  return Math.atan2(y - rect.top - CY, x - rect.left - CX);
}

function onDragStart(x, y) {
  if (spinning || !prizes.length) return;
  dragging = true;
  lastDragAngle = getAngleFromCenter(x, y);
  lastDragTime = performance.now();
  dragVelocity = 0;
}

function onDragMove(x, y) {
  if (!dragging) return;
  const now = performance.now();
  const curr = getAngleFromCenter(x, y);
  let delta = curr - lastDragAngle;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  angle += delta;
  drawWheel();

  const dt = now - lastDragTime;
  if (dt > 0) dragVelocity = delta / dt * 16;

  lastDragAngle = curr;
  lastDragTime = now;
}

function onDragEnd() {
  if (!dragging) return;
  dragging = false;
  if (Math.abs(dragVelocity) > 0.02) {
    launchSpin(dragVelocity);
  }
}

function buttonSpin() {
  if (spinning || !prizes.length) return;
  launchSpin(0.3 + Math.random() * 0.1);
}

async function launchSpin(velocity) {
  spinning = true;
  document.getElementById("spinBtn").disabled = true;
  document.getElementById("result").innerText = "";

  if (Math.abs(velocity) < 0.15) velocity = velocity < 0 ? -0.15 : 0.15;

  const winner = pickWinner();
  const master = allPrizes.find(p => p.name === winner.name);
  master.quantity--;
  saveQuantities();

  const winIdx = prizes.findIndex(p => p.name === winner.name);
  const arc = (2 * Math.PI) / prizes.length;
  const sliceMid = winIdx * arc + arc / 2;
  let targetAngle = -Math.PI / 2 - sliceMid;

  const dir = velocity >= 0 ? 1 : -1;
  let destination = targetAngle + dir * 6 * 2 * Math.PI;
  if (dir > 0) {
    while (destination <= angle) destination += 2 * Math.PI;
  } else {
    while (destination >= angle) destination -= 2 * Math.PI;
  }

  const startAngle = angle;
  const totalDelta = destination - startAngle;
  const duration = 4000;
  const startTime = performance.now();

  await new Promise(resolve => {
    function animate(now) {
      const t = Math.min((now - startTime) / duration, 1);
      angle = startAngle + totalDelta * (1 - Math.pow(1 - t, 4));
      drawWheel();
      if (t < 1) requestAnimationFrame(animate);
      else resolve();
    }
    requestAnimationFrame(animate);
  });

  spinning = false;
  angle = angle % (2 * Math.PI);
  if (winner.is_prize !== false) {
    document.getElementById("result").innerText = "\ud83c\udf89 " + winner.name + "!";
    confetti();
  } else {
    document.getElementById("result").innerText = "\ud83d\ude14 Not a winner. Try again!";
  }
  setTimeout(() => loadPrizes(), 1500);
}

function confetti() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  const screenMin = Math.min(window.innerWidth, window.innerHeight);
  const count = Math.floor(Math.max(80, screenMin * 0.3));

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const size = Math.random() * 6 + 4;
    el.style.cssText = `
      position:fixed; width:${size}px; height:${size}px;
      background:${COLORS[Math.floor(Math.random()*COLORS.length)]};
      left:${cx}px; top:${cy}px;
      border-radius:${Math.random()>.5?'50%':'3px'};
      z-index:999; pointer-events:none;
    `;
    document.body.appendChild(el);

    const screenMin = Math.min(window.innerWidth, window.innerHeight);
    const speedScale = Math.max(1, screenMin / 800);
    const spreadScale = screenMin / 800;
    const spreadAngle = Math.random() * Math.PI * 2;
    let vx = Math.cos(spreadAngle) * (Math.random() * 5 + 2) * spreadScale;
    let vy = -(Math.random() * 12 + 5) * speedScale;
    const gravity = 0.08 * speedScale;
    let x = cx, y = cy;

    (function move() {
      vy += gravity;
      x += vx;
      y += vy;
      el.style.left = x + "px";
      el.style.top = y + "px";
      if (y < window.innerHeight + 20) requestAnimationFrame(move);
      else el.remove();
    })();
  }
}

document.getElementById("spinBtn").onclick = buttonSpin;

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  onDragStart(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  onDragMove(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener("touchend", onDragEnd);

canvas.addEventListener("mousedown", (e) => onDragStart(e.clientX, e.clientY));
window.addEventListener("mousemove", (e) => onDragMove(e.clientX, e.clientY));
window.addEventListener("mouseup", onDragEnd);

sizeCanvas();
loadPrizes();
