import * as THREE from 'three';
import { buildDrone } from './drone-model.js';

/* ------------------------------------------------------------------ data */

const PARTS = {
  frame: {
    label: 'Frame & arms', role: 'Structure',
    body: 'A unibody carbon-fibre plate carries the four arms; a thinner top plate sandwiches the electronics between aluminium standoffs. Arm thickness sets how much of a crash the airframe absorbs before the arm, rather than the motor, gives way.',
    specs: [['Size', '5" / 220 mm diagonal'], ['Bottom plate', '4 mm 3K carbon'], ['Arms', '10 mm wide, replaceable'], ['Stack mount', '30.5 × 30.5 mm'], ['Weight', '≈ 110 g']],
    note: 'Carbon dust is conductive and an irritant. Cut and sand only with extraction and a mask.'
  },
  motors: {
    label: 'Motors', role: 'Propulsion',
    body: 'Four brushless outrunner motors. The four-digit code reads stator diameter and height: a 2207 has a 22 mm wide, 7 mm tall stator. KV is rpm per volt with no load — lower KV with more cells gives the same speed at better efficiency.',
    specs: [['Size', '2207'], ['KV', '1750 KV (6S)'], ['Poles', '12N14P'], ['Shaft', 'M5 threaded'], ['Rotation', 'CW / CCW pairs']],
    note: 'Motor screws that are 1 mm too long reach the stator windings and short the motor. Always test-fit before torquing.'
  },
  props: {
    label: 'Propellers', role: 'Propulsion',
    body: 'Three-blade 5-inch polycarbonate props. Diameter and pitch (5×4.3) set thrust against speed. Diagonal pairs spin the same direction; props in props-out is the common freestyle convention.',
    specs: [['Diameter', '5.1 in / 127 mm'], ['Pitch', '4.3 in'], ['Blades', '3'], ['Bore', '5 mm'], ['Torque', 'hand-tight + 1/8 turn']],
    note: 'Props go on last, after every other check. A chipped or cracked blade is scrap — never fly it.'
  },
  esc: {
    label: 'ESC (4-in-1)', role: 'Power & control',
    body: 'One board with four independent ESCs. Each has its own MCU and gate driver feeding a bank of MOSFETs that commutate one motor\'s three phases. Twelve gold pads on the corner ears take the motor wires; the low-ESR capacitor across the battery input absorbs switching spikes and cleans up video noise. An 8-pin JST-SH ribbon carries throttle and telemetry to the flight controller.',
    specs: [['Rating', '45 A continuous per motor'], ['Input', '3–6S LiPo'], ['Protocol', 'DShot600'], ['Firmware', 'BLHeli_32 / AM32'], ['Capacitor', '35 V 1000 µF low-ESR'], ['Mounting', '30.5 × 30.5 mm on grommets']],
    note: 'Never power the board without the capacitor fitted. Spikes on plug-in are what kills most ESCs.'
  },
  fc: {
    label: 'Flight controller', role: 'Control',
    body: 'The gyro-and-accelerometer board that reads how the aircraft is actually moving, compares it against stick input, and corrects 8000 times a second. Everything else — receiver, VTX, GPS, buzzer — talks to it over UART.',
    specs: [['MCU', 'STM32 F722'], ['IMU', 'ICM-42688-P'], ['UARTs', '6'], ['Mounting', '30.5 mm, soft-mounted'], ['Firmware', 'Betaflight']],
    note: 'Soft-mount grommets are not decoration. A hard-mounted FC passes frame vibration straight into the gyro.'
  },
  vtx: {
    label: 'Video transmitter + antenna', role: 'Video',
    body: 'Takes the camera\'s analogue feed and broadcasts it on 5.8 GHz to the pilot\'s goggles. Output power is switchable; the circularly polarised antenna keeps the picture stable while the aircraft rolls.',
    specs: [['Band', '5.8 GHz, 40 channels'], ['Power', '25 / 200 / 400 / 800 mW'], ['Control', 'SmartAudio over UART'], ['Antenna', 'RHCP stubby'], ['Connector', 'SMA / MMCX']],
    note: 'Powering a VTX with no antenna attached destroys the output stage within seconds.'
  },
  camera: {
    label: 'FPV camera', role: 'Video',
    body: 'A small analogue camera on an adjustable tilt mount. Tilt sets how far ahead the pilot sees: more tilt for speed, less for hovering and cinematic work. The sensor\'s dynamic range decides whether you can still see when flying out of a shadow into sun.',
    specs: [['Sensor', '1/1.8" CMOS'], ['Aspect', '4:3 / 16:9 switchable'], ['Lens', '2.1 mm M12'], ['Latency', '< 12 ms'], ['Tilt', '20–35°']],
    note: 'Route the camera cable away from the props and leave slack — the mount has to be able to rotate.'
  },
  rx: {
    label: 'Radio receiver', role: 'Control link',
    body: 'Receives stick commands from the transmitter and passes them to the FC as one serial stream. It also carries telemetry back. Antenna placement matters more than antenna quality: keep the two elements at 90° to each other and clear of carbon.',
    specs: [['Protocol', 'ELRS 2.4 GHz'], ['Link', 'CRSF over UART'], ['Rate', '250 Hz'], ['Antennas', '2, diversity'], ['Voltage', '5 V']],
    note: 'Carbon fibre blocks 2.4 GHz. An antenna taped flat to the frame is the usual cause of a failsafe.'
  },
  gps: {
    label: 'GPS module', role: 'Navigation',
    body: 'A receiver and patch antenna on a mast, high and clear of the noisy electronics below it. It gives the FC position and heading, which is what makes rescue modes and return-to-home possible. Most units also include a magnetometer.',
    specs: [['Constellations', 'GPS + GLONASS + Galileo'], ['Update', '10 Hz'], ['Compass', 'QMC5883L'], ['Interface', 'UART, 5 V'], ['Fix', '3D fix, 8+ satellites']],
    note: 'Mount it at least 30 mm above the VTX. RF noise from below is what keeps a module from getting a fix.'
  },
  signals: {
    label: 'Buzzer & LEDs', role: 'Support',
    body: 'A self-powered buzzer finds a crashed aircraft in long grass and warns on low battery. Addressable LEDs on the arm ends give orientation in the air and status on the ground — arming state, failsafe, battery warnings.',
    specs: [['Buzzer', '5 V active, 100 dB'], ['Backup', 'onboard cell'], ['LEDs', 'WS2812B addressable'], ['Data', 'single-wire from FC'], ['Draw', '≈ 60 mA per strip']],
    note: 'Many competitions and clubs require a working lost-model buzzer before you are allowed to fly.'
  },
  wiring: {
    label: 'Wiring & solder joints', role: 'Assembly',
    body: 'Twelve motor phase wires down to the ESC pads, plus the ESC-to-FC harness. A good joint is shiny, slightly concave and wets both the pad and the wire. Route wires inside the arm channel so a prop strike cannot reach them.',
    specs: [['Wire', '20 AWG silicone, motor phases'], ['Iron', '350 °C, chisel tip'], ['Solder', '63/37 leaded, 0.8 mm'], ['Flux', 'no-clean, rosin'], ['Phase order', 'any — swap two to reverse']],
    note: 'A dull grey blob is a cold joint. It will pass a bench test and fail in flight from vibration.'
  },
  power: {
    label: 'Power lead (XT60)', role: 'Power',
    body: 'The battery connector and its two heavy leads to the ESC input. Polarity is fixed by the housing, but a reversed solder joint at the board end will destroy the whole stack on the first plug-in.',
    specs: [['Connector', 'XT60 male on aircraft'], ['Wire', '14 AWG silicone'], ['Length', '≈ 60 mm'], ['Rating', '60 A continuous'], ['Check', 'continuity before first power-up']],
    note: 'First power-up goes through a smoke-stopper, never straight onto a battery.'
  },
  battery: {
    label: 'LiPo battery', role: 'Power',
    body: 'A lithium-polymer pack, strapped on the top plate over a grip pad. Cell count sets voltage, capacity sets flight time, C-rating sets how hard it can be discharged. Position it fore or aft to trim the centre of gravity onto the props.',
    specs: [['Cells', '6S — 22.2 V nominal'], ['Capacity', '1300 mAh'], ['C-rating', '120C'], ['Storage', '3.80 V per cell'], ['Land at', '3.60 V per cell under load']],
    note: 'Charge and store LiPos in a fireproof bag, never unattended. A puffed or punctured pack is retired immediately.'
  }
};

