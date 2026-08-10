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
    { value: "#e58cff", css: "#e58cff" }, // violet
    { value: "#ffb3de", css: "#ffb3de" }, // baby pink
    { value: "url(#rainbow)", css: "linear-gradient(135deg,#ff6b6b,#ffd166,#8ee06a,#6cc6ff,#b28dff)" }, // rainbow
    { value: "#ffffff", css: "#ffffff" }, // white
    { value: "#3a3a4a", css: "#3a3a4a" }, // midnight
  ];

  /* ---- Hand geometry ------------------------------------- */
  // Fingertips point up; the palm enters from the bottom of the frame.
  const SKIN = "#f6c9a8";
  const SKIN_SHADE = "#e9b291";

  // Four fingers (thumb handled separately). Bottoms tuck under the palm.
  const FINGERS = [
    { id: "index",  cx: 112, top: 104, w: 42, bottom: 268 },
    { id: "middle", cx: 160, top: 72,  w: 44, bottom: 268 },
    { id: "ring",   cx: 208, top: 104, w: 42, bottom: 268 },
    { id: "pinky",  cx: 250, top: 150, w: 36, bottom: 268 },
  ];

  // Where each nail sits, so decorations can be centered later.
  const nailGeom = {}; // id -> {cx, cy, rx, ry}

  /* ---- Game state ---------------------------------------- */
  const NAIL_IDS = ["thumb", "index", "middle", "ring", "pinky"];
  const state = {};
  NAIL_IDS.forEach((id) => (state[id] = { color: NATURAL }));

  let currentColor = COLORS[0].value;

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
      rx: f.w / 2, fill: SKIN,
    }, g);

    // A soft shaded edge for a little depth.
    el("rect", {
      x: f.cx - f.w / 2, y: f.top, width: f.w, height: f.bottom - f.top,
      rx: f.w / 2, fill: "none", stroke: SKIN_SHADE, "stroke-width": 2, opacity: 0.5,
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
    el("rect", { x: 86, y: 208, width: 182, height: 220, rx: 60, fill: SKIN }, svg);
  }

  // The thumb: a capsule angled out to the lower left, drawn on top of
  // the palm so it reads as being closer to us.
  function buildThumb() {
    const g = el("g", { class: "finger", "data-nail": "thumb", style: "cursor:pointer",
      transform: "rotate(-38 96 300)" }, svg);

    el("rect", { x: 96 - 22, y: 214, width: 44, height: 130, rx: 22, fill: SKIN }, g);
    el("rect", { x: 96 - 22, y: 214, width: 44, height: 130, rx: 22,
      fill: "none", stroke: SKIN_SHADE, "stroke-width": 2, opacity: 0.5 }, g);

    buildNail("thumb", 96, 236, 16, 22, g);
  }

  // Assemble in back-to-front order.
  FINGERS.forEach(buildFinger);
  buildPalm();
  buildThumb();
  handWrap.appendChild(svg);

  /* ---- Painting ------------------------------------------ */
  function fillEl(id) {
    return svg.querySelector(`.nail-fill[data-fill="${id}"]`);
  }

  function paintNail(id) {
    state[id].color = currentColor;
    fillEl(id).setAttribute("fill", currentColor);
  }

  // Tapping anywhere on a finger paints its nail.
  svg.querySelectorAll(".finger").forEach((finger) => {
    const id = finger.getAttribute("data-nail");
    finger.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      paintNail(id);
    });
  });

  /* ---- Color palette ------------------------------------- */
  const palette = document.getElementById("palette");

  function selectColor(value, swatchEl) {
    currentColor = value;
    palette.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
    if (swatchEl) swatchEl.classList.add("selected");
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

  /* ---- Start over ---------------------------------------- */
  const resetBtn = document.getElementById("reset-btn");
  function startOver() {
    NAIL_IDS.forEach((id) => {
      state[id] = { color: NATURAL };
      fillEl(id).setAttribute("fill", NATURAL);
    });
  }
  resetBtn.addEventListener("click", startOver);
})();
