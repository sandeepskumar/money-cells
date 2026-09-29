# Money Cells brand assets

| File | Use |
|---|---|
| `money-cells-icon.svg/.png` | App icon (1024², full-bleed sky background) |
| `money-cells-mark.svg/.png` | Cellie mascot only, transparent (stickers, avatar, favicon) |
| `money-cells-logo.svg/.png` | Horizontal logo + tagline, transparent |
| `money-cells-splash.svg/.png` | Stacked logo on `#f0f9ff` (splash, store graphics) |
| `money-cells-splash-blue.svg/.png` | App splash screen on `#38bdf8` with "Save it. Grow it!" (copied to `assets/images/splash.png`) |

Text is outlined, so the SVGs need no installed font. To regenerate, run
`python3 build_logo.py <Fredoka-Bold.ttf>` (needs `fonttools`), then export PNGs from the SVGs.