const STEPS = [
  { t: 'Bench & safety briefing', s: 'tools · ppe · lipo', show: 'ALL', focus: null,
    body: 'Before anything is unpacked: this is the aircraft you are building. Orbit it, then work down the sequence. Props stay off the bench until step 13.',
    list: ['Soldering iron, 350 °C, chisel tip', 'Hex drivers: 1.5, 2.0, 2.5 mm', 'Side cutters, tweezers, helping hands', 'Multimeter and smoke-stopper', 'Safety glasses — mandatory when props are on', 'Fireproof LiPo bag'],
    warn: 'Never power a build with props fitted. Never solder a live circuit. Battery is the last thing in and the first thing out.' },
  { t: 'Frame & arms', s: 'frame', show: ['frame'], focus: 'frame',
    body: 'Fit the arms to the bottom plate and set the standoffs. Tighten to a cross pattern so the plate stays flat. Leave the top plate off — everything else goes in under it.' },
  { t: 'Motors', s: 'motors', show: ['frame', 'motors'], focus: 'motors',
    body: 'Four motors on the arm ends, screws from underneath. Check screw length against the motor bell depth first. Note which two spin clockwise: diagonal pairs match.' },
  { t: '4-in-1 ESC', s: 'esc', show: ['frame', 'motors', 'esc'], focus: 'esc',
    body: 'The ESC sits lowest in the stack, on soft grommets, capacitor facing the rear. Orient the board so the motor pads land nearest their own arm.' },
  { t: 'Motor wires & solder joints', s: 'wiring', show: ['frame', 'motors', 'esc', 'wiring'], focus: 'wiring',
    body: 'Trim each phase wire to length, tin the pad, then the wire, then join. Twelve joints total. Phase order does not matter — swapping any two reverses that motor.' },
  { t: 'Flight controller', s: 'fc', show: ['frame', 'motors', 'esc', 'wiring', 'fc'], focus: 'fc',
    body: 'Stack the FC above the ESC on the same grommets, arrow forward. Connect the ESC harness. Every later component plugs into this board.' },
  { t: 'Radio receiver', s: 'rx', show: ['frame', 'motors', 'esc', 'wiring', 'fc', 'rx'], focus: 'rx',
    body: 'Solder or plug the receiver to a spare UART. Bind it to the transmitter now, on the bench, before it is buried under the top plate.' },
  { t: 'VTX & antenna', s: 'vtx', show: ['frame', 'motors', 'esc', 'wiring', 'fc', 'rx', 'vtx'], focus: 'vtx',
    body: 'VTX on top of the stack where air can reach the heatsink. Fit the antenna before the board ever sees power.' },
  { t: 'FPV camera', s: 'camera', show: ['frame', 'motors', 'esc', 'wiring', 'fc', 'rx', 'vtx', 'camera'], focus: 'camera',
    body: 'Camera between the front standoffs. Set tilt to about 25° for general flying, then tighten just enough to hold it.' },
  { t: 'GPS module', s: 'gps', show: ['frame', 'motors', 'esc', 'wiring', 'fc', 'rx', 'vtx', 'camera', 'gps'], focus: 'gps',
    body: 'Mast at the rear, puck facing the sky, well above the VTX. Wire to a UART and enable the compass in configuration.' },
  { t: 'Buzzer & LEDs', s: 'signals', show: ['frame', 'motors', 'esc', 'wiring', 'fc', 'rx', 'vtx', 'camera', 'gps', 'signals'], focus: 'signals',
    body: 'Buzzer under the rear plate, pointing down and out. LED strips on the arm ends, data daisy-chained back to the FC.' },
  { t: 'Power lead & battery', s: 'power', show: ['frame', 'motors', 'esc', 'wiring', 'fc', 'rx', 'vtx', 'camera', 'gps', 'signals', 'power', 'battery'], focus: 'power',
    body: 'Solder the XT60 to the ESC input, red to positive. Check continuity, then first power-up through a smoke-stopper with no props. Fit the top plate and strap the pack.' },
  { t: 'Props on — final checks', s: 'props', show: 'ALL', focus: 'props',
    body: 'Motor direction confirmed, arming checked, failsafe tested. Only then do props go on: matched rotation per corner, hand-tight plus an eighth turn.' }
];

