/* ===========================================================
   ✨ Nail Salon ✨  —  game
   A tiny, ad-free nail painting game for little kids.
   Everything is drawn with SVG so it stays crisp on any screen.
   =========================================================== */

(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---- Small SVG helper ---------------------------------- */
  function el(name, attrs = {}, parent = null) {
    const node = document.createElementNS(SVGNS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  }

  /* ---- Cute icons, hand-drawn in a 24x24 box (center 12,12).
         Solid fills + white highlights (no gradient ids) so the exact
         same icon works both on a nail and inside a button. ---------- */
  function starPoints(cx, cy, outer, inner, points) {
    let d = "";
    const step = Math.PI / points;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = -Math.PI / 2 + i * step;
      d += (i ? "L" : "M") + (cx + Math.cos(a) * r).toFixed(2) + "," + (cy + Math.sin(a) * r).toFixed(2);
    }
    return d + "Z";
  }
  function sparkle(g, x, y, s, color) {
    el("path", {
      d: "M0,-10 C1.5,-3 3,-1.5 10,0 C3,1.5 1.5,3 0,10 C-1.5,3 -3,1.5 -10,0 C-3,-1.5 -1.5,-3 0,-10 Z",
      fill: color, transform: `translate(${x},${y}) scale(${s})`,
    }, g);
  }
  function drawHeart(g) {
    el("path", {
      d: "M12 20.5 C12 20.5 3.5 13.7 3.5 8.7 C3.5 5.8 5.7 4 8 4 C9.9 4 11.2 5.2 12 6.7 C12.8 5.2 14.1 4 16 4 C18.3 4 20.5 5.8 20.5 8.7 C20.5 13.7 12 20.5 12 20.5 Z",
      fill: "#ff4d6d", stroke: "#e23b5a", "stroke-width": 0.6, "stroke-linejoin": "round",
    }, g);
    el("ellipse", { cx: 8.6, cy: 8.2, rx: 2.1, ry: 1.3, fill: "#fff", opacity: 0.55, transform: "rotate(-35 8.6 8.2)" }, g);
  }
  function drawGem(g) {
    el("polygon", { points: "7,6 17,6 21,10.5 12,20.5 3,10.5", fill: "#4ec2ff", stroke: "#2f9fe0", "stroke-width": 0.7, "stroke-linejoin": "round" }, g);
    el("polygon", { points: "7,6 17,6 19,10.5 5,10.5", fill: "#bce8ff", opacity: 0.9 }, g);
    el("polyline", { points: "3,10.5 21,10.5", fill: "none", stroke: "#fff", "stroke-width": 0.6, opacity: 0.55 }, g);
    el("polyline", { points: "7,6 12,20.5 17,6", fill: "none", stroke: "#fff", "stroke-width": 0.5, opacity: 0.45 }, g);
    el("polygon", { points: "8,7 10.6,7 9.3,10", fill: "#fff", opacity: 0.65 }, g);
  }
  function drawStar(g) {
    el("path", { d: starPoints(12, 12.5, 10, 4.4, 5), fill: "#ffcf33", stroke: "#f2a900", "stroke-width": 0.7, "stroke-linejoin": "round" }, g);
    el("circle", { cx: 9.4, cy: 9.6, r: 1.4, fill: "#fff4b8", opacity: 0.85 }, g);
  }
  function drawFlower(g) {
    for (let i = 0; i < 5; i++) {
      el("ellipse", { cx: 12, cy: 5.7, rx: 3.4, ry: 4.6, fill: "#ff9ecb", stroke: "#f77fb4", "stroke-width": 0.5, transform: `rotate(${i * 72} 12 12)` }, g);
    }
    el("circle", { cx: 12, cy: 12, r: 3.1, fill: "#ffd23f", stroke: "#f2b807", "stroke-width": 0.5 }, g);
    el("circle", { cx: 10.9, cy: 10.9, r: 1, fill: "#fff0b0", opacity: 0.9 }, g);
  }
  function drawGlitterIcon(g) {
    sparkle(g, 12, 12, 0.92, "#ffdd57");
    sparkle(g, 19, 6, 0.34, "#ffffff");
    sparkle(g, 5.5, 17.5, 0.3, "#ffffff");
  }
  function drawEraser(g) {
    const e = el("g", { transform: "rotate(-18 12 12)" }, g);
    el("rect", { x: 3.5, y: 8, width: 17, height: 8, rx: 2.4, fill: "#ffffff", stroke: "#e58ba9", "stroke-width": 0.7 }, e);
    el("path", { d: "M5.9 8 H18.1 A2.4 2.4 0 0 1 20.5 10.4 V11.4 H3.5 V10.4 A2.4 2.4 0 0 1 5.9 8 Z", fill: "#ff8fab" }, e);
    el("line", { x1: 9, y1: 8, x2: 9, y2: 16, stroke: "#e58ba9", "stroke-width": 0.5, opacity: 0.6 }, e);
  }
  const ICON_DRAW = { gem: drawGem, heart: drawHeart, star: drawStar, flower: drawFlower, glitter: drawGlitterIcon, erase: drawEraser };

  // A small standalone SVG of an icon, for the tool buttons.
  function iconButtonSVG(kind) {
    const svgEl = el("svg", { viewBox: "0 0 24 24", width: "32", height: "32" });
    (ICON_DRAW[kind] || drawGem)(el("g", {}, svgEl));
    return svgEl;
  }

  /* ---- Colors -------------------------------------------- */
  // Each color has a `value` used to fill the SVG nail and a `css`
  // used to paint the round swatch button.
  const NATURAL = "#ffeef0"; // an unpainted, soft natural nail

  // A curated set of twelve colors — a clean two rows on a phone, so a
  // little one can see every color at once without scrolling.
  const COLORS = [
    { value: "#ff8fab", css: "#ff8fab" }, // pink
    { value: "#ff4f8b", css: "#ff4f8b" }, // hot pink
    { value: "#ff5c5c", css: "#ff5c5c" }, // red
    { value: "#ff9f5c", css: "#ff9f5c" }, // orange
    { value: "#ffd166", css: "#ffd166" }, // yellow
    { value: "#8ee06a", css: "#8ee06a" }, // green
    { value: "#5ad1c5", css: "#5ad1c5" }, // teal
    { value: "#6cc6ff", css: "#6cc6ff" }, // sky
    { value: "#6c8cff", css: "#6c8cff" }, // blue
    { value: "#b28dff", css: "#b28dff" }, // purple
    { value: "url(#rainbow)", css: "linear-gradient(135deg,#ff6b6b,#ffd166,#8ee06a,#6cc6ff,#b28dff)" }, // rainbow
    { value: "#ffffff", css: "#ffffff" }, // white
  ];

  /* ---- Hand geometry ------------------------------------- */
  // Fingertips point up; the palm enters from the bottom of the frame.
  // A few skin tones so every child can pick a hand that looks like theirs.
  const SKIN_TONES = [
    { skin: "#ffe0bd", shade: "#f0c9a0" },
    { skin: "#f6c9a8", shade: "#e9b291" },
    { skin: "#d29e78", shade: "#bd845c" },
    { skin: "#a2703f", shade: "#87592e" },
    { skin: "#6f4a2f", shade: "#573823" },
  ];
  let skinIndex = 1;
  let SKIN = SKIN_TONES[skinIndex].skin;
  let SKIN_SHADE = SKIN_TONES[skinIndex].shade;

  // Four fingers (thumb handled separately). Bottoms tuck under the palm.
  const FINGERS = [
    { id: "index",  cx: 112, top: 104, w: 42, bottom: 268 },
    { id: "middle", cx: 160, top: 72,  w: 44, bottom: 268 },
    { id: "ring",   cx: 208, top: 104, w: 42, bottom: 268 },
    { id: "pinky",  cx: 250, top: 150, w: 36, bottom: 268 },
  ];

  // Where each nail sits, so decorations can be centered later.
  const nailGeom = {}; // id -> {cx, cy, rx, ry}

  /* ---- Stickers & effects -------------------------------- */
  const TOOLS = [
    { id: "glitter", label: "Glitter" },
    { id: "gem",     label: "Gem" },
    { id: "heart",   label: "Heart" },
    { id: "star",    label: "Star" },
    { id: "flower",  label: "Flower" },
    { id: "erase",   label: "Eraser" },
  ];

  /* ---- Game state ---------------------------------------- */
  const NAIL_IDS = ["thumb", "index", "middle", "ring", "pinky"];
  const freshNail = () => ({ color: NATURAL, sticker: null, glitter: false });
  const state = {};
  NAIL_IDS.forEach((id) => (state[id] = freshNail()));

  let currentColor = COLORS[0].value;
  // What a tap on a nail does: "paint" (use currentColor) or a tool id.
  let mode = "paint";

  /* ---- Build the SVG hand -------------------------------- */
  const handWrap = document.getElementById("hand-wrap");
  const svg = el("svg", { viewBox: "0 0 320 400", role: "img", "aria-label": "A hand with five nails to paint" });
  const defs = el("defs", {}, svg);

  // Rainbow gradient for the rainbow color.
  const rainbow = el("linearGradient", { id: "rainbow", x1: "0", y1: "0", x2: "1", y2: "1" }, defs);
  ["#ff6b6b", "#ffd166", "#8ee06a", "#6cc6ff", "#b28dff"].forEach((c, i, a) => {
    el("stop", { offset: `${(i / (a.length - 1)) * 100}%`, "stop-color": c }, rainbow);
  });

  // A soft blur so the shading on the hand reads as gentle light, not shapes.
  const soft = el("filter", { id: "soft", x: "-40%", y: "-40%", width: "180%", height: "180%" }, defs);
  el("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "16" }, soft);

  // Draw a single finger: a rounded capsule plus a nail on top.
  function buildFinger(f) {
    const g = el("g", { class: "finger", "data-nail": f.id, style: "cursor:pointer" }, svg);

    // Finger capsule (this is also the tap target).
    el("rect", {
      x: f.cx - f.w / 2, y: f.top, width: f.w, height: f.bottom - f.top,
      rx: f.w / 2, fill: SKIN, class: "skin",
    }, g);

    // A soft shaded edge for a little depth.
    el("rect", {
      x: f.cx - f.w / 2, y: f.top, width: f.w, height: f.bottom - f.top,
      rx: f.w / 2, fill: "none", stroke: SKIN_SHADE, "stroke-width": 2, opacity: 0.5,
      class: "skin-edge",
    }, g);

    // A soft lengthwise sheen so the finger looks rounded.
    el("rect", {
      x: f.cx - f.w * 0.15, y: f.top + 8, width: f.w * 0.3, height: f.bottom - f.top - 14,
      rx: f.w * 0.15, fill: "#ffffff", opacity: 0.12,
    }, g);

    buildNail(f.id, f.cx, f.top + 22, f.w * 0.34, 24, g);
    return g;
  }

  // Draw a nail (paintable) with a glossy highlight. Returns nothing,
  // but records the geometry for later decoration.
  function buildNail(id, cx, cy, rx, ry, parent) {
    nailGeom[id] = { cx, cy, rx, ry };

    // Clip path so future decorations stay inside the nail shape.
    const clip = el("clipPath", { id: `clip-${id}` }, defs);
    el("ellipse", { cx, cy, rx, ry }, clip);

    const ng = el("g", { class: "nail-group", "data-nail-group": id }, parent);

    // A soft bed shadow so the nail sits on the finger.
    el("ellipse", { cx, cy: cy + 1.5, rx: rx + 1.5, ry: ry + 1.5, fill: "#00000018" }, ng);

    // The paintable surface.
    el("ellipse", {
      cx, cy, rx, ry, class: "nail-fill", "data-fill": id,
      fill: state[id].color, stroke: "#e7b9c6", "stroke-width": 1.3,
    }, ng);

    // Gloss and depth, kept inside the nail shape.
    const shine = el("g", { "clip-path": `url(#clip-${id})` }, ng);
    el("ellipse", { cx, cy: cy - ry * 0.42, rx: rx * 0.85, ry: ry * 0.5, fill: "#ffffff", opacity: 0.5 }, shine);
    el("ellipse", { cx: cx - rx * 0.32, cy: cy - ry * 0.52, rx: rx * 0.3, ry: ry * 0.18, fill: "#ffffff", opacity: 0.9 }, shine);
    el("ellipse", { cx, cy: cy + ry * 0.72, rx: rx * 1.25, ry: ry * 0.5, fill: "#00000012" }, shine);

    // Layer where decorations get added later.
    el("g", { class: "deco", "data-deco": id, "clip-path": `url(#clip-${id})` }, ng);
  }

  // The palm: a big rounded shape that runs off the bottom of the frame.
  function buildPalm() {
    el("rect", { x: 86, y: 208, width: 182, height: 220, rx: 60, fill: SKIN, class: "skin" }, svg);
    // A gentle highlight up top and a soft shadow near the wrist give form.
    // Blurred so they read as soft light rather than distinct ovals.
    el("ellipse", { cx: 172, cy: 248, rx: 66, ry: 40, fill: "#ffffff", opacity: 0.16, filter: "url(#soft)" }, svg);
    el("ellipse", { cx: 177, cy: 408, rx: 92, ry: 52, fill: "#000000", opacity: 0.06, filter: "url(#soft)" }, svg);
  }

  // The thumb: a capsule angled out to the lower left, drawn on top of
  // the palm so it reads as being closer to us.
  function buildThumb() {
    const g = el("g", { class: "finger", "data-nail": "thumb", style: "cursor:pointer",
      transform: "rotate(-38 96 300)" }, svg);

    el("rect", { x: 96 - 22, y: 214, width: 44, height: 130, rx: 22, fill: SKIN, class: "skin" }, g);
    el("rect", { x: 96 - 22, y: 214, width: 44, height: 130, rx: 22,
      fill: "none", stroke: SKIN_SHADE, "stroke-width": 2, opacity: 0.5, class: "skin-edge" }, g);
    el("rect", { x: 96 - 7, y: 224, width: 14, height: 108, rx: 7, fill: "#ffffff", opacity: 0.12 }, g);

    buildNail("thumb", 96, 236, 16, 22, g);
  }

  // Assemble in back-to-front order.
  FINGERS.forEach(buildFinger);
  buildPalm();
  buildThumb();
  handWrap.appendChild(svg);

  /* ---- Painting & decorating ----------------------------- */
  function fillEl(id) {
    return svg.querySelector(`.nail-fill[data-fill="${id}"]`);
  }
  function decoEl(id) {
    return svg.querySelector(`.deco[data-deco="${id}"]`);
  }

  // Scatter shimmering dots and a few tiny sparkles for glitter.
  function addGlitter(deco, g) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()); // even spread across the ellipse
      el("circle", {
        cx: g.cx + Math.cos(angle) * radius * g.rx,
        cy: g.cy + Math.sin(angle) * radius * g.ry,
        r: 0.8 + Math.random() * 1.6,
        fill: i % 2 ? "#ffffff" : "#ffe9a8",
        opacity: 0.9,
      }, deco);
    }
    const sg = el("g", {}, deco);
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random());
      sparkle(sg,
        g.cx + Math.cos(angle) * radius * g.rx * 0.8,
        g.cy + Math.sin(angle) * radius * g.ry * 0.8,
        0.16 + Math.random() * 0.14,
        i ? "#ffffff" : "#ffdd57");
    }
  }

  // Stamp a hand-drawn sticker in the middle of the nail. Positioning lives
  // on the outer group; the springy pop animates a separate inner group.
  function addSticker(deco, g, kind) {
    const s = (g.rx * 1.9) / 24;
    const box = el("g", {
      transform: `translate(${g.cx},${g.cy}) scale(${s.toFixed(3)}) translate(-12,-12)`,
    }, deco);
    const inner = el("g", { class: "sticker-pop" }, box);
    (ICON_DRAW[kind] || drawGem)(inner);
  }

  // Redraw one nail from its state (color + decorations).
  function renderNail(id) {
    fillEl(id).setAttribute("fill", state[id].color);
    const deco = decoEl(id);
    while (deco.firstChild) deco.removeChild(deco.firstChild);
    const g = nailGeom[id];
    if (state[id].glitter) addGlitter(deco, g);
    if (state[id].sticker) addSticker(deco, g, state[id].sticker);
  }

  // Apply the current tool/color to a nail.
  function applyToNail(id) {
    if (mode === "paint") {
      state[id].color = currentColor;
    } else if (mode === "erase") {
      state[id] = freshNail();
    } else if (mode === "glitter") {
      state[id].glitter = true;
    } else {
      state[id].sticker = mode; // gem / heart / star / flower
    }
    renderNail(id);
  }

  /* ---- Happy little sounds (made on the fly, no files) ---- */
  let audioCtx = null;
  let soundOn = true;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  // Play a single soft note.
  function note(freq, start, dur, type = "sine", peak = 0.16) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function playSound(kind) {
    if (!soundOn) return;
    ensureAudio();
    if (kind === "erase") {
      note(320, 0, 0.16, "sine", 0.12);
    } else if (kind === "glitter") {
      note(784, 0, 0.12, "triangle");
      note(988, 0.06, 0.12, "triangle");
      note(1319, 0.12, 0.14, "triangle");
    } else if (kind === "paint") {
      note(523, 0, 0.14, "triangle");
      note(784, 0.02, 0.14, "sine", 0.10);
    } else {
      // a sweet two-note twinkle for stickers/gems
      note(880, 0, 0.10, "sine");
      note(1319, 0.07, 0.13, "sine");
    }
  }

  /* ---- Sparkle burst + a little pop ---------------------- */
  const sparkleLayer = document.getElementById("sparkle-layer");
  const SPARK_GLYPHS = ["✨", "⭐", "💖", "🌟", "💫"];

  function spawnSparkles(clientX, clientY) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = sparkleLayer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (let i = 0; i < 7; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.textContent = SPARK_GLYPHS[(Math.random() * SPARK_GLYPHS.length) | 0];
      s.style.left = x + "px";
      s.style.top = y + "px";
      const angle = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 46;
      s.style.setProperty("--dx", (Math.cos(angle) * dist).toFixed(1) + "px");
      s.style.setProperty("--dy", (Math.sin(angle) * dist - 18).toFixed(1) + "px");
      s.style.setProperty("--rot", (Math.random() * 220 - 110).toFixed(0) + "deg");
      s.addEventListener("animationend", () => s.remove());
      sparkleLayer.appendChild(s);
    }
  }

  function popNail(id) {
    const g = svg.querySelector(`.nail-group[data-nail-group="${id}"]`);
    if (!g) return;
    g.classList.remove("pop");
    void g.getBoundingClientRect(); // restart the animation
    g.classList.add("pop");
  }

  // Tapping anywhere on a finger decorates its nail — with a happy little
  // sparkle, pop, and sound.
  svg.querySelectorAll(".finger").forEach((finger) => {
    const id = finger.getAttribute("data-nail");
    finger.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      applyToNail(id);
      popNail(id);
      spawnSparkles(e.clientX, e.clientY);
      playSound(mode);
    });
  });

  /* ---- Color palette & tools ----------------------------- */
  const palette = document.getElementById("palette");
  const toolbar = document.getElementById("tools");

  function clearSelected() {
    palette.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
    toolbar.querySelectorAll(".tool").forEach((t) => t.classList.remove("selected"));
  }

  // Picking a color switches back to plain painting.
  function selectColor(value, swatchEl) {
    currentColor = value;
    mode = "paint";
    clearSelected();
    if (swatchEl) swatchEl.classList.add("selected");
  }

  // Picking a tool switches to stamping/erasing.
  function selectTool(id, toolEl) {
    mode = id;
    clearSelected();
    toolEl.classList.add("selected");
  }

  COLORS.forEach((color, i) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch";
    swatch.style.background = color.css;
    swatch.setAttribute("aria-label", "Pick this color");
    swatch.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      selectColor(color.value, swatch);
    });
    if (i === 0) swatch.classList.add("selected");
    palette.appendChild(swatch);
  });

  TOOLS.forEach((tool) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool";
    btn.appendChild(iconButtonSVG(tool.id));
    btn.setAttribute("aria-label", tool.label);
    btn.setAttribute("title", tool.label);
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      selectTool(tool.id, btn);
    });
    toolbar.appendChild(btn);
  });

  /* ---- Start over ---------------------------------------- */
  const resetBtn = document.getElementById("reset-btn");
  function startOver() {
    NAIL_IDS.forEach((id) => {
      state[id] = freshNail();
      renderNail(id);
    });
    if (soundOn) {
      ensureAudio();
      note(659, 0, 0.12, "sine");
      note(494, 0.08, 0.12, "sine");
      note(392, 0.16, 0.16, "sine");
    }
  }
  resetBtn.addEventListener("click", startOver);

  /* ---- Sound on/off -------------------------------------- */
  const soundBtn = document.getElementById("sound-btn");
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-label", soundOn ? "Sound is on" : "Sound is off");
    if (soundOn) {
      ensureAudio();
      note(880, 0, 0.12, "sine");
    }
  });

  /* ---- A friendly little message ------------------------- */
  const toast = document.getElementById("toast");
  let toastTimer = 0;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1900);
  }

  /* ---- Skin tone (so the hand can look like theirs) ------- */
  const skinBtn = document.getElementById("skin-btn");
  function applySkin() {
    const tone = SKIN_TONES[skinIndex];
    SKIN = tone.skin;
    SKIN_SHADE = tone.shade;
    svg.querySelectorAll(".skin").forEach((e) => e.setAttribute("fill", SKIN));
    svg.querySelectorAll(".skin-edge").forEach((e) => e.setAttribute("stroke", SKIN_SHADE));
  }
  skinBtn.addEventListener("click", () => {
    skinIndex = (skinIndex + 1) % SKIN_TONES.length;
    applySkin();
    if (soundOn) {
      ensureAudio();
      note(520, 0, 0.09, "sine", 0.1);
    }
  });

  /* ---- Save a picture of the nails ----------------------- */
  const saveBtn = document.getElementById("save-btn");
  function savePicture() {
    const box = svg.viewBox.baseVal;
    const scale = 3;
    const W = box.width * scale;
    const H = box.height * scale;

    const clone = svg.cloneNode(true);
    clone.setAttribute("width", box.width);
    clone.setAttribute("height", box.height);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#ffe3f3");
      grad.addColorStop(0.55, "#e7e0ff");
      grad.addColorStop(1, "#dff3ff");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      canvas.toBlob((blob) => {
        if (!blob) {
          showToast("Hmm, couldn't save 😅");
          return;
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "my-nails.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        showToast("Saved your picture! 📸");
      }, "image/png");
    };
    img.onerror = () => showToast("Hmm, couldn't save 😅");
    img.src = url;
  }
  saveBtn.addEventListener("click", savePicture);

  /* ---- Dreamy floating background ------------------------- */
  function createBackdrop() {
    const bd = document.getElementById("backdrop");
    if (!bd) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colors = ["#ffd1e8", "#ffe0b3", "#d9c7ff", "#c7ecff", "#d6ffd6", "#ffd6ec"];

    for (let i = 0; i < 9; i++) {
      const b = document.createElement("div");
      b.className = "blob";
      const size = 60 + Math.random() * 150;
      b.style.width = b.style.height = size + "px";
      b.style.left = (Math.random() * 100).toFixed(1) + "%";
      b.style.top = (Math.random() * 100).toFixed(1) + "%";
      b.style.background = colors[i % colors.length];
      b.style.opacity = (0.3 + Math.random() * 0.3).toFixed(2);
      b.style.setProperty("--dx", ((Math.random() * 2 - 1) * 30).toFixed(0) + "px");
      b.style.setProperty("--dy", ((Math.random() * 2 - 1) * 30).toFixed(0) + "px");
      b.style.setProperty("--dur", (10 + Math.random() * 10).toFixed(1) + "s");
      if (reduce) b.style.animation = "none";
      bd.appendChild(b);
    }

    const glyphs = ["✨", "⭐", "💖", "🌸", "💫"];
    for (let i = 0; i < 7; i++) {
      const t = document.createElement("div");
      t.className = "twinkle";
      t.textContent = glyphs[i % glyphs.length];
      t.style.left = (Math.random() * 94 + 3).toFixed(1) + "%";
      t.style.top = (Math.random() * 90 + 3).toFixed(1) + "%";
      t.style.fontSize = (14 + Math.random() * 20).toFixed(0) + "px";
      t.style.setProperty("--dur", (3 + Math.random() * 3).toFixed(1) + "s");
      t.style.animationDelay = (Math.random() * 3).toFixed(1) + "s";
      if (reduce) { t.style.animation = "none"; t.style.opacity = "0.5"; }
      bd.appendChild(t);
    }
  }
  createBackdrop();
})();
