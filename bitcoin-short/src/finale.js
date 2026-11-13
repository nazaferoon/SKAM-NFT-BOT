// Scenes 7 & 8: the final fortune, and the lone coin in the empty room.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { V, W, H, PX, clamp, lerp, smooth, easeInOut, easeOut, easeInOutSine, mulberry32, makeCoin, makeGlow, makeBeam, makeDust, canvasTex } from './lib.js';

function std(color, rough = 0.7, metal = 0) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }

function windowTex(seed) {
  return canvasTex(256, 256, (ctx, w) => {
    const g = ctx.createLinearGradient(0, 0, 0, w); g.addColorStop(0, '#ffe2a8'); g.addColorStop(0.5, '#e09440'); g.addColorStop(1, '#5a2e0c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    const r = mulberry32(seed);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.4})`; ctx.fillRect(r() * w, w * (0.45 + r() * 0.3), 20 + r() * 60, w); } // furniture silhouettes
    for (let i = 0; i < 3; i++) { const x = r() * w; const rg = ctx.createRadialGradient(x, 10, 0, x, 10, 60); rg.addColorStop(0, 'rgba(255,250,220,0.9)'); rg.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, w); }
  }, { srgb: true });
}

function makeMansion() {
  const g = new THREE.Group();
  const concrete = std(0x2b2825, 0.8), slab = std(0x6d665c, 0.6), darkStone = std(0x141210, 0.7), frame = std(0x050505, 0.4, 0.5);
  const winMats = [1, 2, 3, 4].map(s => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: windowTex(s), emissiveIntensity: 0.55 + s * 0.08, roughness: 0.1 }));
  const glass = (w, h, x, y, z, k, n) => { box(w, h, 0.05, winMats[k % 4], x, y, z, g); for (let i = 0; i <= n; i++) box(0.08, h, 0.12, frame, x - w / 2 + i * w / n, y, z + 0.03, g); box(w, 0.1, 0.12, frame, x, y + h / 2, z + 0.03, g); };
  box(20, 0.5, 10, darkStone, 0, 0.25, 0, g);
  box(15, 3.2, 7, concrete, 0, 2.1, -0.5, g); glass(12.5, 2.7, -0.5, 2.05, 3.03, 0, 6);
  box(17, 0.3, 9, slab, -0.5, 3.85, 0, g);
  box(11, 2.8, 6.4, concrete, -2.8, 5.4, -0.6, g); glass(9.6, 2.2, -2.8, 5.35, 2.63, 1, 5);
  box(13, 0.3, 8.2, slab, -2.6, 6.95, 0, g);
  box(4.6, 2.5, 4.2, concrete, 4.6, 5.25, -1, g); glass(3.8, 1.9, 4.6, 5.2, 1.13, 2, 2); box(5.6, 0.25, 5.4, slab, 4.6, 6.6, -0.6, g);
  box(0.7, 7.6, 7, darkStone, -8.6, 3.8, -0.5, g);
  // stair / terrace lights
  const bollard = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc070).multiplyScalar(4) });
  for (let i = 0; i < 9; i++) box(0.12, 0.05, 0.12, bollard, -8 + i * 2, 0.52, 4.6, g);
  // pool (glowing water)
  const poolMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vP; void main(){ vec2 p=vP*2.0; float c=0.0; for(int i=0;i<3;i++){ p+=vec2(sin(p.y*1.7+uTime*0.6),cos(p.x*1.5-uTime*0.5)); c+=abs(sin(p.x+p.y)); }
      c=pow(c/3.0,3.0); gl_FragColor=vec4(vec3(0.95,0.62,0.22)*(0.35+1.2*c),1.0); }` });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.6), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(-3.5, 0.51, 3.6); g.add(pool);
  g.userData.pool = poolMat;
  return g;
}

function makeCar(paint) {
  const g = new THREE.Group();
  const prof = [[-2.25, 0.3], [-2.3, 0.6], [-2.08, 0.8], [-1.0, 0.9], [-0.4, 1.17], [0.5, 1.2], [1.25, 0.96], [2.12, 0.78], [2.3, 0.56], [2.26, 0.3]];
  const shape = new THREE.Shape(prof.map(p => new THREE.Vector2(...p)));
  const body = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, curveSegments: 4 }); body.translate(0, 0, -0.85);
  g.add(new THREE.Mesh(body, paint));
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.05, metalness: 0.5, clearcoat: 1 });
  const win = new THREE.Shape([[-0.85, 0.93], [-0.35, 1.13], [0.48, 1.15], [1.08, 0.97]].map(p => new THREE.Vector2(...p)));
  const wg = new THREE.ExtrudeGeometry(win, { depth: 1.96, bevelEnabled: false }); wg.translate(0, 0, -0.98); g.add(new THREE.Mesh(wg, glassMat));
  const tire = std(0x050505, 0.8), rimMat = new THREE.MeshStandardMaterial({ color: 0xd8a24a, metalness: 1, roughness: 0.25 });
  for (const x of [-1.45, 1.4]) for (const z of [-0.88, 0.88]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 28), tire); w.rotation.x = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w);
    const rm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 20), rimMat); rm.rotation.x = Math.PI / 2; rm.position.set(x, 0.36, z); g.add(rm);
  }
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d0).multiplyScalar(6) });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1505).multiplyScalar(4) });
  for (const z of [-0.65, 0.65]) { box(0.06, 0.06, 0.38, head, 2.36, 0.68, z, g); }
  box(0.05, 0.05, 1.7, tail, -2.38, 0.7, 0, g);
  const hl = new THREE.SpotLight(0xffe8c0, 40, 0, 0.5, 0.8, 2); hl.position.set(2.4, 0.7, 0); hl.target.position.set(8, 0, 0); g.add(hl, hl.target);
  for (const z of [-0.65, 0.65]) { const s = makeGlow(0xfff0d0, 0.7, 0.5); s.position.set(2.5, 0.68, z); g.add(s); }
  return g;
}

export function buildFortune(env) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0); scene.fog = new THREE.FogExp2(0x030201, 0.012);
  scene.environment = env; scene.environmentIntensity = 0.7;
  const mirror = new Reflector(new THREE.PlaneGeometry(90, 90), { textureWidth: W * 0.5, textureHeight: H * 0.5, color: 0x8c8c8c, clipBias: 0.003 }); mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.6 })); wet.rotation.x = -Math.PI / 2; wet.position.y = 0.003; scene.add(wet);
  const mansion = makeMansion(); mansion.position.set(0, 0, -21); scene.add(mansion);
  const interior = [-5, 0, 5].map(x => { const l = new THREE.PointLight(0xffb060, 8, 0, 2); l.position.set(x, 2.5, -16.5); scene.add(l); return l; });
  const blackPaint = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0.7, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const goldPaint = new THREE.MeshPhysicalMaterial({ color: 0x8a6526, metalness: 0.9, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const cars = [[blackPaint, -3.6, -9.5, -Math.PI / 2 + 0.5], [goldPaint, 3.8, -11, -Math.PI / 2 - 0.55], [blackPaint, 0.6, -15.2, 0.1]].map(([m, x, z, ry]) => { const c = makeCar(m); c.position.set(x, 0, z); c.rotation.y = ry; scene.add(c); return c; });
  const COIN = V(0, 4.3, -2.5);
  const coin = makeCoin(2.3, 0.28, { bumpScale: 4.5, roughness: 0.42, seg: 180 }); coin.rotation.x = Math.PI / 2; coin.position.copy(COIN); scene.add(coin);
  const halo = makeGlow(0xffb040, 9, 0.45); halo.position.copy(COIN).add(V(0, 0, -1.2)); scene.add(halo);
  const key = new THREE.SpotLight(0xffe2b0, 260, 0, 0.4, 0.8, 2); key.position.set(4, 11, 7); key.target.position.copy(COIN); scene.add(key, key.target);
  for (const s of [-1, 1]) { const rim = new THREE.SpotLight(0xffa040, 380, 0, 0.35, 0.7, 2); rim.position.set(s * 6, 8, -9); rim.target.position.copy(COIN); scene.add(rim, rim.target); }
  const fillL = new THREE.SpotLight(0xffb070, 120, 0, 0.5, 1, 2); fillL.position.set(-5, 1.5, 6); fillL.target.position.copy(COIN); scene.add(fillL, fillL.target);
  scene.add(makeBeam(V(-1.2, 22, -6), V(0, 0, -3), 0.6, 3.5, 0xffc070, 0.05), makeBeam(V(2.5, 22, -7), V(0.5, 0, -3), 0.4, 2.2, 0xffb050, 0.04));
  // thousands of orbiting golden particles
  const N = 5000; const r = mulberry32(12);
  const pos = new Float32Array(N * 3), orb = new Float32Array(N * 4), sd = new Float32Array(N);
  for (let i = 0; i < N; i++) { const ring = r() < 0.6; orb[i * 4] = ring ? 2.8 + Math.pow(r(), 1.5) * 5 : 2.6 + r() * 9; orb[i * 4 + 1] = r() * 6.28; orb[i * 4 + 2] = (0.08 + r() * 0.25) * (ring ? 1 : 0.4); orb[i * 4 + 3] = ring ? (r() - 0.5) * 0.6 : (r() - 0.5) * 9; sd[i] = r(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aOrb', new THREE.BufferAttribute(orb, 4)); pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const pm = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uC: { value: COIN }, uPx: { value: PX } },
    vertexShader: `attribute vec4 aOrb; attribute float aSeed; uniform float uTime,uPx; uniform vec3 uC; varying float vA;
      void main(){ float a=aOrb.y+aOrb.z*uTime; vec3 p=vec3(cos(a)*aOrb.x, aOrb.w+sin(a*1.7+aSeed*9.0)*0.25, sin(a)*aOrb.x);
        float tilt=0.35; p=vec3(p.x, p.y*cos(tilt)-p.z*sin(tilt), p.y*sin(tilt)+p.z*cos(tilt)); p+=uC; vec4 mv=modelViewMatrix*vec4(p,1.0);
        vA=0.6+0.4*sin(uTime*3.0+aSeed*40.0); gl_PointSize=clamp((0.02+0.05*aSeed*aSeed)*uPx/-mv.z,1.0,48.0); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); a*=a; gl_FragColor=vec4(vec3(1.0,0.72,0.32)*1.5*vA*a,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; scene.add(pts);
  const cam = new THREE.PerspectiveCamera(52, W / H, 0.05, 150);

  function update(t) {
    pm.uniforms.uTime.value = t + 10; mansion.userData.pool.uniforms.uTime.value = t;
    coin.rotation.z = 0.3 - t * 0.1; coin.position.y = COIN.y + Math.sin(t * 1.1) * 0.08;
    halo.material.color.setRGB(1, 0.72, 0.32).multiplyScalar(0.42 + 0.05 * Math.sin(t * 2));
    const u = easeInOutSine(t / 6);
    cam.position.set(lerp(-2.8, 2.4, u), lerp(1.0, 1.9, u), lerp(10.5, 8.6, u));
    cam.lookAt(lerp(-0.2, 0.2, u), lerp(3.7, 4.0, u), -3);
    cam.updateProjectionMatrix();
    return { bloom: [0.95, 0.6, 0.8], exposure: 1.15 };
  }
  return { scene, cam, update };
}