const QUIZ = [
  { q: 'What do the four digits in a "2207" motor tell you?', o: ['Stator width and height in millimetres', 'Maximum current and voltage', 'Prop size and pitch', 'Bearing and shaft diameter'], a: 0,
    fb: '22 mm stator diameter, 7 mm stator height. Bigger stator, more torque and more weight.' },
  { q: 'Why does a 4-in-1 ESC need its large capacitor?', o: ['To store energy for hovering', 'To absorb voltage spikes and clean video noise', 'To slow the motors on landing', 'To power the buzzer when unplugged'], a: 1,
    fb: 'Switching motors and plug-in inrush both create spikes. The cap absorbs them — running without it kills ESCs and adds lines to the video.' },
  { q: 'A student mounts the flight controller hard against the top plate, no grommets. What fails first?', o: ['The receiver loses range', 'The battery drains faster', 'The gyro reads frame vibration and the quad oscillates', 'The GPS cannot get a fix'], a: 2,
    fb: 'Soft mounting isolates the IMU. Hard-mounted, vibration enters the gyro and the PID loop chases it.' },
  { q: 'When do propellers go onto the aircraft?', o: ['Right after the motors, to check fit', 'Before the first power-up', 'After motor direction, arming and failsafe are all confirmed', 'Whenever convenient — they are safe unarmed'], a: 2,
    fb: 'Props last, always. Everything that can be tested without them, is.' },
  { q: 'A receiver antenna is taped flat along a carbon arm. What is the risk?', o: ['Nothing, carbon is RF-transparent', 'The signal is blocked and the aircraft failsafes', 'The antenna overheats', 'Telemetry reverses'], a: 1,
    fb: 'Carbon fibre blocks 2.4 GHz. Keep both elements clear of the frame and at 90° to each other.' },
  { part: 'esc', q: 'Find the part: click the board that drives the four motors.', fb: 'The 4-in-1 ESC — lowest board in the stack, capacitor at the rear.' }
];

