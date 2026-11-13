import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, H, smooth, clamp, makeEnv, FinalShader } from './lib.js';
import { buildRoom } from './room.js';
import { buildRise, buildCrash } from './market.js';
import { buildVault, buildShatter } from './vault.js';
import { buildFortune, buildEnding } from './finale.js';

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const envGold = makeEnv(renderer, 'gold'), envRed = makeEnv(renderer, 'red');
const room = buildRoom(envGold, makeEnv(renderer, 'desk'));
const rise = buildRise(envGold), crash = buildCrash(envRed);
const vault = buildVault(envGold), shatter = buildShatter(envGold, envRed);
const fortune = buildFortune(envGold), ending = buildEnding(envGold);

const TL = [
  { s: 0, e: 5, scene: room.scene, cam: room.cam, up: room.update1 },
  { s: 5, e: 10, scene: room.scene, cam: room.cam, up: room.update2 },
  { s: 10, e: 16, ...rise, up: rise.update },
  { s: 16, e: 23, ...crash, up: crash.update },
  { s: 23, e: 30, ...vault, up: vault.update },
  { s: 30, e: 35, ...shatter, up: shatter.update },
  { s: 35, e: 41, ...fortune, up: fortune.update },
  { s: 41, e: 45, ...ending, up: ending.update },
];

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: parseInt(new URLSearchParams(location.search).get('msaa') || '4') });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(TL[0].scene, TL[0].cam);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.6, 0.8);
const output = new OutputPass();
const final = new ShaderPass(FinalShader);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output); composer.addPass(final);

function globalFX(t) {
  let fade = smooth(0, 1.0, t);
  const dip = (c, w) => { const d = Math.abs(t - c); return d < w ? smooth(0, w, d) : 1; };
  fade *= dip(5, 0.22) * dip(10, 0.2) * dip(23, 0.35) * dip(35, 0.3) * dip(41, 0.3);
  fade *= 1 - smooth(43.0, 44.85, t);
  let flash = 0, color = [1, 0.85, 0.55];
  if (t >= 16 && t < 16.6) { flash = Math.exp(-(t - 16) * 9) * 0.9; color = [1, 0.92, 0.8]; }
  if (t >= 30 && t < 30.6) { flash = Math.exp(-(t - 30) * 9) * 0.8; color = [1, 0.15, 0.05]; }
  return { fade, flash, color };
}

window.renderFrame = function (t) {
  t = Math.min(t, 44.999);
  let seg = TL.find(s => t >= s.s && t < s.e) || TL[TL.length - 1];
  const r = seg.up(t - seg.s) || {};
  renderPass.scene = seg.scene; renderPass.camera = seg.cam;
  const [bs, br, bt] = r.bloom || [0.9, 0.6, 0.8]; bloom.strength = bs * 0.55; bloom.radius = br * 0.7; bloom.threshold = bt + 0.3;
  renderer.toneMappingExposure = r.exposure || 1.1;
  const g = globalFX(t); const u = final.uniforms;
  u.uTime.value = t; u.uFade.value = g.fade;
  const lf = r.flash || 0;
  u.uFlash.value = Math.max(g.flash, lf);
  u.uFlashColor.value.setRGB(...(g.flash > lf ? g.color : (r.flashColor || [1, 0.85, 0.55])));
  u.uCA.value = r.ca || 0.0015; u.uRed.value = r.red || 0; u.uVig.value = 1;
  composer.render();
  return renderer.domElement.toDataURL('image/jpeg', 0.94);
};
window.READY = true;
