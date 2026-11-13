import * as THREE from 'three';

export const params = new URLSearchParams(location.search);
export const SCALE = parseFloat(params.get('scale') || '1');
export const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
export const PX = H * 1.05; // point-size scale (approx. pixels per world unit at distance 1)

// ---------- math helpers ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeInOut = t => (t = clamp(t), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = t => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = t => Math.pow(clamp(t), 3);
export const easeOutExpo = t => (t = clamp(t), t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = n => { const s = Math.sin((n + seed * 57.13) * 127.1 + seed * 3.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u;
}
export const fbm = (x, seed = 0) => vnoise(x, seed) * 0.6 + vnoise(x * 2.3, seed + 3) * 0.3 + vnoise(x * 5.1, seed + 7) * 0.1;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Catmull-Rom interpolation over keyframes [{t, v:[...]}]
export function track(keys, t) {
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v.slice();
  let i = 0; while (keys[i + 1].t < t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = (t - k1.t) / (k2.t - k1.t);
  return k1.v.map((_, j) => {
    const p0 = k0.v[j], p1 = k1.v[j], p2 = k2.v[j], p3 = k3.v[j];
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  });
}
export function shake(t, amp, seed = 1, freq = 9) {
  return new THREE.Vector3(fbm(t * freq, seed) * amp, fbm(t * freq, seed + 11) * amp, fbm(t * freq, seed + 23) * amp * 0.5);
}

// ---------- textures ----------
export function canvasTex(w, h, draw, { srgb = false, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const glowTex = canvasTex(256, 256, (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
});

export function makeGlow(color, size, intensity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color).multiplyScalar(intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}

// Bitcoin emblem drawn with paths (a currency symbol, no font/text rendering)
export function drawBitcoinSymbol(ctx, cx, cy, s, lw) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(14 * Math.PI / 180);
  ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  const L = -0.17 * s, T = -0.30 * s, M = -0.02 * s, B = 0.30 * s;
  ctx.beginPath();
  ctx.moveTo(L - 0.09 * s, T); ctx.lineTo(0.06 * s, T);
  ctx.arc(0.06 * s, (T + M) / 2, (M - T) / 2, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(L, M);
  ctx.moveTo(0.06 * s, M); ctx.lineTo(0.09 * s, M);
  ctx.arc(0.09 * s, (M + B) / 2, (B - M) / 2, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(L - 0.09 * s, B);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L, T - lw * 0.3); ctx.lineTo(L, B + lw * 0.3); ctx.stroke();
  for (const x of [-0.06 * s, 0.05 * s]) { ctx.beginPath(); ctx.moveTo(x, T - 0.11 * s); ctx.lineTo(x, T); ctx.moveTo(x, B); ctx.lineTo(x, B + 0.11 * s); ctx.stroke(); }
  ctx.restore();
}

// coin face: three passes (color / bump / roughness) of the same layout
function drawFace(ctx, S, pal, blur) {
  const c = S / 2, R = S / 2;
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, S, S);
  const circ = (r, fill) => { ctx.beginPath(); ctx.arc(c, c, r * R, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  // rim with bevel
  const g = ctx.createRadialGradient(c, c, 0.86 * R, c, c, 1.0 * R);
  g.addColorStop(0, pal.rimLo); g.addColorStop(0.35, pal.rimHi); g.addColorStop(0.8, pal.rimHi); g.addColorStop(1, pal.rimLo);
  circ(1.0, g);
  circ(0.865, pal.groove);
  circ(0.835, pal.field);
  // brushed concentric texture on field
  const rr = mulberry32(pal.seed || 7);
  for (let i = 0; i < 260; i++) {
    ctx.beginPath(); ctx.arc(c, c, rr() * 0.83 * R, 0, Math.PI * 2);
    ctx.strokeStyle = pal.brush(rr()); ctx.lineWidth = 0.6 + rr() * 1.2; ctx.stroke();
  }
  // dotted ring in groove
  ctx.fillStyle = pal.raised;
  for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; ctx.beginPath(); ctx.arc(c + Math.cos(a) * 0.85 * R, c + Math.sin(a) * 0.85 * R, 0.0085 * R, 0, Math.PI * 2); ctx.fill(); }
  // inner engraved ring
  ctx.beginPath(); ctx.arc(c, c, 0.74 * R, 0, Math.PI * 2); ctx.strokeStyle = pal.raised; ctx.lineWidth = 0.014 * R; ctx.stroke();
  ctx.beginPath(); ctx.arc(c, c, 0.71 * R, 0, Math.PI * 2); ctx.strokeStyle = pal.ring2; ctx.lineWidth = 0.005 * R; ctx.stroke();
  // symbol with soft shadow (fake AO)
  if (pal.shadow) { ctx.shadowColor = pal.shadow; ctx.shadowBlur = 0.03 * R; }
  ctx.strokeStyle = pal.symbol; drawBitcoinSymbol(ctx, c, c, 1.05 * R, 0.1 * R);
  ctx.shadowBlur = 0;
  if (blur) { const tmp = document.createElement('canvas'); tmp.width = tmp.height = S; const t = tmp.getContext('2d'); t.filter = `blur(${blur}px)`; t.drawImage(ctx.canvas, 0, 0); ctx.clearRect(0, 0, S, S); ctx.drawImage(tmp, 0, 0); }
}

const S = 1024;
export const coinTex = {
  color: canvasTex(S, S, ctx => drawFace(ctx, S, {
    bg: '#000', rimLo: '#8a5f18', rimHi: '#ffd77a', groove: '#5a3c0c', field: '#b07c22',
    brush: v => `rgba(${v > 0.5 ? '255,220,140' : '60,35,5'},0.10)`, raised: '#f4c860', ring2: '#e0b050', symbol: '#ffd36e', shadow: 'rgba(40,20,0,0.9)'
  }), { srgb: true }),
  bump: canvasTex(S, S, ctx => drawFace(ctx, S, {
    bg: '#000', rimLo: '#777', rimHi: '#e8e8e8', groove: '#3a3a3a', field: '#6a6a6a',
    brush: v => `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},0.05)`, raised: '#d0d0d0', ring2: '#a0a0a0', symbol: '#ffffff'
  }, 1.6)),
  rough: canvasTex(S, S, ctx => drawFace(ctx, S, {
    bg: '#fff', rimLo: '#606060', rimHi: '#404040', groove: '#c0c0c0', field: '#a8a8a8',
    brush: v => `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},0.12)`, raised: '#484848', ring2: '#606060', symbol: '#3a3a3a'
  })),
  sideColor: canvasTex(2048, 64, (ctx, w, h) => {
    ctx.fillStyle = '#d9a640'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { ctx.fillStyle = 'rgba(70,40,5,0.55)'; ctx.fillRect(i / 220 * w, 6, w / 220 * 0.45, h - 12); }
    ctx.fillStyle = '#f2c868'; ctx.fillRect(0, 0, w, 6); ctx.fillRect(0, h - 6, w, 6);
  }, { srgb: true }),
  sideBump: canvasTex(2048, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ccc'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { ctx.fillStyle = '#333'; ctx.fillRect(i / 220 * w, 6, w / 220 * 0.45, h - 12); }
  }),
};

export function makeCoinMaterials({ bumpScale = 3, emissive = 0x000000, roughness = 0.55, envMapIntensity = 1 } = {}) {
  const face = new THREE.MeshStandardMaterial({ color: 0xffffff, map: coinTex.color, bumpMap: coinTex.bump, bumpScale, roughnessMap: coinTex.rough, roughness, metalness: 1, emissive, envMapIntensity });
  const side = new THREE.MeshStandardMaterial({ color: 0xffffff, map: coinTex.sideColor, bumpMap: coinTex.sideBump, bumpScale: bumpScale * 0.5, roughness: 0.3, metalness: 1, emissive, envMapIntensity });
  return [side, face, face];
}

// Cylinder coin with face UVs remapped so the emblem is upright when the coin is stood up (rotation.x = PI/2) and seen from +Z.
export function makeCoinGeometry(r, th, seg = 96) {
  const g = new THREE.CylinderGeometry(r, r, th, seg, 1, false);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i);
    if (ny > 0.5) uv.setXY(i, pos.getX(i) / (2 * r) + 0.5, -pos.getZ(i) / (2 * r) + 0.5);
    else if (ny < -0.5) uv.setXY(i, -pos.getX(i) / (2 * r) + 0.5, -pos.getZ(i) / (2 * r) + 0.5);
  }
  return g;
}
export function makeCoin(r, th, opts = {}) {
  const m = new THREE.Mesh(makeCoinGeometry(r, th, opts.seg || 96), opts.materials || makeCoinMaterials(opts));
  m.castShadow = true; m.receiveShadow = true; return m;
}

// ---------- environment maps (studio softboxes for metal reflections) ----------
export function makeEnv(renderer, mode = 'gold') {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x030202, side: THREE.BackSide })));
  const panel = (w, h, p, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  };
  const warm = mode === 'red' ? 0xff3010 : 0xffd9a0, deep = mode === 'red' ? 0xff1000 : 0xffa030;
  panel(26, 8, [0, 32, 4], warm, 6);
  panel(4, 34, [-28, 2, 6], warm, 5);
  panel(4, 34, [28, 0, -6], deep, 4);
  panel(12, 12, [0, 6, 32], warm, 2.5);
  panel(18, 3, [0, -22, -20], deep, 2);
  panel(6, 6, [-18, 18, -20], deep, 3);
  if (mode === 'desk') { panel(60, 60, [0, -30, 0], 0xffb060, 0.35); panel(30, 10, [0, 8, -30], 0xffc080, 1.2); }
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.03).texture; pm.dispose(); return tex;
}