/* ------------------------------------------------------------------ setup */

const stage = document.getElementById('stage');
const { THREE: T } = await stage.ready;
const { root, components } = buildDrone();
stage.setObject(root);
// aspect-aware framing: the quad is wide and flat, so a portrait stage is
// limited by horizontal FOV, not vertical. Refit on resize too.
function frame() {
  const c = stage._camera, ctl = stage._controls;
  const obj = stage._object || root;
  const b = new T.Box3().setFromObject(obj);
  if (b.isEmpty()) return;
  const sph = b.getBoundingSphere(new T.Sphere());
  const vHalf = (c.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * c.aspect);
  const dist = (sph.radius / Math.tan(Math.min(vHalf, hHalf))) * 1.12;
  const dir = c.position.clone().sub(ctl.target);
  if (dir.lengthSq() < 1e-9) dir.set(1, 0.55, 1.25);
  dir.normalize();
  ctl.target.copy(sph.center);
  c.position.copy(sph.center).addScaledVector(dir, dist);
  c.near = Math.max(dist / 100, 0.005);
  c.far = dist * 100;
  c.updateProjectionMatrix();
  ctl.update();
}
frame();
let touched = false;
let refitQueued = false;
stage._controls.addEventListener('start', () => { touched = true; });
new ResizeObserver(() => {
  if (touched || refitQueued) return;
  refitQueued = true;
  requestAnimationFrame(() => { refitQueued = false; frame(); });
}).observe(stage);

