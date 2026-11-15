"use strict";

const el = id => document.getElementById(id);
const canvas = el("world");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const width = canvas.width;
const height = canvas.height;
const coinSprite = new Image();
coinSprite.src = "coin.png";
const trailEnd = 3230;
const lantern = {x: 3120, y: 364};
const ground = [
  [0, 403, 358], [453, 409, 285], [830, 385, 280],
  [1210, 416, 248], [1560, 385, 230], [1888, 418, 270],
  [2258, 389, 217], [2570, 406, 220], [2880, 408, 350]
];
const ledges = [
  [188, 325, 110], [361, 302, 74], [559, 309, 116], [750, 324, 67],
  [952, 288, 124], [1120, 329, 82], [1350, 321, 95], [1478, 286, 63],
  [1690, 305, 93], [1810, 328, 62], [1990, 306, 122], [2170, 350, 65],
  [2349, 291, 111], [2486, 323, 69], [2680, 310, 98], [2799, 353, 58]
];
const platforms = [...ground, ...ledges];
const coinPositions = [
  [242, 297], [401, 273], [620, 280], [782, 293], [1010, 257], [1162, 298],
  [1395, 290], [1507, 255], [1750, 274], [2038, 275], [2390, 260], [2740, 279]
];
const checkpoints = [{x: 90, y: 403}, {x: 1250, y: 416}, {x: 2300, y: 389}];
let coins, moth, particles, camera, checkpoint, elapsed;
let state = "ready";
let audio;
let soundOn = false;
let last = 0;
let accumulator = 0;
const keyboard = new Set();
const touch = new Map();
let queuedJump = 0;

const keyMap = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  Space: "jump", ArrowUp: "jump", KeyW: "jump"
};
const active = action => [...keyboard].some(code => keyMap[code] === action) ||
  [...touch.values()].includes(action);
const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

function spawn() {
  const {x, y} = checkpoints[checkpoint];
  moth = {x, y, vx: 0, vy: 0, direction: 1, grounded: true, wingbeat: true, grace: 0, stretch: 0};
  camera = clamp(x - width * .33, 0, trailEnd - width);
  queuedJump = 0;
}

function reset() {
  checkpoint = 0;
  coins = coinPositions.map(([x, y]) => ({x, y, found: false}));
  particles = [];
  elapsed = 0;
  spawn();
  updateCount();
}

function updateCount() {
  const total = coins.filter(coin => coin.found).length;
  el("count").textContent = String(total).padStart(2, "0") + " / " + coins.length;
  return total;
}

function setState(next) {
  state = next;
  el("overlay").hidden = state === "playing";
  el("pause").disabled = state === "ready" || state === "won";
  el("pause").textContent = state === "paused" ? "Resume" : "Pause";
  el("restart").disabled = state === "ready";
  if (state === "paused") {
    el("title").textContent = "Paused";
    el("message").textContent = "The trail can wait.";
    el("play").firstChild.textContent = "Resume ";
  }
  if (state === "won") {
    el("title").textContent = "Lantern lit!";
    el("message").textContent = updateCount() + " of " + coins.length + " coins found in " + Math.round(elapsed) + "s.";
    el("play").firstChild.textContent = "Play again ";
  }
  if (state !== "playing") {
    keyboard.clear();
    touch.clear();
    queuedJump = 0;
  }
}

function start() {
  if (state !== "paused") reset();
  setState("playing");
  document.activeElement?.blur();
}

function togglePause() {
  if (state === "playing") {
    setState("paused");
    el("play").focus();
  } else if (state === "paused") start();
}

function tone(frequency, duration = .12, type = "sine") {
  if (!soundOn || !audio || audio.state !== "running") return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * .76, now + duration);
  gain.gain.setValueAtTime(.06, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(now + duration);
}

el("sound").addEventListener("click", async () => {
  soundOn = !soundOn;
  if (soundOn) {
    try {
      audio ??= new AudioContext();
      await audio.resume();
    } catch {
      soundOn = false;
    }
  }
  el("sound").textContent = soundOn ? "Sound on" : "Sound off";
  el("sound").setAttribute("aria-pressed", String(soundOn));
  tone(660);
  if (state === "playing") el("sound").blur();
});
el("play").onclick = start;
el("restart").onclick = () => { reset(); setState("playing"); el("restart").blur(); };
el("pause").onclick = togglePause;

