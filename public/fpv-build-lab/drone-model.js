import * as THREE from 'three';

/* ---------------- materials (shared, named → MTL / GLB entries) ---------- */
const M = {
  carbon:   new THREE.MeshStandardMaterial({ name: 'carbon-fiber',   color: 0x23252b, roughness: 0.40, metalness: 0.20 }),
  carbonEdge:new THREE.MeshStandardMaterial({ name: 'carbon-edge',   color: 0x35383f, roughness: 0.55, metalness: 0.12 }),
  alu:      new THREE.MeshStandardMaterial({ name: 'aluminum',       color: 0xbcc1c8, roughness: 0.28, metalness: 0.40 }),
  steel:    new THREE.MeshStandardMaterial({ name: 'steel',          color: 0x9096a0, roughness: 0.24, metalness: 0.40 }),
  darkSteel:new THREE.MeshStandardMaterial({ name: 'anodized-black', color: 0x3a3d44, roughness: 0.30, metalness: 0.38 }),
  copper:   new THREE.MeshStandardMaterial({ name: 'copper-winding', color: 0xb5713a, roughness: 0.38, metalness: 0.38 }),
  laminate: new THREE.MeshStandardMaterial({ name: 'stator-steel',   color: 0x777c85, roughness: 0.35, metalness: 0.40 }),
  pcbGreen: new THREE.MeshStandardMaterial({ name: 'pcb-green',      color: 0x1d6b4f, roughness: 0.52, metalness: 0.10 }),
  pcbBlue:  new THREE.MeshStandardMaterial({ name: 'pcb-blue',       color: 0x1f3c78, roughness: 0.52, metalness: 0.10 }),
  pcbRed:   new THREE.MeshStandardMaterial({ name: 'pcb-red',        color: 0x8c2b28, roughness: 0.52, metalness: 0.10 }),
  pad:      new THREE.MeshStandardMaterial({ name: 'solder-pad',     color: 0xc9a227, roughness: 0.32, metalness: 0.42 }),
  silk:     new THREE.MeshStandardMaterial({ name: 'silkscreen',     color: 0xe8e8e2, roughness: 0.70, metalness: 0.02 }),
  chip:     new THREE.MeshStandardMaterial({ name: 'ic-package',     color: 0x1b1c20, roughness: 0.45, metalness: 0.08 }),
  plastic:  new THREE.MeshStandardMaterial({ name: 'plastic-black',  color: 0x2b2c31, roughness: 0.60, metalness: 0.05 }),
  vent:     new THREE.MeshStandardMaterial({ name: 'shadow-recess',  color: 0x101114, roughness: 0.90, metalness: 0.00 }),
  prop:     new THREE.MeshStandardMaterial({ name: 'polycarbonate',  color: 0xe4e8ee, roughness: 0.33, metalness: 0.04 }),
  wireBlk:  new THREE.MeshStandardMaterial({ name: 'wire-black',     color: 0x16171b, roughness: 0.68, metalness: 0.04 }),
  wireRed:  new THREE.MeshStandardMaterial({ name: 'wire-red',       color: 0x9c2119, roughness: 0.68, metalness: 0.04 }),
  wireWht:  new THREE.MeshStandardMaterial({ name: 'wire-white',     color: 0xd9d9d4, roughness: 0.68, metalness: 0.04 }),
  shrink:   new THREE.MeshStandardMaterial({ name: 'heatshrink',     color: 0x101216, roughness: 0.55, metalness: 0.04 }),
  lipo:     new THREE.MeshStandardMaterial({ name: 'lipo-wrap',      color: 0x2c3550, roughness: 0.44, metalness: 0.10 }),
  lipoLabel:new THREE.MeshStandardMaterial({ name: 'lipo-label',     color: 0xdcdcd6, roughness: 0.70, metalness: 0.02 }),
  strap:    new THREE.MeshStandardMaterial({ name: 'battery-strap',  color: 0x3c3f46, roughness: 0.88, metalness: 0.02 }),
  yellow:   new THREE.MeshStandardMaterial({ name: 'xt60-yellow',    color: 0xd8b22a, roughness: 0.48, metalness: 0.05 }),
  glass:    new THREE.MeshStandardMaterial({ name: 'lens-glass',     color: 0x0d1418, roughness: 0.10, metalness: 0.28 }),
  ledRed:   new THREE.MeshStandardMaterial({ name: 'led-red',        color: 0xd63b2a, roughness: 0.32, emissive: 0x4d0f07 }),
  ledLens:  new THREE.MeshStandardMaterial({ name: 'led-lens',       color: 0xe9e9e4, roughness: 0.25, metalness: 0.02 }),
  tpu:      new THREE.MeshStandardMaterial({ name: 'tpu-mount',      color: 0x4a4e56, roughness: 0.78, metalness: 0.03 }),
  ceramic:  new THREE.MeshStandardMaterial({ name: 'gps-ceramic',    color: 0xd8d3c4, roughness: 0.55, metalness: 0.05 }),
  pcbBlack: new THREE.MeshStandardMaterial({ name: 'pcb-black-mask', color: 0x14151a, roughness: 0.46, metalness: 0.12 }),
  mosfet:   new THREE.MeshStandardMaterial({ name: 'mosfet-package', color: 0xb0b3b6, roughness: 0.30, metalness: 0.55 }),
  ceramicCap:new THREE.MeshStandardMaterial({ name: 'mlcc-ceramic', color: 0xc9a06a, roughness: 0.52, metalness: 0.12 }),
  connWhite:new THREE.MeshStandardMaterial({ name: 'jst-housing',   color: 0xe6e3d9, roughness: 0.60, metalness: 0.03 }),
  capBody:  new THREE.MeshStandardMaterial({ name: 'electrolytic-wrap', color: 0x2f3a1c, roughness: 0.45, metalness: 0.10 }),
  capStripe:new THREE.MeshStandardMaterial({ name: 'capacitor-stripe', color: 0xd9c33a, roughness: 0.50, metalness: 0.05 }),
  motorNavy:new THREE.MeshStandardMaterial({ name: 'anodized-navy',  color: 0x223a5e, roughness: 0.26, metalness: 0.62 }),
  motorTeal:new THREE.MeshStandardMaterial({ name: 'anodized-teal',  color: 0x2f9b93, roughness: 0.24, metalness: 0.60 }),
  magnet:   new THREE.MeshStandardMaterial({ name: 'neodymium',      color: 0x4a4d53, roughness: 0.42, metalness: 0.55 }),
  smoke:    new THREE.MeshStandardMaterial({ name: 'polycarbonate-smoke', color: 0x141416, roughness: 0.14, metalness: 0.02, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
  smokeCW:  new THREE.MeshStandardMaterial({ name: 'polycarbonate-smoke-cw', color: 0x141416, roughness: 0.14, metalness: 0.02, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
  markCW:   new THREE.MeshStandardMaterial({ name: 'marking-cw',     color: 0xd8d8d2, roughness: 0.60, metalness: 0.02 }),
  markCCW:  new THREE.MeshStandardMaterial({ name: 'marking-ccw',    color: 0x8fbfd8, roughness: 0.60, metalness: 0.02 })
};

/* ---------------- helpers ------------------------------------------------ */
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);      s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);      s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);          s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// plate lying flat in XZ, bottom face at y = 0
function plate(shape, t, name, mat, seg = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.name = name; return m;
}
function box(w, h, d, name, mat, r) {
  let g;
  if (r) { g = new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth: d, bevelEnabled: false, curveSegments: 8 }); g.center(); }
  else g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat); m.name = name; return m;
}
function cyl(rt, rb, h, name, mat, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.name = name; return m;
}
function ring(r, t, name, mat, seg = 40) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, seg), mat);
  m.rotation.x = Math.PI / 2; m.name = name; return m;
}
function tube(pts, r, name, mat, seg = 28) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 10, false), mat); m.name = name; return m;
}
function sphere(r, name, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat); m.name = name; return m;
}
// M2/M3 cap screw pointing up
function screw(name, r = 0.0016, headR = 0.0026, h = 0.0035) {
  const g = new THREE.Group(); g.name = name;
  const head = cyl(headR, headR, 0.0016, name + '-head', M.darkSteel, 18);
  head.position.y = 0.0008;
  const rec = cyl(headR * 0.5, headR * 0.5, 0.0008, name + '-hex', M.vent, 6);
  rec.position.y = 0.0014;
  const sh = cyl(r, r, h, name + '-shaft', M.steel, 14);
  sh.position.y = -h / 2;
  g.add(head, rec, sh); return g;
}
function around(n, r, fn) { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; fn(Math.cos(a) * r, Math.sin(a) * r, i, a); } }