const ids = Object.keys(components);
const base = {};
ids.forEach(id => { base[id] = components[id].group.position.clone(); });

// per-component ghost materials, so dimming one part never dims another
const ghostCache = new Map();
function ghostOf(mat) {
  if (!ghostCache.has(mat)) {
    const g = mat.clone();
    g.name = mat.name + '-ghost';
    g.transparent = true; g.opacity = 0.10; g.depthWrite = false;
    ghostCache.set(mat, g);
  }
  return ghostCache.get(mat);
}
ids.forEach(id => {
  components[id].group.traverse(o => { if (o.isMesh) o.userData.mat = o.material; });
});
function setGhost(id, on) {
  components[id].group.traverse(o => {
    if (o.isMesh) o.material = on ? ghostOf(o.userData.mat) : o.userData.mat;
  });
}

const state = {
  mode: 'assembled',
  rail: 'steps',
  solo: null,
  step: 0,
  sel: null,
  explode: 0,
  labels: false,
  tab: 'lesson',
  done: new Set(JSON.parse(localStorage.getItem('fpvLabDone') || '[]')),
  quiz: {}
};

/* ------------------------------------------------------------------ 3d state */

function visibleSet() {
  const show = STEPS[state.step].show;
  return show === 'ALL' ? new Set(ids) : new Set(show);
}

function applyScene() {
  if (state.solo) return;
  const vis = visibleSet();
  const wiring = state.mode === 'wiring';
  const t = state.explode / 100;
  ids.forEach(id => {
    const c = components[id];
    const on = vis.has(id) && !(wiring && (id === 'battery' || id === 'props'));
    c.group.visible = on;
    c.group.position.copy(base[id]).addScaledVector(c.explode, t);
    let ghost = false;
    if (state.sel && state.sel !== id) ghost = true;
    if (wiring && !state.sel) ghost = !['wiring', 'power', 'esc', 'fc', 'motors'].includes(id);
    setGhost(id, ghost && on);
  });
}

/* labels projected from the live camera */
const labelHost = document.getElementById('labels');
const labelEls = {};
ids.forEach(id => {
  const el = document.createElement('button');
  el.className = 'lbl';
  el.style.display = 'none';
  el.textContent = components[id].label;
  el.onclick = () => select(id);
  labelHost.appendChild(el);
  labelEls[id] = el;
});
const boxV = new T.Box3(), ctr = new T.Vector3();
function tickLabels() {
  const cam = stage._camera;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (state.solo) {
    soloLabels.forEach(l => {
      if (!l.el) return;
      boxV.setFromObject(l.obj);
      if (boxV.isEmpty()) return;
      boxV.getCenter(ctr); ctr.y = boxV.min.y;
      ctr.project(cam);
      l.el.style.display = 'block';
      l.el.style.left = ((ctr.x + 1) / 2 * w) + 'px';
      l.el.style.top = (((-ctr.y + 1) / 2 * h) + 20) + 'px';
    });
  }
  const show = (state.labels || state.explode > 5) && !state.solo;
  ids.forEach(id => {
    const el = labelEls[id], g = components[id].group;
    if (!show || !g.visible) { el.style.display = 'none'; return; }
    boxV.setFromObject(g);
    if (boxV.isEmpty()) { el.style.display = 'none'; return; }
    boxV.getCenter(ctr).project(cam);
    if (ctr.z > 1) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = ((ctr.x + 1) / 2 * w) + 'px';
    el.style.top = ((-ctr.y + 1) / 2 * h) + 'px';
    el.classList.toggle('on', state.sel === id);
  });
  requestAnimationFrame(tickLabels);
}
requestAnimationFrame(tickLabels);

