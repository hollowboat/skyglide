# Flappy Game — Setup Notes

## 1. Add your assets

Drop these files into the matching folders (exact names, case-sensitive):

**`images/`**
- `Background.png` — opening/menu background, ideally a 16:9 image
- `Pipe.png` — downward-facing pipe (used for the bottom pipe as-is, and
  rotated 180° for the top pipe — code already handles this in `js/game.js`)
- `Level1.png` ... `Level12.png` — the 12 bird skins (square images work best)

**`sounds/`**
- `ding.mp3` — the point-scoring sound effect

The game runs fine without them (canvas falls back to colored shapes for
the bird/pipes), but you'll want the real art in before shipping.

## 2. Firebase Rules

Make sure your Realtime Database rules match the ones we discussed —
`/users/{uid}` private per-user, `/leaderboard` public-read/owner-write,
everything else locked down. If you haven't pasted those into the
Firebase Console yet (Realtime Database → Rules tab), do that before
testing login, or all reads/writes will be denied.

## 3. Enable Google Sign-In

In the Firebase Console: **Authentication → Sign-in method → Google → Enable**.
Also add your hosting domain (GitHub Pages URL, or your Firebase Hosting
domain) under **Authentication → Settings → Authorized domains**, or the
Google popup will fail with an `auth/unauthorized-domain` error.

## 4. Run it

This is a plain static site — no build step needed.
- **Locally**: just open `index.html` in a browser, or run a tiny local
  server (`python3 -m http.server`) since some browsers restrict
  `file://` audio/canvas behavior.
- **GitHub Pages**: push this folder to a repo, enable Pages on the
  `main` branch root.
- **Firebase Hosting**: `firebase init hosting` (point public dir at this
  folder), then `firebase deploy`.

## 5. File structure

```
index.html
style.css
js/
  firebase-init.js   — Firebase config + SDK init
  storage.js         — localStorage helpers (guest state)
  auth.js            — Google login, merge local → Firebase
  leaderboard.js      — submit score, trim to top 30, fetch top 30, rank progress
  skins.js           — skin prices, sequential unlock, tier logic
  game.js            — Flappy Bird canvas game loop, pipes, scoring, difficulty
  ui.js              — screen switching, HUD, game-over logic, skins grid
  main.js            — button wiring / entry point
images/              — put your art here (see above)
sounds/              — put ding.mp3 here
```

## Known simplifications (flag these if they matter to you)

- **Score validation is client-only.** A determined player could edit the
  JS to submit fake scores. Fine for a casual leaderboard; if you want it
  cheat-proof, that needs a Cloud Function validating scores server-side.
- **Leaderboard trimming** runs after each write from the client, with a
  small window where two near-simultaneous top-30 submissions could
  briefly leave 31 entries before the next trim call cleans it up.
- **HUD ego tracker** uses a *cached* Top 30 snapshot fetched once per
  run (not a live listener), per your "no errors" preference — it won't
  reflect other players' scores that change mid-run, which is a fine
  tradeoff for a fast-paced game.
