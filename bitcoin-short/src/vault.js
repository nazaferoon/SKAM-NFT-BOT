// Scenes 5 & 6: the millionaire room, then the giant coin cracks and shatters.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { V, W, H, clamp, lerp, smooth, easeInOut, easeOut, easeIn, easeOutExpo, track, shake, mulberry32, makeCoin, makeCoinMaterials, coinTex, makeGlow, makeBeam, makeDust, makePanelTextures, makePanelMaterial, makePointCloud, canvasTex, fbm } from './lib.js';

const panelTex = makePanelTextures(6, 42);

function marbleTex() {
  return canvasTex(1024, 1024, (ctx, w) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, w);
    const r = mulberry32(8);
    for (let k = 0; k < 26; k++) {
      let x = r() * w, y = r() * w, a = r() * 6.28; ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 0; i < 70; i++) { a += (r() - 0.5) * 0.6; x += Math.cos(a) * 14; y += Math.sin(a) * 14; ctx.lineTo(x, y); }
      ctx.strokeStyle = `rgba(200,180,150,${0.08 + r() * 0.22})`; ctx.lineWidth = 0.5 + r() * 2.2; ctx.stroke();
    }
  }, { srgb: true, repeat: true });
}

function addFloor(scene, opacity = 0.7) {
  const mirror = new Reflector(new THREE.PlaneGeometry(60, 60), { textureWidth: W * 0.5, textureHeight: H * 0.5, color: 0x8c8c8c, clipBias: 0.003 });
  mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
  const mt = marbleTex(); mt.repeat.set(7, 7);
  const film = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0a0908, map: mt, emissive: 0xffffff, emissiveMap: mt, emissiveIntensity: 0.06, roughness: 0.3, metalness: 0.3, transparent: true, opacity }));
  film.rotation.x = -Math.PI / 2; film.position.y = 0.003; film.receiveShadow = true; scene.add(film);
  return { mirror, film };
}

