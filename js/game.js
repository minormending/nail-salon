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
    { id: "glitter", emoji: "✨", label: "Glitter" },
    { id: "gem",     emoji: "💎", label: "Gem" },
    { id: "heart",   emoji: "❤️", label: "Heart" },
    { id: "star",    emoji: "⭐", label: "Star" },
    { id: "flower",  emoji: "🌸", label: "Flower" },
    { id: "erase",   emoji: "🧽", label: "Eraser" },
  ];
  const STICKER_EMOJI = { gem: "💎", heart: "❤️", star: "⭐", flower: "🌸" };

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

    // The paintable surface.
    el("ellipse", {
      cx, cy, rx, ry, class: "nail-fill", "data-fill": id,
      fill: state[id].color, stroke: "#e7b9c6", "stroke-width": 1.5,
    }, ng);

    // Glossy shine.
    el("ellipse", {
      cx: cx - rx * 0.35, cy: cy - ry * 0.4, rx: rx * 0.4, ry: ry * 0.28,
      fill: "#ffffff", opacity: 0.55,
    }, ng);

    // Layer where decorations get added later.
    el("g", { class: "deco", "data-deco": id, "clip-path": `url(#clip-${id})` }, ng);
  }

  // The palm: a big rounded shape that runs off the bottom of the frame.
  function buildPalm() {
    el("rect", { x: 86, y: 208, width: 182, height: 220, rx: 60, fill: SKIN, class: "skin" }, svg);
  }

  // The thumb: a capsule angled out to the lower left, drawn on top of
  // the palm so it reads as being closer to us.
  function buildThumb() {
    const g = el("g", { class: "finger", "data-nail": "thumb", style: "cursor:pointer",
      transform: "rotate(-38 96 300)" }, svg);

    el("rect", { x: 96 - 22, y: 214, width: 44, height: 130, rx: 22, fill: SKIN, class: "skin" }, g);
    el("rect", { x: 96 - 22, y: 214, width: 44, height: 130, rx: 22,
      fill: "none", stroke: SKIN_SHADE, "stroke-width": 2, opacity: 0.5, class: "skin-edge" }, g);

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

  // Scatter tiny shimmering dots inside the nail for a glitter effect.
  function addGlitter(deco, g) {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()); // even spread across the ellipse
      el("circle", {
        cx: g.cx + Math.cos(angle) * radius * g.rx,
        cy: g.cy + Math.sin(angle) * radius * g.ry,
        r: 0.9 + Math.random() * 1.7,
        fill: i % 2 ? "#ffffff" : "#ffe9a8",
        opacity: 0.9,
      }, deco);
    }
  }

  // Stamp a cute emoji sticker in the middle of the nail.
  function addSticker(deco, g, kind) {
    const t = el("text", {
      x: g.cx, y: g.cy,
      "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": g.ry * 1.5,
    }, deco);
    t.textContent = STICKER_EMOJI[kind];
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
    btn.textContent = tool.emoji;
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
})();