// ---------- volumetric light cone ----------
export function makeBeam(from, to, r0, r1, color, intensity = 1) {
  const h = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(r0, r1, h, 64, 24, true); geo.translate(0, -h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity }, uTime: { value: 0 }, uH: { value: h } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vT; varying vec3 vP; uniform float uH;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vT=-position.y/uH; vP=position; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uIntensity; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vT; varying vec3 vP;
      void main(){ float e=abs(dot(normalize(vN),normalize(vV))); e=pow(e,2.2);
        float fall=mix(1.0,0.35,vT)*smoothstep(0.0,0.06,vT)*smoothstep(1.0,0.8,vT);
        float a=atan(vP.x,vP.z); float streak=0.75+0.25*sin(a*7.0+vT*3.0+uTime*0.4)*sin(a*3.0-uTime*0.25);
        gl_FragColor=vec4(uColor*uIntensity*e*fall*streak,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from); m.quaternion.setFromUnitVectors(V(0, -1, 0), to.clone().sub(from).normalize());
  m.renderOrder = 10; return m;
}

// ---------- floating dust / particles ----------
export function makeDust(n, center, size, { color = 0xffcc80, worldSize = 0.006, seed = 3, base = 0.15, boost = 1.5, amp = 0.05, beam = null } = {}) {
  const r = mulberry32(seed);
  const pos = new Float32Array(n * 3), ph = new Float32Array(n * 3), sc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = center.x + (r() - 0.5) * size.x; pos[i * 3 + 1] = center.y + (r() - 0.5) * size.y; pos[i * 3 + 2] = center.z + (r() - 0.5) * size.z;
    ph[i * 3] = r(); ph[i * 3 + 1] = r(); ph[i * 3 + 2] = r(); sc[i] = 0.4 + r() * r() * 1.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sc, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: worldSize }, uPx: { value: PX }, uAmp: { value: amp },
      uBase: { value: base }, uBoost: { value: boost }, uBeamOn: { value: beam ? 1 : 0 },
      uBA: { value: beam ? beam.from : V(0, 0, 0) }, uBB: { value: beam ? beam.to : V(0, 1, 0) }, uR0: { value: beam ? beam.r0 : 0 }, uR1: { value: beam ? beam.r1 : 0 }, uFade: { value: 1 },
    },
    vertexShader: `attribute vec3 aPh; attribute float aS; uniform float uTime,uSize,uPx,uAmp,uBase,uBoost,uBeamOn,uR0,uR1; uniform vec3 uBA,uBB; varying float vA;
      void main(){ vec3 p=position+vec3(sin(uTime*0.31+aPh.x*6.28),sin(uTime*0.23+aPh.y*6.28)*0.7,cos(uTime*0.27+aPh.z*6.28))*uAmp + vec3(0.0,uTime*0.004,0.0);
        vec4 wp=modelMatrix*vec4(p,1.0); float b=0.0;
        if(uBeamOn>0.5){ vec3 d=uBB-uBA; float L=length(d); vec3 n=d/L; float s=dot(wp.xyz-uBA,n); float rr=mix(uR0,uR1,clamp(s/L,0.0,1.0)); float dist=length(wp.xyz-uBA-n*s);
          b=smoothstep(rr,rr*0.25,dist)*step(0.0,s)*step(s,L); }
        float tw=0.6+0.4*sin(uTime*(1.0+aPh.y*2.0)+aPh.x*20.0);
        vA=(uBase+uBoost*b)*tw; vec4 mv=viewMatrix*wp; gl_PointSize=clamp(uSize*aS*uPx/-mv.z,1.0,48.0); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uFade; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); a*=a; gl_FragColor=vec4(uColor*vA*a*uFade,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; return p;
}

// generic animated point cloud where JS supplies positions each frame
export function makePointCloud(n, { color = 0xffc060, size = 0.02 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aC', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uPx: { value: PX } },
    vertexShader: `attribute float aA; attribute vec3 aC; attribute float aS; uniform float uSize,uPx; varying float vA; varying vec3 vC;
      void main(){ vA=aA; vC=aC; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp(uSize*aS*uPx/-mv.z,1.0,48.0); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); a=a*a*1.4; gl_FragColor=vec4(uColor*vC*vA*a,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; return p;
}