/* click to select */
const ray = new T.Raycaster(), ptr = new T.Vector2();
let down = null;
stage.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
stage.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const r = stage.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, stage._camera);
  const hits = ray.intersectObject(stage._object || root, true).filter(h => h.object.visible && h.object.material.opacity !== 0.10);
  if (!hits.length) { select(null); return; }
  let o = hits[0].object, id = null;
  while (o && !id) { if (o.userData.component) id = o.userData.component; o = o.parent; }
  select(id);
});

function select(id) {
  if (state.quizTarget) { answerFind(id); return; }
  if (state.solo) { state.sel = state.solo; state.tab = 'part'; render(); return; }
  state.sel = (id === state.sel) ? null : id;
  if (state.sel) { state.tab = 'part'; }
  render();
}

/* ---- parts library: load one component alone into the viewer ---------- */
// repeated components open as a single representative unit
const SOLO_UNITS = {
  motors: [[0, 'One 2207 motor']],
  props:  [[0, 'CCW — front-right & rear-left'], [1, 'CW — front-left & rear-right']]
};
let soloLabels = [];

function setSolo(id) {
  state.solo = id || null;
  soloLabels.forEach(l => l.el.remove());
  soloLabels = [];
  document.getElementById('soloBar').hidden = !id;
  if (!id) {
    stage.setObject(root);
    stage.setAttribute('name', 'fpv-5inch-quad');
    touched = false; frame();
    state.sel = null; state.tab = 'lesson';
    render(); return;
  }
  setGhost(id, false);
  const src = components[id].group;
  const wasVisible = src.visible; src.visible = true;
  let g;
  if (SOLO_UNITS[id]) {
    g = new T.Group();
    const units = SOLO_UNITS[id].map(([i]) => src.children[i].clone(true));
    const sizes = units.map(u => new T.Box3().setFromObject(u).getSize(new T.Vector3()));
    const gap = Math.max(...sizes.map(s => s.x)) * 0.45;
    let x = 0;
    units.forEach((u, k) => {
      const b = new T.Box3().setFromObject(u), c = b.getCenter(new T.Vector3());
      u.position.sub(new T.Vector3(c.x, b.min.y, c.z));
      u.position.x += x;
      g.add(u);
      soloLabels.push({ obj: u, text: SOLO_UNITS[id][k][1] });
      x += sizes[k].x + gap;
    });
  } else {
    g = src.clone(true);
  }
  src.visible = wasVisible;
  g.name = id;
  g.position.set(0, 0, 0);
  const b = new T.Box3().setFromObject(g), c = b.getCenter(new T.Vector3());
  g.position.set(-c.x, -b.min.y, -c.z);
  stage.setObject(g);
  stage.setAttribute('name', 'fpv-' + id);
  soloLabels.forEach(l => {
    const el = document.createElement('span');
    el.className = 'lbl';
    el.style.display = 'none';
    el.textContent = l.text;
    labelHost.appendChild(el);
    l.el = el;
  });
  touched = false; frame();
  state.sel = id; state.tab = 'part';
  render();
}
document.getElementById('exitSolo').onclick = () => setSolo(null);

/* ------------------------------------------------------------------ ui */

const pane = document.getElementById('pane');
const stepList = document.getElementById('stepList');