addEventListener("keydown", event => {
  if (event.code === "Escape" && !event.repeat) togglePause();
  if (state !== "playing" || !keyMap[event.code] ||
      (event.code === "Space" && event.target instanceof HTMLButtonElement)) return;
  event.preventDefault();
  keyboard.add(event.code);
  if (keyMap[event.code] === "jump" && !event.repeat) queuedJump = .13;
});
addEventListener("keyup", event => keyboard.delete(event.code));
addEventListener("blur", () => {
  keyboard.clear();
  touch.clear();
  if (state === "playing") setState("paused");
});
for (const button of document.querySelectorAll("[data-input]")) {
  button.addEventListener("pointerdown", event => {
    if (state !== "playing") return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touch.set(event.pointerId, button.dataset.input);
    if (button.dataset.input === "jump") queuedJump = .13;
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
    button.addEventListener(name, event => touch.delete(event.pointerId));
  }
}

function burst(x, y, color, count = 11) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 110;
    particles.push({x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: .28 + Math.random() * .28, color});
  }
}

function step(dt) {
  elapsed += dt;
  const move = Number(active("right")) - Number(active("left"));
  const target = move * 285;
  moth.vx += (target - moth.vx) * Math.min(1, dt * (move ? 13 : 17));
  if (move) moth.direction = move;
  moth.grace = moth.grounded ? .09 : Math.max(0, moth.grace - dt);
  if (queuedJump > 0 && (moth.grace > 0 || moth.wingbeat)) {
    const extra = moth.grace === 0;
    moth.vy = extra ? -438 : -503;
    if (extra) moth.wingbeat = false;
    moth.grace = 0;
    moth.grounded = false;
    moth.stretch = -.18;
    queuedJump = 0;
    burst(moth.x, moth.y - 8, extra ? "#ffdb8d" : "#c8a5ee", extra ? 15 : 6);
    tone(extra ? 660 : 395, .14, "triangle");
  }
  queuedJump = Math.max(0, queuedJump - dt);
  const previousY = moth.y;
  moth.x = clamp(moth.x + moth.vx * dt, 12, trailEnd - 12);
  moth.vy += 1230 * dt;
  moth.y += moth.vy * dt;
  const wasGrounded = moth.grounded;
  moth.grounded = false;
  if (moth.vy >= 0) {
    for (const [x, y, length] of platforms) {
      if (previousY <= y && moth.y >= y && moth.x + 9 > x && moth.x - 9 < x + length) {
        if (!wasGrounded && moth.vy > 140) {
          moth.stretch = .25;
          burst(moth.x, y - 2, "#a482c5", 5);
        }
        moth.y = y;
        moth.vy = 0;
        moth.grounded = true;
        moth.wingbeat = true;
        break;
      }
    }
  }
  moth.stretch *= Math.max(0, 1 - dt * 10);
  if (moth.grounded && checkpoints[checkpoint + 1] && moth.x >= checkpoints[checkpoint + 1].x) {
    checkpoint++;
    burst(moth.x, moth.y - 20, "#ffdb8d", 14);
    tone(520);
  }
  if (moth.y > height + 85) {
    spawn();
    burst(moth.x, moth.y - 10, "#e4acee", 15);
    tone(170, .28);
  }

  for (const coin of coins) {
    if (coin.found || Math.hypot(moth.x - coin.x, moth.y - 17 - coin.y) > 27) continue;
    coin.found = true;
    burst(coin.x, coin.y, "#ffdb8d");
    tone(570 + 39 * updateCount(), .18);
  }
  if (Math.abs(moth.x - lantern.x) < 28 && Math.abs(moth.y - 404) < 24) {
    burst(lantern.x, lantern.y, "#ffdb8d", 25);
    tone(960, .45);
    setState("won");
    el("play").focus();
  }
  camera += (clamp(moth.x - width * .33, 0, trailEnd - width) - camera) * dt * 5;
}

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function shape(color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

function glow(x, y, radius, color) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, radius);
  halo.addColorStop(0, color);
  halo.addColorStop(1, "transparent");
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function star(x, y, size, color) {
  shape(color, [[x, y-size], [x+2, y-2], [x+size, y], [x+2, y+2],
    [x, y+size], [x-2, y+2], [x-size, y], [x-2, y-2]]);
}

