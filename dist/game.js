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
let selectedCharacter = "sun";
const characterNames = {sun: "Monkey Sun", dragon: "Dragon Girl", fairy: "Fairywhite"};

for (const button of document.querySelectorAll("[data-character]")) {
  button.addEventListener("click", () => {
    if (state !== "ready" && state !== "won") return;
    selectedCharacter = button.dataset.character;
    for (const option of document.querySelectorAll("[data-character]")) {
      const selected = option === button;
      option.setAttribute("aria-pressed", String(selected));
      option.querySelector(".selection").textContent = selected ? "Selected" : "Choose";
    }
    el("play").firstChild.textContent = "Play as " + characterNames[selectedCharacter] + " ";
  });
}
el("characters").onclick = () => setState("ready");
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
  moth = {x, y, vx: 0, vy: 0, direction: 1, grounded: true, airJumps: 2, grace: 0, stretch: 0};
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
  el("character-picker").hidden = state === "playing" || state === "paused";
  el("characters").hidden = state === "ready" || state === "won";
  if (state === "ready") {
    el("title").textContent = "Mothlight";
    el("message").textContent = "Follow the coins. Find the lantern.";
    el("play").firstChild.textContent = "Play as " + characterNames[selectedCharacter] + " ";
  }
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
  if (queuedJump > 0 && (moth.grace > 0 || moth.airJumps > 0)) {
    const extra = moth.grace === 0;
    moth.vy = extra ? -438 : -503;
    if (extra) moth.airJumps--;
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
        moth.airJumps = 2;
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
sky.addColorStop(0, "#666a9c");
sky.addColorStop(.59, "#a18db5");
sky.addColorStop(1, "#e9b6ae");
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
  hills(camera * .17, 328, "#9582aa", 165, 83);
  hills(camera * .27, 379, "#7c7197", 125, 49);
  for (let layer = 0; layer < 2; layer++) {
    const scroll = camera * (.33 + layer * .19);
    const first = Math.floor(scroll / 49);
    for (let i = first - 2; i < first + 23; i++) {
      pine(i * 49 - scroll + seed(i + 6) * 26, 463 + layer * 12,
        99 + seed(i + 131 + layer * 57) * (100 + layer * 31),
        layer ? "#595777" : "#72688f");
    }
  }
  const fog = ctx.createLinearGradient(0, 404, 0, height);
  fog.addColorStop(0, "#c1adcf00");
  fog.addColorStop(1, "#c1adcf80");
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

// Shared renderer keeps the selection portraits and playable heroes identical.
function drawCharacter(t, context = ctx, pose = moth, character = selectedCharacter) {
  const {x, y, grounded, vx, direction, stretch, airJumps} = pose;
  const stride = grounded && Math.abs(vx) > 20 ? Math.sin(t * 25) : 0;
  const flap = Math.sin(t * (grounded ? 9 : 37));
  const rect = (x, y, w, h, color) => { context.fillStyle = color; context.fillRect(x, y, w, h); };
  const shape = (color, points) => {
    context.fillStyle = color; context.beginPath();
    points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath(); context.fill();
  };
  context.save();
  context.translate(Math.round(x), Math.round(y + (grounded ? -Math.abs(stride) * 2 : 0)));
  context.scale(direction * (1 + stretch), 1 - stretch);
  if (character === "sun") {
    // Curled tail, red scarf, golden armor and a gold-tipped staff.
    shape("#c28a51", [[-7,-12],[-20,-6],[-27,-10],[-27,-23],[-21,-26],[-17,-22],[-22,-20],[-22,-13],[-18,-12],[-8,-19]]);
    shape("#d85c66", [[-5,-25],[-26,-30-flap*2],[-21,-21],[-30,-18],[-5,-18]]);
    rect(17,-43,3,43,"#ae6947");rect(16,-44,5,7,"#ffe59d");rect(16,-7,5,7,"#ffe59d");
    rect(-8,-22,17,17,"#e7b858");rect(-8,-13,17,4,"#ad454e");
    rect(-9,-6,6,6+stride*2,"#61435c");rect(4,-6+stride*2,6,6,"#61435c");
    rect(-12,-36,24,17,"#a96d43");rect(-15,-31,5,8,"#dba06b");rect(10,-31,5,8,"#dba06b");
    shape("#ffd3a0", [[-8,-32],[-2,-29],[4,-32],[10,-30],[11,-21],[-8,-21]]);
    rect(-11,-36,23,4,"#ffda79");rect(-1,-39,5,7,"#fff0ac");
    rect(5,-28,3,4,"#352642");rect(6,-21,7,3,"#ffd3a0");
  } else if (character === "dragon") {
    const span = 24 + flap * (grounded ? 2 : 6);
    shape(airJumps > 0 ? "#73d4c5" : "#548e9d", [[-5,-23],[-span,-38],[-span+2,-20],[-16,-23],[-17,-12],[-5,-16]]);
    shape("#4ba99d", [[-7,-10],[-21,-3],[-30,-9],[-32,-18],[-26,-13],[-24,-8],[-8,-18]]);
    rect(-10,-35,21,25,"#24485e");
    shape("#6ed5c4", [[-6,-24],[7,-24],[13,-4],[-12,-4]]);
    rect(-7,-16,16,3,"#f3cf87");rect(-7,-4,5,4+stride*2,"#47708d");rect(5,-4+stride*2,5,4,"#47708d");
    rect(-7,-33,17,13,"#f6cfba");rect(-9,-37,21,6,"#24485e");rect(-9,-32,4,14,"#24485e");
    shape("#f6d997", [[-6,-35],[-12,-46],[-5,-42],[-2,-35]]);
    shape("#f6d997", [[6,-35],[10,-46],[13,-42],[10,-34]]);
    rect(5,-29,3,4,"#24485e");rect(11,-31,5,4,"#86e8d6");
  } else {
    const span = 25 + flap * (grounded ? 2 : 7);
    shape(airJumps > 0 ? "#d8e7ff" : "#8d92ba", [[-5,-22],[-span,-38],[-span-2,-26],[-14,-18],[-span+2,-17],[-20,-8],[-5,-13]]);
    rect(-18,-30,3,17,"#a9bdec");
    rect(-10,-37,22,25,"#ddd8f2");
    shape("#fff3fa", [[-5,-25],[6,-25],[15,-4],[-14,-4]]);
    rect(-7,-17,15,3,"#b6a0de");rect(-7,-4,5,4+stride*2,"#c9b7eb");rect(5,-4+stride*2,5,4,"#c9b7eb");
    rect(-7,-33,17,13,"#ffdbc9");
    shape("#f5f2ff", [[-11,-33],[-6,-40],[7,-39],[13,-31],[3,-33],[-3,-29]]);
    rect(-10,-28,4,15,"#f5f2ff");rect(5,-29,3,4,"#59416e");
    rect(-8,-39,18,3,"#ffdd99");rect(0,-43,3,6,"#fff0c9");
    rect(18,-33,2,30,"#d5bbef");
    shape("#fff0c9", [[19,-43],[22,-37],[28,-35],[22,-32],[19,-26],[16,-32],[10,-35],[16,-37]]);
  }
  context.restore();
}

function drawPortraits() {
  for (const button of document.querySelectorAll("[data-character]")) {
    const portrait = button.querySelector("canvas");
    const context = portrait.getContext("2d");
    context.clearRect(0, 0, 100, 100);
    context.save(); context.scale(1.7, 1.7);
    drawCharacter(0, context, {x: 30, y: 55, grounded: true, vx: 0, direction: 1, stretch: 0, airJumps: 2}, button.dataset.character);
    context.restore();
  }
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
  drawCharacter(t);
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

drawPortraits();
reset();
setState("ready");
requestAnimationFrame(frame);