export function buildEnding(env) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0); scene.fog = new THREE.FogExp2(0x020100, 0.04);
  scene.environment = env; scene.environmentIntensity = 0.25;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), std(0x0b0a09, 0.45, 0.2)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const room = new THREE.Mesh(new THREE.BoxGeometry(34, 16, 40), std(0x0a0908, 0.95)); room.position.set(0, 8, -4); room.material.side = THREE.BackSide; scene.add(room);
  const pillarMat = std(0x0d0c0a, 0.6);
  for (const x of [-9, 9]) for (let z = -18; z <= 10; z += 7) box(0.9, 16, 0.9, pillarMat, x, 8, z, scene);
  const tableMat = new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const top = box(2.4, 0.08, 1.3, tableMat, 0, 0.92, 0, scene); top.receiveShadow = true; top.castShadow = true;
  for (const [x, z] of [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.5], [1.05, 0.5]]) box(0.07, 0.88, 0.07, tableMat, x, 0.44, z, scene);
  const TOP = 0.96, R = 0.05, T = 0.008;
  const coin = makeCoin(R, T, { bumpScale: 2.5, roughness: 0.45 }); coin.position.set(0, TOP + T / 2 + 0.0005, 0); coin.rotation.y = 2.75; scene.add(coin);
  const spot = new THREE.SpotLight(0xffcf8a, 900, 0, 0.055, 0.45, 2); spot.position.set(0, 12, 0); spot.target.position.set(0, TOP, 0);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.camera.near = 8; spot.shadow.camera.far = 13; spot.shadow.bias = -0.00005; scene.add(spot, spot.target);
  const beam = makeBeam(V(0, 12, 0), V(0, TOP, 0), 0.03, 0.62, 0xffc070, 0.32); scene.add(beam);
  const pool = makeGlow(0xffb050, 1.6, 0.15); pool.position.set(0, TOP + 0.01, 0); scene.add(pool);
  const coinKey = new THREE.SpotLight(0xffd8a0, 1.2, 0, 0.1, 0.9, 2); coinKey.position.set(0.4, 1.4, 0.6); coinKey.target = coin; scene.add(coinKey);
  const dust = makeDust(700, V(0, 6, 0), V(2.5, 11, 2.5), { worldSize: 0.01, base: 0.02, boost: 1.6, amp: 0.08, beam: { from: V(0, 12, 0), to: V(0, TOP, 0), r0: 0.03, r1: 0.62 }, seed: 31 }); scene.add(dust);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.003, 120);
  const C = coin.position.clone();
  function update(t) {
    dust.material.uniforms.uTime.value = t; beam.material.uniforms.uTime.value = t;
    const u = easeInOut(clamp(t / 3.9));
    const d = 0.09 * Math.pow(15.5 / 0.09, u);
    const dir = V(lerp(0.55, 0.12, u), lerp(0.16, 0.36, u), 1).normalize();
    cam.position.copy(C).addScaledVector(dir, d);
    cam.lookAt(V(0, lerp(C.y, 2.6, smooth(0.25, 1, u)), 0));
    cam.fov = lerp(32, 50, u); cam.near = Math.max(0.003, d * 0.05); cam.updateProjectionMatrix();
    return { bloom: [0.9, 0.55, 0.8], exposure: 1.2 };
  }
  return { scene, cam, update };
}
