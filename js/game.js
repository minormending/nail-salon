/* ===========================================================
   ✨ Nail Salon ✨  —  game
   A tiny, ad-free nail salon for little kids.
   One SVG holds the salon scene plus a hand and a foot you can
   swap between. Nails can change shape, colour, and get glittery
   themed stickers. Everything is drawn with SVG/CSS — no images.
   =========================================================== */

(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}, parent = null) => {
    const node = document.createElementNS(SVGNS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  };
  const rand = () => Math.random();

  /* =========================================================
     ICONS — each drawn in a 24x24 box (centre 12,12), using
     solid fills + white highlights so the very same icon looks
     right on a nail and inside a button.
     ========================================================= */
  function starPoints(cx, cy, outer, inner, pts) {
    let d = "";
    const step = Math.PI / pts;
    for (let i = 0; i < pts * 2; i++) {
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
  const drawHeart = (g) => {
    el("path", { d: "M12 20.5 C12 20.5 3.5 13.7 3.5 8.7 C3.5 5.8 5.7 4 8 4 C9.9 4 11.2 5.2 12 6.7 C12.8 5.2 14.1 4 16 4 C18.3 4 20.5 5.8 20.5 8.7 C20.5 13.7 12 20.5 12 20.5 Z", fill: "#ff4d6d", stroke: "#e23b5a", "stroke-width": 0.6, "stroke-linejoin": "round" }, g);
    el("ellipse", { cx: 8.6, cy: 8.2, rx: 2.1, ry: 1.3, fill: "#fff", opacity: 0.55, transform: "rotate(-35 8.6 8.2)" }, g);
  };
  const drawStar = (g) => {
    el("path", { d: starPoints(12, 12.5, 10, 4.4, 5), fill: "#ffcf33", stroke: "#f2a900", "stroke-width": 0.7, "stroke-linejoin": "round" }, g);
    el("circle", { cx: 9.4, cy: 9.6, r: 1.4, fill: "#fff4b8", opacity: 0.85 }, g);
  };
  const drawFlower = (g) => {
    for (let i = 0; i < 5; i++) el("ellipse", { cx: 12, cy: 5.7, rx: 3.4, ry: 4.6, fill: "#ff9ecb", stroke: "#f77fb4", "stroke-width": 0.5, transform: `rotate(${i * 72} 12 12)` }, g);
    el("circle", { cx: 12, cy: 12, r: 3.1, fill: "#ffd23f", stroke: "#f2b807", "stroke-width": 0.5 }, g);
    el("circle", { cx: 10.9, cy: 10.9, r: 1, fill: "#fff0b0", opacity: 0.9 }, g);
  };
  const drawBow = (g) => {
    el("path", { d: "M12 12 L4 7 Q2.4 12 4 17 Z", fill: "#ff7fb0", stroke: "#f2589a", "stroke-width": 0.5, "stroke-linejoin": "round" }, g);
    el("path", { d: "M12 12 L20 7 Q21.6 12 20 17 Z", fill: "#ff7fb0", stroke: "#f2589a", "stroke-width": 0.5, "stroke-linejoin": "round" }, g);
    el("circle", { cx: 12, cy: 12, r: 2.5, fill: "#ff5c9e" }, g);
    el("ellipse", { cx: 6.4, cy: 9.4, rx: 1, ry: 1.6, fill: "#fff", opacity: 0.5 }, g);
  };
  const drawRainbow = (g) => {
    ["#ff6b6b", "#ffb14e", "#ffd23f", "#7ed957", "#4fc3f7", "#b28dff"].forEach((c, i) => {
      const r = 10 - i * 1.4;
      el("path", { d: `M ${12 - r} 16 A ${r} ${r} 0 0 1 ${12 + r} 16`, fill: "none", stroke: c, "stroke-width": 1.3, "stroke-linecap": "round" }, g);
    });
    el("circle", { cx: 5, cy: 16.4, r: 2.4, fill: "#fff" }, g);
    el("circle", { cx: 19, cy: 16.4, r: 2.4, fill: "#fff" }, g);
  };
  const drawShell = (g) => {
    el("path", { d: "M12 5 C5 5 3 12 4 17 L20 17 C21 12 19 5 12 5 Z", fill: "#ffc1d9", stroke: "#f28fb4", "stroke-width": 0.6, "stroke-linejoin": "round" }, g);
    for (let i = -2; i <= 2; i++) el("line", { x1: 12, y1: 7, x2: 12 + i * 4, y2: 17, stroke: "#f28fb4", "stroke-width": 0.5, opacity: 0.7 }, g);
    el("circle", { cx: 12, cy: 6.4, r: 1.7, fill: "#ffe0ec", stroke: "#f28fb4", "stroke-width": 0.4 }, g);
  };
  const drawStarfish = (g) => {
    el("path", { d: starPoints(12, 12.5, 9.5, 5.2, 5), fill: "#ff9a52", stroke: "#f07f2e", "stroke-width": 0.6, "stroke-linejoin": "round" }, g);
    [[12, 9.5], [9.2, 13], [14.8, 13], [10.6, 16], [13.4, 16]].forEach((p) => el("circle", { cx: p[0], cy: p[1], r: 0.7, fill: "#fff", opacity: 0.85 }, g));
  };
  const drawFish = (g) => {
    el("path", { d: "M16 12 L22 8 L22 16 Z", fill: "#5ec8e8", stroke: "#3aa7c9", "stroke-width": 0.5, "stroke-linejoin": "round" }, g);
    el("ellipse", { cx: 11, cy: 12, rx: 7, ry: 5, fill: "#5ec8e8", stroke: "#3aa7c9", "stroke-width": 0.5 }, g);
    el("ellipse", { cx: 10, cy: 9.6, rx: 2.4, ry: 1.1, fill: "#fff", opacity: 0.4 }, g);
    el("circle", { cx: 8, cy: 11, r: 1.2, fill: "#fff" }, g);
    el("circle", { cx: 7.7, cy: 11, r: 0.55, fill: "#333" }, g);
  };
  const drawBubble = (g) => {
    el("circle", { cx: 12, cy: 12, r: 7.2, fill: "#bfeaff", stroke: "#8fd3f0", "stroke-width": 0.6 }, g);
    el("ellipse", { cx: 9.5, cy: 9.5, rx: 2.3, ry: 1.5, fill: "#fff", opacity: 0.85, transform: "rotate(-30 9.5 9.5)" }, g);
  };
  const drawBalloon = (g) => {
    el("line", { x1: 12, y1: 19, x2: 13, y2: 23, stroke: "#c9a86f", "stroke-width": 0.5 }, g);
    el("path", { d: "M12 16.5 L10.6 19.5 L13.4 19.5 Z", fill: "#e85555" }, g);
    el("ellipse", { cx: 12, cy: 9.5, rx: 6, ry: 7.5, fill: "#ff6b6b", stroke: "#e85555", "stroke-width": 0.5 }, g);
    el("ellipse", { cx: 9.6, cy: 6.8, rx: 1.6, ry: 2.4, fill: "#fff", opacity: 0.45, transform: "rotate(-20 9.6 6.8)" }, g);
  };
  const drawCake = (g) => {
    el("rect", { x: 5, y: 12, width: 14, height: 8, rx: 1.6, fill: "#ffd9a0", stroke: "#e8b877", "stroke-width": 0.5 }, g);
    el("path", { d: "M5 13.5 Q8 16 11 13.5 T17 13.5 Q18.4 14 19 13.2 L19 12 L5 12 Z", fill: "#ff9ec4" }, g);
    el("rect", { x: 11.2, y: 5.5, width: 1.6, height: 5, fill: "#ffd23f" }, g);
    el("path", { d: "M12 3.4 C13 4.6 13 5.6 12 5.8 C11 5.6 11 4.6 12 3.4 Z", fill: "#ff7a1a" }, g);
  };
  const drawGift = (g) => {
    el("rect", { x: 5, y: 9.5, width: 14, height: 10.5, rx: 1.4, fill: "#8ed0ff", stroke: "#5cb3e8", "stroke-width": 0.5 }, g);
    el("rect", { x: 11, y: 9.5, width: 2, height: 10.5, fill: "#ff6b9d" }, g);
    el("rect", { x: 5, y: 13, width: 14, height: 2, fill: "#ff6b9d" }, g);
    el("path", { d: "M12 9.5 C9.5 5.5 6 7 8.4 8.6 C9.6 9.4 11 9.5 12 9.5 C13 9.5 14.4 9.4 15.6 8.6 C18 7 14.5 5.5 12 9.5 Z", fill: "#ff6b9d" }, g);
  };
  const drawCrown = (g) => {
    el("path", { d: "M4 17 L5 8 L9 12 L12 5.5 L15 12 L19 8 L20 17 Z", fill: "#ffd23f", stroke: "#eab308", "stroke-width": 0.6, "stroke-linejoin": "round" }, g);
    el("rect", { x: 4, y: 16, width: 16, height: 2.6, rx: 0.8, fill: "#f2b807" }, g);
    [[5, 8, "#ff6b9d"], [12, 5.6, "#66d1ff"], [19, 8, "#ff6b9d"]].forEach((p) => el("circle", { cx: p[0], cy: p[1], r: 1.2, fill: p[2] }, g));
  };
  const drawDiamond = (g) => {
    el("polygon", { points: "7,6 17,6 21,10.5 12,20.5 3,10.5", fill: "#4ec2ff", stroke: "#2f9fe0", "stroke-width": 0.7, "stroke-linejoin": "round" }, g);
    el("polygon", { points: "7,6 17,6 19,10.5 5,10.5", fill: "#bce8ff", opacity: 0.9 }, g);
    el("polyline", { points: "3,10.5 21,10.5", fill: "none", stroke: "#fff", "stroke-width": 0.6, opacity: 0.55 }, g);
    el("polyline", { points: "7,6 12,20.5 17,6", fill: "none", stroke: "#fff", "stroke-width": 0.5, opacity: 0.45 }, g);
    el("polygon", { points: "8,7 10.6,7 9.3,10", fill: "#fff", opacity: 0.65 }, g);
  };
  const roundGem = (color) => (g) => {
    el("circle", { cx: 12, cy: 12, r: 8, fill: color, stroke: "#ffffff", "stroke-width": 0.9 }, g);
    el("polygon", { points: "12,5 17,9 15,15 9,15 7,9", fill: "#ffffff", opacity: 0.22 }, g);
    el("circle", { cx: 9.5, cy: 9.5, r: 1.9, fill: "#fff", opacity: 0.8 }, g);
  };
  const drawGlitterIcon = (g) => {
    sparkle(g, 12, 12, 0.92, "#ffdd57");
    sparkle(g, 19, 6, 0.34, "#ffffff");
    sparkle(g, 5.5, 17.5, 0.3, "#ffffff");
  };
  const drawEraser = (g) => {
    const e = el("g", { transform: "rotate(-18 12 12)" }, g);
    el("rect", { x: 3.5, y: 8, width: 17, height: 8, rx: 2.4, fill: "#ffffff", stroke: "#e58ba9", "stroke-width": 0.7 }, e);
    el("path", { d: "M5.9 8 H18.1 A2.4 2.4 0 0 1 20.5 10.4 V11.4 H3.5 V10.4 A2.4 2.4 0 0 1 5.9 8 Z", fill: "#ff8fab" }, e);
    el("line", { x1: 9, y1: 8, x2: 9, y2: 16, stroke: "#e58ba9", "stroke-width": 0.5, opacity: 0.6 }, e);
  };

  /* ---- Henna (mehndi) — guided, salon-style line art ----------
     Rather than free stamps, henna fills predefined "zones": one
     ornate mandala on the back of the hand/foot, and a matching sprig
     down each finger/toe. The art is generated so several "looks"
     stay compact. Reddish-brown and monochrome, like a real stain. */
  const HENNA = "#8a3a17";

  // A single radial petal/leaf (a pointed lens) from radius ri to ro at
  // `ang` degrees around (cx,cy), `w` = half-width at its midpoint.
  function petalPath(cx, cy, ang, ri, ro, w) {
    const a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const mid = (ri + ro) / 2;
    const bx = cx + dx * ri, by = cy + dy * ri, tx = cx + dx * ro, ty = cy + dy * ro;
    const m1x = cx + dx * mid + px * w, m1y = cy + dy * mid + py * w;
    const m2x = cx + dx * mid - px * w, m2y = cy + dy * mid - py * w;
    return `M${bx.toFixed(1)},${by.toFixed(1)} Q${m1x.toFixed(1)},${m1y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} Q${m2x.toFixed(1)},${m2y.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)} Z`;
  }

  // An ornate concentric mandala centred at (cx,cy) with outer radius R.
  function buildMandala(parent, cx, cy, R, look, opts = {}) {
    const o = look.mandala, s = R / 46, sw = Math.max(0.7, R * 0.02);
    const g = el("g", { fill: "none", stroke: HENNA, "stroke-width": sw.toFixed(2), "stroke-linejoin": "round", "stroke-linecap": "round" }, parent);
    if (opts.ghost) { g.setAttribute("opacity", "0.4"); g.setAttribute("stroke-dasharray", `${(sw * 1.5).toFixed(1)} ${(sw * 1.7).toFixed(1)}`); }
    const dot = (x, y, r) => el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: Math.max(0.4, r).toFixed(2), fill: HENNA, stroke: "none" }, g);
    const ring = (rad, swm) => el("circle", { cx, cy, r: (rad * s).toFixed(1), "stroke-width": (sw * swm).toFixed(2) }, g);
    const petal = (ang, ri, ro, w, swm) => el("path", { d: petalPath(cx, cy, ang, ri * s, ro * s, w * s), "stroke-width": (sw * swm).toFixed(2) }, g);
    const dotRing = (rad, n, r) => { for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n; dot(cx + Math.cos(a) * rad * s, cy + Math.sin(a) * rad * s, r); } };
    // outer ring of pointed petals + a fine echo inside each
    for (let i = 0; i < o.outerN; i++) { const a = i * 360 / o.outerN; petal(a, 30, 46, o.outerW, 1); petal(a, 33, 42, o.outerW * 0.45, 0.6); }
    dotRing(48, o.outerN * 2, sw * 0.7);   // picot dots around the very edge
    ring(28, 0.7);
    dotRing(26, o.dotN, sw * 0.8);          // beaded ring
    ring(22.5, 0.6);
    // middle ring of petals, offset so they nest between the outer ones
    for (let i = 0; i < o.midN; i++) { const a = i * 360 / o.midN + 180 / o.midN; petal(a, 10, 22, o.midW, 0.85); }
    ring(9, 0.6);
    // centre flower
    for (let i = 0; i < 8; i++) petal(i * 45, 2.5, 8, 1.7, 0.7);
    dot(cx, cy, sw * 1.8);
    // a little hanging pendant toward the wrist
    if (o.tail) {
      const ty = cy + 46 * s;
      el("path", { d: `M${cx.toFixed(1)},${ty.toFixed(1)} q${(-5 * s).toFixed(1)},${(10 * s).toFixed(1)} 0,${(20 * s).toFixed(1)} q${(5 * s).toFixed(1)},${(-10 * s).toFixed(1)} 0,${(-20 * s).toFixed(1)} Z`, "stroke-width": sw.toFixed(2) }, g);
      dot(cx, cy + 70 * s, sw * 1.3); dot(cx, cy + 76 * s, sw * 0.9);
    }
    return g;
  }

  // A vine sprig running down a finger from (x,ytop) to (x,ybot). Nothing is
  // ever drawn above `ytop`, so it stays clear of the nail.
  function buildSprig(parent, x, ytop, ybot, look, opts = {}) {
    const kind = look.sprig, len = ybot - ytop, sw = 1.7;
    const g = el("g", { fill: "none", stroke: HENNA, "stroke-width": sw, "stroke-linecap": "round", "stroke-linejoin": "round" }, parent);
    if (opts.ghost) { g.setAttribute("opacity", "0.4"); g.setAttribute("stroke-dasharray", `${(sw * 1.5).toFixed(1)} ${(sw * 1.7).toFixed(1)}`); }
    // A small top bud whose tip sits exactly at ytop and whose body hangs below.
    el("path", { d: `M${x},${ytop} C${x - 4.5},${(ytop + 5).toFixed(1)} ${x - 4.5},${(ytop + 11).toFixed(1)} ${x},${(ytop + 13).toFixed(1)} C${x + 4.5},${(ytop + 11).toFixed(1)} ${x + 4.5},${(ytop + 5).toFixed(1)} ${x},${ytop} Z`, "stroke-width": sw * 0.9 }, g);
    el("path", { d: `M${x},${(ytop + 12).toFixed(1)} L${x},${(ybot - 5).toFixed(1)}` }, g); // stem
    const y0 = ytop + 20, y1 = ybot - 8;
    const n = y1 > y0 ? Math.max(1, Math.min(6, Math.round((y1 - y0) / 20) + 1)) : 0;
    for (let i = 0; i < n; i++) {
      const y = n > 1 ? y0 + (y1 - y0) * i / (n - 1) : (y0 + y1) / 2;
      if (kind === "fern") { el("path", { d: `M${x},${y.toFixed(1)} L${x - 10},${(y + 8).toFixed(1)}` }, g); el("path", { d: `M${x},${y.toFixed(1)} L${x + 10},${(y + 8).toFixed(1)}` }, g); }
      else if (kind === "leaf") { el("ellipse", { cx: x - 8, cy: y, rx: 3, ry: 6, transform: `rotate(-35 ${x - 8} ${y.toFixed(1)})`, "stroke-width": sw * 0.85 }, g); el("ellipse", { cx: x + 8, cy: y, rx: 3, ry: 6, transform: `rotate(35 ${x + 8} ${y.toFixed(1)})`, "stroke-width": sw * 0.85 }, g); }
      else { el("circle", { cx: x - 8, cy: y.toFixed(1), r: 2.1, fill: HENNA, stroke: "none" }, g); el("circle", { cx: x + 8, cy: y.toFixed(1), r: 2.1, fill: HENNA, stroke: "none" }, g); }
    }
    el("circle", { cx: x, cy: (ybot - 2).toFixed(1), r: 2.4, fill: HENNA, stroke: "none" }, g);
    return g;
  }

  // A small mandala for a picker button.
  function mandalaIcon(look, size = 42) {
    const s = el("svg", { viewBox: "0 0 48 48", width: size, height: size });
    buildMandala(s, 24, 24, 21, look);
    return s;
  }

  // Build a small standalone SVG of an icon for a button.
  function iconSVG(drawFn, size = 34) {
    const s = el("svg", { viewBox: "0 0 24 24", width: size, height: size });
    drawFn(el("g", {}, s));
    return s;
  }

  /* =========================================================
     DATA
     ========================================================= */
  const NATURAL = "#ffeef0";

  // Polishes: solids + a few gradients. `value` fills the SVG nail,
  // `css` fills the little bottle in the picker.
  const POLISHES = [
    { value: "#ff8fab", css: "#ff8fab" },
    { value: "#ff4f8b", css: "#ff4f8b" },
    { value: "#ff5c5c", css: "#ff5c5c" },
    { value: "#ff9f5c", css: "#ff9f5c" },
    { value: "#ffd166", css: "#ffd166" },
    { value: "#8ee06a", css: "#8ee06a" },
    { value: "#5ad1c5", css: "#5ad1c5" },
    { value: "#6cc6ff", css: "#6cc6ff" },
    { value: "#6c8cff", css: "#6c8cff" },
    { value: "#b28dff", css: "#b28dff" },
    { value: "#ffffff", css: "#ffffff" },
    { value: "#3a3a4a", css: "#3a3a4a" },
    { value: "url(#g-rainbow)", css: "linear-gradient(135deg,#ff6b6b,#ffd166,#8ee06a,#6cc6ff,#b28dff)" },
    { value: "url(#g-sunset)", css: "linear-gradient(160deg,#ff8fb0,#ffb347)" },
    { value: "url(#g-ocean)", css: "linear-gradient(160deg,#6cc6ff,#5ad1c5)" },
    { value: "url(#g-grape)", css: "linear-gradient(160deg,#b28dff,#ff8fd0)" },
  ];

  const SKIN_TONES = [
    { skin: "#ffe0bd", shade: "#f0c9a0" },
    { skin: "#f6c9a8", shade: "#e9b291" },
    { skin: "#d29e78", shade: "#bd845c" },
    { skin: "#a2703f", shade: "#87592e" },
    { skin: "#6f4a2f", shade: "#573823" },
  ];

  const SHAPES = ["oval", "round", "almond", "square", "coffin"];

  // Themed sticker packs. `glitter` is a special sparkly effect.
  const PACKS = [
    { id: "cute", label: "Cute", items: [
      { id: "glitter", label: "Glitter", draw: drawGlitterIcon },
      { id: "heart", label: "Heart", draw: drawHeart },
      { id: "star", label: "Star", draw: drawStar },
      { id: "flower", label: "Flower", draw: drawFlower },
      { id: "bow", label: "Bow", draw: drawBow },
      { id: "rainbow", label: "Rainbow", draw: drawRainbow },
    ]},
    { id: "sea", label: "Sea", items: [
      { id: "shell", label: "Shell", draw: drawShell },
      { id: "starfish", label: "Starfish", draw: drawStarfish },
      { id: "fish", label: "Fish", draw: drawFish },
      { id: "pearl", label: "Pearl", draw: drawBubble },
    ]},
    { id: "party", label: "Party", items: [
      { id: "balloon", label: "Balloon", draw: drawBalloon },
      { id: "cake", label: "Cake", draw: drawCake },
      { id: "gift", label: "Gift", draw: drawGift },
      { id: "crown", label: "Crown", draw: drawCrown },
    ]},
    { id: "gems", label: "Gems", items: [
      { id: "gem-diamond", label: "Diamond", draw: drawDiamond },
      { id: "gem-pink", label: "Pink gem", draw: roundGem("#ff6bb0") },
      { id: "gem-blue", label: "Blue gem", draw: roundGem("#5cc8ff") },
      { id: "gem-purple", label: "Purple gem", draw: roundGem("#b98cff") },
      { id: "gem-green", label: "Green gem", draw: roundGem("#7ed957") },
      { id: "gem-red", label: "Red gem", draw: roundGem("#ff6b6b") },
    ]},
  ];
  // id -> draw function, for rendering a saved sticker.
  const STICKER_DRAW = {};
  PACKS.forEach((p) => p.items.forEach((it) => { if (it.id !== "glitter") STICKER_DRAW[it.id] = it.draw; }));

  // Henna "looks": each defines the mandala's ring counts/petal widths and
  // the finger-sprig style. The whole design is applied in the chosen look.
  const HENNA_LOOKS = [
    { id: "bloom", label: "Bloom", mandala: { outerN: 8, outerW: 8, midN: 8, midW: 5, dotN: 16, tail: true }, sprig: "leaf" },
    { id: "star", label: "Star", mandala: { outerN: 12, outerW: 5, midN: 12, midW: 3, dotN: 24, tail: true }, sprig: "fern" },
    { id: "dotty", label: "Dotty", mandala: { outerN: 10, outerW: 6.5, midN: 10, midW: 4, dotN: 20, tail: false }, sprig: "dots" },
  ];
  const isHenna = (m) => m === "henna";

  const CATEGORIES = [
    { id: "colors", ico: "💅", label: "Colors" },
    { id: "stickers", ico: "✨", label: "Stickers" },
    { id: "henna", ico: "🪷", label: "Henna" },
    { id: "shapes", ico: "💠", label: "Shapes" },
    { id: "skin", ico: "✋", label: "Skin" },
    { id: "erase", ico: "🧽", label: "Wipe" },
  ];

  /* =========================================================
     GEOMETRY — hand fingers and foot toes
     ========================================================= */
  const FINGERS = [
    { id: "index",  cx: 112, top: 104, w: 42, bottom: 268 },
    { id: "middle", cx: 160, top: 72,  w: 44, bottom: 268 },
    { id: "ring",   cx: 208, top: 104, w: 42, bottom: 268 },
    { id: "pinky",  cx: 250, top: 150, w: 36, bottom: 268 },
  ];
  const TOES = [
    { id: "toe1", cx: 118, top: 150, w: 52, bottom: 214 },
    { id: "toe2", cx: 164, top: 150, w: 34, bottom: 210 },
    { id: "toe3", cx: 194, top: 160, w: 30, bottom: 210 },
    { id: "toe4", cx: 220, top: 174, w: 26, bottom: 210 },
    { id: "toe5", cx: 244, top: 190, w: 22, bottom: 210 },
  ];
  const HAND_NAILS = ["thumb", "index", "middle", "ring", "pinky"];
  const FOOT_NAILS = ["toe1", "toe2", "toe3", "toe4", "toe5"];

  /* ---- Henna zones: where a design can go on each surface ----
     A big mandala on the back, and a sprig down each finger/toe.
     Sprigs store a hit-test segment (`_seg`) in surface coordinates;
     the thumb's is rotated to follow the thumb. */
  // Sprig `ytop` sits clear below each nail (nail bottom ≈ finger top + 48).
  const HAND_ZONES = [
    { id: "h-back", kind: "mandala", cx: 176, cy: 332, R: 66 },
    { id: "h-index", kind: "sprig", x: 112, ytop: 162, ybot: 250 },
    { id: "h-middle", kind: "sprig", x: 160, ytop: 130, ybot: 252 },
    { id: "h-ring", kind: "sprig", x: 208, ytop: 162, ybot: 250 },
    { id: "h-pinky", kind: "sprig", x: 250, ytop: 208, ybot: 250 },
    { id: "h-thumb", kind: "sprig", x: 96, ytop: 268, ybot: 332, rotDeg: -38, rotCx: 96, rotCy: 300 },
  ];
  // The foot gets just the mandala — the toenails are too close together to
  // fit a sprig without overlapping them.
  const FOOT_ZONES = [
    { id: "f-top", kind: "mandala", cx: 172, cy: 326, R: 46 },
  ];
  const rotPt = (x, y, cx, cy, deg) => { const a = deg * Math.PI / 180, s = Math.sin(a), c = Math.cos(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };
  [...HAND_ZONES, ...FOOT_ZONES].forEach((z) => {
    if (z.kind !== "sprig") return;
    if (z.rotDeg !== undefined) z._seg = [...rotPt(z.x, z.ytop, z.rotCx, z.rotCy, z.rotDeg), ...rotPt(z.x, z.ybot, z.rotCx, z.rotCy, z.rotDeg)];
    else z._seg = [z.x, z.ytop, z.x, z.ybot];
  });
  function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  const zoneDist = (z, x, y) => z.kind === "mandala" ? Math.hypot(x - z.cx, y - z.cy) : distToSeg(x, y, z._seg[0], z._seg[1], z._seg[2], z._seg[3]);
  const zoneThreshold = (z) => z.kind === "mandala" ? z.R : 30;

  /* =========================================================
     STATE
     ========================================================= */
  const freshNail = () => ({ color: NATURAL, sticker: null, glitter: false });
  const state = {};
  [...HAND_NAILS, ...FOOT_NAILS].forEach((id) => (state[id] = freshNail()));
  const nailMeta = {}; // id -> {cx,cy,rx,ry,surface}
  const surfaceShape = { hand: "oval", foot: "oval" };

  // Henna lives in its own layer per surface (kept separate from the nails so
  // each hand/foot remembers its own design). Each zone id maps to the group
  // node currently drawn there (or is absent when the zone is empty).
  const hennaLayer = { hand: null, foot: null };
  const hennaZones = { hand: {}, foot: {} };

  let currentSurface = "hand";
  let currentColor = POLISHES[0].value;
  let mode = "paint"; // "paint" | "erase" | "glitter" | <stickerId>
  let currentCategory = "colors";
  let currentPack = "cute";
  let currentLook = HENNA_LOOKS[0];
  let skinIndex = 1;
  let SKIN = SKIN_TONES[skinIndex].skin;
  let SKIN_SHADE = SKIN_TONES[skinIndex].shade;

  /* =========================================================
     NAIL SHAPES (paths around a centre)
     ========================================================= */
  function ellipsePath(cx, cy, rx, ry) {
    const k = 0.5523;
    return `M${cx},${cy - ry}` +
      `C${cx + rx * k},${cy - ry} ${cx + rx},${cy - ry * k} ${cx + rx},${cy}` +
      `C${cx + rx},${cy + ry * k} ${cx + rx * k},${cy + ry} ${cx},${cy + ry}` +
      `C${cx - rx * k},${cy + ry} ${cx - rx},${cy + ry * k} ${cx - rx},${cy}` +
      `C${cx - rx},${cy - ry * k} ${cx - rx * k},${cy - ry} ${cx},${cy - ry}Z`;
  }
  function shapePath(shape, cx, cy, rx, ry) {
    if (shape === "round") return ellipsePath(cx, cy, rx * 1.02, ry * 0.82);
    if (shape === "almond") {
      return `M${cx},${cy - ry}` +
        `C${cx + rx * 0.85},${cy - ry * 0.6} ${cx + rx},${cy - ry * 0.1} ${cx + rx},${cy + ry * 0.15}` +
        `C${cx + rx},${cy + ry * 0.7} ${cx + rx * 0.55},${cy + ry} ${cx},${cy + ry}` +
        `C${cx - rx * 0.55},${cy + ry} ${cx - rx},${cy + ry * 0.7} ${cx - rx},${cy + ry * 0.15}` +
        `C${cx - rx},${cy - ry * 0.1} ${cx - rx * 0.85},${cy - ry * 0.6} ${cx},${cy - ry}Z`;
    }
    if (shape === "square") {
      const r = Math.min(rx, ry) * 0.5, l = cx - rx, t = cy - ry, R = cx + rx, B = cy + ry;
      return `M${l + r},${t} L${R - r},${t} Q${R},${t} ${R},${t + r} L${R},${B - r} Q${R},${B} ${R - r},${B} L${l + r},${B} Q${l},${B} ${l},${B - r} L${l},${t + r} Q${l},${t} ${l + r},${t} Z`;
    }
    if (shape === "coffin") {
      const tw = rx * 0.55;
      return `M${cx - tw},${cy - ry} L${cx + tw},${cy - ry} L${cx + rx},${cy + ry * 0.72} Q${cx + rx},${cy + ry} ${cx + rx * 0.68},${cy + ry} L${cx - rx * 0.68},${cy + ry} Q${cx - rx},${cy + ry} ${cx - rx},${cy + ry * 0.72} Z`;
    }
    return ellipsePath(cx, cy, rx, ry); // oval
  }

  /* =========================================================
     BUILD THE SVG
     ========================================================= */
  const handWrap = document.getElementById("hand-wrap");
  const svg = el("svg", { viewBox: "0 0 320 470", role: "img", "aria-label": "A hand to paint nails on" });
  const defs = el("defs", {}, svg);

  function grad(id, stops) {
    const lg = el("linearGradient", { id, x1: "0", y1: "0", x2: "1", y2: "1" }, defs);
    stops.forEach((c, i) => el("stop", { offset: `${(i / (stops.length - 1)) * 100}%`, "stop-color": c }, lg));
  }
  grad("g-rainbow", ["#ff6b6b", "#ffd166", "#8ee06a", "#6cc6ff", "#b28dff"]);
  grad("g-sunset", ["#ff8fb0", "#ffb347"]);
  grad("g-ocean", ["#6cc6ff", "#5ad1c5"]);
  grad("g-grape", ["#b28dff", "#ff8fd0"]);
  const soft = el("filter", { id: "soft", x: "-40%", y: "-40%", width: "180%", height: "180%" }, defs);
  el("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "16" }, soft);

  /* ---- Salon scene (table, cushion, bottles, lamp) -------- */
  function buildBottle(g, cx, baseY, color) {
    el("ellipse", { cx, cy: baseY + 2, rx: 13, ry: 3.5, fill: "#00000012" }, g);
    el("rect", { x: cx - 10, y: baseY - 30, width: 20, height: 30, rx: 6, fill: color, stroke: "#ffffff", "stroke-width": 1.5 }, g);
    el("rect", { x: cx - 7, y: baseY - 27, width: 3.5, height: 20, rx: 1.75, fill: "#ffffff", opacity: 0.42 }, g);
    el("rect", { x: cx - 4, y: baseY - 36, width: 8, height: 7, fill: "#e9c9a0" }, g);
    el("rect", { x: cx - 6, y: baseY - 50, width: 12, height: 15, rx: 3, fill: "#6b4a63" }, g);
  }
  function buildLamp(g, cx, baseY) {
    el("ellipse", { cx, cy: baseY + 2, rx: 30, ry: 4, fill: "#00000012" }, g);
    el("rect", { x: cx - 26, y: baseY - 12, width: 52, height: 14, rx: 6, fill: "#ffd0e6", stroke: "#fff", "stroke-width": 1.5 }, g);
    el("path", { d: `M${cx - 25} ${baseY - 10} Q${cx - 27} ${baseY - 46} ${cx} ${baseY - 46} Q${cx + 27} ${baseY - 46} ${cx + 25} ${baseY - 10} Z`, fill: "#ffffff", stroke: "#ececf4", "stroke-width": 1.5 }, g);
    el("ellipse", { cx, cy: baseY - 26, rx: 17, ry: 9, fill: "#e9d5ff", opacity: 0.85, class: "lamp-glow" }, g);
    [-9, 0, 9].forEach((dx) => el("circle", { cx: cx + dx, cy: baseY - 26, r: 1.5, fill: "#b98cff", class: "lamp-glow" }, g));
  }
  function buildScene(g) {
    // A soft cushion the hand rests on, with polish bottles and a UV lamp.
    el("ellipse", { cx: 160, cy: 442, rx: 140, ry: 30, fill: "#00000010", filter: "url(#soft)" }, g);
    el("rect", { x: 30, y: 360, width: 260, height: 92, rx: 44, fill: "#e7dcff", stroke: "#d8c9ff", "stroke-width": 2 }, g);
    el("rect", { x: 40, y: 364, width: 240, height: 40, rx: 34, fill: "#f4eeff", opacity: 0.75 }, g);
    buildLamp(g, 44, 452);
    buildBottle(g, 292, 448, "#ff6b9d");
    buildBottle(g, 256, 458, "#ffd23f");
  }

  /* ---- Nails --------------------------------------------- */
  function buildNail(id, cx, cy, rx, ry, parent, surface) {
    nailMeta[id] = { cx, cy, rx, ry, surface };
    const d = shapePath(surfaceShape[surface], cx, cy, rx, ry);

    const clip = el("clipPath", { id: `clip-${id}` }, defs);
    el("path", { d }, clip);

    const ng = el("g", { class: "nail-group", "data-ng": id }, parent);
    el("ellipse", { cx, cy: cy + 1.5, rx: rx + 1.5, ry: ry + 1.5, fill: "#00000018" }, ng);
    el("path", { d, class: "nail-fill", "data-fill": id, fill: state[id].color, stroke: "#e7b9c6", "stroke-width": 1.3 }, ng);

    const shine = el("g", { "clip-path": `url(#clip-${id})` }, ng);
    el("ellipse", { cx, cy: cy - ry * 0.42, rx: rx * 0.85, ry: ry * 0.5, fill: "#ffffff", opacity: 0.5 }, shine);
    el("ellipse", { cx: cx - rx * 0.32, cy: cy - ry * 0.52, rx: rx * 0.3, ry: ry * 0.18, fill: "#ffffff", opacity: 0.9 }, shine);
    el("ellipse", { cx, cy: cy + ry * 0.72, rx: rx * 1.25, ry: ry * 0.5, fill: "#00000012" }, shine);

    el("g", { class: "deco", "data-deco": id, "clip-path": `url(#clip-${id})` }, ng);
  }

  /* ---- Hand ---------------------------------------------- */
  function buildFinger(f, parent) {
    const g = el("g", { class: "nailhit", "data-nail": f.id, style: "cursor:pointer" }, parent);
    el("rect", { x: f.cx - f.w / 2, y: f.top, width: f.w, height: f.bottom - f.top, rx: f.w / 2, fill: SKIN, class: "skin" }, g);
    el("rect", { x: f.cx - f.w / 2, y: f.top, width: f.w, height: f.bottom - f.top, rx: f.w / 2, fill: "none", stroke: SKIN_SHADE, "stroke-width": 2, opacity: 0.5, class: "skin-edge" }, g);
    el("rect", { x: f.cx - f.w * 0.15, y: f.top + 8, width: f.w * 0.3, height: f.bottom - f.top - 14, rx: f.w * 0.15, fill: "#ffffff", opacity: 0.12 }, g);
    buildNail(f.id, f.cx, f.top + 22, f.w * 0.34, 24, g, "hand");
  }
  function buildHand(root) {
    FINGERS.forEach((f) => buildFinger(f, root));
    el("rect", { x: 86, y: 208, width: 182, height: 240, rx: 60, fill: SKIN, class: "skin" }, root);
    el("ellipse", { cx: 172, cy: 248, rx: 66, ry: 40, fill: "#ffffff", opacity: 0.16, filter: "url(#soft)" }, root);
    el("ellipse", { cx: 177, cy: 420, rx: 92, ry: 52, fill: "#000000", opacity: 0.06, filter: "url(#soft)" }, root);
    const t = el("g", { class: "nailhit", "data-nail": "thumb", style: "cursor:pointer", transform: "rotate(-38 96 300)" }, root);
    el("rect", { x: 74, y: 214, width: 44, height: 130, rx: 22, fill: SKIN, class: "skin" }, t);
    el("rect", { x: 74, y: 214, width: 44, height: 130, rx: 22, fill: "none", stroke: SKIN_SHADE, "stroke-width": 2, opacity: 0.5, class: "skin-edge" }, t);
    el("rect", { x: 89, y: 224, width: 14, height: 108, rx: 7, fill: "#ffffff", opacity: 0.12 }, t);
    buildNail("thumb", 96, 236, 16, 22, t, "hand");
  }

  /* ---- Foot ---------------------------------------------- */
  function buildToe(t, parent) {
    const g = el("g", { class: "nailhit", "data-nail": t.id, style: "cursor:pointer" }, parent);
    el("rect", { x: t.cx - t.w / 2, y: t.top, width: t.w, height: t.bottom - t.top, rx: t.w / 2, fill: SKIN, class: "skin" }, g);
    el("rect", { x: t.cx - t.w / 2, y: t.top, width: t.w, height: t.bottom - t.top, rx: t.w / 2, fill: "none", stroke: SKIN_SHADE, "stroke-width": 2, opacity: 0.5, class: "skin-edge" }, g);
    buildNail(t.id, t.cx, t.top + t.w * 0.42, t.w * 0.4, t.w * 0.3, g, "foot");
  }
  function buildFoot(root) {
    // Foot body (cute, top-down): widest at the ball, tapering to the heel.
    // Then toes are drawn on top so their bases blend into the foot.
    el("path", { d: "M100 226 C96 198 122 190 152 190 C204 190 248 202 250 248 C254 322 232 452 176 454 C140 456 118 450 116 408 C110 348 104 282 100 226 Z", fill: SKIN, class: "skin" }, root);
    el("ellipse", { cx: 168, cy: 252, rx: 64, ry: 36, fill: "#ffffff", opacity: 0.16, filter: "url(#soft)" }, root);
    el("ellipse", { cx: 172, cy: 430, rx: 78, ry: 40, fill: "#000000", opacity: 0.06, filter: "url(#soft)" }, root);
    TOES.forEach((t) => buildToe(t, root));
  }

  const sceneG = el("g", { class: "scene" }, svg);
  buildScene(sceneG);
  const handG = el("g", { class: "surface", "data-surface": "hand" }, svg);
  buildHand(handG);
  const footG = el("g", { class: "surface", "data-surface": "foot", style: "display:none" }, svg);
  buildFoot(footG);
  // Henna layer sits on top of each surface's skin; marks never eat taps.
  hennaLayer.hand = el("g", { class: "henna-layer" }, handG);
  hennaLayer.foot = el("g", { class: "henna-layer" }, footG);
  handWrap.appendChild(svg);

  /* =========================================================
     PAINTING & DECORATING
     ========================================================= */
  const fillEl = (id) => svg.querySelector(`.nail-fill[data-fill="${id}"]`);
  const decoEl = (id) => svg.querySelector(`.deco[data-deco="${id}"]`);

  function addGlitter(deco, m) {
    for (let i = 0; i < 15; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand());
      el("circle", { cx: m.cx + Math.cos(a) * r * m.rx, cy: m.cy + Math.sin(a) * r * m.ry, r: 0.8 + rand() * 1.6, fill: i % 2 ? "#ffffff" : "#ffe9a8", opacity: 0.9 }, deco);
    }
    const sg = el("g", { class: "glint" }, deco);
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand());
      sparkle(sg, m.cx + Math.cos(a) * r * m.rx * 0.8, m.cy + Math.sin(a) * r * m.ry * 0.8, 0.16 + rand() * 0.14, i ? "#ffffff" : "#ffdd57");
    }
  }
  function addSticker(deco, m, id) {
    const draw = STICKER_DRAW[id];
    if (!draw) return;
    const s = (m.rx * 1.9) / 24;
    const box = el("g", { transform: `translate(${m.cx},${m.cy}) scale(${s.toFixed(3)}) translate(-12,-12)` }, deco);
    draw(el("g", { class: "sticker-pop" }, box));
  }
  function renderNail(id) {
    fillEl(id).setAttribute("fill", state[id].color);
    const deco = decoEl(id);
    while (deco.firstChild) deco.removeChild(deco.firstChild);
    if (state[id].glitter) addGlitter(deco, nailMeta[id]);
    if (state[id].sticker) addSticker(deco, nailMeta[id], state[id].sticker);
  }
  const prefersReduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A little nail-polish brush that swoops in to paint. The tip sits at the
  // group's origin (0,0) so it can be positioned right on the nail.
  function makeBrush(color) {
    const g = el("g", { class: "fx-tool" });
    const s = el("g", { transform: "scale(1.15)" }, g);
    el("rect", { x: -3.5, y: -42, width: 7, height: 30, rx: 3.5, fill: "#6b4a63" }, s);
    el("rect", { x: -1.3, y: -40, width: 2, height: 25, rx: 1, fill: "#ffffff", opacity: 0.28 }, s);
    el("rect", { x: -4, y: -14.5, width: 8, height: 5.5, rx: 1.2, fill: "#cfc7d6" }, s);
    el("path", { d: "M-4.2,-10.5 Q0,-13.5 4.2,-10.5 L1.7,-1 Q0,1.8 -1.7,-1 Z", fill: color, stroke: "#0000001a", "stroke-width": 0.4 }, s);
    el("path", { d: "M-1.4,-9 L-0.5,-2.5", stroke: "#ffffff", "stroke-width": 0.9, opacity: 0.45, "stroke-linecap": "round" }, s);
    return g;
  }
  // A little sponge that wipes a nail clean.
  function makeSponge() {
    const g = el("g", { class: "fx-tool" });
    el("rect", { x: -11, y: -8, width: 22, height: 14, rx: 4, fill: "#fff0f5", stroke: "#f4c6d8", "stroke-width": 1 }, g);
    el("rect", { x: -11, y: -8, width: 22, height: 6, rx: 4, fill: "#ff9ec4" }, g);
    el("circle", { cx: -4, cy: 0, r: 1.3, fill: "#ffffff", opacity: 0.8 }, g);
    el("circle", { cx: 3.5, cy: 2, r: 1, fill: "#ffffff", opacity: 0.7 }, g);
    return g;
  }
  const nailParent = (id) => (fillEl(id).closest(".nailhit") || svg);

  // Paint a nail: the colour sweeps down its shape while a brush strokes over it.
  function animatePaint(id, color) {
    state[id].color = color;
    const fill = fillEl(id);
    if (prefersReduce()) { fill.setAttribute("fill", color); return; }
    const m = nailMeta[id];

    const overlay = el("rect", {
      x: m.cx - m.rx - 2, y: m.cy - m.ry - 2, width: (m.rx + 2) * 2, height: (m.ry + 2) * 2,
      fill: color, "clip-path": `url(#clip-${id})`,
    });
    overlay.style.transformBox = "fill-box";
    overlay.style.transformOrigin = "top";
    fill.after(overlay); // above base fill, below gloss + stickers
    overlay.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
      { duration: 300, delay: 70, easing: "ease-out", fill: "forwards" });
    // Commit the colour and clean up on a timer (robust across browsers).
    setTimeout(() => { fill.setAttribute("fill", color); overlay.remove(); }, 380);

    const brush = makeBrush(color);
    nailParent(id).appendChild(brush);
    const cx = m.cx, top = m.cy - m.ry, bot = m.cy + m.ry;
    brush.animate([
      { offset: 0,    transform: `translate(${cx}px,${top - 10}px) rotate(-30deg)`,   opacity: 0 },
      { offset: 0.18, transform: `translate(${cx}px,${top + 3}px) rotate(-14deg)`,    opacity: 1 },
      { offset: 0.55, transform: `translate(${cx}px,${bot - 4}px) rotate(-8deg)`,     opacity: 1 },
      { offset: 0.82, transform: `translate(${cx + 10}px,${top - 6}px) rotate(-30deg)`, opacity: 0.85 },
      { offset: 1,    transform: `translate(${cx + 16}px,${top - 18}px) rotate(-36deg)`, opacity: 0 },
    ], { duration: 500, easing: "ease-in-out", fill: "forwards" });
    setTimeout(() => brush.remove(), 520);
  }

  // Erase a nail: a sponge swipes back and forth as the colour disappears.
  function animateErase(id) {
    state[id] = freshNail();
    renderNail(id);
    if (prefersReduce()) return;
    const m = nailMeta[id];
    const sponge = makeSponge();
    nailParent(id).appendChild(sponge);
    const cx = m.cx, cy = m.cy, r = m.rx + 5;
    sponge.animate([
      { offset: 0,   transform: `translate(${cx - r}px,${cy}px) rotate(-6deg)`, opacity: 0 },
      { offset: 0.2, transform: `translate(${cx - r}px,${cy}px) rotate(-6deg)`, opacity: 1 },
      { offset: 0.5, transform: `translate(${cx + r}px,${cy}px) rotate(6deg)`,  opacity: 1 },
      { offset: 0.8, transform: `translate(${cx - r * 0.6}px,${cy}px) rotate(-4deg)`, opacity: 1 },
      { offset: 1,   transform: `translate(${cx}px,${cy}px) rotate(0deg)`, opacity: 0 },
    ], { duration: 440, easing: "ease-in-out", fill: "forwards" });
    setTimeout(() => sponge.remove(), 460);
  }

  function applyToNail(id) {
    if (mode === "paint") { animatePaint(id, currentColor); return; }
    if (mode === "erase") { animateErase(id); return; }
    if (mode === "glitter") state[id].glitter = true;
    else state[id].sticker = mode;
    renderNail(id);
    popNail(id);
  }

  // Attach tap handlers to every finger and toe.
  svg.querySelectorAll(".nailhit").forEach((hit) => {
    const id = hit.getAttribute("data-nail");
    hit.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      // In henna mode a finger tap should fill its sprig on the skin, so let
      // it bubble up to the surface handler below.
      if (isHenna(mode)) return;
      // In wipe mode, if the tap is on this finger's henna, remove the henna
      // first; only wipe the nail when there's no henna under the finger.
      if (mode === "erase") {
        const p = svgPoint(e.clientX, e.clientY, hennaLayer[currentSurface]);
        const z = p && nearestZone(currentSurface, p.x, p.y, true, 22);
        if (z) { clearZoneNode(currentSurface, z); spawnSparkles(e.clientX, e.clientY); playSound("erase"); e.stopPropagation(); return; }
      }
      applyToNail(id);
      spawnSparkles(e.clientX, e.clientY);
      playSound(mode);
      e.stopPropagation(); // a nail tap shouldn't also reach the surface handler
    });
  });

  /* ---- Henna: fill guided zones on the skin --------------- */
  // Map a screen point into the surface layer's own coordinates so the tapped
  // zone is found correctly, even while the hand gently floats.
  function svgPoint(clientX, clientY, elem) {
    const ctm = elem.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  const zonesFor = (surface) => (surface === "hand" ? HAND_ZONES : FOOT_ZONES);

  // Draw one zone, either as a faint dashed stencil (`ghost`) or the real,
  // fully-inked henna. Returns the group node.
  function drawZone(surface, zone, look, ghost) {
    const zg = el("g", { class: ghost ? "henna-zone henna-guide" : "henna-zone", "data-zone": zone.id }, hennaLayer[surface]);
    if (zone.kind === "mandala") buildMandala(zg, zone.cx, zone.cy, zone.R, look, { ghost });
    else {
      const inner = zone.rotDeg !== undefined ? el("g", { transform: `rotate(${zone.rotDeg} ${zone.rotCx} ${zone.rotCy})` }, zg) : zg;
      buildSprig(inner, zone.x, zone.ytop, zone.ybot, look, { ghost });
    }
    if (!ghost && !prefersReduce()) {
      zg.style.transformBox = "fill-box";
      zg.style.transformOrigin = "center";
      zg.animate([{ opacity: 0, transform: "scale(0.55)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: 340, easing: "cubic-bezier(0.34,1.56,0.64,1)" });
    }
    return zg;
  }
  // Ink a zone in (guide -> real henna), remembering which look it used.
  function fillZone(surface, zone, look) {
    const cur = hennaZones[surface][zone.id];
    if (cur) cur.node.remove();
    hennaZones[surface][zone.id] = { node: drawZone(surface, zone, look, false), filled: true, lookId: look.id };
  }
  // Show faint stencils for every not-yet-inked zone, in the given look.
  function showGuides(surface, look) {
    zonesFor(surface).forEach((z) => {
      const cur = hennaZones[surface][z.id];
      if (cur && cur.filled) return;               // keep real henna as-is
      if (cur && cur.lookId === look.id) return;   // guide already shows this look
      if (cur) cur.node.remove();                  // refresh guide to the new look
      hennaZones[surface][z.id] = { node: drawZone(surface, z, look, true), filled: false, lookId: look.id };
    });
  }
  // Remove all stencils (both surfaces); real henna is untouched.
  function hideGuides() {
    ["hand", "foot"].forEach((s) => {
      const map = hennaZones[s];
      Object.keys(map).forEach((id) => { if (!map[id].filled) { map[id].node.remove(); delete map[id]; } });
    });
  }
  function clearZoneNode(surface, zone) {
    const map = hennaZones[surface], cur = map[zone.id];
    if (!cur || !cur.filled) return false;
    delete map[zone.id];
    if (prefersReduce()) { cur.node.remove(); return true; }
    cur.node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" });
    setTimeout(() => cur.node.remove(), 230); // robust even if the animation is paused
    return true;
  }
  function clearHenna(surface) {
    const layer = hennaLayer[surface];
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    hennaZones[surface] = {};
    if (currentCategory === "henna") showGuides(surface, currentLook);
  }
  function fillAllZones(surface) {
    let delay = 0;
    zonesFor(surface).forEach((z) => {
      const cur = hennaZones[surface][z.id];
      if (cur && cur.filled) return;
      setTimeout(() => fillZone(surface, z, currentLook), delay);
      delay += 90; // stagger so it "draws on" piece by piece
    });
    playSound("henna");
  }
  // Nearest zone to a tap. `filledOnly` limits to inked zones; `maxDist`
  // overrides the zone's own reach.
  function nearestZone(surface, x, y, filledOnly, maxDist) {
    let best = null, bestD = Infinity;
    zonesFor(surface).forEach((z) => {
      const cur = hennaZones[surface][z.id];
      if (filledOnly && !(cur && cur.filled)) return;
      const d = zoneDist(z, x, y);
      if (d < bestD) { bestD = d; best = z; }
    });
    if (!best) return null;
    const lim = maxDist !== undefined ? maxDist : zoneThreshold(best);
    return bestD <= lim ? best : null;
  }
  function onSurfaceTap(e, surface) {
    if (!isHenna(mode) && mode !== "erase") return;
    const p = svgPoint(e.clientX, e.clientY, hennaLayer[surface]);
    if (!p) return;
    if (isHenna(mode)) {
      const z = nearestZone(surface, p.x, p.y, false);
      if (!z) return;
      fillZone(surface, z, currentLook);
      spawnSparkles(e.clientX, e.clientY);
      playSound("henna");
    } else {
      const z = nearestZone(surface, p.x, p.y, true);
      if (z && clearZoneNode(surface, z)) {
        spawnSparkles(e.clientX, e.clientY);
        playSound("erase");
      }
    }
  }
  handG.addEventListener("pointerdown", (e) => { e.preventDefault(); onSurfaceTap(e, "hand"); });
  footG.addEventListener("pointerdown", (e) => { e.preventDefault(); onSurfaceTap(e, "foot"); });

  /* ---- Nail shapes: reshape all nails on a surface -------- */
  function setShape(shape) {
    surfaceShape[currentSurface] = shape;
    const ids = currentSurface === "hand" ? HAND_NAILS : FOOT_NAILS;
    ids.forEach((id) => {
      const m = nailMeta[id];
      const d = shapePath(shape, m.cx, m.cy, m.rx, m.ry);
      svg.querySelector(`#clip-${id} path`).setAttribute("d", d);
      fillEl(id).setAttribute("d", d);
      renderNail(id);
    });
  }

  /* =========================================================
     SPARKLES, POP, SOUND
     ========================================================= */
  const sparkleLayer = document.getElementById("sparkle-layer");
  const SPARK_GLYPHS = ["✨", "⭐", "💖", "🌟", "💫"];
  function spawnSparkles(clientX, clientY) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = sparkleLayer.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    for (let i = 0; i < 7; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.textContent = SPARK_GLYPHS[(rand() * SPARK_GLYPHS.length) | 0];
      s.style.left = x + "px";
      s.style.top = y + "px";
      const a = rand() * Math.PI * 2, dist = 26 + rand() * 46;
      s.style.setProperty("--dx", (Math.cos(a) * dist).toFixed(1) + "px");
      s.style.setProperty("--dy", (Math.sin(a) * dist - 18).toFixed(1) + "px");
      s.style.setProperty("--rot", (rand() * 220 - 110).toFixed(0) + "deg");
      s.addEventListener("animationend", () => s.remove());
      sparkleLayer.appendChild(s);
    }
  }
  function popNail(id) {
    const g = svg.querySelector(`.nail-group[data-ng="${id}"]`);
    if (!g) return;
    g.classList.remove("pop");
    void g.getBoundingClientRect();
    g.classList.add("pop");
  }

  let audioCtx = null, soundOn = true;
  function ensureAudio() {
    if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function note(freq, start, dur, type = "sine", peak = 0.16) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function playSound(kind) {
    if (!soundOn) return;
    ensureAudio();
    if (kind === "erase") note(320, 0, 0.16, "sine", 0.12);
    else if (kind === "glitter") { note(784, 0, 0.12, "triangle"); note(988, 0.06, 0.12, "triangle"); note(1319, 0.12, 0.14, "triangle"); }
    else if (kind === "paint") { note(523, 0, 0.14, "triangle"); note(784, 0.02, 0.14, "sine", 0.1); }
    else if (kind === "henna") { note(587, 0, 0.13, "sine", 0.13); note(392, 0.05, 0.17, "sine", 0.11); }
    else { note(880, 0, 0.1, "sine"); note(1319, 0.07, 0.13, "sine"); }
  }
  function chime() { if (!soundOn) return; ensureAudio(); note(659, 0, 0.12, "sine"); note(494, 0.08, 0.12, "sine"); note(392, 0.16, 0.16, "sine"); }
  function blip() { if (!soundOn) return; ensureAudio(); note(660, 0, 0.09, "sine", 0.1); }

  /* =========================================================
     THE TRAY — category tabs + a panel of options
     ========================================================= */
  const tabsEl = document.getElementById("tabs");
  const panelEl = document.getElementById("panel");

  CATEGORIES.forEach((cat) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab";
    b.dataset.cat = cat.id;
    b.innerHTML = `<span class="tab-ico">${cat.ico}</span><span class="tab-lbl">${cat.label}</span>`;
    b.addEventListener("click", () => selectCategory(cat.id));
    tabsEl.appendChild(b);
  });

  function selectCategory(id) {
    if (currentCategory === "henna" && id !== "henna") hideGuides(); // leaving henna
    currentCategory = id;
    tabsEl.querySelectorAll(".tab").forEach((t) => t.classList.toggle("sel", t.dataset.cat === id));
    if (id === "erase") mode = "erase";
    else if (id === "henna") mode = "henna";
    renderPanel();
    if (id === "henna") showGuides(currentSurface, currentLook); // stencil the design
  }

  function optButton(extraClass, child, onPick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opt " + extraClass;
    if (child) b.appendChild(child);
    // 'click' (not pointerdown) so scrolling the panel never mis-selects.
    b.addEventListener("click", () => onPick(b));
    return b;
  }

  function renderPanel() {
    panelEl.innerHTML = "";
    panelEl.className = "panel panel-" + currentCategory;

    if (currentCategory === "colors") {
      POLISHES.forEach((p) => {
        const cap = document.createElement("span"); cap.className = "b-cap";
        const body = document.createElement("span"); body.className = "b-body"; body.style.background = p.css;
        const b = optButton("bottle", null, (btn) => {
          currentColor = p.value; mode = "paint";
          markSel(btn); blip();
        });
        b.appendChild(cap); b.appendChild(body);
        if (mode === "paint" && p.value === currentColor) b.classList.add("sel");
        panelEl.appendChild(b);
      });

    } else if (currentCategory === "stickers") {
      const packRow = document.createElement("div");
      packRow.className = "pack-row";
      PACKS.forEach((pk) => {
        const t = document.createElement("button");
        t.type = "button";
        t.className = "pack" + (pk.id === currentPack ? " sel" : "");
        t.textContent = pk.label;
        t.addEventListener("click", () => { currentPack = pk.id; renderPanel(); blip(); });
        packRow.appendChild(t);
      });
      panelEl.appendChild(packRow);

      const grid = document.createElement("div");
      grid.className = "sticker-grid";
      const pack = PACKS.find((p) => p.id === currentPack);
      pack.items.forEach((it) => {
        const b = optButton("tool", iconSVG(it.draw), (btn) => {
          mode = it.id; markSel(btn); playSound(it.id === "glitter" ? "glitter" : it.id);
        });
        b.setAttribute("aria-label", it.label);
        if (mode === it.id) b.classList.add("sel");
        grid.appendChild(b);
      });
      panelEl.appendChild(grid);

    } else if (currentCategory === "henna") {
      mode = "henna";
      const grid = document.createElement("div");
      grid.className = "sticker-grid";
      HENNA_LOOKS.forEach((lk) => {
        const b = optButton("tool henna-look", mandalaIcon(lk), (btn) => {
          currentLook = lk; markSel(btn); playSound("henna");
          showGuides(currentSurface, currentLook); // preview the new look on empty parts
        });
        b.setAttribute("aria-label", lk.label);
        if (currentLook.id === lk.id) b.classList.add("sel");
        grid.appendChild(b);
      });
      panelEl.appendChild(grid);
      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "henna-all";
      allBtn.textContent = "✨ Fill it all";
      allBtn.addEventListener("click", () => fillAllZones(currentSurface));
      panelEl.appendChild(allBtn);
      const hint = document.createElement("div");
      hint.className = "henna-hint";
      hint.textContent = "Tap the faded parts to fill them in ✍️";
      panelEl.appendChild(hint);

    } else if (currentCategory === "shapes") {
      SHAPES.forEach((sh) => {
        const s = el("svg", { viewBox: "0 0 40 48", width: 34, height: 40 });
        el("path", { d: shapePath(sh, 20, 26, 13, 19), fill: "#ffd0e0", stroke: "#f2a6c0", "stroke-width": 1.5 }, s);
        const b = optButton("shape", s, (btn) => { setShape(sh); markSel(btn); blip(); });
        if (surfaceShape[currentSurface] === sh) b.classList.add("sel");
        panelEl.appendChild(b);
      });

    } else if (currentCategory === "skin") {
      SKIN_TONES.forEach((tone, i) => {
        const b = optButton("skinopt", null, (btn) => { setSkin(i); markSel(btn); blip(); });
        b.style.background = tone.skin;
        if (i === skinIndex) b.classList.add("sel");
        panelEl.appendChild(b);
      });

    } else if (currentCategory === "erase") {
      const hint = document.createElement("div");
      hint.className = "erase-hint";
      hint.appendChild(iconSVG(drawEraser, 44));
      const txt = document.createElement("span");
      txt.textContent = "Tap a nail — or some henna — to wipe it away";
      hint.appendChild(txt);
      panelEl.appendChild(hint);
    }
  }
  function markSel(btn) {
    [...btn.parentElement.children].forEach((c) => c.classList.remove("sel"));
    btn.classList.add("sel");
  }

  /* =========================================================
     SKIN, SURFACE TOGGLE, RESET, SOUND, SAVE
     ========================================================= */
  function setSkin(i) {
    skinIndex = i;
    SKIN = SKIN_TONES[i].skin; SKIN_SHADE = SKIN_TONES[i].shade;
    svg.querySelectorAll(".skin").forEach((e) => e.setAttribute("fill", SKIN));
    svg.querySelectorAll(".skin-edge").forEach((e) => e.setAttribute("stroke", SKIN_SHADE));
  }

  const surfaceBtn = document.getElementById("surface-btn");
  surfaceBtn.addEventListener("click", () => {
    currentSurface = currentSurface === "hand" ? "foot" : "hand";
    handG.style.display = currentSurface === "hand" ? "" : "none";
    footG.style.display = currentSurface === "foot" ? "" : "none";
    surfaceBtn.textContent = currentSurface === "hand" ? "✋" : "🦶";
    svg.setAttribute("aria-label", currentSurface === "hand" ? "A hand to paint nails on" : "A foot to paint toenails on");
    if (currentCategory === "shapes") renderPanel(); // reflect this surface's shape
    if (currentCategory === "henna") showGuides(currentSurface, currentLook); // stencil this surface
    blip();
  });

  const resetBtn = document.getElementById("reset-btn");
  resetBtn.addEventListener("click", () => {
    const ids = currentSurface === "hand" ? HAND_NAILS : FOOT_NAILS;
    ids.forEach((id) => { state[id] = freshNail(); renderNail(id); });
    clearHenna(currentSurface);
    chime();
  });

  const soundBtn = document.getElementById("sound-btn");
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-label", soundOn ? "Sound is on" : "Sound is off");
    if (soundOn) { ensureAudio(); note(880, 0, 0.12, "sine"); }
  });

  const toast = document.getElementById("toast");
  let toastTimer = 0;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1900);
  }

  const saveBtn = document.getElementById("save-btn");
  saveBtn.addEventListener("click", () => {
    const box = svg.viewBox.baseVal, scale = 2.4, W = box.width * scale, H = box.height * scale;
    const clone = svg.cloneNode(true);
    clone.querySelectorAll(".henna-guide").forEach((n) => n.remove()); // don't save the faint stencil
    clone.setAttribute("width", box.width);
    clone.setAttribute("height", box.height);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      const gr = ctx.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, "#ffe3f3"); gr.addColorStop(0.55, "#e7e0ff"); gr.addColorStop(1, "#dff3ff");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      canvas.toBlob((blob) => {
        if (!blob) { showToast("Hmm, couldn't save 😅"); return; }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "my-nails.png";
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        showToast("Saved your picture! 📸");
      }, "image/png");
    };
    img.onerror = () => showToast("Hmm, couldn't save 😅");
    img.src = url;
  });

  /* =========================================================
     DREAMY FLOATING BACKGROUND
     ========================================================= */
  (function createBackdrop() {
    const bd = document.getElementById("backdrop");
    if (!bd) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colors = ["#ffd1e8", "#ffe0b3", "#d9c7ff", "#c7ecff", "#d6ffd6", "#ffd6ec"];
    for (let i = 0; i < 9; i++) {
      const b = document.createElement("div");
      b.className = "blob";
      const size = 60 + rand() * 150;
      b.style.width = b.style.height = size + "px";
      b.style.left = (rand() * 100).toFixed(1) + "%";
      b.style.top = (rand() * 100).toFixed(1) + "%";
      b.style.background = colors[i % colors.length];
      b.style.opacity = (0.3 + rand() * 0.3).toFixed(2);
      b.style.setProperty("--dx", ((rand() * 2 - 1) * 30).toFixed(0) + "px");
      b.style.setProperty("--dy", ((rand() * 2 - 1) * 30).toFixed(0) + "px");
      b.style.setProperty("--dur", (10 + rand() * 10).toFixed(1) + "s");
      if (reduce) b.style.animation = "none";
      bd.appendChild(b);
    }
    const glyphs = ["✨", "⭐", "💖", "🌸", "💫"];
    for (let i = 0; i < 7; i++) {
      const t = document.createElement("div");
      t.className = "twinkle";
      t.textContent = glyphs[i % glyphs.length];
      t.style.left = (rand() * 94 + 3).toFixed(1) + "%";
      t.style.top = (rand() * 90 + 3).toFixed(1) + "%";
      t.style.fontSize = (14 + rand() * 20).toFixed(0) + "px";
      t.style.setProperty("--dur", (3 + rand() * 3).toFixed(1) + "s");
      t.style.animationDelay = (rand() * 3).toFixed(1) + "s";
      if (reduce) { t.style.animation = "none"; t.style.opacity = "0.5"; }
      bd.appendChild(t);
    }
  })();

  /* ---- Keep touch gestures from getting in the way -------- */
  // No long-press context menu, no pinch/double-tap zoom — this is a toy,
  // not a document, so small hands can tap freely without surprises.
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  /* ---- Go! ----------------------------------------------- */
  selectCategory("colors");
})();