/* ---------------- dimensions (metres) ----------------------------------- */
const ARM_R = 0.0778, PLATE_T = 0.004, STAND_H = 0.036;
const SX = 0.01525, SZ = 0.01525;   // 30.5 x 30.5 stack pattern
const CORNERS = [[SX, SZ], [SX, -SZ], [-SX, SZ], [-SX, -SZ]];
const MOT = [[1, -1], [-1, -1], [-1, 1], [1, 1]];
const R2 = Math.SQRT1_2;
// per-arm frame: d = outward along the arm, p = perpendicular (pad row direction)
const ARMS = MOT.map(([sx, sz]) => ({
  sx, sz,
  d: [sx * R2, sz * R2],
  p: [-sz * R2, sx * R2],
  yaw: Math.atan2(-sx * R2, -sz * R2)   // face the motor's wire exit inboard
}));
const PAD_R = 0.0184, PAD_GAP = 0.0036, PAD_Y = 0.0124;
function padPos(arm, k) {           // k = -1, 0, 1
  return [arm.d[0] * PAD_R + arm.p[0] * k * PAD_GAP, PAD_Y, arm.d[1] * PAD_R + arm.p[1] * k * PAD_GAP];
}

/* ---------------- motor (2207, inverted-bell rotor) --------------------- */
function motor(name) {
  const g = new THREE.Group(); g.name = name;

  // --- mounting base with four lugs ---
  const hub = cyl(0.0092, 0.0098, 0.0042, name + '-base-hub', M.motorNavy, 36);
  hub.position.y = 0.0021; g.add(hub);
  around(4, 0.0106, (x, z, i, a) => {
    const lug = box(0.0088, 0.0034, 0.0100, name + '-mount-lug-' + (i + 1), M.motorNavy, 0.0016);
    lug.position.set(x, 0.0017, z); lug.rotation.y = -a; g.add(lug);
    const eye = cyl(0.0038, 0.0038, 0.0036, name + '-lug-boss-' + (i + 1), M.motorNavy, 20);
    eye.position.set(x * 1.16, 0.0018, z * 1.16); g.add(eye);
    const hole = cyl(0.0017, 0.0017, 0.0040, name + '-lug-hole-' + (i + 1), M.vent, 14);
    hole.position.set(x * 1.16, 0.0018, z * 1.16); g.add(hole);
    const sc = screw(name + '-mount-screw-' + (i + 1), 0.0015, 0.0028, 0.0042);
    sc.position.set(x * 1.16, 0.0044, z * 1.16); g.add(sc);
  });

  // --- stator: laminations + windings, visible through the bell gaps ---
  const bearing = cyl(0.0058, 0.0064, 0.0030, name + '-bearing-boss', M.steel, 26);
  bearing.position.y = 0.0056; g.add(bearing);
  const lamBot = cyl(0.0113, 0.0113, 0.0010, name + '-stator-lamination-lower', M.laminate, 12);
  lamBot.position.y = 0.0052;
  const lamTop = cyl(0.0113, 0.0113, 0.0010, name + '-stator-lamination-upper', M.laminate, 12);
  lamTop.position.y = 0.0124;
  g.add(lamBot, lamTop);
  around(12, 0.0092, (x, z, i, a) => {
    const w = box(0.0044, 0.0068, 0.0040, name + '-winding-' + (i + 1), M.copper, 0.0012);
    w.position.set(x, 0.0088, z); w.rotation.y = -a; g.add(w);
  });
  const wireTie = ring(0.0100, 0.0008, name + '-winding-tie', M.wireBlk, 28);
  wireTie.position.y = 0.0122; g.add(wireTie);

  // --- rotor bell: navy skirt, open teal spoked top ---
  const skirt = cyl(0.0141, 0.0136, 0.0104, name + '-bell-skirt', M.motorNavy, 44);
  skirt.position.y = 0.0122; g.add(skirt);
  const skirtLip = ring(0.0140, 0.0011, name + '-bell-lip', M.motorNavy, 48);
  skirtLip.position.y = 0.0073; g.add(skirtLip);
  const magnets = cyl(0.0128, 0.0128, 0.0082, name + '-magnet-ring', M.magnet, 14);
  magnets.position.y = 0.0110; g.add(magnets);

  const topRing = cyl(0.0142, 0.0142, 0.0026, name + '-rotor-rim', M.motorTeal, 44);
  topRing.position.y = 0.0187; g.add(topRing);
  const rimInner = cyl(0.0128, 0.0128, 0.0009, name + '-rotor-rim-recess', M.vent, 40);
  rimInner.position.y = 0.0170; g.add(rimInner);
  const rotorHub = cyl(0.0056, 0.0060, 0.0050, name + '-rotor-hub', M.motorTeal, 30);
  rotorHub.position.y = 0.0182; g.add(rotorHub);
  around(6, 0.0092, (x, z, i, a) => {
    const spoke = box(0.0072, 0.0032, 0.0038, name + '-rotor-spoke-' + (i + 1), M.motorTeal, 0.0008);
    spoke.position.set(x, 0.0184, z); spoke.rotation.y = -a; g.add(spoke);
    const fin = box(0.0030, 0.0044, 0.0016, name + '-rotor-fin-' + (i + 1), M.motorTeal);
    fin.position.set(x * 1.28, 0.0178, z * 1.28); fin.rotation.y = -a - 0.5; g.add(fin);
  });

  // --- threaded M5 shaft ---
  const shaftBase = cyl(0.0040, 0.0044, 0.0042, name + '-shaft-shoulder', M.steel, 24);
  shaftBase.position.y = 0.0212;
  const shaft = cyl(0.0025, 0.0025, 0.0120, name + '-shaft-M5', M.steel, 22);
  shaft.position.y = 0.0288;
  g.add(shaftBase, shaft);
  for (let i = 0; i < 13; i++) {
    const th = ring(0.0025, 0.00035, name + '-shaft-thread-' + (i + 1), M.steel, 20);
    th.position.y = 0.0238 + i * 0.00080;
    th.rotation.z = 0.05; g.add(th);
  }

  const grommet = cyl(0.0022, 0.0022, 0.0042, name + '-phase-wire-grommet', M.tpu, 14);
  grommet.position.set(0, 0.0034, 0.0100); grommet.rotation.x = Math.PI / 2;
  g.add(grommet);
  return g;
}