const sky = ctx.createLinearGradient(0, 0, 0, height);
sky.addColorStop(0, "#171733");
sky.addColorStop(.59, "#58466d");
sky.addColorStop(1, "#b27d8b");
const seed = n => {
  const v = Math.sin(n * 129.71 + 9.27) * 43758.5453;
  return v - Math.floor(v);
};
const stars = Array.from({length: 125}, (_, i) =>
  [seed(i + 1) * 1100, 12 + seed(i + 300) * 330, seed(i + 500)]);

function hills(scroll, base, color, spacing, offset) {
  const start = Math.floor(scroll / spacing) * spacing;
  const points = [[start - scroll, height]];
  for (let x = start; x < width + scroll + spacing; x += spacing) {
    const peak = base - seed(x + offset) * 105;
    points.push([x - scroll, base], [x + spacing * .45 - scroll, peak],
      [x + spacing * .59 - scroll, peak + 13]);
  }
  points.push([width + spacing, height]);
  shape(color, points);
}

function pine(x, base, size, color) {
  rect(x - size * .033, base - size * .68, size * .066, size * .69, color);
  for (let tier = 0; tier < 4; tier++) {
    const y = base - size + size * .15 * tier;
    const w = size * (.095 + tier * .04);
    shape(color, [[x, y], [x + w, y + size * .35], [x + w * .39, y + size * .32],
      [x, y + size * .36], [x - w, y + size * .35]]);
  }
}

function forest(t) {
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  for (const [x, y, phase] of stars) {
    const drawX = ((x - camera * .078 + 1100) % 1100) - 10;
    ctx.globalAlpha = .32 + .31 * (1 + Math.sin(t * 1.2 + phase * 200));
    if (phase > .94) star(drawX, y, 4, "#f9d6c0");
    else rect(drawX, y, phase > .72 ? 2 : 1, 1, "#e5c8d9");
  }
  ctx.globalAlpha = 1;
  const moonX = 747 - camera * .1;
  glow(moonX, 119, 125, "#f3bdc566");
  ctx.fillStyle = "#ffe3b4";
  ctx.beginPath();
  ctx.arc(moonX, 119, 60, 0, 2 * Math.PI);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (const [dx, dy, w] of [[-60, 13, 120], [-54, 27, 108], [-42, 40, 84], [-29, 52, 58]]) {
    rect(moonX + dx, 119 + dy, w, 3, "#d997a188");
  }
  ctx.restore();
  hills(camera * .17, 328, "#514063", 165, 83);
  hills(camera * .27, 379, "#403357", 125, 49);
  for (let layer = 0; layer < 2; layer++) {
    const scroll = camera * (.33 + layer * .19);
    const first = Math.floor(scroll / 49);
    for (let i = first - 2; i < first + 23; i++) {
      pine(i * 49 - scroll + seed(i + 6) * 26, 463 + layer * 12,
        99 + seed(i + 131 + layer * 57) * (100 + layer * 31),
        layer ? "#29253f" : "#39304f");
    }
  }
  const fog = ctx.createLinearGradient(0, 404, 0, height);
  fog.addColorStop(0, "#66527b00");
  fog.addColorStop(1, "#71587780");
  ctx.fillStyle = fog;
  ctx.fillRect(0, 404, width, height - 404);
}

