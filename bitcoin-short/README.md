# What if you invested $100 in Bitcoin in 2011? — 45s vertical cinematic short

Procedurally generated 1080×1920 (9:16), 30 fps, 45 s video. Everything (3D scenes, lighting, particles, post-processing, soundtrack) is generated from code; no stock footage, no text on screen.

| Time | Scene |
|---|---|
| 0–5 s | Dark 2011 bedroom, CRT glow on a young man's face, push-in to a single gold coin |
| 5–10 s | Hand presses a key, the screen flares, golden light streams out and forms the coin; orbit |
| 10–16 s | Golden chart rockets upward, stacks of coins build under it, camera rises, gold white-out |
| 16–23 s | Crash: chart turns red and collapses, coins rain onto a mirror floor, red strobes, shake, fast cuts |
| 23–30 s | Luxurious marble room, giant floating coin, wall of golden charts rising |
| 30–35 s | Giant coin cracks, shatters into glowing shards and red sparks, rapid pull-back |
| 35–41 s | Gigantic coin in a storm of gold particles, modern mansion and sports cars in the dark |
| 41–45 s | Extreme close-up on a lone coin on a black table, pull back into an empty room, fade to black |

## Rebuild
```bash
npm install                     # three.js
node render.cjs --start 0 --end 45 --out video.mp4          # needs Playwright + Chromium + ffmpeg
python3 audio.py soundtrack.wav                               # numpy-only soundtrack
ffmpeg -i video.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 192k -shortest final.mp4
```
Preview stills: `node render.cjs --stills 3,12,20 --scale 0.5 --outdir stills`