function buildChartWall(scene, { cols = 7, rows = 9, z = -10, color = 0xffc070 } = {}) {
  const panels = []; const r = mulberry32(31); const pw = 1.15, ph = 0.8, gap = 0.12;
  for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
    const mat = makePanelMaterial(panelTex[(c * 3 + rr) % panelTex.length], { color, intensity: 1.2 + r() * 1.0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
    const x = (c - (cols - 1) / 2) * (pw + gap), y = 0.6 + rr * (ph + gap);
    m.position.set(x, y, z + (r() - 0.5) * 0.4); scene.add(m);
    panels.push({ m, mat, x, y, delay: c * 0.12 + rr * 0.22 + r() * 0.3 });
  }
  return panels;
}

export function buildVault(env) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0); scene.fog = new THREE.FogExp2(0x020100, 0.035);
  scene.environment = env; scene.environmentIntensity = 0.55;
  addFloor(scene);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.25, metalness: 0.3 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0a848, roughness: 0.25, metalness: 1 });
  for (const x of [-3.5, 3.5]) for (const z of [1.5, -2.5, -6.5]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 9, 40), pillarMat); p.position.set(x, 4.5, z); scene.add(p);
    for (const y of [0.15, 0.5, 8.6]) { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, y < 0.3 ? 0.3 : 0.08, 40), goldMat); g.position.set(x, y, z); scene.add(g); }
  }
  // ceiling light strips (reflect in the floor)
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb050).multiplyScalar(2.2) });
  for (const x of [-2.2, 2.2]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 22), stripMat); s.position.set(x, 9.2, -3); scene.add(s); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(20, 30), new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.6 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 9.3, -3); scene.add(ceil);
  const panels = buildChartWall(scene);
  // rising light bars behind the coin
  const bars = []; const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb040).multiplyScalar(1.6), transparent: true, opacity: 0.9 });
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1, 0.05), barMat); b.position.set((i - 4) * 0.5, 0, -7.5); scene.add(b); bars.push({ b, h: 1.2 + Math.pow(i / 8, 1.8) * 6.5 * (0.8 + 0.4 * Math.sin(i * 2.1) ** 2) }); }

  const COIN = V(0, 3.3, -3);
  const coin = makeCoin(1.6, 0.2, { bumpScale: 4, roughness: 0.42, seg: 160 }); coin.rotation.x = Math.PI / 2; coin.position.copy(COIN); scene.add(coin);
  const halo = makeGlow(0xffb040, 9, 0.9); halo.position.copy(COIN).add(V(0, 0, -0.8)); scene.add(halo);
  const key = new THREE.SpotLight(0xffe0b0, 260, 0, 0.35, 0.8, 2); key.position.set(2.5, 9, 5); key.target.position.copy(COIN); scene.add(key, key.target);
  const fillL = new THREE.SpotLight(0xffb060, 90, 0, 0.4, 1, 2); fillL.position.set(-5, 2, 4); fillL.target.position.copy(COIN); scene.add(fillL, fillL.target);
  for (const s of [-1, 1]) { const rim = new THREE.SpotLight(0xffa040, 220, 0, 0.4, 0.7, 2); rim.position.set(s * 4.5, 6.5, -7); rim.target.position.copy(COIN); scene.add(rim, rim.target); }
  const under = new THREE.PointLight(0xffa040, 12, 0, 2); under.position.set(0, 0.6, -3); scene.add(under);
  const beam = makeBeam(V(0, 9.3, -3), V(0, 0, -3), 0.5, 1.6, 0xffc070, 0.12); scene.add(beam);
  const dust = makeDust(900, V(0, 4, -2), V(9, 8, 12), { worldSize: 0.018, base: 0.25, boost: 0, amp: 0.25, seed: 4 }); scene.add(dust);
  const cam = new THREE.PerspectiveCamera(46, W / H, 0.05, 100);

  function update(t) {
    panels.forEach(p => {
      const k = easeOut(clamp((t - p.delay * 0.7) / 1.6));
      p.m.position.y = p.y - (1 - k) * 4; p.mat.uniforms.uA.value = k; p.mat.uniforms.uP.value = clamp((t - p.delay * 0.7 - 0.4) / 1.8) * 1.05;
    });
    bars.forEach((b, i) => { const k = easeOut(clamp((t - 0.3 - i * 0.12) / 2.5)); const h = Math.max(0.01, b.h * k); b.b.scale.y = h; b.b.position.y = h / 2; });
    coin.rotation.z = -0.35 + t * 0.12; // spin around its vertical axis (coin is stood up)
    coin.position.y = COIN.y + Math.sin(t * 1.3) * 0.06;
    halo.material.color.setRGB(1, 0.7, 0.3).multiplyScalar(0.7 + 0.15 * Math.sin(t * 2));
    dust.material.uniforms.uTime.value = t; beam.material.uniforms.uTime.value = t;
    const u = easeInOut(t / 7);
    cam.position.set(lerp(-0.6, 0.25, u), lerp(1.2, 2.6, u), lerp(10.5, 3.0, u));
    cam.lookAt(lerp(0, 0, u), lerp(3.6, 3.35, u), -3);
    cam.fov = 46; cam.updateProjectionMatrix();
    return { bloom: [0.85, 0.55, 0.8], exposure: 1.1 };
  }
  return { scene, cam, update, coin };
}

