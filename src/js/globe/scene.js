// Real-time hero globe. Loaded on demand only for the "enhanced" and "simplified" tiers.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Object3D, Color, Vector3,
  SphereGeometry, CircleGeometry, BoxGeometry, CylinderGeometry, PlaneGeometry, TubeGeometry, CubicBezierCurve3,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial,
  DirectionalLight, HemisphereLight, AmbientLight, CanvasTexture, AdditiveBlending, BackSide, DoubleSide,
  PCFSoftShadowMap, SRGBColorSpace, ACESFilmicToneMapping, PMREMGenerator, MathUtils, Clock,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LAND, UK } from './land.js';

const NAVY = 0x0b1640, ROYAL = 0x1800ac, AMBER = 0xf5a623;
const R = 1;
const LONDON = [51.5, -0.12];
const ORIGINS = [
  [6.52, 3.38],    // Lagos
  [28.61, 77.21],  // Delhi
  [23.81, 90.41],  // Dhaka
  [31.23, 121.47], // Shanghai
  [25.2, 55.27],   // Dubai
  [-23.55, -46.63],// São Paulo
  [-1.29, 36.82],  // Nairobi
  [3.14, 101.69],  // Kuala Lumpur
];

const PROFILES = {
  enhanced: { dpr: 2, maxPx: 1400 * 1400, seg: 64, shadows: true, env: true, floaters: 3, arcs: ORIGINS.length, tube: 64, antialias: true },
  simplified: { dpr: 1.5, maxPx: 720 * 720, seg: 40, shadows: false, env: false, floaters: 2, arcs: 5, tube: 32, antialias: false },
};

export function latLonToVec(lat, lon, r = R) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function fibPoint(i, n) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const lat = Math.asin(y) * 180 / Math.PI;
  const lon = ((((i * golden) * 180 / Math.PI) % 360) + 540) % 360 - 180;
  return [lat, lon];
}