// ---------- financial chart pieces ----------
export function chartCurve(seed, n, x0, x1, ymax, y0 = 0.25) {
  const r = mulberry32(seed); const pts = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    let y = y0 + ymax * Math.pow(s, 2.3) + (r() - 0.5) * 0.25 * (0.3 + s * 1.5) + Math.sin(i * 1.9) * 0.07 * (1 + s * 2);
    if (i % 7 === 4) y -= 0.12 + s * 0.5;
    pts.push(V(lerp(x0, x1, s), Math.max(0.08, y), 0));
  }
  pts[n - 1].y = y0 + ymax + 0.1;
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
}

export function makeChartLine(curve, { radius = 0.02, segs = 700, color = 0xffb340, intensity = 4 } = {}) {
  const geo = new THREE.TubeGeometry(curve, segs, radius, 8, false);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: true });
  const m = new THREE.Mesh(geo, mat);
  m.userData.setProgress = p => { geo.setDrawRange(0, Math.floor(clamp(p) * segs) * 8 * 6); };
  return m;
}

export function makeChartFill(curve, { color = 0xffa020, intensity = 0.5, samples = 500 } = {}) {
  const pts = curve.getSpacedPoints(samples);
  const pos = [], top = [], idx = [];
  pts.forEach((p, i) => { pos.push(p.x, p.y, p.z, p.x, 0, p.z); top.push(1, 0); if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uTipX: { value: -99 } },
    vertexShader: `attribute float aTop; varying float vTop; varying vec3 vP; void main(){ vTop=aTop; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI,uTipX; varying float vTop; varying vec3 vP;
      void main(){ if(vP.x>uTipX) discard; float g=pow(vTop,2.5)*0.8+0.05*vTop; float lines=0.5+0.5*smoothstep(0.92,1.0,abs(sin(vP.x*18.0)));
        gl_FragColor=vec4(uColor*uI*g*lines,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, mat);
}

// glowing grid plane (floor or wall) -- no labels
export function makeGrid(w, h, { color = 0xffb040, intensity = 0.25, cell = 0.5, fadeR = 8 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uCell: { value: cell }, uR: { value: fadeR } },
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI,uCell,uR; varying vec2 vP;
      void main(){ vec2 g=abs(fract(vP/uCell-0.5)-0.5)/fwidth(vP/uCell); float l=1.0-min(min(g.x,g.y),1.0); float f=smoothstep(uR,0.0,length(vP)); gl_FragColor=vec4(uColor*uI*l*f,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

// chart panel textures (lines, candles, bars) -- purely graphic, no numbers
export function makePanelTextures(count = 6, seed = 42) {
  const r = mulberry32(seed); const out = [];
  for (let k = 0; k < count; k++) {
    out.push(canvasTex(512, 360, (ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,190,90,0.18)'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 6); ctx.lineTo(w, i * h / 6); ctx.stroke(); }
      for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * w / 8, 0); ctx.lineTo(i * w / 8, h); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,200,110,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4);
      const type = k % 3; const N = 40; let y = h * 0.8; const ys = [];
      for (let i = 0; i < N; i++) { y -= (r() - 0.35) * h * 0.05 * (1 + i / N); y = Math.max(h * 0.08, Math.min(h * 0.92, y)); ys.push(y); }
      if (type === 1) { // candles
        for (let i = 1; i < N; i++) { const x = 12 + i * (w - 24) / N, o = ys[i - 1], c = ys[i]; const up = c < o;
          ctx.fillStyle = up ? 'rgba(255,205,110,0.95)' : 'rgba(150,100,40,0.8)'; ctx.fillRect(x - 3, Math.min(o, c), 6, Math.max(3, Math.abs(o - c)));
          ctx.fillRect(x - 0.7, Math.min(o, c) - 8 * r(), 1.4, Math.abs(o - c) + 16 * r()); }
      } else if (type === 2) { // bars + line
        for (let i = 0; i < N; i++) { const x = 12 + i * (w - 24) / N; ctx.fillStyle = 'rgba(255,180,80,0.35)'; ctx.fillRect(x, ys[i], (w - 24) / N - 3, h - ys[i]); }
      }
      ctx.shadowColor = 'rgba(255,200,100,1)'; ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(255,220,140,1)'; ctx.lineWidth = 4; ctx.beginPath();
      ys.forEach((yy, i) => { const x = 12 + i * (w - 24) / (N - 1); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }); ctx.stroke();
    }, { srgb: true }));
  }
  return out;
}

export function makePanelMaterial(tex, { color = 0xffc070, intensity = 1.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uP: { value: 1 }, uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uColor; uniform float uI,uP,uA; varying vec2 vUv;
      void main(){ vec3 c=texture2D(map,vUv).rgb; float rev=smoothstep(uP,uP-0.02,vUv.x); float frame=step(vUv.x,0.012)+step(0.988,vUv.x)+step(vUv.y,0.015)+step(0.985,vUv.y);
        c*= max(rev, min(frame,1.0)); gl_FragColor=vec4(c*uColor*uI*uA,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// ---------- bouncing on a floor (analytic, deterministic) ----------
// returns {p: Vector3, rest: time of rest or Infinity, landed: bool}
export function ballistic(p0, v0, tau, { g = -9.8, floorY = 0, e = 0.35, friction = 0.55, maxB = 3 } = {}) {
  let px = p0.x, py = p0.y, pz = p0.z, vx = v0.x, vy = v0.y, vz = v0.z, t = tau, tt = 0, landed = false;
  for (let b = 0; b <= maxB; b++) {
    // solve py + vy*s + 0.5 g s^2 = floorY
    const A = 0.5 * g, Bq = vy, C = py - floorY; const disc = Bq * Bq - 4 * A * C;
    const s = disc < 0 ? 0 : (-Bq - Math.sqrt(disc)) / (2 * A);
    if (t <= s) return { p: V(px + vx * t, py + vy * t + 0.5 * g * t * t, pz + vz * t), rest: Infinity, landed, tLand: tt + s };
    t -= s; tt += s; px += vx * s; pz += vz * s; py = floorY; landed = true;
    vy = -(vy + g * s) * e; vx *= friction; vz *= friction;
    if (b === maxB || vy < 0.2) { // slide to stop
      const k = 4; const d = (1 - Math.exp(-k * t)) / k;
      return { p: V(px + vx * d, floorY, pz + vz * d), rest: tt, landed: true, tLand: tt };
    }
  }
}

// ---------- final post shader (grade, grain, vignette, flash, fade, aberration) ----------
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 0.85, 0.55) },
    uGrain: { value: 0.045 }, uVig: { value: 1 }, uCA: { value: 0 }, uRed: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uFade,uFlash,uGrain,uVig,uCA,uRed; uniform vec3 uFlashColor; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    void main(){ vec2 uv=vUv; vec2 c=uv-0.5; vec3 col;
      if(uCA>0.0001){ vec2 o=c*uCA; col=vec3(texture2D(tDiffuse,uv+o).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-o).b); } else col=texture2D(tDiffuse,uv).rgb;
      float l=dot(col,vec3(0.2126,0.7152,0.0722));
      col=mix(col,col*vec3(1.05,0.97,0.84),smoothstep(0.15,0.85,l));      // gold highlights
      col=mix(col,col*vec3(0.92,0.95,1.0),smoothstep(0.25,0.0,l)*0.5);    // cool-neutral deep shadows
      col=mix(vec3(l),col,1.06);
      col=max(col-0.008,0.0)*1.008;
      col=mix(col,vec3(l*1.25,l*0.12,l*0.06),uRed);
      float v=smoothstep(0.95,0.25,length(c*vec2(1.25,0.95)));
      col*=mix(1.0,v,uVig);
      col+=uFlashColor*uFlash;
      col*=uFade;
      vec2 gp=floor(uv*uRes/1.5);
      float g=hash(gp+fract(uTime*7.31)*vec2(91.7,47.3))-0.5;
      col+=g*uGrain*(0.35+0.65*(1.0-l))*max(uFade,0.15);
      gl_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`,
};