// ---------- shattering coin ----------
function makeShards(R, TH, seed) {
  const r = mulberry32(seed); const NC = 9; const ringR = a => R * (0.46 + 0.07 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7 + 2));
  const angs = []; for (let i = 0; i < NC; i++) angs.push((i + 0.15 + r() * 0.7) / NC * Math.PI * 2);
  const jit = (amp, n) => { const a = []; for (let i = 0; i <= n; i++) a.push((r() - 0.5) * amp); a[0] = 0; a[n] = 0; return a; };
  const P = (rad, ang) => new THREE.Vector2(Math.cos(ang) * rad, Math.sin(ang) * rad);
  const cutsIn = [], cutsOut = [];
  for (const a of angs) {
    const n = 7, j = jit(0.16, n), rr = ringR(a); cutsIn.push(j.map((v, k) => P(rr * k / n, a + (k ? v / (k / n * 3 + 0.4) : 0))));
    const m = 6, j2 = jit(0.1, m); cutsOut.push(j2.map((v, k) => P(lerp(rr, R, k / m), a + v)));
  }
  const ring = (a0, a1) => { const pts = []; let A1 = a1; if (A1 < a0) A1 += Math.PI * 2; const n = 10; for (let k = 0; k <= n; k++) { const a = lerp(a0, A1, k / n); pts.push(P(ringR(a) * (k && k < n ? 1 + (r() - 0.5) * 0.06 : 1), a)); } return pts; };
  const rim = (a0, a1) => { const pts = []; let A1 = a1; if (A1 < a0) A1 += Math.PI * 2; const n = 28; for (let k = 0; k <= n; k++) pts.push(P(R, lerp(a0, A1, k / n))); return pts; };
  const polys = []; const rings = angs.map((a, i) => ring(a, angs[(i + 1) % NC]));
  for (let i = 0; i < NC; i++) {
    const i2 = (i + 1) % NC; const a0 = angs[i], a1 = angs[i2];
    const rg = rings[i];
    polys.push([...cutsIn[i], ...rg.slice(1, -1), ...cutsIn[i2].slice().reverse().slice(0, -1)]);
    polys.push([...cutsOut[i], ...rim(a0, a1).slice(1, -1), ...cutsOut[i2].slice().reverse(), ...rg.slice().reverse().slice(1, -1)]);
  }
  // crack texture: R = mask, G = reveal order
  const tex = canvasTex(1024, 1024, (ctx, w) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, w); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const toPx = p => [(p.x / (2 * R) + 0.5) * w, (1 - (p.y / (2 * R) + 0.5)) * w];
    const stroke = (pts, lw) => { for (let k = 1; k < pts.length; k++) { if (pts[k].length() < R * 0.07) continue; const a = toPx(pts[k - 1]), b = toPx(pts[k]); const ord = Math.min(1, pts[k].length() / R) * 0.85 + 0.05;
      ctx.strokeStyle = `rgb(255,${Math.floor(ord * 255)},0)`; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); } };
    cutsIn.forEach(c => stroke(c, 5)); cutsOut.forEach(c => stroke(c, 4.5));
    rings.forEach(rg => stroke(rg, 4));
    // hairline branches
    for (let k = 0; k < 70; k++) { const a = r() * 6.28, rad = r() * R * 0.95; let p = P(rad, a); const pts = [p]; let d = a + (r() - 0.5) * 2;
      for (let s = 0; s < 5; s++) { d += (r() - 0.5) * 0.9; p = p.clone().add(P(R * 0.035, d)); pts.push(p); } stroke(pts, 1.6); }
  });
  const crackPts = []; [...cutsIn, ...cutsOut].forEach(c => c.forEach(p => crackPts.push(p)));
  return { polys, tex, crackPts };
}