document.getElementById('modes').onclick = e => {
  const b = e.target.closest('button[data-mode]'); if (!b) return;
  if (state.solo) setSolo(null);
  state.mode = b.dataset.mode;
  if (state.mode === 'exploded') { state.explode = 100; }
  if (state.mode === 'assembled') { state.explode = 0; }
  if (state.mode === 'wiring') { state.explode = 0; state.sel = null; }
  document.getElementById('explode').value = state.explode;
  render();
};
document.getElementById('explode').oninput = e => {
  state.explode = +e.target.value;
  state.mode = state.explode > 5 ? 'exploded' : (state.mode === 'wiring' ? 'wiring' : 'assembled');
  render();
};
document.getElementById('labelToggle').onclick = e => {
  state.labels = !state.labels;
  e.currentTarget.textContent = 'Labels: ' + (state.labels ? 'on' : 'off');
  e.currentTarget.setAttribute('aria-pressed', String(state.labels));
};
document.getElementById('reset').onclick = () => { if (state.solo) { setSolo(null); return; } state.sel = null; state.step = 0; render(); };
document.getElementById('railTabs').onclick = e => {
  const b = e.target.closest('button[data-rail]'); if (!b) return;
  state.rail = b.dataset.rail; render();
};
document.getElementById('tabs').onclick = e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  state.tab = b.dataset.tab; render();
};
stepList.onclick = e => {
  const pli = e.target.closest('li[data-part]');
  if (pli) { setSolo(pli.dataset.part === state.solo ? null : pli.dataset.part); return; }
  const li = e.target.closest('li[data-i]'); if (!li) return;
  const i = +li.dataset.i;
  if (state.solo) setSolo(null);
  if (e.target.closest('.n')) {
    state.done.has(i) ? state.done.delete(i) : state.done.add(i);
    localStorage.setItem('fpvLabDone', JSON.stringify([...state.done]));
  } else {
    state.step = i; state.sel = STEPS[i].focus; state.tab = state.sel ? 'part' : 'lesson';
  }
  render();
};

function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function renderRail() {
  if (state.rail === 'parts') {
    stepList.innerHTML = ids.map((id, i) =>
      `<li class="part" data-part="${id}" aria-pressed="${state.solo === id}">
         <span class="n">${String(i + 1).padStart(2, '0')}</span>
         <span><span class="lb">${esc(PARTS[id].label)}</span><span class="sub">${esc(PARTS[id].role.toLowerCase())} · open alone</span></span>
       </li>`).join('');
  } else {
    stepList.innerHTML = STEPS.map((s, i) =>
      `<li data-i="${i}" class="${state.done.has(i) ? 'done' : ''}" aria-current="${i === state.step}">
         <span class="n">${state.done.has(i) ? '✓' : i + 1}</span>
         <span><span class="lb">${esc(s.t)}</span><span class="sub">${esc(s.s)}</span></span>
       </li>`).join('');
  }
  const n = state.done.size;
  document.getElementById('progTxt').textContent = n + ' / ' + STEPS.length;
  document.getElementById('progBar').style.width = (n / STEPS.length * 100) + '%';
}

function partCard(id) {
  const p = PARTS[id];
  return `<h2>${esc(p.label)}</h2>
    <div class="chips"><span class="chip">${esc(p.role)}</span><span class="chip">part ${ids.indexOf(id) + 1} of ${ids.length}</span></div>
    <p style="margin-top:14px">${esc(p.body)}</p>
    <dl class="kv">${p.specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="note"><b>Watch out.</b> ${esc(p.note)}</div>
    <div class="row">
      ${state.solo === id
        ? `<button class="btn pri" data-act="exit">Back to full assembly</button>`
        : `<button class="btn pri" data-act="lib">Open this part alone</button>
           <button class="btn" data-act="iso">Isolate in assembly</button>`}
      <button class="btn" data-act="clear">Show all</button>
    </div>`;
}

