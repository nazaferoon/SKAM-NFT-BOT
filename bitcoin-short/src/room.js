// Scenes 1 & 2: dark 2011 bedroom, old CRT, the first coin.
import * as THREE from 'three';
import { V, clamp, lerp, smooth, easeInOut, easeOut, track, mulberry32, makeCoin, makeBeam, makeDust, makeGlow, makePointCloud, fbm } from './lib.js';

function std(color, rough = 0.8, metal = 0) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function limb(a, b, r, mat, parent) {
  const d = b.clone().sub(a); const L = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, L, 6, 14), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

function makeHand(skin, sleeve) {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), skin); palm.scale.set(0.041, 0.016, 0.047); palm.position.z = -0.005; g.add(palm);
  const knuckles = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.05, 6, 12), skin); knuckles.rotation.z = Math.PI / 2; knuckles.position.set(0, 0.002, -0.038); g.add(knuckles);
  const fingers = [];
  const defs = [{ x: -0.024, len: 0.96 }, { x: -0.008, len: 1.0 }, { x: 0.008, len: 0.95 }, { x: 0.023, len: 0.78 }];
  for (const fd of defs) {
    const base = new THREE.Group(); base.position.set(fd.x, 0, -0.042); g.add(base);
    let parent = base; const L = [0.025, 0.019, 0.016].map(v => v * fd.len); const R = [0.0082, 0.0076, 0.0069]; const joints = [];
    for (let k = 0; k < 3; k++) {
      const j = new THREE.Group(); if (k > 0) j.position.set(0, 0, -L[k - 1]); parent.add(j);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(R[k], L[k], 6, 12), skin); seg.rotation.x = Math.PI / 2; seg.position.z = -L[k] / 2; seg.castShadow = true; j.add(seg);
      joints.push(j); parent = j;
    }
    joints[0].rotation.x = -0.32; joints[1].rotation.x = -0.6; joints[2].rotation.x = -0.45;
    fingers.push(joints);
  }
  // thumb (on -x side)
  const tb = new THREE.Group(); tb.position.set(-0.036, -0.004, -0.008); tb.rotation.set(-0.35, 0.75, 0.3); g.add(tb);
  let tp = tb; const TL = [0.026, 0.022];
  for (let k = 0; k < 2; k++) { const j = new THREE.Group(); if (k > 0) j.position.z = -TL[0]; tp.add(j); const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, TL[k], 6, 12), skin); s.rotation.x = Math.PI / 2; s.position.z = -TL[k] / 2; j.add(s); j.rotation.x = -0.25; tp = j; }
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.16, 6, 14), skin); fore.rotation.x = Math.PI / 2; fore.position.set(0, 0.004, 0.11); g.add(fore);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.22, 20), sleeve); cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.006, 0.25); cuff.castShadow = true; g.add(cuff);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, fingers };
}