export function buildShatter(env, envRed) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0); scene.fog = new THREE.FogExp2(0x030000, 0.03);
  scene.environment = env; scene.environmentIntensity = 0.6;
  const R = 1.6, TH = 0.2; const { polys, tex, crackPts } = makeShards(R, TH, 2030);
  const [, faceMat] = makeCoinMaterials({ bumpScale: 4, roughness: 0.42 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xc8902e, metalness: 1, roughness: 0.35, emissive: 0xff2a08, emissiveIntensity: 0 });
  const group = new THREE.Group(); group.position.set(0, 0, 0); scene.add(group);
  const shards = []; const r = mulberry32(7);
  for (const poly of polys) {
    const shape = new THREE.Shape(poly);
    const g = new THREE.ExtrudeGeometry(shape, { depth: TH, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, -TH / 2);
    const pos = g.attributes.position, uv = g.attributes.uv; const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), nz = nor.getZ(i);
      if (nz > 0.5) uv.setXY(i, x / (2 * R) + 0.5, y / (2 * R) + 0.5); else if (nz < -0.5) uv.setXY(i, -x / (2 * R) + 0.5, y / (2 * R) + 0.5); }
    const c = new THREE.Vector3(); g.computeBoundingBox(); g.boundingBox.getCenter(c); g.translate(-c.x, -c.y, 0);
    const m = new THREE.Mesh(g, [faceMat, coreMat]); m.position.set(c.x, c.y, 0); group.add(m);
    const dir = V(c.x, c.y, 0).normalize();
    shards.push({ m, c: c.clone(), v: dir.multiplyScalar(1.2 + r() * 2.2).add(V((r() - 0.5) * 0.6, 0.6 + r() * 1.4, (r() - 0.5) * 3)), ax: V(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), w: 1 + r() * 4, d: r() * 0.12 });
  }
  const crackMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uP: { value: 0 }, uI: { value: 6 }, uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float uP,uI,uA; varying vec2 vUv; void main(){ vec3 t=texture2D(map,vUv).rgb; float vis=t.r*smoothstep(t.g,t.g-0.06,uP);
      vec3 col=mix(vec3(1.0,0.12,0.03),vec3(1.0,0.55,0.2),t.r*vis*0.6); gl_FragColor=vec4(col*vis*uI*uA,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const cf = new THREE.Mesh(new THREE.CircleGeometry(R, 96), crackMat); cf.position.z = TH / 2 + 0.004; group.add(cf);
  const cb = cf.clone(); cb.rotation.y = Math.PI; cb.position.z = -TH / 2 - 0.004; cb.scale.x = -1; group.add(cb);
  const halo = makeGlow(0xffa040, 9, 0.8); halo.position.set(0, 0, -1); scene.add(halo);

  // far red chart wall, dying
  const wall = buildChartWall(scene, { cols: 9, rows: 8, z: -14, color: 0xff5030 }); wall.forEach(p => { p.m.position.y -= 3.2; p.m.scale.setScalar(1.4); p.m.position.x *= 1.4; });

  const key = new THREE.SpotLight(0xffd8a0, 200, 0, 0.45, 0.8, 2); key.position.set(3, 6, 6); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  const reds = [V(-5, 3, -3), V(5, -2, -2), V(0, -4, 3)].map(p => { const l = new THREE.PointLight(0xff1a08, 0, 0, 1.5); l.position.copy(p); scene.add(l); return l; });
  const NP = 2600; const sparks = makePointCloud(NP, { color: 0xffffff, size: 0.035 }); scene.add(sparks);
  const sp = []; for (let i = 0; i < NP; i++) { const o = crackPts[Math.floor(r() * crackPts.length)]; const pre = i < 500;
    sp.push({ o: V(o.x, o.y, (r() < 0.5 ? 1 : -1) * TH / 2), v: V(o.x + (r() - 0.5) * 0.8, o.y + (r() - 0.5) * 0.8, (r() - 0.5) * 2).normalize().multiplyScalar(pre ? 0.4 + r() * 0.8 : 2 + r() * 7), t0: pre ? 0.1 + r() * 1.6 : 1.85 + r() * 0.25, life: pre ? 0.6 + r() : 1.5 + r() * 2, s: 0.4 + r() * 1.6, c: [1, 0.15 + r() * 0.45, 0.03 + r() * 0.08] }); }
  const cam = new THREE.PerspectiveCamera(46, W / H, 0.05, 120);
  const BREAK = 1.85;

  function update(t) {
    const crack = smooth(0.1, 1.75, t);
    crackMat.uniforms.uP.value = crack; crackMat.uniforms.uA.value = 1 - smooth(BREAK, BREAK + 0.4, t);
    cf.visible = cb.visible = t < BREAK + 0.5;
    coreMat.emissiveIntensity = 3 * smooth(BREAK - 0.2, BREAK + 0.1, t) * (1 - 0.6 * smooth(2.5, 5, t));
    group.rotation.set(0.05, -0.25 + t * 0.05, 0); group.position.y = Math.sin(t * 1.3) * 0.04;
    shards.forEach(s => { const tau = Math.max(0, t - BREAK - s.d);
      const pre = smooth(1.0, BREAK, t) * 0.02; // shards start separating as cracks grow
      s.m.position.set(s.c.x * (1 + pre) + s.v.x * tau, s.c.y * (1 + pre) + s.v.y * tau - 4.5 * tau * tau, s.v.z * tau);
      s.m.quaternion.setFromAxisAngle(s.ax, s.w * tau); });
    halo.material.color.setRGB(1, lerp(0.7, 0.15, smooth(0.5, BREAK, t)), lerp(0.3, 0.05, smooth(0.5, BREAK, t))).multiplyScalar(0.8 * (1 - smooth(BREAK, BREAK + 1.5, t)) + 1.5 * Math.exp(-Math.max(0, t - BREAK) * 4) * (t > BREAK ? 1 : 0));
    wall.forEach((p, i) => { p.mat.uniforms.uA.value = 0.5 * (1 - smooth(1, 4, t)) * (0.6 + 0.4 * Math.sin(t * 20 + i)); });
    reds.forEach((l, i) => l.intensity = (60 + 40 * Math.sin(t * 13 + i * 2)) * smooth(0, 0.8, t));
    key.intensity = lerp(200, 50, smooth(0.5, 2.5, t)); key.color.setRGB(1, lerp(0.85, 0.35, smooth(0.5, 2, t)), lerp(0.65, 0.2, smooth(0.5, 2, t)));
    scene.environment = t < 1.0 ? env : envRed; scene.environmentIntensity = t < 1 ? 0.6 : 0.4;
    const pa = sparks.geometry.attributes.position.array, aa = sparks.geometry.attributes.aA.array, ca = sparks.geometry.attributes.aC.array, sa = sparks.geometry.attributes.aS.array;
    const gp = new THREE.Vector3();
    sp.forEach((q, i) => { const tau = t - q.t0; const alive = tau > 0 && tau < q.life;
      const k = 1.6; const d = (1 - Math.exp(-k * Math.max(0, tau))) / k;
      gp.set(q.o.x + q.v.x * d, q.o.y + q.v.y * d - 0.6 * tau * tau, q.o.z + q.v.z * d).applyMatrix4(group.matrixWorld);
      pa[i * 3] = gp.x; pa[i * 3 + 1] = gp.y; pa[i * 3 + 2] = gp.z; aa[i] = alive ? 3 * (1 - tau / q.life) : 0; sa[i] = q.s;
      ca[i * 3] = q.c[0]; ca[i * 3 + 1] = q.c[1]; ca[i * 3 + 2] = q.c[2]; });
    sparks.geometry.attributes.position.needsUpdate = sparks.geometry.attributes.aA.needsUpdate = sparks.geometry.attributes.aC.needsUpdate = sparks.geometry.attributes.aS.needsUpdate = true;
    group.updateMatrixWorld();
    // camera: close & shaking, then a rapid pull back
    const pull = easeOutExpo(clamp((t - BREAK + 0.05) / 2.6));
    const dist = lerp(4.6, 17, pull) + lerp(0.0, 0.0, 0);
    const sh = shake(t, 0.015 + 0.05 * smooth(0.5, BREAK, t) + 0.25 * Math.exp(-Math.max(0, t - BREAK) * 3) * (t > BREAK ? 1 : 0), 6, 16);
    cam.position.set(lerp(0.4, 1.2, pull), lerp(0.15, 1.6, pull), dist).add(sh);
    cam.lookAt(V(0, lerp(0, -1.2, pull), 0).add(sh.multiplyScalar(0.5)));
    cam.fov = lerp(42, 50, pull); cam.updateProjectionMatrix();
    const brk = t > BREAK ? Math.exp(-(t - BREAK) * 7) : 0;
    return { bloom: [1.0 + brk * 1.5, 0.6, 0.7], exposure: 1.1, flash: brk * 0.4, flashColor: [1, 0.25, 0.08], ca: 0.003 + 0.02 * brk + 0.004 * smooth(0.5, BREAK, t), red: 0.05 * smooth(0.5, 2, t) };
  }
  return { scene, cam, update };
}