function lessonCard() {
  const s = STEPS[state.step];
  return `<h2>${esc(s.t)}</h2>
    <div class="chips"><span class="chip">step ${state.step + 1} of ${STEPS.length}</span>${s.focus ? `<span class="chip" aria-pressed="true">${esc(PARTS[s.focus].label)}</span>` : ''}</div>
    <p style="margin-top:14px">${esc(s.body)}</p>
    ${s.list ? `<h3>On the bench</h3><ul class="plain">${s.list.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    ${s.warn ? `<div class="note"><b>Safety.</b> ${esc(s.warn)}</div>` : ''}
    <div class="row">
      <button class="btn" data-act="prev" ${state.step === 0 ? 'disabled' : ''}>Back</button>
      <button class="btn pri" data-act="next" ${state.step === STEPS.length - 1 ? 'disabled' : ''}>Next step</button>
      <button class="btn" data-act="mark">${state.done.has(state.step) ? 'Mark undone' : 'Mark complete'}</button>
    </div>`;
}

function quizCard() {
  return QUIZ.map((q, i) => {
    if (q.part) {
      const got = state.quiz[i];
      return `<div class="q"><span class="qn">FIND ${i + 1}</span><p>${esc(q.q)}</p>
        <div class="opts"><button class="opt ${got === true ? 'good' : got ? 'bad' : ''}" data-find="${i}">${state.quizTarget === i ? 'Now click the part in the 3D view…' : (got === true ? 'Correct' : 'Start')}</button></div>
        ${got ? `<div class="fb">${esc(q.fb)}</div>` : ''}</div>`;
    }
    const picked = state.quiz[i];
    return `<div class="q"><span class="qn">Q${i + 1}</span><p>${esc(q.q)}</p>
      <div class="opts">${q.o.map((o, j) => {
        let cls = '';
        if (picked != null) cls = j === q.a ? 'good' : (j === picked ? 'bad' : '');
        return `<button class="opt ${cls}" data-q="${i}" data-o="${j}">${esc(o)}</button>`;
      }).join('')}</div>
      ${picked != null ? `<div class="fb">${esc(q.fb)}</div>` : ''}</div>`;
  }).join('');
}

pane.onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'lib') { setSolo(state.sel); return; }
  if (act === 'exit') { setSolo(null); return; }
  if (act === 'iso') { state.explode = 40; document.getElementById('explode').value = 40; }
  if (act === 'clear') { if (state.solo) { setSolo(null); return; } state.sel = null; }
  if (act === 'prev') { state.step = Math.max(0, state.step - 1); state.sel = STEPS[state.step].focus; }
  if (act === 'next') {
    state.done.add(state.step);
    localStorage.setItem('fpvLabDone', JSON.stringify([...state.done]));
    state.step = Math.min(STEPS.length - 1, state.step + 1);
    state.sel = STEPS[state.step].focus;
  }
  if (act === 'mark') {
    state.done.has(state.step) ? state.done.delete(state.step) : state.done.add(state.step);
    localStorage.setItem('fpvLabDone', JSON.stringify([...state.done]));
  }
  if (b.dataset.q != null) { state.quiz[+b.dataset.q] = +b.dataset.o; }
  if (b.dataset.find != null) {
    if (state.solo) setSolo(null);
    state.quizTarget = +b.dataset.find;
    state.sel = null; state.step = 0;
    const qb = document.getElementById('quizBar');
    qb.hidden = false; qb.classList.add('live');
    qb.textContent = 'Find the part — click it in the view';
  }
  render();
};

function answerFind(id) {
  const i = state.quizTarget;
  state.quiz[i] = id === QUIZ[i].part;
  state.quizTarget = null;
  state.tab = 'quiz';
  const qb = document.getElementById('quizBar');
  qb.hidden = true; qb.classList.remove('live');
  render();
}

function render() {
  document.querySelectorAll('#modes button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  document.querySelectorAll('#tabs button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)));
  document.querySelectorAll('#railTabs button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.rail === state.rail)));
  if (state.tab === 'part' && !state.sel) state.tab = 'lesson';
  pane.innerHTML = state.tab === 'part' ? partCard(state.sel)
    : state.tab === 'quiz' ? quizCard() : lessonCard();
  renderRail();
  applyScene();
}

render();