function drawPlatform(x, y, length, floating) {
  if (x + length < camera || x > camera + width) return;
  const bottom = floating ? y + 31 : height;
  rect(x + 4, y + 7, length - 8, bottom - y - 7, "#2b233f");
  rect(x, y, length, 7, "#81729a");
  rect(x + 3, y, length - 6, 2, "#c0a7c6");
  for (let i = 3; i < length - 5; i += 8) {
    const s = seed(x + i);
    rect(x + i, y + 6, 5, 3 + Math.floor(s * 8), s > .5 ? "#66567e" : "#514368");
    if (s > .72) rect(x + i, y + 17 + Math.floor((s - .72) * 36), 4, 2, "#51446a");
    if (s < .16) {
      const h = 3 + Math.floor(seed(x - i) * 10);
      rect(x + i, y - h, 2, h, "#9885af");
      rect(x + i - 2, y - h + 3, 2, 2, "#9885af");
    }
  }
}

function drawMoth(t) {
  const {x, y, grounded, vx, direction, stretch, wingbeat} = moth;
  const stride = grounded && Math.abs(vx) > 20 ? Math.sin(t * 25) : 0;
  const flap = Math.sin(t * (grounded ? 9 : 37));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + (grounded ? -Math.abs(stride) * 2 : 0)));
  ctx.scale(direction * (1 + stretch), 1 - stretch);
  const span = 20 + flap * (grounded ? 2 : 8);
  shape(wingbeat ? "#aa84d7" : "#736693",
    [[-4,-20],[-span,-33],[-span-2,-25],[-span+4,-14],[-12,-11],[-6,-15]]);
  rect(-span + 4, -25, 4, 3, wingbeat ? "#f6b7d0" : "#a092b0");
  rect(-7, -4, 5, 4 + stride * 2, "#ce9178");
  rect(4, -4 + stride * 2, 5, 4, "#ce9178");
  shape("#f2c590", [[-10,-20],[-6,-27],[7,-27],[12,-22],[13,-12],[8,-6],[-6,-6],[-11,-11]]);
  rect(-6,-20,17,10,"#ffe1a9");
  rect(7,-19,3,5,"#352642");
  rect(-2,-27,2, -6,"#f2c590");
  rect(7,-27,2, -7,"#f2c590");
  rect(-4,-34,3,2,"#ffe4a8");
  rect(9,-35,3,2,"#ffe4a8");
  ctx.restore();
}

function draw(t, dt) {
  forest(t);
  ctx.save();
  ctx.translate(-Math.round(camera), 0);
  for (const [x, y, length] of ground) drawPlatform(x, y, length, false);
  for (const [x, y, length] of ledges) drawPlatform(x, y, length, true);
  coins.forEach((coin, i) => {
    if (coin.found || coin.x < camera - 30 || coin.x > camera + width + 30) return;
    const y = coin.y + Math.sin(t * 3.8 + i) * 4;
    glow(coin.x, y, 24, "#ffce7277");
    if (!coinSprite.naturalWidth) return;
    ctx.drawImage(coinSprite, Math.round(coin.x - 9), Math.round(y - 11), 18, 22);
  });
  checkpoints.slice(1).forEach(({x, y}, i) => {
    rect(x, y - 29, 3, 29, "#977ba5");
    rect(x + 3, y - 28, 16, 9, checkpoint > i ? "#ffd48d" : "#997bb5");
  });
  glow(lantern.x, lantern.y, state === "won" ? 95 : 57, "#ffbd676e");
  rect(lantern.x - 2, lantern.y - 13, 4, 57, "#9075a0");
  rect(lantern.x - 15, lantern.y - 12, 30, 24, "#422942");
  rect(lantern.x - 10, lantern.y - 9, 20, 18, "#ffcb78");
  star(lantern.x, lantern.y, 7, "#fff1b9");
  drawMoth(t);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life * 3, 0, 1);
    rect(p.x, p.y, 3, 3, p.color);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 95 * dt;
    p.life -= dt;
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function frame(now) {
  const dt = last ? Math.min((now - last) / 1000, .05) : 0;
  last = now;
  if (state === "playing") {
    accumulator += dt;
    while (accumulator >= 1 / 120 && state === "playing") {
      step(1 / 120);
      accumulator -= 1 / 120;
    }
  } else accumulator = 0;
  draw(now / 1000, state === "paused" ? 0 : dt);
  requestAnimationFrame(frame);
}

reset();
requestAnimationFrame(frame);
