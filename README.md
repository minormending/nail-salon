# ✨ Nail Salon ✨

A gentle, ad-free nail painting game made for little kids (about 5 years old).

- **No ads. No paywalls. No sign-ups. No internet needed.** Just paint and play.
- Runs in any web browser — on a computer, phone, or tablet.
- Big, friendly buttons and soft pastel colors designed for small hands.

![A hand with painted and decorated nails](README-preview.png)

## How to play

1. Open `index.html` in a web browser.
2. Tap a **color** at the bottom, then tap a **nail** to paint it.
3. Tap a **sticker** (✨ glitter, 💎 gem, ❤️ heart, ⭐ star, 🌸 flower), then tap a
   nail to decorate it. The 🧽 sponge cleans one nail.
4. Use the top buttons any time:
   - ✋ change the hand's skin color
   - 🔊 turn the happy sounds on or off
   - 📸 save a picture of the design
   - 🧼 start over with fresh nails

Every tap gives a little sparkle, a springy pop, and a soft chime. 🎵

## Run it

Just double-click `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Put it on a phone or tablet (including Android)

Because it's a normal, self-contained web page, you can:

- Copy this folder to the device and open `index.html`, **or**
- Host the folder anywhere free (GitHub Pages, Netlify, etc.) and open the link.

Then, in the browser's menu, choose **"Add to Home Screen."** It gets its own
icon and opens full-screen, so it feels just like an app — no app store, no
downloads, no ads.

## Why a web page instead of an app?

It's the simplest thing that works everywhere, needs no installation or app-store
account, and can never sneak in ads or purchases. The whole game is three small
files with no dependencies and no tracking.

## Project layout

```
nail-salon/
├── index.html        # the page
├── css/styles.css    # looks and layout
├── js/game.js        # the game (SVG hand, painting, stickers, sounds)
├── fonts/
│   ├── fredoka.woff2 # the rounded title font (self-hosted for offline use)
│   └── OFL.txt       # its license
└── README.md
```

## Credits

- Everything you see — the hand, the glossy nails, the gems, hearts, stars,
  flowers, and glitter — is drawn with plain SVG and CSS. No image files, no
  tracking, no dependencies.
- Font: **[Fredoka](https://fonts.google.com/specimen/Fredoka)** by Milena
  Brandão & Hafontia, used under the SIL Open Font License 1.1 (see
  `fonts/OFL.txt`). It's bundled locally so the game needs no internet.

Made with love for a 5-year-old who just wants to paint nails in peace. 💅
