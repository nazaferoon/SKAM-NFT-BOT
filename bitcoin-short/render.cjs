// Frame-accurate renderer: drives the three.js page in headless Chromium and pipes frames to ffmpeg.
// usage: node render.cjs --start 0 --end 45 --fps 30 --scale 1 --out out.mp4
//        node render.cjs --stills 1,7.5,12 --scale 0.5 --outdir stills
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') && a.push([v.slice(2), arr[i + 1]]), a), []));
const ROOT = __dirname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});
(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const scale = parseFloat(args.scale || '1');
  const W = Math.round(1080 * scale), H = Math.round(1920 * scale);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/index.html?scale=${scale}`);
  await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  const grab = async t => Buffer.from((await page.evaluate(t => window.renderFrame(t), t)).split(',')[1], 'base64');
  if (args.stills) {
    const dir = args.outdir || 'stills'; fs.mkdirSync(dir, { recursive: true });
    for (const s of args.stills.split(',')) {
      const t0 = Date.now(); const buf = await grab(parseFloat(s));
      fs.writeFileSync(path.join(dir, `t${parseFloat(s).toFixed(2)}.jpg`), buf);
      console.log(`still ${s}s in ${Date.now() - t0}ms`);
    }
  } else {
    const fps = parseFloat(args.fps || '30'), start = parseFloat(args.start || '0'), end = parseFloat(args.end || '45');
    const f0 = Math.round(start * fps), f1 = Math.round(end * fps);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(fps), args.out || 'out.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
    const tStart = Date.now();
    for (let f = f0; f < f1; f++) {
      const buf = await grab(f / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 30 === 0) console.log(`${args.out}: frame ${f - f0}/${f1 - f0}  ${((Date.now() - tStart) / (f - f0 + 1)).toFixed(0)}ms/frame`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