/* ---------------- propeller (parametric swept airfoil blade) ------------- */
// NACA-ish section: closed loop, LE -> TE upper, TE -> LE lower. x in 0..1 chord.
function airfoilSection(n, thick) {
  const half = Math.floor(n / 2), up = [], lo = [];
  for (let i = 0; i < half; i++) {
    const x = 0.5 - 0.5 * Math.cos((i / (half - 1)) * Math.PI);
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = 4 * 0.035 * x * (1 - x);            // 3.5% camber
    up.push([x, yc + yt / 2]); lo.push([x, yc - yt / 2]);
  }
  return up.concat(lo.slice(1, -1).reverse());
}

// dir: +1 = CCW seen from above, -1 = CW. Pitch is real geometric pitch.
function bladeGeometry(dir, r0, r1, pitch) {
  const SPAN = 30, sec0 = airfoilSection(24, 0.11), NP = sec0.length;
  const pos = [], idx = [];
  for (let i = 0; i <= SPAN; i++) {
    const u = i / SPAN;
    const r = r0 + (r1 - r0) * u;
    const chord = 0.0046 + 0.0108 * Math.pow(Math.sin(Math.PI * Math.min(u * 0.96, 0.999)), 1.05);
    const thick = 0.115 - 0.055 * u;
    const theta = Math.atan2(pitch, 2 * Math.PI * r);        // pitch angle at this radius
    const A = -dir * 0.62 * Math.pow(u, 1.45);                // sweep, trailing the rotation
    const rise = 0.0026 * u * u;                              // rake
    const cx = Math.cos(A) * r, cz = Math.sin(A) * r;
    // chord axis (LE -> TE) is opposite the direction of travel
    const chx = dir * -Math.sin(A), chz = dir * Math.cos(A);
    const sec = airfoilSection(24, thick);
    for (let k = 0; k < NP; k++) {
      const xc = (sec[k][0] - 0.27) * chord, ya = sec[k][1] * chord;
      const X = xc * Math.cos(theta) + ya * Math.sin(theta);
      const Y = -xc * Math.sin(theta) + ya * Math.cos(theta);
      pos.push(cx + chx * X, rise + Y, cz + chz * X);
    }
  }
  for (let i = 0; i < SPAN; i++) {
    for (let k = 0; k < NP; k++) {
      const a = i * NP + k, b = i * NP + (k + 1) % NP;
      const c = (i + 1) * NP + k, d = (i + 1) * NP + (k + 1) % NP;
      idx.push(a, c, b, b, c, d);
    }
  }
  // tip cap
  const tipStart = SPAN * NP, cIdx = pos.length / 3;
  let tx = 0, ty = 0, tz = 0;
  for (let k = 0; k < NP; k++) { tx += pos[(tipStart + k) * 3]; ty += pos[(tipStart + k) * 3 + 1]; tz += pos[(tipStart + k) * 3 + 2]; }
  pos.push(tx / NP, ty / NP, tz / NP);
  for (let k = 0; k < NP; k++) idx.push(tipStart + k, tipStart + (k + 1) % NP, cIdx);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// direction arrow moulded into the hub top
function dirArrow(name, cw, mat) {
  const s = new THREE.Shape();
  s.moveTo(0.0000, 0.0000); s.lineTo(0.0030, 0.0016); s.lineTo(0.0030, 0.0006);
  s.lineTo(0.0092, 0.0006); s.lineTo(0.0092, -0.0006); s.lineTo(0.0030, -0.0006);
  s.lineTo(0.0030, -0.0016); s.lineTo(0.0000, 0.0000);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0006, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.rotation.y = cw ? Math.PI : 0;
  m.scale.z = cw ? -1 : 1;
  return m;
}

function propeller(name, cw) {
  const g = new THREE.Group(); g.name = name;
  const dir = cw ? -1 : 1;
  const mat = cw ? M.smokeCW : M.smoke;
  const mark = cw ? M.markCW : M.markCCW;
  const PITCH = 0.1092;                       // 4.3 in geometric pitch
  const geo = bladeGeometry(dir, 0.0082, 0.0640, PITCH);

  const hub = cyl(0.0082, 0.0088, 0.0070, name + '-hub', mat, 30);
  hub.position.y = 0.0035;
  const hubTop = cyl(0.0074, 0.0082, 0.0016, name + '-hub-crown', mat, 30);
  hubTop.position.y = 0.0078;
  const bore = cyl(0.0026, 0.0026, 0.0090, name + '-hub-bore-5mm', M.vent, 20);
  bore.position.y = 0.0040;
  g.add(hub, hubTop, bore);

  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.name = name + '-blade-' + (i + 1);
    pivot.rotation.y = dir * (i * Math.PI * 2 / 3);
    const blade = new THREE.Mesh(geo, mat);
    blade.name = name + '-blade-' + (i + 1) + '-surface';
    blade.position.y = 0.0034;
    const root = box(0.0092, 0.0052, 0.0130, name + '-blade-' + (i + 1) + '-root-fillet', mat, 0.0018);
    root.position.set(Math.cos(0) * 0.0098, 0.0038, 0);
    root.rotation.y = 0;
    pivot.add(blade, root);
    g.add(pivot);
  }

  const arrow = dirArrow(name + '-rotation-arrow-' + (cw ? 'cw' : 'ccw'), cw, mark);
  arrow.position.set(0, 0.0087, 0);
  g.add(arrow);
  const band = ring(0.0072, 0.0006, name + '-hub-' + (cw ? 'cw' : 'ccw') + '-band', mark, 28);
  band.position.y = 0.0086;
  g.add(band);

  const nut = cyl(0.0048, 0.0054, 0.0044, name + '-lock-nut-M5', M.motorNavy, 6);
  nut.position.y = 0.0108;
  const nutFlange = cyl(0.0060, 0.0060, 0.0010, name + '-lock-nut-flange', M.motorNavy, 24);
  nutFlange.position.y = 0.0091;
  const nyloc = cyl(0.0034, 0.0034, 0.0012, name + '-nyloc-insert', M.silk, 20);
  nyloc.position.y = 0.0126;
  g.add(nut, nutFlange, nyloc);
  return g;
}

