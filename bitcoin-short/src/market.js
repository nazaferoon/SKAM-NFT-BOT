// Scenes 3 & 4: the golden chart explosion and the first crash.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { V, W, H, clamp, lerp, smooth, easeInOut, easeOut, easeIn, track, shake, mulberry32, makeCoinGeometry, makeCoinMaterials, makeGlow, makeChartLine, makeChartFill, makeGrid, chartCurve, ballistic, makeDust, fbm } from './lib.js';

const X0 = -1.15, X1 = 1.15, YMAX = 7.6;
const curve = chartCurve(2011, 70, X0, X1, YMAX);
const spaced = curve.getSpacedPoints(800);
const yAtX = x => { let best = spaced[0]; for (const p of spaced) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; return best.y; };

// coin stacks under the curve (bar chart made of coins)
const STACK_R = 0.105, STACK_T = 0.04, STEP = 0.043;
const NCOL = 9; const stacks = [];
for (let k = 0; k < NCOL; k++) { const x = lerp(X0 + 0.12, X1 - 0.12, k / (NCOL - 1)); const h = yAtX(x) - 0.06; stacks.push({ x, n: Math.max(1, Math.floor(h / STEP)) }); }
const STACK_COINS = stacks.reduce((a, s) => a + s.n, 0);

const progAt = t => Math.pow(clamp((t - 0.25) / 4.9), 1.25);
const timeAtProg = p => 0.25 + 4.9 * Math.pow(p, 1 / 1.25);
const progAtX = x => { // arc-length fraction of first point reaching x
  for (let i = 0; i < spaced.length; i++) if (spaced[i].x >= x) return i / (spaced.length - 1); return 1;
};

function setInst(mesh, i, p, q, s) { const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(s, s, s)); mesh.setMatrixAt(i, m); }
const Q = new THREE.Quaternion(), E = new THREE.Euler();