function decodeBits(b64) {
  const s = atob(b64); const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function radialTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

function dots(points, size, color, opacity, seg) {
  const geo = new CircleGeometry(size, seg);
  const mat = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: DoubleSide, depthWrite: opacity >= 1 });
  const mesh = new InstancedMesh(geo, mat, points.length);
  const o = new Object3D();
  points.forEach((p, i) => { o.position.copy(p); o.lookAt(p.clone().multiplyScalar(2)); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function arcCurve(from, to) {
  const a = latLonToVec(from[0], from[1], R * 1.004), b = latLonToVec(to[0], to[1], R * 1.004);
  const dist = a.distanceTo(b);
  const lift = R + dist * 0.3;
  const c1 = a.clone().lerp(b, 0.28).normalize().multiplyScalar(lift);
  const c2 = a.clone().lerp(b, 0.72).normalize().multiplyScalar(lift);
  return new CubicBezierCurve3(a, c1, c2, b);
}

const arcVertex = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const arcFragment = `
  uniform float uTime; uniform float uOffset; uniform vec3 uBase; uniform vec3 uHead; varying vec2 vUv;
  void main(){
    float t = fract(uTime * 0.16 + uOffset);
    float d = vUv.x - t * 1.25 + 0.12;
    float comet = smoothstep(-0.22, 0.0, d) * (1.0 - smoothstep(0.0, 0.015, d));
    float base = 0.32 * smoothstep(0.0, 0.08, vUv.x);
    vec3 col = mix(uBase, uHead, smoothstep(0.75, 1.0, vUv.x));
    gl_FragColor = vec4(col, base + comet * 0.95);
  }`;

const glowVertex = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const glowFragment = `uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(-vN.z * 2.3, 0.0, 1.0), 2.4); gl_FragColor = vec4(uColor, f * 0.85); }`;

function mortarboard(p) {
  const g = new Group();
  const dark = new MeshStandardMaterial({ color: 0x141c44, roughness: 0.55, metalness: 0.1 });
  const board = new Mesh(new BoxGeometry(0.34, 0.022, 0.34), dark);
  const cap = new Mesh(new CylinderGeometry(0.11, 0.12, 0.09, p.seg / 2), dark); cap.position.y = -0.055;
  const button = new Mesh(new CylinderGeometry(0.018, 0.018, 0.012, 12), new MeshStandardMaterial({ color: AMBER, roughness: 0.4 })); button.position.y = 0.017;
  const cord = new Mesh(new CylinderGeometry(0.005, 0.005, 0.16, 6), new MeshStandardMaterial({ color: AMBER, roughness: 0.5 }));
  cord.position.set(0.12, -0.06, 0.12);
  board.castShadow = cap.castShadow = true;
  g.add(board, cap, button, cord);
  return g;
}
function book() {
  const g = new Group();
  const cover = new MeshStandardMaterial({ color: ROYAL, roughness: 0.45, metalness: 0.05 });
  const pages = new MeshStandardMaterial({ color: 0xf4f6fb, roughness: 0.9 });
  const a = new Mesh(new BoxGeometry(0.3, 0.012, 0.22), cover); a.position.y = 0.032;
  const b = a.clone(); b.position.y = -0.032;
  const spine = new Mesh(new BoxGeometry(0.012, 0.076, 0.22), cover); spine.position.x = -0.144;
  const block = new Mesh(new BoxGeometry(0.285, 0.054, 0.205), pages); block.position.x = 0.004;
  [a, b, spine, block].forEach((m) => { m.castShadow = true; });
  g.add(a, b, spine, block);
  return g;
}
function letter() {
  const g = new Group();
  const paper = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const env = new Mesh(new BoxGeometry(0.3, 0.2, 0.008), paper); env.castShadow = true;
  const flap = new Mesh(new CylinderGeometry(0.152, 0.152, 0.006, 3, 1, false, 0, Math.PI * 2), new MeshStandardMaterial({ color: 0xe9ecf6, roughness: 0.7 }));
  flap.rotation.set(Math.PI / 2, 0, Math.PI); flap.scale.set(1, 1, 0.42); flap.position.set(0, 0.035, 0.006);
  const seal = new Mesh(new CylinderGeometry(0.028, 0.028, 0.008, 18), new MeshStandardMaterial({ color: AMBER, roughness: 0.35, metalness: 0.2 }));
  seal.rotation.x = Math.PI / 2; seal.position.set(0, -0.005, 0.01);
  g.add(env, flap, seal);
  return g;
}

/**
 * Mounts the globe into `host`. Returns a controller, or throws if WebGL cannot start.
 * opts: { tier, onReady, onFail, staticFrame }
 */
const yieldToMain = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

export async function mountGlobe(host, opts) {
  const p = PROFILES[opts.tier] || PROFILES.simplified;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, antialias: p.antialias, alpha: true, powerPreference: opts.tier === 'enhanced' ? 'high-performance' : 'low-power', preserveDrawingBuffer: !!opts.staticFrame });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  if (p.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap; }

  await yieldToMain();
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.12, 5.6);
  camera.lookAt(0, 0, 0);

  // Image-based lighting is added only once the device has proved it renders quickly.
  function addEnvironment() {
    if (!p.env || destroyed) return;
    const pm = new PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }

  // Lighting: key from upper left (photography should match), cool rim from behind.
  scene.add(new HemisphereLight(0xdfe6ff, 0x0b1640, p.env ? 0.35 : 1.4));
  const key = new DirectionalLight(0xffffff, p.env ? 1.5 : 2.6);
  key.position.set(-5, 4.2, 2.2);
  if (p.shadows) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.camera.near = 1; key.shadow.camera.far = 12; Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8 }); key.shadow.bias = -0.0008; }
  scene.add(key);
  const rim = new DirectionalLight(0x6f7dff, 2.2); rim.position.set(3, 1.2, -3.5); scene.add(rim);
  if (!p.env) scene.add(new AmbientLight(0x31408a, 0.6));

  await yieldToMain();
  const world = new Group(); scene.add(world);
  const globe = new Group(); world.add(globe);

  const sphere = new Mesh(
    new SphereGeometry(R, p.seg, p.seg),
    p.env
      ? new MeshPhysicalMaterial({ color: 0x0e1a52, roughness: 0.62, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.5, envMapIntensity: 0.35 })
      : new MeshStandardMaterial({ color: 0x101c58, roughness: 0.7, metalness: 0.0 }),
  );
  sphere.receiveShadow = p.shadows;
  globe.add(sphere);

  // Land as a dot matrix; UK as dense amber dots.
  const bits = decodeBits(LAND[opts.tier === 'enhanced' ? 'enhanced' : 'simplified'].bits);
  const n = LAND[opts.tier === 'enhanced' ? 'enhanced' : 'simplified'].n;
  const landPts = [];
  for (let i = 0; i < n; i++) if (bits[i >> 3] & (1 << (i & 7))) { const [la, lo] = fibPoint(i, n); landPts.push(latLonToVec(la, lo, R * 1.002)); }
  globe.add(dots(landPts, opts.tier === 'enhanced' ? 0.0085 : 0.012, 0xb4c0ff, 0.5, 6));
  const ukPts = []; for (let i = 0; i < UK.length; i += 2) ukPts.push(latLonToVec(UK[i], UK[i + 1], R * 1.003));
  const ukMesh = dots(ukPts, 0.0062, AMBER, 1, 8); globe.add(ukMesh);

  // London beacon and pulse ring.
  const london = latLonToVec(LONDON[0], LONDON[1], R * 1.006);
  const beacon = new Mesh(new PlaneGeometry(0.1, 0.1), new MeshBasicMaterial({ map: radialTexture('rgba(255,214,140,0.9)', 'rgba(245,166,35,0)'), transparent: true, depthWrite: false, blending: AdditiveBlending }));
  beacon.position.copy(london); beacon.lookAt(london.clone().multiplyScalar(2)); globe.add(beacon);
  const ring = new Mesh(new PlaneGeometry(0.2, 0.2), new MeshBasicMaterial({ map: radialTexture('rgba(245,166,35,0)', 'rgba(245,166,35,0)'), transparent: true, depthWrite: false }));
  {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.strokeStyle = 'rgba(245,166,35,0.9)'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
    ring.material.map = new CanvasTexture(c);
  }
  ring.position.copy(london); ring.lookAt(london.clone().multiplyScalar(2)); globe.add(ring);

  // Atmosphere.
  const atmo = new Mesh(new SphereGeometry(R * 1.16, p.seg, p.seg), new ShaderMaterial({ vertexShader: glowVertex, fragmentShader: glowFragment, uniforms: { uColor: { value: new Color(0x5a6bff) } }, side: BackSide, transparent: true, blending: AdditiveBlending, depthWrite: false }));
  world.add(atmo);

  await yieldToMain();
  // Connection paths into the UK.
  const arcMats = [];
  ORIGINS.slice(0, p.arcs).forEach((o, i) => {
    const mat = new ShaderMaterial({ vertexShader: arcVertex, fragmentShader: arcFragment, transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uOffset: { value: i / p.arcs }, uBase: { value: new Color(0xb9c3ff) }, uHead: { value: new Color(AMBER) } } });
    arcMats.push(mat);
    globe.add(new Mesh(new TubeGeometry(arcCurve(o, LONDON), p.tube, 0.0055, 5, false), mat));
    const start = new Mesh(new CircleGeometry(0.012, 10), new MeshBasicMaterial({ color: 0xffffff }));
    const sp = latLonToVec(o[0], o[1], R * 1.004); start.position.copy(sp); start.lookAt(sp.clone().multiplyScalar(2)); globe.add(start);
  });

  // Face the UK towards the viewer, slightly tilted so north stays up.
  const uk = latLonToVec(54, -2);
  const baseYaw = -Math.atan2(uk.x, uk.z);
  const baseTilt = 0.62;
  globe.rotation.order = 'XYZ';

  // Floating university elements: few and restrained.
  const floaters = [];
  const makers = [mortarboard, book, letter].slice(0, p.floaters);
  const slots = [
    { pos: [-1.18, 0.78, 0.55], rot: [0.5, 0.6, -0.25], s: 1.05 },
    { pos: [1.22, -0.62, 0.62], rot: [0.9, -0.5, 0.25], s: 1.0 },
    { pos: [1.12, 0.98, -0.1], rot: [0.25, -0.3, 0.2], s: 0.9 },
  ];
  makers.forEach((make, i) => {
    const obj = make(p); const s = slots[i];
    obj.position.set(...s.pos); obj.rotation.set(...s.rot); obj.scale.setScalar(s.s);
    obj.userData = { base: obj.position.clone(), rot: obj.rotation.clone(), phase: i * 2.1 };
    world.add(obj); floaters.push(obj);
  });

  // Soft contact shadow below the globe.
  const shadow = new Mesh(new PlaneGeometry(2.6, 0.7), new MeshBasicMaterial({ map: radialTexture('rgba(0,0,10,0.55)', 'rgba(0,0,10,0)'), transparent: true, depthWrite: false }));
  shadow.position.set(0, -1.38, 0.1); shadow.rotation.x = -Math.PI / 2.3; world.add(shadow);

  await yieldToMain();
  if (renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); } catch { /* compile on first render */ } }
  host.appendChild(canvas);

  // Sizing with a capped rendering resolution.
  let width = 0, height = 0;
  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width)); height = Math.max(1, Math.round(rect.height));
    let dpr = Math.min(window.devicePixelRatio || 1, p.dpr);
    if (width * height * dpr * dpr > p.maxPx) dpr = Math.sqrt(p.maxPx / (width * height));
    renderer.setPixelRatio(Math.max(dpr, 0.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(host);

  // Pointer parallax for mouse users only.
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function onPointer(e) {
    const r = host.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }
  if (fine) window.addEventListener('pointermove', onPointer, { passive: true });

  const clock = new Clock(false);
  let elapsed = opts.staticFrame ? 3.2 : 0;
  let running = false, visible = true, paused = false, raf = 0, lost = false;
  let firstFrame = true;
  const samples = [];
  const renderCost = []; let frameNo = 0;

  function frame() {
    raf = 0;
    if (!running) return;
    const dt = clock.getDelta();
    elapsed += Math.min(dt, 0.05);
    // Performance guard: if this device cannot keep up, fall back to the static render.
    if (!opts.staticFrame && !opts.noGuard && samples.length < 25) {
      samples.push(dt);
      if (samples.length === 25) {
        const sorted = samples.slice(5).sort((x, y) => x - y);
        if (sorted[sorted.length >> 1] > 0.045) { running = false; destroy(); opts.onFail && opts.onFail('too-slow'); return; }
      }
    }
    draw(elapsed);
    raf = requestAnimationFrame(frame);
  }
  function draw(t) {
    if (destroyed) return;
    cur.x += (target.x - cur.x) * 0.04; cur.y += (target.y - cur.y) * 0.04;
    globe.rotation.y = baseYaw + Math.sin(t * 0.18) * 0.38;
    globe.rotation.x = baseTilt;
    world.rotation.y = cur.x * 0.12; world.rotation.x = cur.y * 0.06;
    arcMats.forEach((m) => { m.uniforms.uTime.value = t; });
    const pulse = (t * 0.6) % 1;
    ring.scale.setScalar(0.4 + pulse * 1.6); ring.material.opacity = 1 - pulse;
    beacon.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
    floaters.forEach((f) => {
      const u = f.userData;
      f.position.y = u.base.y + Math.sin(t * 0.8 + u.phase) * 0.05;
      f.rotation.y = u.rot.y + Math.sin(t * 0.35 + u.phase) * 0.25;
      f.rotation.z = u.rot.z + Math.sin(t * 0.5 + u.phase) * 0.06;
    });
    const r0 = performance.now();
    renderer.render(scene, camera);
    // A GPU-backed render returns in a few ms; software rendering blocks the main thread.
    if (!opts.staticFrame && frameNo < 8) {
      if (opts.noGuard) { frameNo = 8; } else {
      frameNo++;
      if (frameNo > 2) renderCost.push(performance.now() - r0);
      if (renderCost.length === 4 && renderCost.sort((x, y) => x - y)[1] > 22) { running = false; destroy(); opts.onFail && opts.onFail('too-slow'); return; }
    } }
    if (firstFrame && (opts.staticFrame || opts.noGuard || frameNo >= 6)) { firstFrame = false; if (opts.staticFrame) { addEnvironment(); renderer.render(scene, camera); } else { setTimeout(addEnvironment, 0); } opts.onReady && opts.onReady(); }
  }
  function sync() {
    const should = visible && !paused && !document.hidden && !lost;
    if (should && !running) { running = true; clock.start(); raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; clock.stop(); if (raf) cancelAnimationFrame(raf); raf = 0; }
  }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '80px' });
  io.observe(host);
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); lost = true; sync(); destroy(); opts.onFail && opts.onFail('context-lost');
  }, { once: true });

  let destroyed = false;
  function destroy() {
    if (destroyed) return; destroyed = true;
    io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointermove', onPointer);
    if (raf) cancelAnimationFrame(raf);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    renderer.dispose();
    canvas.remove();
  }

  if (opts.staticFrame) { draw(elapsed); } else { sync(); }

  return {
    canvas,
    setPaused(v) { paused = v; if (paused) { draw(elapsed); } sync(); },
    get paused() { return paused; },
    destroy,
  };
}