export function buildRoom(env, envDesk) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.16);
  scene.environment = env; scene.environmentIntensity = 0.015;

  const wood = std(0x1b120b, 0.72), wall = std(0x0f0d0b, 0.95), darkWood = std(0x120c08, 0.6);
  // floor & walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), std(0x120d09, 0.8)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), wall); back.position.set(0, 2, 2.6); back.rotation.y = Math.PI; back.receiveShadow = true; scene.add(back);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), wall); side.position.set(2.0, 2, 0); side.rotation.y = -Math.PI / 2; side.receiveShadow = true; scene.add(side);
  const side2 = side.clone(); side2.position.x = -2.2; side2.rotation.y = Math.PI / 2; scene.add(side2);
  const front = back.clone(); front.position.z = -1.6; front.rotation.y = 0; scene.add(front);
  // window on right wall (sodium streetlight glow)
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(1.6) });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), winMat); win.position.set(1.99, 1.85, 0.6); win.rotation.y = -Math.PI / 2; scene.add(win);
  const frameMat = std(0x050403, 0.9);
  box(0.05, 1.15, 0.04, frameMat, 1.97, 1.85, 0.6, scene); box(0.05, 0.04, 0.95, frameMat, 1.97, 1.85, 0.6, scene);
  // blinds
  for (let i = 0; i < 9; i++) box(0.03, 0.025, 0.92, frameMat, 1.95, 1.35 + i * 0.12, 0.6, scene);

  // desk
  box(1.8, 0.03, 0.9, wood, 0, 0.75, 0, scene);
  for (const [x, z] of [[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]]) box(0.05, 0.74, 0.05, darkWood, x, 0.37, z, scene);
  box(0.45, 0.6, 0.85, darkWood, 0.62, 0.43, 0, scene); // drawer unit
  const DESK = 0.765;

  // CRT monitor
  const beige = std(0x37322b, 0.55), dark = std(0x0b0a09, 0.4);
  const mon = new THREE.Group(); mon.position.set(-0.24, DESK, -0.12); scene.add(mon);
  box(0.26, 0.03, 0.22, beige, 0, 0.015, 0, mon); box(0.1, 0.06, 0.1, beige, 0, 0.05, 0, mon);
  box(0.62, 0.52, 0.07, beige, 0, 0.33, 0.21, mon);
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.42, 4, 1), beige); housing.rotation.set(-Math.PI / 2, 0, 0); housing.rotateY(Math.PI / 4); housing.scale.set(1, 1, 0.82); housing.position.set(0, 0.32, -0.02); housing.castShadow = true; mon.add(housing);
  box(0.54, 0.43, 0.02, dark, 0, 0.335, 0.24, mon);
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uI: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime,uFlash,uI; varying vec2 vUv;
      void main(){ vec2 uv=vUv; vec2 c=uv-0.5; float vig=smoothstep(0.78,0.15,length(c*vec2(1.0,1.25)));
        float scan=0.82+0.18*sin(uv.y*520.0); float x=uv.x; float cy=0.18+0.6*pow(x,2.3)+0.03*sin(x*30.0+uTime*0.6);
        float line=exp(-pow((uv.y-cy)*55.0,2.0))*1.4+0.35*exp(-pow((uv.y-cy)*10.0,2.0)); float fill=step(uv.y,cy)*0.12*smoothstep(0.0,cy,uv.y);
        vec3 base=vec3(0.95,0.55,0.16)*(0.22+0.05*sin(uTime*2.7+uv.y*4.0));
        vec3 col=base+vec3(1.0,0.72,0.3)*(line+fill); col*=vig*scan; col+=vec3(1.0,0.78,0.4)*uFlash*vig*4.0;
        gl_FragColor=vec4(col*uI,1.0); }`,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), screenMat); screen.position.set(0, 0.335, 0.252); mon.add(screen);
  const screenGlow = makeGlow(0xffa040, 0.7, 0.12); screenGlow.position.set(0, 0.335, 0.3); mon.add(screenGlow);
  const screenLight = new THREE.SpotLight(0xffa64a, 2.2, 0, 1.15, 1, 2); screenLight.position.set(-0.24, DESK + 0.335, 0.2);
  screenLight.target.position.set(-0.2, 1.2, 0.9); scene.add(screenLight, screenLight.target);
  const deskSpill = new THREE.PointLight(0xff9a40, 0.25, 0, 2); deskSpill.position.set(-0.24, DESK + 0.2, 0.3); scene.add(deskSpill);

  // keyboard & mouse
  box(0.46, 0.022, 0.16, beige, -0.22, DESK + 0.011, 0.29, scene);
  const keyGeo = new THREE.BoxGeometry(0.024, 0.012, 0.024);
  const keys = new THREE.InstancedMesh(keyGeo, std(0x3f3a32, 0.6), 15 * 5); let ki = 0; const mtx = new THREE.Matrix4();
  for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) { mtx.makeTranslation(-0.22 - 0.196 + c * 0.028, DESK + 0.028, 0.235 + r * 0.028); keys.setMatrixAt(ki++, mtx); }
  keys.castShadow = keys.receiveShadow = true; scene.add(keys);
  const pressKey = box(0.05, 0.012, 0.024, std(0x433d34, 0.6), -0.035, DESK + 0.028, 0.263, scene); // enter key (right side)
  box(0.06, 0.025, 0.1, beige, 0.1, DESK + 0.012, 0.3, scene);
  // mug + papers silhouettes
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 24), std(0x1a1714, 0.5)); mug.position.set(-0.7, DESK + 0.05, -0.2); mug.castShadow = true; scene.add(mug);
  box(0.21, 0.004, 0.29, std(0x2a2620, 0.9), 0.35, DESK + 0.002, 0.18, scene).rotation.y = 0.3;

  // young man in hoodie
  const skin = new THREE.MeshStandardMaterial({ color: 0x5e4232, roughness: 0.6 });
  const hood = std(0x161412, 0.95);
  const man = new THREE.Group(); scene.add(man);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.38, 8, 20), hood); torso.scale.set(1.05, 1, 0.62); torso.position.set(-0.2, 1.02, 0.86); torso.rotation.x = -0.12; torso.castShadow = true; man.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 16), skin); neck.position.set(-0.2, 1.33, 0.83); man.add(neck);
  const head = new THREE.Group(); head.position.set(-0.2, 1.45, 0.8); head.rotation.x = 0.18; man.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 40, 28), skin); skull.scale.set(0.86, 1.12, 1.0); skull.castShadow = true; head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 30, 20), skin); jaw.scale.set(0.95, 0.8, 1.0); jaw.position.set(0, -0.06, -0.025); head.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 12), skin); nose.rotation.x = -Math.PI / 2 - 0.25; nose.position.set(0, -0.012, -0.1); head.add(nose);
  
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.05, metalness: 0.2 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), eyeMat); e.position.set(s * 0.032, 0.012, -0.088); head.add(e); }
  const hoodGeo = new THREE.SphereGeometry(0.15, 40, 24, 3 * Math.PI / 2 + 0.85, 2 * Math.PI - 1.7, 0, Math.PI * 0.78);
  const hoodM = new THREE.Mesh(hoodGeo, new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 0.95, side: THREE.DoubleSide })); hoodM.position.set(0, 0.025, 0.03); hoodM.scale.set(1, 1.05, 1.08); hoodM.castShadow = true; head.add(hoodM);
  // chair back
  box(0.5, 0.65, 0.06, std(0x0a0909, 0.5), -0.2, 1.0, 1.15, scene); box(0.5, 0.06, 0.5, std(0x0a0909, 0.5), -0.2, 0.5, 0.95, scene);
  // hands on keyboard
  const right = makeHand(skin, hood); right.group.position.set(-0.075, DESK + 0.06, 0.32); right.group.rotation.y = -0.15; scene.add(right.group);
  const left = makeHand(skin, hood); left.group.scale.x = -1; left.group.position.set(-0.36, DESK + 0.06, 0.33); left.group.rotation.y = 0.2; scene.add(left.group);
  scene.updateMatrixWorld(true);
  for (const [h, sx] of [[right, 1], [left, -1]]) {
    const wrist = h.group.localToWorld(V(0, 0.006, 0.34)); const shoulder = V(-0.2 + sx * 0.17, 1.2, 0.84); const elbow = V(-0.2 + sx * 0.23, 0.92, 0.72);
    limb(shoulder, elbow, 0.055, hood, man); limb(elbow, wrist, 0.045, hood, man);
  }

  // the coin (lying flat on the desk)
  const COIN_R = 0.05, COIN_T = 0.008;
  const coin = makeCoin(COIN_R, COIN_T, { bumpScale: 2.5, roughness: 0.45, envMapIntensity: 1.3 });
  coin.material.forEach(m => { m.envMap = envDesk; });
  coin.position.set(0.24, DESK + COIN_T / 2 + 0.0005, 0.1); coin.rotation.y = 0.9 + Math.PI / 2; scene.add(coin); coin.receiveShadow = false;
  const coinGlow = makeGlow(0xffb040, 0.16, 0.0); coinGlow.position.copy(coin.position).add(V(0, 0.01, 0)); scene.add(coinGlow);

  // golden beam through the window toward the desk
  const beamFrom = V(1.95, 1.95, 0.6), beamTo = V(0.1, DESK, 0.1);
  const beam = makeBeam(beamFrom, beamTo, 0.22, 0.32, 0xffb050, 0.07); scene.add(beam);
  const sun = new THREE.SpotLight(0xffb050, 30, 0, 0.2, 0.7, 2); sun.position.copy(beamFrom); sun.target.position.copy(beamTo);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 5; scene.add(sun, sun.target);
  const coinKey = new THREE.SpotLight(0xffd090, 1.6, 0, 0.12, 0.9, 2); coinKey.position.set(0.5, 1.5, -0.4); coinKey.target = coin; scene.add(coinKey);
  scene.add(new THREE.HemisphereLight(0x302418, 0x000000, 0.02));
  const rim = new THREE.PointLight(0xffb060, 0.25, 0, 2); rim.position.set(0.4, 1.7, 1.6); scene.add(rim);

  const dust = makeDust(900, V(0.8, 1.3, 0.4), V(2.4, 1.6, 1.6), { worldSize: 0.005, base: 0.04, boost: 2.2, amp: 0.06, beam: { from: beamFrom, to: beamTo, r0: 0.28, r1: 0.42 } });
  scene.add(dust);

  // particles that stream from the screen into the coin (scene 2)
  const NP = 700; const stream = makePointCloud(NP, { color: 0xffc060, size: 0.0035 }); scene.add(stream);
  const sr = mulberry32(99); const sp = [];
  for (let i = 0; i < NP; i++) {
    const a = sr() * Math.PI * 2, rr = Math.sqrt(sr()) * COIN_R;
    sp.push({ from: V(-0.24 + (sr() - 0.5) * 0.46, DESK + 0.335 + (sr() - 0.5) * 0.34, 0.14), to: V(coin.position.x + Math.cos(a) * rr, coin.position.y + (sr() - 0.5) * 0.006, coin.position.z + Math.sin(a) * rr), ctrl: V((sr() - 0.5) * 0.3, 0.15 + sr() * 0.2, 0.25 + sr() * 0.2), t0: 2.15 + sr() * 0.85, dur: 0.45 + sr() * 0.3, s: 0.6 + sr() * 1.4 });
  }
  const orbitLight = new THREE.PointLight(0xffd080, 0, 0, 2); scene.add(orbitLight);

  const cam = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.005, 60);
  const coinBase = coin.position.clone();
  const fingerBase = right.fingers[0].map(j => j.rotation.x);

  function common(t) {
    screenMat.uniforms.uTime.value = t; dust.material.uniforms.uTime.value = t + 3; beam.material.uniforms.uTime.value = t;
    const flick = 1 + 0.06 * Math.sin(t * 31) * Math.sin(t * 7.3) + 0.04 * fbm(t * 6, 4);
    screenLight.intensity = 1.1 * flick; deskSpill.intensity = 0.1 * flick;
  }

  // ---- Scene 1: the hook ----
  function update1(t) {
    common(t);
    coin.visible = true; coin.scale.setScalar(1); stream.visible = false; orbitLight.intensity = 0; coinGlow.material.color.setRGB(1, 0.7, 0.25).multiplyScalar(0.12 + 0.1 * smooth(2, 5, t));
    screenMat.uniforms.uFlash.value = 0;
    const u = easeInOut(t / 5);
    const p = track([{ t: 0, v: [0.62, 1.2, -0.5] }, { t: 0.5, v: [0.45, 1.06, -0.25] }, { t: 1, v: [0.36, 0.99, -0.07] }], u);
    const l = track([{ t: 0, v: [-0.08, 1.06, 0.55] }, { t: 0.55, v: [0.08, 0.9, 0.3] }, { t: 1, v: [0.24, 0.775, 0.1] }], u);
    cam.position.set(...p); cam.lookAt(...l); cam.fov = lerp(44, 34, u); cam.updateProjectionMatrix();
    return { bloom: [0.9, 0.55, 0.8], exposure: 1.0 };
  }

  // ---- Scene 2: the first investment ----
  function update2(t) {
    common(t + 5);
    // index finger presses the enter key at t=1.15
    const press = Math.exp(-Math.pow((t - 1.2) / 0.09, 2));
    right.fingers[0][0].rotation.x = fingerBase[0] - 0.22 * press; right.fingers[0][1].rotation.x = fingerBase[1] + 0.1 * press;
    const lift = smooth(0.6, 1.05, t) * (1 - smooth(1.2, 1.5, t));
    right.fingers[0][0].rotation.x += 0.25 * lift;
    pressKey.position.y = DESK + 0.028 - 0.005 * press;
    const flash = smooth(1.15, 1.3, t) * (1 - smooth(1.4, 2.4, t));
    screenMat.uniforms.uFlash.value = flash * 0.8;
    screenLight.intensity *= 1 + flash * 3;
    // coin assembles from streaming light particles
    const appear = smooth(2.75, 3.3, t);
    coin.visible = t > 2.6; coin.scale.setScalar(lerp(0.3, 1, easeOut(smooth(2.6, 3.25, t))));
    coin.position.copy(coinBase); coin.position.y += 0.03 * (1 - easeOut(smooth(2.6, 3.4, t)));
    coin.rotation.y = 0.9 + Math.PI / 2 + (1 - easeOut(smooth(2.6, 3.6, t))) * 4;
    coin.material[1].emissive.setRGB(1, 0.6, 0.15).multiplyScalar(0.7 * (1 - smooth(3.0, 3.9, t)) * smooth(2.6, 2.9, t)); coin.material[0].emissive.copy(coin.material[1].emissive);
    coinGlow.material.color.setRGB(1, 0.7, 0.25).multiplyScalar(0.12 + 0.6 * smooth(2.6, 3.0, t) * (1 - smooth(3.1, 4.0, t)));
    stream.visible = t > 2.0 && t < 3.6;
    const pa = stream.geometry.attributes.position.array, aa = stream.geometry.attributes.aA.array, ss = stream.geometry.attributes.aS.array;
    sp.forEach((q, i) => {
      const s = (t - q.t0) / q.dur; const k = clamp(s); const e = k * k * (3 - 2 * k);
      const mid = q.from.clone().lerp(q.to, 0.5).add(q.ctrl);
      const a = q.from.clone().lerp(mid, e), b = mid.clone().lerp(q.to, e), p = a.lerp(b, e);
      pa[i * 3] = p.x; pa[i * 3 + 1] = p.y; pa[i * 3 + 2] = p.z; aa[i] = (s > 0 && s < 1.05) ? 2.5 * Math.sin(Math.PI * Math.min(1, s)) + 0.4 : 0; ss[i] = q.s;
    });
    stream.geometry.attributes.position.needsUpdate = true; stream.geometry.attributes.aA.needsUpdate = true; stream.geometry.attributes.aS.needsUpdate = true;
    // orbit light for sweeping reflections
    const oa = t * 1.4; orbitLight.position.set(coinBase.x + Math.cos(oa) * 0.25, DESK + 0.18, coinBase.z + Math.sin(oa) * 0.25); orbitLight.intensity = 0.06 * smooth(3.0, 3.6, t);

    let bloom = [0.9, 0.5, 0.8];
    if (t < 2.0) { // close-up: hand on keyboard, screen glowing behind
      const u = t / 2.0;
      cam.position.set(lerp(0.1, 0.07, u), lerp(0.825, 0.83, u), lerp(0.47, 0.43, u));
      cam.lookAt(lerp(-0.1, -0.11, u), lerp(0.86, 0.87, u), lerp(0.12, 0.12, u)); cam.fov = 40;
      bloom = [1.0 + flash, 0.6, 0.75];
    } else { // coin appears, camera circles it
      const u = clamp((t - 2.0) / 3.0);
      const ang = lerp(0.5, 1.9, easeInOut(u * 0.9 + 0.1 * u));
      const rad = lerp(0.75, 0.26, easeOut(u * 1.3)), hgt = lerp(0.3, 0.055, easeOut(u * 1.2));
      cam.position.set(coinBase.x + Math.sin(ang) * rad, DESK + hgt, coinBase.z + Math.cos(ang) * rad);
      const lk = smooth(0.25, 0.75, u); const look = V(lerp(-0.08, coinBase.x, lk), lerp(0.98, DESK + 0.005, lk), lerp(0.1, coinBase.z, lk));
      cam.lookAt(look); cam.fov = lerp(40, 30, u);
      bloom = [1.0 + appear * 0.4 * (1 - smooth(3.4, 4.2, t)), 0.6, 0.75];
    }
    cam.updateProjectionMatrix();
    return { bloom, exposure: 1.0 };
  }
  return { scene, cam, update1, update2 };
}