export function buildRise(env) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0); scene.fog = new THREE.FogExp2(0x020100, 0.055);
  scene.environment = env; scene.environmentIntensity = 0.75;
  const line = makeChartLine(curve, { radius: 0.02, intensity: 2.4 }); scene.add(line);
  const fill = makeChartFill(curve, { intensity: 0.22 }); scene.add(fill);
  const ghosts = [];
  for (let k = 0; k < 3; k++) {
    const c = chartCurve(77 + k, 50, -3 + k, 3 - k * 0.5, YMAX * (0.8 + k * 0.15));
    const g = makeChartLine(c, { radius: 0.01, intensity: 0.9 - k * 0.2, color: 0xffa030 }); g.position.z = -2.5 - k * 2.2; g.position.x = (k - 1) * 1.4; scene.add(g); ghosts.push(g);
  }
  const floorGrid = makeGrid(30, 30, { intensity: 0.22, cell: 0.4, fadeR: 9 }); floorGrid.rotation.x = -Math.PI / 2; scene.add(floorGrid);
  const wallGrid = makeGrid(14, 24, { intensity: 0.07, cell: 0.4, fadeR: 12 }); wallGrid.position.set(0, 6, -1.2); scene.add(wallGrid);
  const tip = makeGlow(0xffc060, 0.9, 3); scene.add(tip);
  const tipLight = new THREE.PointLight(0xffb040, 6, 0, 2); scene.add(tipLight);
  const key = new THREE.DirectionalLight(0xffd8a0, 1.2); key.position.set(3, 6, 5); scene.add(key);
  const rimL = new THREE.SpotLight(0xffa040, 80, 0, 0.6, 1, 2); rimL.position.set(-4, 9, -4); rimL.target.position.set(0, 3, 0); scene.add(rimL, rimL.target);

  const geo = makeCoinGeometry(STACK_R, STACK_T, 40); const mats = makeCoinMaterials({ bumpScale: 2, roughness: 0.45 });
  const stackMesh = new THREE.InstancedMesh(geo, mats, STACK_COINS); stackMesh.frustumCulled = false; scene.add(stackMesh);
  const r = mulberry32(5);
  const sc = []; // stack coin info
  stacks.forEach(s => { const p0 = progAtX(s.x); const tEnd = timeAtProg(Math.min(1, p0 + 0.01)); const tStart = Math.max(0.15, tEnd - 0.9);
    for (let j = 0; j < s.n; j++) sc.push({ x: s.x + (r() - 0.5) * 0.012, z: (r() - 0.5) * 0.012, y: STACK_T / 2 + j * STEP, t: lerp(tStart, tEnd, j / s.n), yaw: r() * 6.28, tilt: (r() - 0.5) * 0.04 }); });
  const NF = 160; const floatMesh = new THREE.InstancedMesh(geo, mats, NF); floatMesh.frustumCulled = false; scene.add(floatMesh);
  const fc = []; for (let i = 0; i < NF; i++) fc.push({ x: (r() - 0.5) * 6, z: -0.5 - r() * 4 + (r() < 0.3 ? 3 : 0), y: r() * 10, t: 0.3 + r() * 5, sp: 0.2 + r() * 0.5, rot: V(r() * 3, r() * 3, r() * 3), s: 0.7 + r() * 0.8 });
  const dust = makeDust(700, V(0, 5, 0), V(8, 12, 6), { worldSize: 0.012, base: 0.25, boost: 0, amp: 0.2, color: 0xffc070, seed: 9 }); scene.add(dust);
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 80);

  function update(t) {
    const p = progAt(t);
    line.userData.setProgress(p); ghosts.forEach((g, k) => g.userData.setProgress(clamp(p * 1.1 - k * 0.05)));
    const tp = curve.getPointAt(clamp(p, 0.001, 1)); tip.position.copy(tp); tipLight.position.copy(tp).add(V(0, 0.2, 0.5)); fill.material.uniforms.uTipX.value = tp.x;
    const end = smooth(5.4, 5.98, t);
    tip.scale.setScalar(0.9 + 0.2 * Math.sin(t * 9) + end * 14); tip.material.color.setRGB(1, 0.75, 0.38).multiplyScalar(1.4 + end * 6);
    tipLight.intensity = 6 + end * 60;
    sc.forEach((c, i) => {
      const k = clamp((t - c.t) / 0.28); const vis = t >= c.t;
      E.set(c.tilt + (1 - k) * 1.2, c.yaw + (1 - k) * 2, c.tilt * 0.5); Q.setFromEuler(E);
      setInst(stackMesh, i, V(c.x, c.y + (1 - easeOut(k)) * 0.5, c.z), Q, vis ? lerp(0.5, 1, easeOut(k)) : 0);
    });
    stackMesh.instanceMatrix.needsUpdate = true;
    fc.forEach((c, i) => {
      const a = clamp((t - c.t) / 0.5); const tt = t - c.t;
      E.set(c.rot.x * t, c.rot.y * t, c.rot.z * t); Q.setFromEuler(E);
      setInst(floatMesh, i, V(c.x + Math.sin(t * 0.5 + i) * 0.1, c.y + tt * c.sp, c.z), Q, t > c.t ? easeOut(a) * c.s : 0);
    });
    floatMesh.instanceMatrix.needsUpdate = true;
    dust.material.uniforms.uTime.value = t;
    // camera rises with the tip
    const ly = lerp(1.1, tp.y * 0.92, smooth(0.6, 5.2, t)) + 0.6 * end;
    const ang = lerp(-0.35, 0.3, easeInOut(t / 6));
    const dist = lerp(5.4, 6.4, smooth(1, 5.5, t)) - end * 1.5;
    cam.position.set(Math.sin(ang) * dist + 0.2, ly + lerp(-0.4, 0.9, smooth(0, 5, t)), Math.cos(ang) * dist);
    cam.lookAt(lerp(0, tp.x * 0.7, smooth(0.5, 5, t)), ly, 0);
    cam.fov = 50 - end * 6; cam.updateProjectionMatrix();
    return { bloom: [1.0 + end * 2.2, 0.6 + end * 0.3, 0.75 - end * 0.5], exposure: 1.1 + end * 2.5, flash: end * end * 0.75 };
  }
  return { scene, cam, update };
}