/* ---------------- build -------------------------------------------------- */
export function buildDrone() {
  const root = new THREE.Group(); root.name = 'fpv-quad-5inch';
  const comp = {};
  const add = (id, label, group, explode) => {
    group.userData.component = id;
    root.add(group);
    comp[id] = { id, label, group, explode: new THREE.Vector3(...explode) };
    return group;
  };

  /* ---- frame ---- */
  const frame = new THREE.Group(); frame.name = 'frame';
  frame.add(plate(roundedRect(0.072, 0.104, 0.009), PLATE_T, 'bottom-plate', M.carbon));
  const bellyPlate = plate(roundedRect(0.052, 0.070, 0.008), 0.0012, 'belly-plate', M.carbonEdge);
  bellyPlate.position.y = -0.0013; frame.add(bellyPlate);
  MOT.forEach(([sx, sz], i) => {
    const armShape = roundedRect(0.0112, 0.0900, 0.0050);
    const arm = plate(armShape, PLATE_T, 'arm-' + (i + 1), M.carbon, 8);
    arm.position.set(sx * ARM_R * 0.55, 0, sz * ARM_R * 0.55);
    arm.rotation.y = (sx * sz > 0 ? 1 : -1) * Math.PI / 4;
    const pad = cyl(0.0158, 0.0158, PLATE_T - 0.0002, 'motor-pad-' + (i + 1), M.carbon, 30);
    pad.position.set(sx * ARM_R, PLATE_T / 2, sz * ARM_R);
    const padHole = cyl(0.0032, 0.0032, PLATE_T + 0.0006, 'arm-cable-slot-' + (i + 1), M.vent, 16);
    padHole.position.set(sx * (ARM_R - 0.020), PLATE_T / 2, sz * (ARM_R - 0.020));
    frame.add(arm, pad, padHole);
  });
  const topPlate = plate(roundedRect(0.036, 0.098, 0.007), 0.002, 'top-plate', M.carbon);
  topPlate.position.y = PLATE_T + STAND_H; frame.add(topPlate);
  const gripPad = plate(roundedRect(0.032, 0.078, 0.005), 0.0012, 'battery-grip-pad', M.strap);
  gripPad.position.y = PLATE_T + STAND_H + 0.002; frame.add(gripPad);
  CORNERS.forEach(([x, z], i) => {
    const s = cyl(0.0027, 0.0027, STAND_H, 'standoff-' + (i + 1), M.alu, 22);
    s.position.set(x, PLATE_T + STAND_H / 2, z);
    const flute = ring(0.0028, 0.0004, 'standoff-flute-' + (i + 1), M.darkSteel, 20);
    flute.position.set(x, PLATE_T + STAND_H - 0.004, z);
    const sc = screw('frame-screw-top-' + (i + 1), 0.0014, 0.0026, 0.004);
    sc.position.set(x, PLATE_T + STAND_H + 0.002, z);
    const sb = screw('frame-screw-bottom-' + (i + 1), 0.0014, 0.0026, 0.004);
    sb.position.set(x, -0.0013, z); sb.rotation.x = Math.PI;
    frame.add(s, flute, sc, sb);
  });
  [-1, 1].forEach((s, i) => {
    const post = plate(roundedRect(0.0028, 0.0300, 0.0012), 0.0225, 'camera-cage-' + (i + 1), M.carbon, 6);
    post.position.set(s * 0.0132, PLATE_T, -0.0330);
    post.rotation.set(0, Math.PI / 2, 0);
    frame.add(post);
  });
  const antMount = box(0.0140, 0.0090, 0.0110, 'antenna-mount-tpu', M.tpu, 0.0020);
  antMount.position.set(0, PLATE_T + STAND_H + 0.0045, 0.0510); frame.add(antMount);
  add('frame', 'Frame & arms', frame, [0, -0.055, 0]);

  /* ---- motors + props ---- */
  const motors = new THREE.Group(); motors.name = 'motors';
  const props = new THREE.Group(); props.name = 'propellers';
  ARMS.forEach((arm, i) => {
    const { sx, sz } = arm;
    const m = motor('motor-' + (i + 1));
    m.position.set(sx * ARM_R, PLATE_T, sz * ARM_R);
    m.rotation.y = arm.yaw;
    motors.add(m);
    const p = propeller('prop-' + (i + 1), (sx * sz) > 0);
    p.position.set(sx * ARM_R, PLATE_T + 0.0206, sz * ARM_R);
    props.add(p);
  });
  add('motors', 'Motors', motors, [0, 0.005, 0]);
  add('props', 'Propellers', props, [0, 0.090, 0]);

  /* ---- 4-in-1 ESC ---- */
  const esc = new THREE.Group(); esc.name = 'esc-4in1';
  const PCB_Y = 0.0105, PCB_T = 0.0016, TOP = PCB_Y + PCB_T;

  // board: 35.5 mm black square with four diagonal mounting ears
  const escPcb = plate(roundedRect(0.0355, 0.0355, 0.0026), PCB_T, 'esc-pcb', M.pcbBlack);
  escPcb.position.y = PCB_Y;
  esc.add(escPcb);
  ARMS.forEach((arm, i) => {
    const ear = cyl(0.0062, 0.0062, PCB_T, 'esc-mount-ear-' + (i + 1), M.pcbBlack, 26);
    ear.position.set(arm.d[0] * 0.0182, PCB_Y + PCB_T / 2, arm.d[1] * 0.0182);
    esc.add(ear);
  });
  CORNERS.forEach(([x, z], i) => {
    const holeRing = ring(0.0026, 0.0006, 'esc-mount-hole-ring-' + (i + 1), M.pad, 24);
    holeRing.position.set(x, TOP - 0.0002, z);
    const hole = cyl(0.0021, 0.0021, PCB_T + 0.0008, 'esc-mount-hole-' + (i + 1), M.vent, 20);
    hole.position.set(x, PCB_Y + PCB_T / 2, z);
    esc.add(holeRing, hole);
  });

  // gold castellations along all four edges
  for (let e = 0; e < 4; e++) {
    const ang = e * Math.PI / 2;
    for (let k = -3; k <= 3; k++) {
      if (k === 0) continue;
      const u = k * 0.0042;
      const px = Math.cos(ang) * 0.0176 - Math.sin(ang) * u;
      const pz = Math.sin(ang) * 0.0176 + Math.cos(ang) * u;
      const c = box(0.0022, PCB_T + 0.0003, 0.0026, 'esc-castellation-' + e + '-' + (k + 4), M.pad);
      c.position.set(px, PCB_Y + PCB_T / 2, pz);
      c.rotation.y = -ang;
      esc.add(c);
    }
  }

  // motor phase pads on the ears: three tinned gold pads per arm
  ARMS.forEach((arm, i) => {
    for (let k = -1; k <= 1; k++) {
      const [x, , z] = padPos(arm, k);
      const pd = cyl(0.0022, 0.0022, 0.0006, 'esc-motor-pad-' + (i + 1) + '-' + (k + 2), M.pad, 20);
      pd.position.set(x, TOP + 0.0002, z);
      const tin = cyl(0.0016, 0.0022, 0.0006, 'esc-motor-pad-tin-' + (i + 1) + '-' + (k + 2), M.steel, 20);
      tin.position.set(x, TOP + 0.0008, z);
      esc.add(pd, tin);
    }
  });

  // battery input pads, oversized, beside the capacitor
  [[1, 'positive'], [-1, 'negative']].forEach(([sgn, nm]) => {
    const pd = box(0.0060, 0.0006, 0.0044, 'esc-battery-pad-' + nm, M.pad, 0.0008);
    pd.position.set(sgn * 0.0108, TOP + 0.0003, 0.0136);
    const tin = box(0.0046, 0.0008, 0.0032, 'esc-battery-pad-tin-' + nm, M.steel, 0.0006);
    tin.position.set(sgn * 0.0108, TOP + 0.0009, 0.0136);
    const mark = box(0.0026, 0.0002, 0.0006, 'esc-battery-mark-' + nm, M.silk);
    mark.position.set(sgn * 0.0108, TOP + 0.0001, 0.0104);
    esc.add(pd, tin, mark);
    if (sgn > 0) {
      const cross = box(0.0006, 0.0002, 0.0026, 'esc-battery-mark-plus-bar', M.silk);
      cross.position.set(0.0108, TOP + 0.0001, 0.0104); esc.add(cross);
    }
  });

  // twelve MOSFETs, three per edge
  for (let e = 0; e < 4; e++) {
    const ang = e * Math.PI / 2;
    for (let k = -1; k <= 1; k++) {
      const u = k * 0.0072;
      const px = Math.cos(ang) * 0.0122 - Math.sin(ang) * u;
      const pz = Math.sin(ang) * 0.0122 + Math.cos(ang) * u;
      const f = box(0.0044, 0.0016, 0.0060, 'esc-mosfet-' + (e * 3 + k + 2), M.mosfet, 0.0006);
      f.position.set(px, TOP + 0.0008, pz);
      f.rotation.y = -ang;
      esc.add(f);
    }
  }

  // central cluster: four ESC MCUs, four gate drivers, passives
  [[-0.0042, -0.0042], [0.0042, -0.0042], [-0.0042, 0.0042], [0.0042, 0.0042]].forEach(([x, z], i) => {
    const mcu = box(0.0038, 0.0011, 0.0038, 'esc-mcu-' + (i + 1), M.chip);
    mcu.position.set(x, TOP + 0.00055, z);
    const dot = cyl(0.0004, 0.0004, 0.0003, 'esc-mcu-pin1-' + (i + 1), M.silk, 8);
    dot.position.set(x - 0.0013, TOP + 0.0012, z - 0.0013);
    esc.add(mcu, dot);
  });
  [[0, -0.0084], [0, 0.0084], [-0.0084, 0], [0.0084, 0]].forEach(([x, z], i) => {
    const drv = box(0.0030, 0.0009, 0.0030, 'esc-gate-driver-' + (i + 1), M.chip);
    drv.position.set(x, TOP + 0.00045, z);
    esc.add(drv);
  });
  const shunt = box(0.0052, 0.0008, 0.0022, 'esc-current-shunt', M.silk);
  shunt.position.set(0, TOP + 0.0004, -0.0126); esc.add(shunt);
  let pcount = 0;
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      if (Math.abs(gx) < 2 && Math.abs(gz) < 2) continue;
      if ((gx + gz) % 2) continue;
      pcount++;
      const p = box(0.0014, 0.0006, 0.0008, 'esc-passive-' + pcount, M.ceramicCap);
      p.position.set(gx * 0.0022, TOP + 0.0003, gz * 0.0022);
      esc.add(p);
    }
  }

  // 8-pin JST-SH socket on the rear edge
  const sock = box(0.0092, 0.0026, 0.0032, 'esc-jst-sh-socket', M.connWhite, 0.0004);
  sock.position.set(0, TOP + 0.0013, 0.0150);
  esc.add(sock);
  for (let i = 0; i < 8; i++) {
    const pin = box(0.0005, 0.0004, 0.0026, 'esc-jst-pin-' + (i + 1), M.pad);
    pin.position.set(-0.0035 + i * 0.0010, TOP + 0.0026, 0.0150);
    esc.add(pin);
  }

  // underside: MLCC filter array
  let cc = 0;
  for (let r = -1; r <= 2; r++) {
    for (let c2 = -4; c2 <= 4; c2++) {
      cc++;
      const mc = box(0.0016, 0.0010, 0.0026, 'esc-mlcc-' + cc, M.ceramicCap);
      mc.position.set(c2 * 0.0030, PCB_Y - 0.0005, r * 0.0032);
      esc.add(mc);
    }
  }

  // 1000 uF 35 V low-ESR capacitor, lying along the rear edge
  const capBody = cyl(0.0050, 0.0050, 0.0200, 'esc-capacitor-1000uf', M.capBody, 28);
  capBody.position.set(0, TOP + 0.0062, 0.0252); capBody.rotation.z = Math.PI / 2;
  const capWrap = ring(0.0051, 0.0009, 'esc-capacitor-stripe', M.capStripe, 28);
  capWrap.position.set(0, TOP + 0.0062, 0.0252); capWrap.rotation.set(0, 0, 0);
  capWrap.rotation.x = 0; capWrap.rotation.z = 0;
  const capEnd = cyl(0.0050, 0.0050, 0.0012, 'esc-capacitor-vent-end', M.plastic, 28);
  capEnd.position.set(0.0103, TOP + 0.0062, 0.0252); capEnd.rotation.z = Math.PI / 2;
  esc.add(capBody, capWrap, capEnd);
  [-1, 1].forEach(sgn => {
    const lead = tube([[sgn * 0.0022, TOP + 0.0032, 0.0252], [sgn * 0.0060, TOP + 0.0016, 0.0200], [sgn * 0.0108, TOP + 0.0006, 0.0136]],
      0.0006, 'esc-capacitor-lead-' + (sgn > 0 ? 'positive' : 'negative'), M.steel, 18);
    esc.add(lead);
  });

  // rubber soft-mount grommets in the mounting holes
  CORNERS.forEach(([x, z], i) => {
    const waist = cyl(0.0021, 0.0021, 0.0032, 'esc-grommet-' + (i + 1), M.tpu, 18);
    waist.position.set(x, PCB_Y - 0.0002, z);
    const fTop = cyl(0.0034, 0.0034, 0.0009, 'esc-grommet-flange-top-' + (i + 1), M.tpu, 20);
    fTop.position.set(x, TOP + 0.0004, z);
    const fBot = cyl(0.0034, 0.0034, 0.0009, 'esc-grommet-flange-bottom-' + (i + 1), M.tpu, 20);
    fBot.position.set(x, PCB_Y - 0.0020, z);
    esc.add(waist, fTop, fBot);
  });

  add('esc', 'ESC (4-in-1)', esc, [-0.105, 0.015, 0]);

  /* ---- flight controller ---- */
  const fc = new THREE.Group(); fc.name = 'flight-controller';
  const fcPcb = plate(roundedRect(0.0345, 0.0345, 0.0040), 0.0016, 'fc-pcb', M.pcbBlue);
  fcPcb.position.y = 0.0225; fc.add(fcPcb);
  const mcu = box(0.0092, 0.0018, 0.0092, 'fc-mcu-f722', M.chip);
  mcu.position.set(-0.0040, 0.0250, 0.0020);
  const mcuMark = box(0.0060, 0.0002, 0.0060, 'fc-mcu-marking', M.silk);
  mcuMark.position.set(-0.0040, 0.0260, 0.0020);
  const imu = box(0.0044, 0.0014, 0.0044, 'fc-gyro-icm42688', M.chip);
  imu.position.set(0.0085, 0.0248, -0.0060);
  const osd = box(0.0038, 0.0012, 0.0038, 'fc-osd-chip', M.chip);
  osd.position.set(0.0100, 0.0247, 0.0075);
  const bec = box(0.0050, 0.0016, 0.0032, 'fc-5v-regulator', M.chip);
  bec.position.set(-0.0110, 0.0249, -0.0090);
  fc.add(mcu, mcuMark, imu, osd, bec);
  const usb = box(0.0090, 0.0030, 0.0058, 'fc-usb-c-port', M.alu, 0.0012);
  usb.position.set(0, 0.0256, 0.0162);
  const usbSlot = box(0.0064, 0.0012, 0.0020, 'fc-usb-c-slot', M.vent);
  usbSlot.position.set(0, 0.0256, 0.0186);
  const boot = box(0.0022, 0.0012, 0.0022, 'fc-boot-button', M.silk);
  boot.position.set(0.0130, 0.0247, 0.0130);
  fc.add(usb, usbSlot, boot);
  [['fc-status-led-1', -0.0060], ['fc-status-led-2', -0.0028]].forEach(([n, x]) => {
    const l = box(0.0016, 0.0010, 0.0016, n, M.ledLens);
    l.position.set(x, 0.0246, -0.0140); fc.add(l);
  });
  for (let i = 0; i < 6; i++) {
    const p = cyl(0.0009, 0.0009, 0.0008, 'fc-uart-pad-' + (i + 1), M.pad, 12);
    p.position.set(-0.0148, 0.0245, -0.0100 + i * 0.0040); fc.add(p);
  }
  CORNERS.forEach(([x, z], i) => {
    const gr = cyl(0.0036, 0.0036, 0.0074, 'fc-grommet-' + (i + 1), M.tpu, 18);
    gr.position.set(x, 0.0196, z); fc.add(gr);
  });
  add('fc', 'Flight controller', fc, [0.105, 0.030, 0]);

  /* ---- VTX + antenna ---- */
  const vtx = new THREE.Group(); vtx.name = 'vtx';
  const vtxPcb = plate(roundedRect(0.0300, 0.0300, 0.0030), 0.0016, 'vtx-pcb', M.pcbRed);
  vtxPcb.position.y = 0.0320; vtx.add(vtxPcb);
  const hsBase = box(0.0180, 0.0016, 0.0180, 'vtx-heatsink-base', M.alu);
  hsBase.position.set(0, 0.0344, 0);
  vtx.add(hsBase);
  for (let i = 0; i < 6; i++) {
    const fin = box(0.0170, 0.0034, 0.0016, 'vtx-heatsink-fin-' + (i + 1), M.alu);
    fin.position.set(0, 0.0369, -0.0070 + i * 0.0028); vtx.add(fin);
  }
  const rfShield = box(0.0100, 0.0022, 0.0080, 'vtx-rf-shield', M.steel);
  rfShield.position.set(0, 0.0347, -0.0100); vtx.add(rfShield);
  // SMA jack on the board edge
  const SMA_Y = 0.0332, SMA_Z = 0.0150;
  const smaBase = cyl(0.0040, 0.0042, 0.0040, 'vtx-sma-base', M.alu, 22);
  smaBase.position.set(0, SMA_Y, SMA_Z + 0.0020); smaBase.rotation.x = Math.PI / 2;
  const smaHex = cyl(0.0042, 0.0042, 0.0030, 'vtx-sma-nut', M.darkSteel, 6);
  smaHex.position.set(0, SMA_Y, SMA_Z + 0.0055); smaHex.rotation.x = Math.PI / 2;
  const smaThread = cyl(0.0031, 0.0031, 0.0050, 'vtx-sma-thread', M.alu, 20);
  smaThread.position.set(0, SMA_Y, SMA_Z + 0.0095); smaThread.rotation.x = Math.PI / 2;
  vtx.add(smaBase, smaHex, smaThread);

  // antenna: one chain built along local +Y, seated on the SMA
  const ant = new THREE.Group();
  ant.name = 'vtx-antenna';
  ant.position.set(0, SMA_Y, SMA_Z + 0.0110);
  ant.rotation.x = -0.62;
  const ferrule = cyl(0.0034, 0.0038, 0.0060, 'antenna-connector-ferrule', M.alu, 20);
  ferrule.position.y = 0.0030;
  const relief = cyl(0.0030, 0.0034, 0.0070, 'antenna-strain-relief', M.shrink, 18);
  relief.position.y = 0.0092;
  const stalk = cyl(0.0022, 0.0026, 0.0330, 'antenna-coax-stalk', M.shrink, 18);
  stalk.position.y = 0.0290;
  const collar = cyl(0.0044, 0.0044, 0.0038, 'antenna-collar', M.plastic, 22);
  collar.position.y = 0.0474;
  const pod = cyl(0.0038, 0.0062, 0.0240, 'antenna-radome', M.plastic, 26);
  pod.position.y = 0.0613;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 20, 14), M.plastic);
  tip.name = 'antenna-tip'; tip.position.y = 0.0733;
  ant.add(ferrule, relief, stalk, collar, pod, tip);
  vtx.add(ant);

  add('vtx', 'Video transmitter + antenna', vtx, [0.020, 0.115, 0.020]);

  /* ---- FPV camera ---- */
  const cam = new THREE.Group(); cam.name = 'fpv-camera';
  const TILT = 0.34;
  const body = box(0.0190, 0.0190, 0.0140, 'camera-body', M.plastic, 0.0022);
  body.position.set(0, 0.0242, -0.0326); body.rotation.x = TILT;
  const bodyBack = box(0.0176, 0.0176, 0.0016, 'camera-pcb-back', M.pcbGreen, 0.0018);
  bodyBack.position.set(0, 0.0218, -0.0258); bodyBack.rotation.x = TILT;
  const holder = box(0.0154, 0.0154, 0.0060, 'camera-lens-holder', M.plastic, 0.0016);
  holder.position.set(0, 0.0270, -0.0392); holder.rotation.x = TILT;
  const lens = cyl(0.0072, 0.0079, 0.0120, 'camera-lens-barrel', M.plastic, 30);
  lens.position.set(0, 0.0288, -0.0428); lens.rotation.x = Math.PI / 2 + TILT;
  cam.add(body, bodyBack, holder, lens);
  for (let i = 0; i < 3; i++) {
    const th = ring(0.0074, 0.0006, 'camera-lens-thread-' + (i + 1), M.plastic, 24);
    th.position.set(0, 0.0284 - i * 0.0012, -0.0405 - i * 0.0034);
    th.rotation.x = TILT; cam.add(th);
  }
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.0060, 26, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
  glass.name = 'camera-lens-glass';
  glass.position.set(0, 0.0306, -0.0484); glass.rotation.x = Math.PI / 2 + TILT;
  const bezel = ring(0.0068, 0.0008, 'camera-lens-bezel', M.darkSteel, 26);
  bezel.position.set(0, 0.0302, -0.0478); bezel.rotation.x = TILT;
  cam.add(glass, bezel);
  [-1, 1].forEach((s, i) => {
    const br = box(0.0026, 0.0250, 0.0135, 'camera-mount-arm-' + (i + 1), M.tpu, 0.0010);
    br.position.set(s * 0.0112, 0.0248, -0.0320);
    const pivot = cyl(0.0028, 0.0028, 0.0034, 'camera-tilt-screw-' + (i + 1), M.darkSteel, 16);
    pivot.position.set(s * 0.0126, 0.0248, -0.0326); pivot.rotation.z = Math.PI / 2;
    cam.add(br, pivot);
  });
  const pig = tube([[0, 0.0208, -0.0262], [0, 0.0210, -0.0180], [0.0040, 0.0230, -0.0100]], 0.0012, 'camera-pigtail', M.wireBlk, 20);
  const plug = box(0.0046, 0.0026, 0.0060, 'camera-jst-plug', M.silk, 0.0006);
  plug.position.set(0.0055, 0.0236, -0.0074);
  cam.add(pig, plug);
  add('camera', 'FPV camera', cam, [0, 0.020, -0.105]);

  /* ---- receiver ---- */
  const rx = new THREE.Group(); rx.name = 'receiver';
  const RX_Y = 0.0300, RX_Z = 0.0330;
  const rxPcb = box(0.0122, 0.0016, 0.0200, 'rx-pcb', M.pcbGreen, 0.0010);
  rxPcb.position.set(0, RX_Y, RX_Z);
  const rxSoc = box(0.0050, 0.0014, 0.0050, 'rx-soc', M.chip);
  rxSoc.position.set(0, RX_Y + 0.0015, RX_Z - 0.0020);
  const rxLed = box(0.0014, 0.0010, 0.0014, 'rx-status-led', M.ledLens);
  rxLed.position.set(0.0040, RX_Y + 0.0013, RX_Z + 0.0060);
  const rxShrink = box(0.0134, 0.0046, 0.0206, 'rx-heatshrink', M.shrink, 0.0018);
  rxShrink.position.set(0, RX_Y + 0.0004, RX_Z);
  rx.add(rxPcb, rxSoc, rxLed, rxShrink);

  // two diversity antennas, each one connected chain off its u.FL jack
  [-1, 1].forEach((sgn, i) => {
    const jackX = sgn * 0.0036, jackZ = RX_Z + 0.0086;
    const ufl = cyl(0.0016, 0.0018, 0.0016, 'rx-ufl-jack-' + (i + 1), M.alu, 16);
    ufl.position.set(jackX, RX_Y + 0.0024, jackZ);
    rx.add(ufl);

    const arm = new THREE.Group();
    arm.name = 'rx-antenna-' + (i + 1);
    arm.position.set(jackX, RX_Y + 0.0030, jackZ);
    arm.rotation.set(-0.55, 0, -sgn * 0.85);   // 90 degrees between the two elements
    const boot = cyl(0.0014, 0.0017, 0.0030, 'rx-coax-boot-' + (i + 1), M.shrink, 14);
    boot.position.y = 0.0015;
    const coax = cyl(0.0009, 0.0009, 0.0150, 'rx-coax-' + (i + 1), M.wireBlk, 14);
    coax.position.y = 0.0105;
    const joint = cyl(0.0013, 0.0013, 0.0018, 'rx-antenna-joint-' + (i + 1), M.shrink, 14);
    joint.position.y = 0.0189;
    const element = cyl(0.0015, 0.0015, 0.0140, 'rx-antenna-element-' + (i + 1), M.wireWht, 16);
    element.position.y = 0.0268;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0015, 14, 10), M.wireWht);
    tip.name = 'rx-antenna-tip-' + (i + 1); tip.position.y = 0.0338;
    arm.add(boot, coax, joint, element, tip);
    rx.add(arm);
  });

  add('rx', 'Radio receiver', rx, [0, 0.045, 0.112]);

  /* ---- GPS ---- */
  const gps = new THREE.Group(); gps.name = 'gps';
  const mastFoot = cyl(0.0060, 0.0068, 0.0035, 'gps-mast-foot', M.tpu, 20);
  mastFoot.position.set(0, 0.0437, 0.0430);
  const mast = cyl(0.0028, 0.0032, 0.0290, 'gps-mast', M.plastic, 18);
  mast.position.set(0, 0.0580, 0.0430);
  const puck = box(0.0172, 0.0040, 0.0172, 'gps-module-housing', M.plastic, 0.0016);
  puck.position.set(0, 0.0735, 0.0430);
  const patch = box(0.0112, 0.0022, 0.0112, 'gps-patch-antenna', M.ceramic);
  patch.position.set(0, 0.0767, 0.0430);
  const patchFeed = cyl(0.0012, 0.0012, 0.0008, 'gps-antenna-feed', M.pad, 12);
  patchFeed.position.set(0.0030, 0.0779, 0.0430);
  const gpsLed = box(0.0016, 0.0010, 0.0016, 'gps-fix-led', M.ledLens);
  gpsLed.position.set(-0.0060, 0.0756, 0.0500);
  const gpsWire = tube([[0, 0.0715, 0.0430], [-0.0130, 0.0620, 0.0470], [-0.0230, 0.0430, 0.0420], [-0.0190, 0.0300, 0.0330]], 0.0014, 'gps-cable', M.wireBlk, 26);
  gps.add(mastFoot, mast, puck, patch, patchFeed, gpsLed, gpsWire);
  add('gps', 'GPS module', gps, [0, 0.105, 0.045]);

  /* ---- buzzer + LEDs ---- */
  const sig = new THREE.Group(); sig.name = 'buzzer-leds';
  const buz = cyl(0.0060, 0.0060, 0.0055, 'buzzer-can', M.plastic, 24);
  buz.position.set(-0.0230, -0.0002, 0.0430); buz.rotation.x = Math.PI;
  const buzHole = cyl(0.0016, 0.0016, 0.0014, 'buzzer-sound-port', M.vent, 14);
  buzHole.position.set(-0.0230, -0.0032, 0.0430);
  const buzLead = tube([[-0.0230, 0.0020, 0.0430], [-0.0190, 0.0090, 0.0400], [-0.0150, 0.0210, 0.0330]], 0.0010, 'buzzer-lead', M.wireRed, 20);
  sig.add(buz, buzHole, buzLead);
  MOT.forEach(([sx, sz], i) => {
    const stripBase = box(0.0100, 0.0018, 0.0090, 'led-strip-' + (i + 1), M.pcbGreen, 0.0008);
    stripBase.position.set(sx * (ARM_R - 0.0195), PLATE_T + 0.0011, sz * (ARM_R - 0.0195));
    stripBase.rotation.y = (sx * sz > 0 ? 1 : -1) * Math.PI / 4;
    sig.add(stripBase);
    for (let d = 0; d < 3; d++) {
      const led = box(0.0022, 0.0014, 0.0022, 'led-' + (i + 1) + '-' + (d + 1), M.ledRed);
      const off = (d - 1) * 0.0030;
      led.position.set(sx * (ARM_R - 0.0195) + off * (sx * sz > 0 ? 0.7 : 0.7), PLATE_T + 0.0027, sz * (ARM_R - 0.0195) - off * 0.7);
      sig.add(led);
    }
  });
  add('signals', 'Buzzer & LEDs', sig, [0, -0.032, 0.062]);

  /* ---- wiring ---- */
  const wires = new THREE.Group(); wires.name = 'wiring';
  ARMS.forEach((arm, i) => {
    const [dx, dz] = arm.d, [px, pz] = arm.p;
    for (let k = -1; k <= 1; k++) {
      const exit = [dx * (ARM_R - 0.0128) + px * k * 0.0022, 0.0048, dz * (ARM_R - 0.0128) + pz * k * 0.0022];
      const mid  = [dx * 0.045 + px * k * 0.0028, 0.0060, dz * 0.045 + pz * k * 0.0028];
      const rise = [dx * 0.026 + px * k * PAD_GAP, 0.0104, dz * 0.026 + pz * k * PAD_GAP];
      const pad  = padPos(arm, k);
      const w = tube([exit, mid, rise, [pad[0], pad[1] + 0.0012, pad[2]]], 0.0010,
        'motor-wire-' + (i + 1) + '-' + (k + 2), k === 0 ? M.wireRed : M.wireBlk, 26);
      wires.add(w);
      const fillet = new THREE.Mesh(new THREE.ConeGeometry(0.0018, 0.0020, 16), M.steel);
      fillet.name = 'solder-joint-' + (i + 1) + '-' + (k + 2);
      fillet.position.set(pad[0], pad[1] + 0.0011, pad[2]);
      wires.add(fillet);
    }
  });
  const plugLo = box(0.0094, 0.0022, 0.0034, 'jst-plug-esc-end', M.connWhite, 0.0004);
  plugLo.position.set(0, 0.0142, 0.0150);
  const plugHi = box(0.0094, 0.0022, 0.0034, 'jst-plug-fc-end', M.connWhite, 0.0004);
  plugHi.position.set(0, 0.0214, 0.0150);
  wires.add(plugLo, plugHi);
  for (let i = 0; i < 8; i++) {
    const x = -0.0035 + i * 0.0010;
    const w = tube([[x, 0.0152, 0.0150], [x * 1.5, 0.0172, 0.0178], [x * 1.5, 0.0192, 0.0178], [x, 0.0206, 0.0150]],
      0.00035, 'esc-fc-signal-' + (i + 1), M.wireBlk, 18);
    wires.add(w);
  }
  const rxLead = tube([[-0.0150, 0.0234, -0.0010], [-0.0168, 0.0262, 0.0130], [-0.0090, 0.0292, 0.0282]], 0.0009, 'receiver-lead', M.wireWht, 22);
  const vtxLead = tube([[0.0150, 0.0234, -0.0010], [0.0168, 0.0284, 0.0110], [0.0090, 0.0320, 0.0170]], 0.0009, 'vtx-lead', M.wireWht, 22);
  wires.add(rxLead, vtxLead);
  add('wiring', 'Wiring & solder joints', wires, [0, -0.105, 0]);

  /* ---- power lead ---- */
  const pwr = new THREE.Group(); pwr.name = 'power-lead';
  const xt = box(0.0158, 0.0084, 0.0150, 'xt60-housing', M.yellow, 0.0012);
  xt.position.set(0, 0.0300, 0.0640);
  pwr.add(xt);
  [-1, 1].forEach(s => {
    const bullet = cyl(0.0019, 0.0019, 0.0060, 'xt60-contact-' + (s > 0 ? 'positive' : 'negative'), M.pad, 16);
    bullet.position.set(s * 0.0042, 0.0300, 0.0706); bullet.rotation.x = Math.PI / 2;
    const rib = box(0.0014, 0.0082, 0.0138, 'xt60-key-rib-' + (s > 0 ? 'r' : 'l'), M.yellow);
    rib.position.set(s * 0.0082, 0.0300, 0.0640);
    const w = tube([[s * 0.0042, 0.0288, 0.0570], [s * 0.0070, 0.0232, 0.0430], [s * 0.0110, 0.0170, 0.0290], [s * 0.0118, 0.0141, 0.0142]],
      0.0020, 'power-wire-' + (s > 0 ? 'positive' : 'negative'), s > 0 ? M.wireRed : M.wireBlk, 26);
    const sl = cyl(0.0025, 0.0025, 0.0070, 'power-wire-shrink-' + (s > 0 ? 'r' : 'l'), M.shrink, 14);
    sl.position.set(s * 0.0042, 0.0294, 0.0594); sl.rotation.x = Math.PI / 2 - 0.35;
    const joint = new THREE.Mesh(new THREE.ConeGeometry(0.0026, 0.0026, 18), M.steel);
    joint.name = 'power-solder-joint-' + (s > 0 ? 'positive' : 'negative');
    joint.position.set(s * 0.0118, 0.0146, 0.0142);
    pwr.add(bullet, rib, w, sl, joint);
  });
  add('power', 'Power lead (XT60)', pwr, [0, 0.018, 0.130]);

  /* ---- battery ---- */
  const bat = new THREE.Group(); bat.name = 'battery';
  const cell = box(0.0360, 0.0280, 0.0760, 'lipo-pack', M.lipo, 0.0030);
  cell.position.set(0, 0.0560, 0.0060);
  const label = box(0.0300, 0.0006, 0.0330, 'lipo-label', M.lipoLabel);
  label.position.set(0, 0.0701, 0.0060);
  const seam = box(0.0364, 0.0010, 0.0764, 'lipo-seam', M.strap);
  seam.position.set(0, 0.0560, 0.0060);
  bat.add(cell, label, seam);
  [-0.0130, 0.0270].forEach((z, i) => {
    const n = 'battery-strap-' + (i + 1);
    const top = box(0.0376, 0.0016, 0.0150, n + '-top', M.strap);
    top.position.set(0, 0.0708, z);
    const bot = box(0.0376, 0.0016, 0.0150, n + '-bottom', M.strap);
    bot.position.set(0, 0.0412, z);
    [-1, 1].forEach(sgn => {
      const side = box(0.0016, 0.0296, 0.0150, n + (sgn > 0 ? '-right' : '-left'), M.strap);
      side.position.set(sgn * 0.0188, 0.0560, z);
      bat.add(side);
    });
    bat.add(top, bot);
  });
  const buckle = box(0.0170, 0.0044, 0.0110, 'strap-buckle', M.plastic, 0.0012);
  buckle.position.set(0, 0.0726, -0.0130); bat.add(buckle);
  const balPlug = box(0.0130, 0.0048, 0.0058, 'balance-plug', M.silk, 0.0008);
  balPlug.position.set(-0.0090, 0.0452, 0.0470); bat.add(balPlug);
  [-1, 1].forEach(sgn => {
    const w = tube([[sgn * 0.0042, 0.0450, 0.0400], [sgn * 0.0046, 0.0380, 0.0560], [sgn * 0.0042, 0.0318, 0.0596]],
      0.0020, 'battery-lead-' + (sgn > 0 ? 'positive' : 'negative'), sgn > 0 ? M.wireRed : M.wireBlk, 22);
    bat.add(w);
  });
  add('battery', 'LiPo battery', bat, [0, 0.145, 0.020]);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, components: comp, materials: M };
}