export function buildCrash(env) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0); scene.fog = new THREE.FogExp2(0x030000, 0.05);
  scene.environment = env; scene.environmentIntensity = 0.45;
  const mirror = new Reflector(new THREE.PlaneGeometry(40, 40), { textureWidth: W * 0.5, textureHeight: H * 0.5, color: 0x8a8a8a, clipBias: 0.003 });
  mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
  const film = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.25, metalness: 0.4, transparent: true, opacity: 0.62 }));
  film.rotation.x = -Math.PI / 2; film.position.y = 0.002; film.receiveShadow = true; scene.add(film);
  const grid = makeGrid(30, 30, { intensity: 0.08, cell: 0.4, fadeR: 8, color: 0xff3010 }); grid.rotation.x = -Math.PI / 2; grid.position.y = 0.004; scene.add(grid);

  // the golden chart split into falling pieces
  const NPIECE = 46; const pieces = []; const pieceMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb340).multiplyScalar(2.6) });
  const r = mulberry32(17);
  for (let i = 0; i < NPIECE; i++) {
    const u0 = i / NPIECE, u1 = (i + 1) / NPIECE; const pts = []; for (let k = 0; k <= 12; k++) pts.push(curve.getPointAt(lerp(u0, u1, k / 12)));
    const mid = curve.getPointAt((u0 + u1) / 2); const sub = new THREE.CatmullRomCurve3(pts.map(p => p.clone().sub(mid)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(sub, 24, 0.024, 8, false), pieceMat); m.position.copy(mid); scene.add(m);
    const dir = pts[12].clone().sub(pts[0]); const a0 = Math.atan2(dir.y, dir.x);
    pieces.push({ m, mid, u: (u0 + u1) / 2, a0, w: (r() - 0.5) * 8, vx: (r() - 0.5) * 1.6, vz: (r() - 0.5) * 1.6, len: dir.length() });
  }
  // red crash line plunging from the peak
  const peak = curve.getPointAt(1);
  const crashPts = [peak.clone()]; let cy = peak.y; let cx = peak.x;
  for (let i = 0; i < 16; i++) { cx += 0.03 + r() * 0.03; cy -= (peak.y - 0.6) / 16 * (0.6 + r() * 0.8) * (i % 3 === 1 ? -0.35 : 1.2); crashPts.push(V(cx, Math.max(0.5, cy), 0)); }
  crashPts[crashPts.length - 1].y = 0.5;
  const crashCurve = new THREE.CatmullRomCurve3(crashPts, false, 'catmullrom', 0.1);
  const crashLine = makeChartLine(crashCurve, { radius: 0.03, intensity: 7, color: 0xff2008, segs: 300 }); scene.add(crashLine);
  const crashTip = makeGlow(0xff3010, 1.2, 4); scene.add(crashTip);

  // coins: stack coins scatter + coins raining onto the mirror floor
  const geo = makeCoinGeometry(STACK_R, STACK_T, 40); const mats = makeCoinMaterials({ bumpScale: 2, roughness: 0.4 });
  const N = STACK_COINS + 260; const coins = new THREE.InstancedMesh(geo, mats, N); coins.frustumCulled = false; scene.add(coins);
  const cd = [];
  stacks.forEach(s => { for (let j = 0; j < s.n; j++) { const y = STACK_T / 2 + j * STEP; const h = y / YMAX;
    cd.push({ p0: V(s.x, y, 0), v0: V((r() - 0.5) * 2.6, r() * 1.2, (r() - 0.5) * 2.8 + 0.4), t0: 0.75 + (1 - h) * 0.4 + r() * 0.9 + (j < 3 ? 1.0 : 0), stack: true, ax: V(r() * 9, r() * 9, r() * 9), yaw: r() * 6.28 }); } });
  for (let i = 0; i < 260; i++) cd.push({ p0: V((r() - 0.5) * 5, 7 + r() * 6, (r() - 0.5) * 4), v0: V(0, -r() * 2, 0), t0: 0.6 + r() * 5.2, stack: false, ax: V(r() * 9, r() * 9, r() * 9), yaw: r() * 6.28 });
  const qFlat = new THREE.Quaternion(), q = new THREE.Quaternion();

  // lighting: red alarm strobes
  const reds = [V(-3, 3, 2), V(3, 5, -2), V(0, 1.2, 4)].map((p, i) => { const l = new THREE.PointLight(0xff1a08, 0, 0, 1.6); l.position.copy(p); scene.add(l); return l; });
  const redSpot = new THREE.SpotLight(0xff2010, 0, 0, 0.7, 0.8, 1.5); redSpot.position.set(0, 10, 3); redSpot.target.position.set(0, 0, 0); scene.add(redSpot, redSpot.target);
  const gold = new THREE.DirectionalLight(0xffcf90, 1.5); gold.position.set(3, 6, 5); scene.add(gold);
  const embers = makeDust(600, V(0, 3, 0), V(7, 7, 5), { worldSize: 0.012, base: 0.4, boost: 0, amp: 0.25, color: 0xff4020, seed: 21 }); scene.add(embers);
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.03, 80);

  const shots = [
    { t: 0.0, p: [[2.6, 1.0, 9.0], [2.2, 1.2, 8.2]], l: [[0.3, 4.6, 0], [0.2, 4.0, 0]], fov: 55 },
    { t: 1.3, p: [[0.9, 0.22, 2.6], [0.65, 0.2, 2.2]], l: [[-0.1, 0.5, 0], [-0.2, 0.45, 0]], fov: 48 },
    { t: 2.3, p: [[-2.6, 7.2, 4.2], [-2.2, 6.4, 3.8]], l: [[0.6, 4.5, 0], [0.5, 3.6, 0]], fov: 50 },
    { t: 3.3, p: [[-3.2, 0.5, 3.4], [-2.6, 0.55, 3.0]], l: [[0.5, 1.0, 0], [0.4, 0.8, 0]], fov: 50 },
    { t: 4.4, p: [[1.8, 3.2, 6.2], [0.4, 1.4, 3.6]], l: [[0.3, 1.4, 0], [0.0, 0.5, 0]], fov: 50 },
  ];

  function update(t) {
    // red strobes
    const strobe = (k, f, ph) => Math.pow(Math.max(0, Math.sin(t * f + ph)), 6);
    reds[0].intensity = 14 * strobe(0, 9, 0) * smooth(0.4, 0.8, t); reds[1].intensity = 22 * strobe(1, 7, 1.7) * smooth(0.5, 1, t); reds[2].intensity = 2 + 8 * strobe(2, 11, 3.1);
    redSpot.intensity = 60 * (0.4 + 0.6 * strobe(3, 4.5, 0.4)) * smooth(0.3, 1.0, t);
    gold.intensity = lerp(2.0, 0.25, smooth(0.3, 2, t));
    scene.environmentIntensity = lerp(0.6, 0.3, smooth(0.3, 2, t));
    // chart: gold -> red, then collapses top first
    const red = smooth(0.35, 1.3, t);
    pieceMat.color.setRGB(lerp(1.0, 1.0, red), lerp(0.7, 0.12, red), lerp(0.25, 0.04, red)).multiplyScalar(lerp(2.6, 2.2, red) * (0.85 + 0.15 * Math.sin(t * 40)));
    pieces.forEach(pc => {
      const tf = 0.65 + (1 - pc.u) * 1.6; const tau = Math.max(0, t - tf);
      const fall = ballistic(pc.mid, V(pc.vx, 0.4, pc.vz), tau, { g: -9.8, floorY: 0.03, e: 0.25, friction: 0.5, maxB: 2 });
      pc.m.position.copy(fall.p);
      let ang = pc.w * Math.min(tau, fall.tLand || tau);
      if (fall.landed) { const target = Math.round((pc.a0 + ang) / Math.PI) * Math.PI - pc.a0; ang = lerp(ang, target, smooth(0, 0.25, tau - fall.tLand)); }
      pc.m.rotation.set(0, pc.vx * tau * 0.3, ang);
      if (tau > 0) pc.m.rotation.y = Math.atan2(pc.vz, 1) * 0.6;
    });
    crashLine.userData.setProgress(easeIn(smooth(0.45, 1.6, t)) * 0.6 + 0.4 * smooth(0.45, 1.6, t));
    const cp = crashCurve.getPointAt(clamp(smooth(0.45, 1.6, t), 0.001, 1)); crashTip.position.copy(cp);
    crashLine.material.color.setRGB(1, 0.12, 0.03).multiplyScalar(3.5 * (0.7 + 0.3 * Math.sin(t * 25)));
    crashTip.material.color.setRGB(1, 0.15, 0.05).multiplyScalar(4 * smooth(0.4, 0.6, t));
    // coins
    cd.forEach((c, i) => {
      const tau = t - c.t0;
      if (c.stack && tau < 0) { qFlat.setFromEuler(E.set(0, c.yaw, 0)); setInst(coins, i, c.p0, qFlat, 1); return; }
      if (!c.stack && tau < 0) { setInst(coins, i, c.p0, qFlat, 0); return; }
      const b = ballistic(c.p0, c.v0, tau, { g: -9.8, floorY: STACK_T / 2, e: 0.38, friction: 0.6, maxB: 3 });
      E.set(c.ax.x * tau, c.ax.y * tau, c.ax.z * tau); q.setFromEuler(E);
      if (b.landed) { qFlat.setFromEuler(E.set(0, c.yaw, 0)); q.slerp(qFlat, smooth(b.tLand - 0.1, b.tLand + 0.6, tau)); }
      setInst(coins, i, b.p, q, 1);
    });
    coins.instanceMatrix.needsUpdate = true;
    embers.material.uniforms.uTime.value = t * 2;
    // fast cuts with camera shake
    let si = 0; while (si + 1 < shots.length && t >= shots[si + 1].t) si++;
    const s = shots[si], sEnd = si + 1 < shots.length ? shots[si + 1].t : 7; const u = easeInOut((t - s.t) / (sEnd - s.t));
    const amp = 0.03 + 0.16 * Math.exp(-(t - s.t) * 3.5) + 0.05 * smooth(0.5, 1.0, t) * (1 - smooth(4, 6, t));
    const sh = shake(t, amp, 3, 14);
    cam.position.set(...s.p[0].map((v, j) => lerp(v, s.p[1][j], u))).add(sh);
    cam.lookAt(V(...s.l[0].map((v, j) => lerp(v, s.l[1][j], u))).add(sh.multiplyScalar(0.6)));
    cam.rotation.z += fbm(t * 8, 9) * amp * 0.3;
    cam.fov = s.fov; cam.updateProjectionMatrix();
    const cutFlash = Math.exp(-(t - s.t) * 14) * (si > 0 ? 1 : 0);
    return { bloom: [1.1, 0.55, 0.7], exposure: 1.2, ca: 0.002 + 0.008 * Math.exp(-(t - s.t) * 6), red: 0.08 + 0.1 * cutFlash, flash: 0.35 * cutFlash, flashColor: [1, 0.2, 0.08] };
  }
  return { scene, cam, update };
}
