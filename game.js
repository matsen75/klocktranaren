'use strict';
/* =========================================================
   Klocktränaren – lär dig klockan, analog och digital
   ========================================================= */

/* ---------- Småhjälpare ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = n => String(n).padStart(2, '0');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const n12 = h => (((h % 12) + 12) % 12) || 12;

let TIMERS = [];
const later = (fn, ms) => { const id = setTimeout(fn, ms); TIMERS.push(id); return id; };
const every = (fn, ms) => { const id = setInterval(fn, ms); TIMERS.push(id); return id; };
const clearTimers = () => { TIMERS.forEach(id => { clearTimeout(id); clearInterval(id); }); TIMERS = []; };
let keyHandler = null;
document.addEventListener('keydown', e => { if (keyHandler) keyHandler(e); });

/* ---------- Sparning ---------- */
const SAVE_KEY = 'klocktranaren-v1';
const defaultState = () => ({
  name: '', coins: 0, coinsEarned: 0, stars: {}, bosses: {}, totalCorrect: 0, bestStreak: 0,
  badges: [], avatars: ['🧒', '👦', '👧'], avatar: '🧒', skins: ['klassisk'], skin: 'klassisk',
  sound: true, speakAuto: false, help: true, quickBest: 0, bought: false, lvl: 1, unlockAll: false,
});
let S = load();
function load() {
  try { const r = localStorage.getItem(SAVE_KEY); if (r) return Object.assign(defaultState(), JSON.parse(r)); } catch (e) { /* ingen lagring */ }
  return defaultState();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ingen lagring */ } }

/* ---------- Ljud ---------- */
let AC = null;
function beep(freq, dur, type = 'sine', vol = .15, when = 0) {
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) { /* inget ljud */ }
}
const SFX = {
  ok: () => { beep(660, .12, 'sine', .15); beep(990, .2, 'sine', .15, .1); },
  bad: () => { beep(220, .25, 'square', .07); beep(170, .3, 'square', .07, .12); },
  hit: () => { beep(140, .2, 'sawtooth', .12); beep(90, .3, 'square', .08, .06); },
  hurt: () => { beep(320, .15, 'sawtooth', .1); beep(160, .35, 'sawtooth', .1, .1); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, .3, 'triangle', .14, i * .12)),
  coin: () => { beep(1200, .08, 'square', .05); beep(1600, .12, 'square', .05, .06); },
  click: () => beep(520, .05, 'sine', .05),
};
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'sv-SE'; u.rate = .9;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('sv'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* ingen uppläsning */ }
}

/* ---------- Svenska klockuttryck ---------- */
const HN = ['tolv', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva'];
const NUM = ['noll', 'en', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv', 'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton', 'nitton', 'tjugo', 'tjugoen', 'tjugotvå', 'tjugotre', 'tjugofyra'];
const hourName = h => HN[((h % 12) + 12) % 12];
const minText = n => n === 1 ? 'en minut' : `${NUM[n]} minuter`;
function phrase(h, m) {
  const H = hourName(h), N = hourName(h + 1);
  const fixed = {
    0: `klockan ${H}`, 5: `fem över ${H}`, 10: `tio över ${H}`, 15: `kvart över ${H}`, 20: `tjugo över ${H}`,
    25: `fem i halv ${N}`, 30: `halv ${N}`, 35: `fem över halv ${N}`, 40: `tjugo i ${N}`,
    45: `kvart i ${N}`, 50: `tio i ${N}`, 55: `fem i ${N}`,
  };
  if (fixed[m]) return fixed[m];
  if (m < 25) return `${minText(m)} över ${H}`;
  if (m < 30) return `${minText(30 - m)} i halv ${N}`;
  if (m < 40) return `${minText(m - 30)} över halv ${N}`;
  return `${minText(60 - m)} i ${N}`;
}
function dayPart(h) {
  if (h < 5) return 'på natten';
  if (h < 10) return 'på morgonen';
  if (h < 12) return 'på förmiddagen';
  if (h < 18) return 'på eftermiddagen';
  return 'på kvällen';
}
const DAYPARTS = ['på morgonen', 'på förmiddagen', 'på eftermiddagen', 'på kvällen', 'på natten'];
const fmt12 = (h, m) => `${n12(h)}:${pad(m)}`;
const fmt24 = (h, m) => `${pad(((h % 24) + 24) % 24)}:${pad(m)}`;
function deltaText(d) {
  return ({ 15: 'en kvart', 30: 'en halvtimme', 45: 'tre kvart', 60: 'en timme', 90: 'en och en halv timme', 120: 'två timmar' })[d] || minText(d);
}
function tipFor(t) {
  const m = t.m, next = hourName(t.h + 1);
  if (m === 0) return 'Stora visaren pekar rakt upp på 12 – då är det en hel timme. Lilla visaren visar vilken timme det är.';
  if (m === 30) return `”Halv ${next}” betyder att det är en halvtimme kvar tills klockan blir ${next}. Lilla visaren står mitt emellan ${n12(t.h)} och ${n12(t.h + 1)}.`;
  if (m === 15) return 'Kvart över: stora visaren pekar på 3. En kvart är 15 minuter.';
  if (m === 45) return `Kvart i: stora visaren pekar på 9. Det är 15 minuter kvar tills klockan blir ${next}.`;
  if (m > 20 && m < 40) return 'När stora visaren är nära 6 räknar vi från halv: ”fem i halv”, ”fem över halv”.';
  if (m < 30) return 'Stora visaren är på högra sidan – då säger vi ”över”. Varje siffra är 5 minuter.';
  return `Stora visaren är på vänstra sidan – då närmar vi oss ${next}, och vi säger ”i”. Varje siffra är 5 minuter.`;
}

/* ---------- Utseende ---------- */
const SKINS = {
  klassisk: { n: 'Klassisk', p: 0, face: '#ffffff', rim: '#264653', num: '#264653', hour: '#e63946', min: '#1d3557' },
  hav: { n: 'Havet', p: 40, face: '#caf0f8', rim: '#0077b6', num: '#023e8a', hour: '#ff6b35', min: '#03045e' },
  djungel: { n: 'Djungeln', p: 60, face: '#d8f3dc', rim: '#2d6a4f', num: '#1b4332', hour: '#f77f00', min: '#081c15' },
  godis: { n: 'Godis', p: 90, face: '#ffe5ec', rim: '#ff8fab', num: '#c9184a', hour: '#7209b7', min: '#3a0ca3' },
  rymd: { n: 'Rymden', p: 140, face: '#10002b', rim: '#7b2cbf', num: '#e0aaff', hour: '#ffd60a', min: '#80ffdb' },
  guld: { n: 'Guld', p: 250, face: '#fff8dc', rim: '#d4a017', num: '#7f5539', hour: '#9d0208', min: '#3d405b' },
};
const AVATARS = [
  ['🧒', 0], ['👦', 0], ['👧', 0], ['🦊', 20], ['🐸', 25], ['🐼', 35], ['🐯', 45], ['🦖', 60], ['🦄', 75],
  ['🤖', 90], ['🐲', 110], ['🦸', 130], ['🥷', 160], ['🧑‍🚀', 200], ['🦁', 240],
];

function clockSVG(h, m, o = {}) {
  const size = o.size || 240, sk = SKINS[o.skin || S.skin] || SKINS.klassisk;
  const P = (a, r) => [(Math.sin(a) * r).toFixed(1), (-Math.cos(a) * r).toFixed(1)];
  let s = `<svg class="clock" ${o.id ? `id="${o.id}"` : ''} viewBox="-135 -135 270 270" width="${size}" height="${size}" role="img" aria-label="Analog klocka">`;
  s += `<circle r="118" fill="${sk.rim}"/><circle r="108" fill="${sk.face}"/>`;
  for (let i = 0; i < 60; i++) {
    const a = i * Math.PI / 30, big = i % 5 === 0, [x1, y1] = P(a, big ? 93 : 99), [x2, y2] = P(a, 104);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${sk.num}" stroke-width="${big ? 3.5 : 1.5}" stroke-linecap="round"/>`;
  }
  for (let n = 1; n <= 12; n++) {
    const [x, y] = P(n * Math.PI / 6, 77);
    s += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="23" font-weight="700" fill="${sk.num}" font-family="Fredoka, sans-serif">${n}</text>`;
  }
  if (o.help) {
    for (let n = 0; n < 12; n++) {
      const [x, y] = P(n * Math.PI / 6, 127);
      s += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="600" fill="#6c757d" font-family="Fredoka, sans-serif">${pad(n * 5)}</text>`;
    }
  }
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
  s += `<g class="hand-h" transform="rotate(${ha})"><line x1="0" y1="12" x2="0" y2="-52" stroke="${sk.hour}" stroke-width="10" stroke-linecap="round"/></g>`;
  s += `<g class="hand-m" transform="rotate(${ma})"><line x1="0" y1="14" x2="0" y2="-88" stroke="${sk.min}" stroke-width="6" stroke-linecap="round"/></g>`;
  s += `<circle r="7" fill="${sk.min}"/><circle r="3" fill="${sk.face}"/></svg>`;
  return s;
}

/* ---------- Världar ---------- */
const five = () => rnd(0, 11) * 5;
const BASE_LEVELS = [
  { n: 'Läs klockan', i: '👀', t: ['readChoice', 'matchAnalog'] },
  { n: 'Ställ klockan', i: '✋', t: ['set', 'set', 'readDigitalChoice'] },
  { n: 'Digitalt', i: '📟', t: ['typeDigital', 'phraseToDigital', 'digitalToPhrase'] },
];
const TRAVEL = { n: 'Tidsresa', i: '🚀', t: ['addTime'] };
const BOSS_TYPES = {
  analog: ['readChoice', 'set', 'matchAnalog', 'readDigitalChoice'],
  digital: ['typeDigital', 'phraseToDigital', 'digitalToPhrase'],
  final1: ['match24', 'set24', 'readChoice'],
  final2: ['to24Type', 'from24Phrase', 'addTime'],
};
const WORLDS = [
  {
    id: 'w1', name: 'Hela timmar', icon: '🌅', color: '#ffb703', mins: [0], step: 60,
    desc: 'Stora visaren pekar på 12. Lilla visaren visar timmen.', levels: BASE_LEVELS,
    boss: { name: 'Tick-Tack-Trollet', emoji: '👹', kind: 'analog', hp: 6, time: 45, intro: 'Hoho! Ingen kan läsa MINA klockor! Mina visare är för kluriga!' },
  },
  {
    id: 'w2', name: 'Halvtimmar', icon: '🌗', color: '#fb8500', mins: [0, 30, 30], step: 30,
    desc: 'Halv fyra betyder halvvägs till fyra – alltså 3:30!', levels: BASE_LEVELS,
    boss: { name: 'Siffer-Spindeln', emoji: '🕷️', kind: 'digital', hp: 7, time: 45, intro: 'Jag har spunnit in alla digitala klockor i mitt nät! Kan du lösa koden?' },
  },
  {
    id: 'w3', name: 'Kvartar', icon: '🍀', color: '#52b788', mins: [0, 15, 15, 30, 45, 45], step: 15, deltas: [15, 30, 45, 60],
    desc: 'Kvart över och kvart i. En kvart är 15 minuter.', levels: [...BASE_LEVELS, TRAVEL],
    boss: { name: 'Kvart-Kraken', emoji: '🐙', kind: 'analog', hp: 8, time: 45, intro: 'Med mina åtta armar snurrar jag alla visare åt fel håll! Blubb!' },
  },
  {
    id: 'w4', name: 'Fem minuter', icon: '🖐️', color: '#4cc9f0', mins: five, step: 5, deltas: [5, 10, 15, 20, 30, 45],
    desc: 'Varje siffra på klockan är 5 minuter för stora visaren.', levels: [...BASE_LEVELS, TRAVEL],
    boss: { name: 'Glitch Pixelroboten', emoji: '🤖', kind: 'digital', hp: 9, time: 40, intro: 'BZZT! JAG HAR HACKAT ALLA DIGITALA KLOCKOR. FEL. FEL. FEL.' },
  },
  {
    id: 'w5', name: 'Varje minut', icon: '🔍', color: '#9b5de5', mins: () => rnd(0, 59), step: 1, deltas: [3, 5, 10, 15, 20, 30],
    desc: 'Räkna de små strecken – varje streck är en minut.', levels: [...BASE_LEVELS, TRAVEL],
    boss: { name: 'Sekund-Spöket', emoji: '👻', kind: 'analog', hp: 10, time: 50, intro: 'Buuu! Jag gömmer mig mellan de små minutstrecken...' },
  },
  {
    id: 'w6', name: 'Dygnet runt', icon: '🌙', color: '#3a0ca3', mins: five, step: 5, h24: true, deltas: [15, 30, 45, 60, 90, 120],
    desc: 'Digitala klockor går till 24. 15:00 är tre på eftermiddagen.',
    levels: [
      { n: 'Fm & em', i: '🌞', t: ['from24Phrase', 'to24Type'] },
      { n: 'Analog 24h', i: '🕰️', t: ['match24', 'set24'] },
      { n: 'Tidsresa', i: '🚀', t: ['addTime'] },
    ],
    boss: { name: 'Klockmästaren Kronox', emoji: '🧙‍♂️', emoji2: '👾', kind: 'final', hp: 12, time: 45, intro: 'Jag är Kronox, härskare över ALL tid! Först besegrar jag dig med analoga klockor... och sedan med digitala!' },
  },
];
WORLDS.forEach(w => { w.allowed = m => Array.isArray(w.mins) ? w.mins.includes(m) : (m % w.step === 0); });

const levelKey = (wi, li) => `${WORLDS[wi].id}-${li}`;
const worldOpen = wi => S.unlockAll || wi === 0 || !!S.bosses[WORLDS[wi - 1].id];
const levelOpen = (wi, li) => worldOpen(wi) && (S.unlockAll || li === 0 || (S.stars[levelKey(wi, li - 1)] || 0) >= 1);
const bossOpen = wi => worldOpen(wi) && (S.unlockAll || WORLDS[wi].levels.every((_, li) => (S.stars[levelKey(wi, li)] || 0) >= 1));
const totalStars = () => Object.values(S.stars).reduce((a, b) => a + b, 0);
const helpOn = w => S.help && w.step <= 15;

/* ---------- Frågegenerator ---------- */
function randTime(w) {
  const m = typeof w.mins === 'function' ? w.mins() : pick(w.mins);
  const h = w.h24 ? rnd(6, 23) : rnd(1, 12);
  return { h, m };
}
const normT = (t, full) => ({ h: full ? ((t.h % 24) + 24) % 24 : n12(t.h), m: ((t.m % 60) + 60) % 60 });
const sameT = (a, b, full) => (full ? a.h === b.h : n12(a.h) === n12(b.h)) && a.m === b.m;
function distract(t, w, n = 3, full = false) {
  const s = Math.min(w.step, 60);
  const T = normT(t, full);
  const cands = shuffle([
    { h: t.h + 1, m: t.m }, { h: t.h - 1, m: t.m },
    { h: Math.round(t.m / 5) || 12, m: (n12(t.h) % 12) * 5 },
    { h: t.h, m: t.m + s }, { h: t.h, m: t.m - s },
    { h: 12 - n12(t.h), m: 60 - t.m }, { h: t.h, m: t.m + 30 }, { h: t.h + 1, m: t.m + s },
  ]).map(x => normT(x, full));
  const out = [];
  const ok = x => w.allowed(x.m) && ![T, ...out].some(y => sameT(x, y, full));
  for (const x of cands) { if (out.length >= n) break; if (ok(x)) out.push(x); }
  let guard = 0;
  while (out.length < n && guard++ < 300) { const x = normT(randTime(w), full); if (ok(x)) out.push(x); }
  return out;
}
function addMin(t, d, full) {
  const tot = t.h * 60 + t.m + d;
  const h = Math.floor(tot / 60), m = ((tot % 60) + 60) % 60;
  return full ? { h: ((h % 24) + 24) % 24, m } : { h: n12(h), m };
}
const choicesOf = (list, label) => shuffle(list.map((x, i) => ({ label: label(x), t: x, correct: i === 0 })));
const lcd = (txt, cls = 'huge') => `<div class="lcd ${cls}">${txt}</div>`;
const big = txt => `<div class="bigtext">${txt}</div>`;

function makeQ(type, w) {
  const t = randTime(w);
  const P = x => cap(phrase(x.h, x.m));
  const P24 = x => cap(`${phrase(x.h, x.m)} ${dayPart(x.h)}`);
  const D = x => fmt12(x.h, x.m);
  const help = helpOn(w);
  const sol = { t, h24: false };
  const acc12 = (h, m) => n12(h) === n12(t.h) && m === t.m;
  const acc24 = (h, m) => h === t.h && m === t.m;
  const useDigital = w.id !== 'w1' && Math.random() < .5;
  switch (type) {
    case 'readChoice':
      return { ui: 'choice', prompt: 'Vad är klockan?', stim: clockSVG(t.h, t.m, { help }), choices: choicesOf([t, ...distract(t, w)], P), sol };
    case 'readDigitalChoice':
      return { ui: 'lcdchoice', prompt: 'Vilken digital tid visar klockan?', stim: clockSVG(t.h, t.m, { help }), choices: choicesOf([t, ...distract(t, w)], D), sol };
    case 'matchAnalog': {
      const label = useDigital ? D(t) : P(t);
      return { ui: 'clocks', prompt: 'Vilken klocka visar', say: `Vilken klocka visar ${label}?`, stim: useDigital ? lcd(label) : big(label), choices: choicesOf([t, ...distract(t, w)], x => x), sol };
    }
    case 'set': {
      const label = useDigital ? D(t) : P(t);
      return { ui: 'set', prompt: 'Ställ klockan på', say: `Ställ klockan på ${label}`, stim: useDigital ? lcd(label, '') : big(label), target: t, sol };
    }
    case 'typeDigital':
      return { ui: 'keypad', prompt: 'Skriv tiden digitalt', stim: clockSVG(t.h, t.m, { help, size: 200 }), accept: acc12, sol };
    case 'phraseToDigital':
      return { ui: 'keypad', prompt: 'Skriv tiden digitalt', say: `Skriv ${phrase(t.h, t.m)} digitalt`, stim: big(P(t)), accept: acc12, sol };
    case 'digitalToPhrase':
      return { ui: 'choice', prompt: 'Hur säger man den här tiden?', stim: lcd(D(t)), choices: choicesOf([t, ...distract(t, w)], P), sol };
    case 'addTime': {
      const full = !!w.h24, d = pick(w.deltas), end = addMin(t, d, full);
      const lab = full ? (x => fmt24(x.h, x.m)) : D;
      const startTxt = full ? `${phrase(t.h, t.m)} ${dayPart(t.h)}` : phrase(t.h, t.m);
      const dist = distract(end, { ...w, allowed: () => true }, 2, full);
      const wrongDir = addMin(t, -d, full);
      const opts = [end, ...dist];
      if (![end, ...dist].some(x => sameT(x, wrongDir, full))) opts.push(wrongDir); else opts.push(...distract(end, { ...w, allowed: () => true }, 3, full).filter(x => !opts.some(y => sameT(x, y, full))).slice(0, 1));
      return {
        ui: 'lcdchoice', prompt: `Klockan är ${startTxt}. Vad är klockan om ${deltaText(d)}?`,
        stim: full ? lcd(fmt24(t.h, t.m), '') : clockSVG(t.h, t.m, { help, size: 190 }),
        choices: choicesOf(opts.slice(0, 4), lab), sol: { t: end, h24: full, startFrom: t, d },
      };
    }
    case 'from24Phrase': {
      if (Math.random() < .7 && t.h < 12) t.h += 12;
      if (t.h > 23) t.h -= 12;
      const myPart = dayPart(t.h);
      const others = shuffle(DAYPARTS.filter(p => p !== myPart));
      const opts = [`${phrase(t.h, t.m)} ${myPart}`, `${phrase(t.h, t.m)} ${others[0]}`, `${phrase(t.h + 1, t.m)} ${myPart}`, `${phrase(t.h - 1, t.m)} ${others[1]}`];
      return { ui: 'choice', prompt: 'Vad betyder tiden?', stim: lcd(fmt24(t.h, t.m)), choices: shuffle(opts.map((o, i) => ({ label: cap(o), correct: i === 0 }))), sol: { t, h24: true } };
    }
    case 'to24Type':
      if (Math.random() < .7 && t.h < 12) t.h += 12;
      return { ui: 'keypad', prompt: 'Skriv tiden med 24-timmarsklocka', say: `Skriv ${phrase(t.h, t.m)} ${dayPart(t.h)} med 24-timmarsklocka`, stim: big(P24(t)), accept: acc24, hint24: true, sol: { t, h24: true } };
    case 'match24':
      if (Math.random() < .7 && t.h < 12) t.h += 12;
      return { ui: 'clocks', prompt: 'Vilken klocka visar', say: `Vilken klocka visar ${fmt24(t.h, t.m)}?`, stim: lcd(fmt24(t.h, t.m)), choices: choicesOf([t, ...distract(t, w)], x => x), sol: { t, h24: true } };
    case 'set24':
      if (Math.random() < .7 && t.h < 12) t.h += 12;
      return { ui: 'set', prompt: 'Ställ klockan på', say: `Ställ klockan på ${fmt24(t.h, t.m)}`, stim: lcd(fmt24(t.h, t.m), ''), target: t, sol: { t, h24: true } };
  }
  throw new Error('Okänd frågetyp ' + type);
}
function makeFreshQ(type, w) {
  let q, guard = 0;
  do { q = makeQ(type, w); } while (G && G.lastKey === `${q.sol.t.h}:${q.sol.t.m}` && guard++ < 10);
  if (G) G.lastKey = `${q.sol.t.h}:${q.sol.t.m}`;
  return q;
}
function solText(q) {
  const t = q.sol.t;
  if (q.sol.h24) return `<b>${cap(phrase(t.h, t.m))} ${dayPart(t.h)}</b> = <span class="lcd" style="padding:2px 8px;font-size:1.1rem">${fmt24(t.h, t.m)}</span>`;
  return `<b>${cap(phrase(t.h, t.m))}</b> = <span class="lcd" style="padding:2px 8px;font-size:1.1rem">${fmt12(t.h, t.m)}</span>`;
}

/* ---------- Visa en fråga ---------- */
const PRAISE = ['Rätt! 🎉', 'Superbra! ⭐', 'Snyggt! 😎', 'Klockrent! ⏰', 'Wow, rätt! 🚀', 'Perfekt! 💪', 'Grymt! 🔥', 'Du kan det här! 🌟'];

function renderQ(el, q, w, opts) {
  el.innerHTML = `<div class="prompt"><span>${q.prompt}</span><button class="speak" aria-label="Läs upp">🔊</button></div>
    <div class="stim">${q.stim || ''}</div><div class="answer"></div><div class="feedback"></div>`;
  const sayText = q.say || q.prompt;
  $('.speak', el).onclick = () => speak(sayText);
  if (S.speakAuto) speak(sayText);
  const ans = $('.answer', el);
  let locked = false;
  const finish = ok => {
    if (locked) return; locked = true; keyHandler = null;
    $$('button, svg', ans).forEach(b => { if (b.tagName === 'BUTTON') b.disabled = true; else b.style.pointerEvents = 'none'; });
    opts.onAnswer(ok);
    showFeedback(el, q, ok, opts);
  };

  if (q.ui === 'choice' || q.ui === 'lcdchoice' || q.ui === 'clocks') {
    const cls = q.ui === 'lcdchoice' ? 'lcdc' : q.ui === 'clocks' ? 'clockc' : '';
    const sz = window.innerWidth < 480 ? 130 : 160;
    ans.innerHTML = `<div class="choices">${q.choices.map((c, i) =>
      `<button class="choice ${cls}" data-i="${i}">${q.ui === 'clocks' ? clockSVG(c.t.h, c.t.m, { size: sz }) : c.label}</button>`).join('')}</div>`;
    $$('.choice', ans).forEach(b => b.onclick = () => {
      if (locked) return;
      const c = q.choices[+b.dataset.i];
      b.classList.add(c.correct ? 'right' : 'wrong');
      if (!c.correct) $$('.choice', ans)[q.choices.findIndex(x => x.correct)].classList.add('right');
      finish(c.correct);
    });
  } else if (q.ui === 'set') {
    setUI(ans, q, w, finish);
  } else if (q.ui === 'keypad') {
    keypadUI(ans, q, finish);
  }
  return { fail: () => finish(false), isLocked: () => locked };
}

function showFeedback(el, q, ok, opts) {
  const fb = $('.feedback', el);
  if (ok) {
    fb.innerHTML = `<div class="fb good">${pick(PRAISE)}</div>`;
    later(opts.onNext, opts.fast ? 550 : 1100);
  } else {
    const t = q.sol.t;
    const extra = q.sol.startFrom ? `Från ${q.sol.h24 ? fmt24(q.sol.startFrom.h, q.sol.startFrom.m) : fmt12(q.sol.startFrom.h, q.sol.startFrom.m)} går vi framåt ${deltaText(q.sol.d)}.` : tipFor(t);
    fb.innerHTML = `<div class="fb bad">${opts.timeout ? '<div style="margin-bottom:6px">⏰ Tiden tog slut!</div>' : ''}<div class="fbrow">${clockSVG(t.h, t.m, { size: 110 })}<div><div>Rätt svar:</div>${solText(q)}<div class="tip">💡 ${extra}</div></div></div>${opts.fast ? '' : '<button class="btn next">Nästa ➜</button>'}</div>`;
    if (opts.fast) later(opts.onNext, 1800);
    else $('.next', fb).onclick = () => { SFX.click(); opts.onNext(); };
  }
  later(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function setUI(ans, q, w, finish) {
  const step = Math.min(w.step, 60);
  let cur = { h: 12, m: 0 };
  if (n12(q.target.h) === 12 && q.target.m === 0) cur = { h: 6, m: 0 };
  const sk = SKINS[S.skin] || SKINS.klassisk;
  const minuteLocked = step >= 60;
  ans.innerHTML = `<div class="setwrap">${clockSVG(cur.h, cur.m, { size: 280, help: helpOn(w), id: 'setclock' })}
    <div class="sethint">Dra i visarna eller använd knapparna</div>
    <div class="setbtns">
      <div class="ctrl"><span class="dot" style="background:${sk.hour}"></span>Lilla visaren<button data-a="h-" aria-label="Lilla visaren bakåt">◀</button><button data-a="h+" aria-label="Lilla visaren framåt">▶</button></div>
      ${minuteLocked ? '' : `<div class="ctrl"><span class="dot" style="background:${sk.min}"></span>Stora visaren<button data-a="m-" aria-label="Stora visaren bakåt">◀</button><button data-a="m+" aria-label="Stora visaren framåt">▶</button></div>`}
    </div>
    <button class="btn green go">Klar! ✔</button></div>`;
  const svg = $('#setclock', ans);
  const hh = $('.hand-h', svg), mh = $('.hand-m', svg);
  const update = () => {
    hh.setAttribute('transform', `rotate(${((cur.h % 12) + cur.m / 60) * 30})`);
    mh.setAttribute('transform', `rotate(${cur.m * 6})`);
  };
  const setMin = nm => {
    nm = ((nm % 60) + 60) % 60;
    if (cur.m >= 45 && nm < 15) cur.h = n12(cur.h + 1);
    else if (cur.m < 15 && nm >= 45) cur.h = n12(cur.h - 1);
    cur.m = nm; update();
  };
  $$('.ctrl button', ans).forEach(b => b.onclick = () => {
    SFX.click();
    const a = b.dataset.a;
    if (a === 'h+') cur.h = n12(cur.h + 1);
    if (a === 'h-') cur.h = n12(cur.h - 1);
    if (a === 'm+') setMin(cur.m + step);
    if (a === 'm-') setMin(cur.m - step);
    update();
  });
  let drag = null;
  const pt = e => { const r = svg.getBoundingClientRect(), sc = 270 / r.width; return { x: (e.clientX - r.left) * sc - 135, y: (e.clientY - r.top) * sc - 135 }; };
  const angOf = p => (Math.atan2(p.x, -p.y) * 180 / Math.PI + 360) % 360;
  const tip = (deg, len) => ({ x: Math.sin(deg * Math.PI / 180) * len, y: -Math.cos(deg * Math.PI / 180) * len });
  const move = e => {
    const a = angOf(pt(e));
    if (drag === 'm') setMin(Math.round(a / (6 * step)) * step);
    else {
      let h = Math.round((a - cur.m * .5) / 30);
      cur.h = n12(h); update();
    }
  };
  svg.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = pt(e);
    const th = tip(((cur.h % 12) + cur.m / 60) * 30, 52), tm = tip(cur.m * 6, 88);
    const dh = Math.hypot(p.x - th.x, p.y - th.y), dm = Math.hypot(p.x - tm.x, p.y - tm.y);
    const r = Math.hypot(p.x, p.y);
    drag = minuteLocked ? 'h' : (r > 70 ? 'm' : (dh < dm ? 'h' : 'm'));
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    move(e);
  });
  svg.addEventListener('pointermove', e => { if (drag) move(e); });
  const end = () => { drag = null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  $('.go', ans).onclick = () => finish(n12(cur.h) === n12(q.target.h) && cur.m === q.target.m);
}

function keypadUI(ans, q, finish) {
  let s = '';
  ans.innerHTML = `<div class="keypad"><div class="lcd kpdisp">_:__</div>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
    <button data-k="del" aria-label="Sudda">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">OK</button></div>
    <div class="kphint">${q.hint24 ? 'Tryck t.ex. 1 5 3 0 för 15:30' : 'Tryck t.ex. 3 3 0 för 3:30'}</div></div>`;
  const disp = $('.kpdisp', ans), hint = $('.kphint', ans);
  const show = () => {
    let txt;
    if (s.length === 0) txt = '_:__';
    else if (s.length === 1) txt = `${s}:__`;
    else if (s.length === 2) txt = `${s[0]}:${s[1]}_`;
    else if (s.length === 3) txt = `${s[0]}:${s.slice(1)}`;
    else txt = `${s.slice(0, 2)}:${s.slice(2)}`;
    disp.textContent = txt;
  };
  const press = k => {
    if (k === 'del') s = s.slice(0, -1);
    else if (k === 'ok') {
      if (s.length < 3) { disp.classList.remove('hurt'); void disp.offsetWidth; disp.classList.add('hurt'); hint.textContent = 'Skriv både timmar och minuter!'; return; }
      const h = s.length === 3 ? +s[0] : +s.slice(0, 2), m = +s.slice(-2);
      if (m > 59) { hint.textContent = 'Minuterna går bara upp till 59. Försök igen!'; s = ''; show(); return; }
      if (h > 24) { hint.textContent = 'Timmarna går bara upp till 24. Försök igen!'; s = ''; show(); return; }
      finish(q.accept(h, m)); return;
    } else if (s.length < 4) s += k;
    SFX.click(); show();
  };
  $$('.keys button', ans).forEach(b => b.onclick = () => press(b.dataset.k));
  keyHandler = e => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('ok');
  };
}

/* ---------- Belöningar ---------- */
const RANKS = [[1, 'Klockkyckling 🐣'], [3, 'Tidsspanare 🔭'], [5, 'Visarvän 🤝'], [7, 'Minutmagiker 🪄'], [10, 'Tidsriddare 🛡️'], [14, 'Klockmästare 👑']];
const xpOf = () => S.totalCorrect * 10 + Object.keys(S.bosses).length * 150 + totalStars() * 15;
function lvlInfo() {
  let xp = xpOf(), lvl = 1, need = 100;
  while (xp >= need) { xp -= need; lvl++; need += 50; }
  const title = RANKS.filter(r => lvl >= r[0]).pop()[1];
  return { lvl, xp, need, title };
}
const BADGES = [
  { id: 'first', e: '🌟', n: 'Första rätt', d: 'Svara rätt på en fråga', c: () => S.totalCorrect >= 1 },
  { id: 'c50', e: '🎯', n: '50 rätt', d: 'Svara rätt 50 gånger', c: () => S.totalCorrect >= 50 },
  { id: 'c200', e: '🏹', n: '200 rätt', d: 'Svara rätt 200 gånger', c: () => S.totalCorrect >= 200 },
  { id: 'c500', e: '💎', n: '500 rätt', d: 'Svara rätt 500 gånger', c: () => S.totalCorrect >= 500 },
  { id: 's5', e: '🔥', n: 'Het', d: '5 rätt i rad', c: () => S.bestStreak >= 5 },
  { id: 's10', e: '☄️', n: 'Komet', d: '10 rätt i rad', c: () => S.bestStreak >= 10 },
  { id: 's25', e: '🌋', n: 'Vulkan', d: '25 rätt i rad', c: () => S.bestStreak >= 25 },
  { id: 'perfect', e: '⭐', n: 'Perfekt', d: 'Få 3 stjärnor på en nivå', c: () => Object.values(S.stars).some(v => v >= 3) },
  { id: 'starworld', e: '🌈', n: 'Stjärnvärld', d: '3 stjärnor på alla nivåer i en värld', c: () => WORLDS.some((w, wi) => w.levels.every((_, li) => (S.stars[levelKey(wi, li)] || 0) >= 3)) },
  ...WORLDS.map(w => ({ id: 'boss_' + w.id, e: w.boss.emoji, n: w.boss.name, d: `Besegra bossen i ${w.name}`, c: () => !!S.bosses[w.id] })),
  { id: 'master', e: '🏆', n: 'Klockmästare', d: 'Besegra alla bossar', c: () => WORLDS.every(w => S.bosses[w.id]) },
  { id: 'quick10', e: '⚡', n: 'Blixtsnabb', d: '10 poäng i Snabbrundan', c: () => S.quickBest >= 10 },
  { id: 'quick20', e: '🚀', n: 'Raket', d: '20 poäng i Snabbrundan', c: () => S.quickBest >= 20 },
  { id: 'shop', e: '🛍️', n: 'Shoppare', d: 'Köp något i butiken', c: () => S.bought },
  { id: 'rich', e: '💰', n: 'Skattjägare', d: 'Tjäna 500 mynt totalt', c: () => S.coinsEarned >= 500 },
];
function addCoins(n) {
  S.coins += n; S.coinsEarned += n;
  const c = $('.coinnum');
  if (c) { c.textContent = S.coins; c.classList.remove('coinpop'); void c.offsetWidth; c.classList.add('coinpop'); }
}
function checkRewards() {
  BADGES.forEach(b => {
    if (!S.badges.includes(b.id) && b.c()) { S.badges.push(b.id); toast(`🏅 Ny medalj: ${b.e} ${b.n}!`); }
  });
  const li = lvlInfo();
  if (li.lvl > S.lvl) {
    S.lvl = li.lvl; addCoins(10);
    toast(`🎊 Ny nivå! Du är nu nivå ${li.lvl} – ${li.title} (+10 🪙)`); confetti(120);
  }
  save();
}
function toast(msg) {
  const box = $('#toast'), d = document.createElement('div');
  d.className = 'toast'; d.textContent = msg; box.appendChild(d);
  setTimeout(() => d.remove(), 2800);
}
function confetti(n = 160) {
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#ffb703', '#fb8500', '#e63946', '#52b788', '#4cc9f0', '#9b5de5', '#ff8fab'];
  const ps = Array.from({ length: n }, () => ({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .5, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 6, c: pick(cols), a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .05; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
    if (t - t0 < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, cv.width, cv.height);
  })(t0);
}
const starStr = n => '⭐'.repeat(n) + '☆'.repeat(3 - n);

/* ---------- Navigering ---------- */
let G = null;
const app = $('#app');
function go(fn, ...args) {
  clearTimers(); keyHandler = null; G = null;
  try { speechSynthesis.cancel(); } catch (e) { /* ok */ }
  $$('.overlay').forEach(o => o.remove());
  window.scrollTo(0, 0);
  fn(...args);
}
function topbar(title, back = showHome, icon = '⬅') {
  return { html: `<div class="topbar"><button class="iconbtn back" aria-label="Tillbaka">${icon}</button><div class="tb-title">${title}</div><div class="tb-coins">🪙 <span class="coinnum">${S.coins}</span></div></div>`, back };
}
function mount(tb, body) {
  app.innerHTML = tb.html + body;
  $('.back', app).onclick = () => { SFX.click(); go(tb.back); };
}

/* ---------- Hem ---------- */
function showHome() {
  const li = lvlInfo();
  app.innerHTML = `
    <h1 class="logo">⏰ Klocktränaren</h1>
    <div class="card">
      <div class="hero">
        <div class="bigavatar">${S.avatar}</div>
        <div style="flex:1">
          <h2>Hej ${S.name}!</h2>
          <div class="rank">Nivå ${li.lvl} · ${li.title}</div>
          <div class="xpbar"><div class="xpfill" style="width:${Math.round(li.xp / li.need * 100)}%"></div></div>
          <div class="xptext">${li.xp} / ${li.need} XP till nästa nivå</div>
        </div>
      </div>
      <div class="stats"><span>🪙 ${S.coins}</span><span>⭐ ${totalStars()}</span><span>🏅 ${S.badges.length}/${BADGES.length}</span></div>
    </div>
    <div class="menu">
      <button class="btn big" data-go="map">🗺️ Äventyr</button>
      <button class="btn alt" data-go="quick">⚡ Snabbrunda</button>
      <button class="btn alt" data-go="shop">🛍️ Butik</button>
      <button class="btn alt" data-go="badges">🏅 Medaljer</button>
      <button class="btn alt" data-go="settings">⚙️ Inställningar</button>
      <div class="installslot" style="grid-column:1/-1"></div>
    </div>
    <div class="card nowclock"><div class="nowc"></div><div class="nowtext"></div></div>`;
  const nav = { map: showMap, quick: startQuick, shop: showShop, badges: showBadges, settings: showSettings };
  $$('[data-go]').forEach(b => b.onclick = () => { SFX.click(); go(nav[b.dataset.go]); });
  const tick = () => {
    const d = new Date(), h = d.getHours(), m = d.getMinutes();
    $('.nowc').innerHTML = clockSVG(h, m, { size: 120 });
    $('.nowtext').innerHTML = `Just nu är klockan<b>${cap(phrase(h, m))}</b>${fmt24(h, m)} ${dayPart(h)}`;
  };
  tick(); every(tick, 15000);
  renderInstall();
}

/* ---------- Installera på telefonen ---------- */
let installPrompt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function renderInstall() {
  const slot = $('.installslot');
  if (!slot) return;
  if (isStandalone() || (!installPrompt && !isIOS())) { slot.innerHTML = ''; return; }
  slot.innerHTML = '<button class="btn purple" style="width:100%">📲 Installera på telefonen</button>';
  $('button', slot).onclick = async () => {
    SFX.click();
    if (installPrompt) {
      installPrompt.prompt();
      try { await installPrompt.userChoice; } catch (e) { /* ok */ }
      installPrompt = null; renderInstall();
      return;
    }
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="card"><div class="introemoji">📲</div><h2>Lägg till på hemskärmen</h2>
      <p style="text-align:left">1. Öppna sidan i <b>Safari</b>.<br>2. Tryck på <b>Dela</b>-knappen <span style="font-size:1.4rem">⬆️</span> (rutan med pilen).<br>3. Välj <b>”Lägg till på hemskärmen”</b>.<br>4. Tryck <b>Lägg till</b>.</p>
      <p>Sen finns Klocktränaren som en app på telefonen! ⏰</p>
      <button class="btn green">Okej!</button></div>`;
    document.body.appendChild(ov);
    $('button', ov).onclick = () => ov.remove();
  };
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; renderInstall(); });
window.addEventListener('appinstalled', () => { installPrompt = null; renderInstall(); toast('📲 Klocktränaren är installerad!'); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* ok */ }));
}

/* ---------- Karta ---------- */
function showMap() {
  const worlds = WORLDS.map((w, wi) => {
    const open = worldOpen(wi);
    const lv = w.levels.map((L, li) => {
      const st = S.stars[levelKey(wi, li)] || 0, un = levelOpen(wi, li);
      return `<button class="lvl ${un ? '' : 'locked'}" data-w="${wi}" data-l="${li}" ${un ? '' : 'disabled'}>
        <span class="li">${un ? L.i : '🔒'}</span><span class="ln">${L.n}</span><span class="ls">${starStr(st)}</span></button>`;
    }).join('');
    const bo = bossOpen(wi), beaten = S.bosses[w.id];
    const kind = { analog: '🕰️ Analog', digital: '📟 Digital', final: '🕰️ + 📟' }[w.boss.kind];
    return `<section class="card world ${open ? '' : 'wlocked'}" style="--wc:${w.color}">
      <div class="whead"><span class="wicon">${open ? w.icon : '🔒'}</span><div><h2>Värld ${wi + 1}: ${w.name}</h2><p>${open ? w.desc : 'Besegra bossen i förra världen för att öppna.'}</p></div></div>
      <div class="levels">${lv}
        <button class="lvl boss ${bo ? '' : 'locked'} ${beaten ? 'beaten' : ''}" data-b="${wi}" ${bo ? '' : 'disabled'}>
          <span class="li">${bo ? w.boss.emoji : '🔒'}</span><span class="ln">${beaten ? '🏆 Besegrad!' : 'BOSS'}</span><span class="ls">${kind}</span></button>
      </div></section>`;
  }).join('');
  mount(topbar('🗺️ Äventyret'), worlds);
  $$('[data-l]').forEach(b => b.onclick = () => { SFX.click(); go(startLevel, +b.dataset.w, +b.dataset.l); });
  $$('[data-b]').forEach(b => b.onclick = () => { SFX.click(); go(startBoss, +b.dataset.b); });
}

/* ---------- Vanlig nivå ---------- */
function startLevel(wi, li) {
  const w = WORLDS[wi], L = w.levels[li];
  const total = 8;
  const queue = shuffle(Array.from({ length: total }, (_, i) => L.t[i % L.t.length]));
  G = { mode: 'level', wi, li, w, L, i: 0, total, correct: 0, streak: 0, queue, coins: 0 };
  mount(topbar(`${w.icon} ${L.n}`, showMap, '✖'), `
    <div class="progress"><div style="width:0%"></div></div>
    <div class="hud"><span class="qcount">Fråga 1 av ${total}</span><span class="streak"></span></div>
    <div id="qarea" class="card"></div>`);
  nextLevelQ();
}
function nextLevelQ() {
  const g = G;
  $('.qcount').textContent = `Fråga ${g.i + 1} av ${g.total}`;
  $('.progress > div').style.width = `${g.i / g.total * 100}%`;
  const q = makeFreshQ(g.queue[g.i], g.w);
  renderQ($('#qarea'), q, g.w, {
    onAnswer: ok => {
      if (ok) {
        g.correct++; g.streak++; S.totalCorrect++; S.bestStreak = Math.max(S.bestStreak, g.streak);
        const c = g.streak >= 3 ? 2 : 1; g.coins += c; addCoins(c); SFX.ok();
        if ([3, 5, 8].includes(g.streak)) toast(`🔥 ${g.streak} rätt i rad!`);
      } else { g.streak = 0; SFX.bad(); }
      $('.streak').textContent = g.streak >= 2 ? `🔥 ${g.streak} i rad` : '';
      $('.progress > div').style.width = `${(g.i + 1) / g.total * 100}%`;
      checkRewards();
    },
    onNext: () => { if (G !== g) return; g.i++; if (g.i >= g.total) finishLevel(); else nextLevelQ(); },
  });
}
function finishLevel() {
  const g = G, key = levelKey(g.wi, g.li);
  const stars = g.correct >= 8 ? 3 : g.correct >= 6 ? 2 : g.correct >= 4 ? 1 : 0;
  const prev = S.stars[key] || 0;
  const bossWasOpen = bossOpen(g.wi);
  if (stars > prev) S.stars[key] = stars;
  let bonus = stars * 3 + (stars > prev ? (stars - prev) * 5 : 0);
  addCoins(bonus); g.coins += bonus;
  checkRewards();
  const nowBoss = !bossWasOpen && bossOpen(g.wi);
  const hasNext = g.li + 1 < g.w.levels.length && levelOpen(g.wi, g.li + 1);
  const msg = stars === 3 ? 'Perfekt! Alla rätt!' : stars === 2 ? 'Jättebra jobbat!' : stars === 1 ? 'Bra! Kan du få fler stjärnor?' : 'Nästan! Träna lite till så klarar du det!';
  if (stars >= 2) { confetti(); SFX.win(); }
  app.innerHTML = `<div class="card result">
    <h2>${msg}</h2>
    <div class="stars">${[0, 1, 2].map(i => `<span>${i < stars ? '⭐' : '☆'}</span>`).join('')}</div>
    <p>${g.correct} av ${g.total} rätt · +${g.coins} 🪙</p>
    ${nowBoss ? `<p style="font-size:1.3rem;font-weight:700;color:#e63946">⚔️ ${g.w.boss.emoji} ${g.w.boss.name} väntar på dig!</p>` : ''}
    <div class="btnrow">
      <button class="btn alt" data-a="again">🔁 Igen</button>
      <button class="btn alt" data-a="map">🗺️ Kartan</button>
      ${nowBoss ? '<button class="btn red" data-a="boss">⚔️ Till bossen!</button>' : hasNext ? '<button class="btn green" data-a="next">Nästa ➜</button>' : ''}
    </div></div>`;
  const { wi, li } = g;
  $$('[data-a]').forEach(b => b.onclick = () => {
    SFX.click();
    const a = b.dataset.a;
    if (a === 'again') go(startLevel, wi, li);
    if (a === 'map') go(showMap);
    if (a === 'next') go(startLevel, wi, li + 1);
    if (a === 'boss') go(startBoss, wi);
  });
}

/* ---------- Bossfajt ---------- */
const HURT_LINES = ['Aj! Det gjorde ont!', 'Neeej! Hur visste du det?!', 'Grr... tur bara!', 'Ouff! Du är stark!', 'Va?! Rätt igen?!'];
const TAUNT_LINES = ['Haha! Fel fel fel!', 'Mohahaha! Tiden är min!', 'Hihi, lurade dig!', 'Du får aldrig tag på mig!'];
function startBoss(wi) {
  const w = WORLDS[wi], B = w.boss;
  G = { mode: 'boss', wi, w, B, hp: B.hp, max: B.hp, hearts: 3, phase: 1, streak: 0, correct: 0, qStart: 0 };
  mount(topbar(`⚔️ ${B.name}`, showMap, '✖'), `
    <div class="arena">
      <div class="bubble"></div>
      <div class="fighter player"><div class="avatar">${S.avatar}</div><div class="hearts"></div><div class="fname">${S.name}</div></div>
      <div class="vs">VS</div>
      <div class="fighter enemy"><div class="bossemoji">${B.emoji}</div><div class="hpbar"><div class="hpfill" style="width:100%"></div></div><div class="fname">${B.name}</div></div>
    </div>
    <div class="timerbar"><div class="timerfill" style="width:100%"></div></div>
    <div id="qarea" class="card"></div>`);
  drawBossHud();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="card"><div class="introemoji">${B.emoji}</div><h2>${B.name}</h2>
    <p>”${B.intro}”</p>
    <p style="font-size:1rem;color:#457b9d">Svara rätt för att skada bossen. Svara snabbt för SUPERSLAG! Du har 3 hjärtan ❤️</p>
    <button class="btn red" style="font-size:1.4rem">⚔️ Kämpa!</button></div>`;
  document.body.appendChild(ov);
  speak(B.intro);
  $('button', ov).onclick = () => { ov.remove(); SFX.click(); nextBossQ(); };
}
function drawBossHud() {
  const g = G;
  $('.hearts').textContent = '❤️'.repeat(Math.max(0, g.hearts)) + '🖤'.repeat(Math.max(0, 3 - g.hearts));
  $('.hpfill').style.width = `${Math.max(0, g.hp) / g.max * 100}%`;
}
function bubble(txt) {
  const b = $('.bubble'); if (!b) return;
  b.textContent = txt; b.classList.add('show');
  later(() => b.classList.remove('show'), 1800);
}
function fx(cls, emoji) {
  const a = $('.arena'); if (!a) return;
  const p = document.createElement('div'); p.className = 'proj ' + cls; p.textContent = emoji; a.appendChild(p);
  setTimeout(() => p.remove(), 500);
}
function nextBossQ() {
  const g = G;
  const types = g.B.kind === 'final' ? BOSS_TYPES[g.phase === 1 ? 'final1' : 'final2'] : BOSS_TYPES[g.B.kind];
  const q = makeFreshQ(pick(types), g.w);
  const fill = $('.timerfill');
  const dur = g.B.time * 1000;
  g.qStart = performance.now();
  let ctrl;
  const opts = {
    onAnswer: ok => {
      clearInterval(g.timerId);
      const fast = performance.now() - g.qStart < 7000;
      if (ok) {
        g.correct++; g.streak++; S.totalCorrect++; S.bestStreak = Math.max(S.bestStreak, g.streak); addCoins(2);
        const dmg = fast ? 2 : 1;
        g.hp -= dmg;
        fx('toBoss', fast ? '💥' : '⚡');
        setTimeout(() => {
          if (!$('.bossemoji')) return;
          SFX.hit();
          const be = $('.bossemoji'); be.classList.remove('hit'); void be.offsetWidth; be.classList.add('hit');
          const d = document.createElement('div'); d.className = 'dmg'; d.textContent = fast ? `SUPERSLAG! -${dmg}` : `-${dmg}`; $('.arena').appendChild(d); setTimeout(() => d.remove(), 900);
          drawBossHud();
          if (g.hp > 0) bubble(pick(HURT_LINES));
        }, 420);
        SFX.ok();
      } else {
        g.streak = 0; g.hearts--;
        fx('toPlayer', '☄️');
        setTimeout(() => {
          if (!$('.arena')) return;
          SFX.hurt();
          const pa = $('.player .avatar'); pa.classList.remove('hurt'); void pa.offsetWidth; pa.classList.add('hurt');
          app.classList.remove('screenshake'); void app.offsetWidth; app.classList.add('screenshake');
          drawBossHud(); bubble(pick(TAUNT_LINES));
        }, 420);
      }
      checkRewards();
    },
    onNext: () => {
      if (G !== g) return;
      if (g.hp <= 0) return later(bossWin, 400);
      if (g.hearts <= 0) return bossLose();
      if (g.B.kind === 'final' && g.phase === 1 && g.hp <= g.max / 2) return finalPhase2();
      nextBossQ();
    },
  };
  ctrl = renderQ($('#qarea'), q, g.w, opts);
  fill.style.width = '100%'; fill.classList.remove('low');
  g.timerId = every(() => {
    const left = Math.max(0, 1 - (performance.now() - g.qStart) / dur);
    fill.style.width = `${left * 100}%`;
    fill.classList.toggle('low', left < .25);
    if (left <= 0 && !ctrl.isLocked()) { opts.timeout = true; ctrl.fail(); }
  }, 100);
}
function finalPhase2() {
  const g = G;
  g.phase = 2;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="card"><div class="introemoji">${g.B.emoji2}</div><h2>Kronox förvandlas!</h2>
    <p>”Grrr! Analoga klockor räcker inte... Nu blir jag DIGITAL!”</p><button class="btn purple" style="font-size:1.3rem">⚔️ Fortsätt kämpa!</button></div>`;
  document.body.appendChild(ov);
  SFX.hurt(); speak('Grrr! Nu blir jag digital!');
  $('.bossemoji').textContent = g.B.emoji2;
  $('.arena').classList.add('final2');
  $('button', ov).onclick = () => { ov.remove(); SFX.click(); nextBossQ(); };
}
function bossWin() {
  const g = G, first = !S.bosses[g.w.id];
  S.bosses[g.w.id] = true;
  const coins = first ? 50 : 20;
  addCoins(coins); checkRewards();
  SFX.win(); confetti(260); later(() => confetti(160), 1200);
  const nextW = WORLDS[g.wi + 1];
  app.innerHTML = `<div class="card result">
    <div class="trophy">🏆</div>
    <h2>Du besegrade ${g.B.name}!</h2>
    <p style="font-size:2.4rem;margin:6px 0">${g.B.kind === 'final' ? g.B.emoji2 : g.B.emoji}💫</p>
    <p>${g.hearts} ${g.hearts === 1 ? 'hjärta' : 'hjärtan'} kvar · +${coins} 🪙</p>
    ${first && nextW ? `<p style="font-size:1.25rem;font-weight:700;color:#2a9d8f">🔓 Ny värld upplåst: ${nextW.icon} ${nextW.name}!</p>` : ''}
    ${first && WORLDS.every(x => S.bosses[x.id]) ? '<p style="font-size:1.35rem;font-weight:700;color:#9b5de5">👑 Du har besegrat ALLA bossar! Du är en riktig Klockmästare!</p>' : ''}
    <div class="btnrow"><button class="btn green" data-a="map">🗺️ Till kartan</button><button class="btn alt" data-a="home">🏠 Hem</button></div></div>`;
  speak(`Du besegrade ${g.B.name}!`);
  $('[data-a=map]').onclick = () => go(showMap);
  $('[data-a=home]').onclick = () => go(showHome);
}
function bossLose() {
  const g = G;
  addCoins(5); save();
  const { wi } = g;
  app.innerHTML = `<div class="card result">
    <div class="trophy">${g.phase === 2 ? g.B.emoji2 : g.B.emoji}</div>
    <h2>${g.B.name} vann den här gången...</h2>
    <p>Men du gav ${g.max - Math.max(0, g.hp)} i skada! Träna lite till och försök igen – du klarar det! 💪</p>
    <p>+5 🪙 för modet</p>
    <div class="btnrow"><button class="btn red" data-a="again">⚔️ Försök igen</button><button class="btn alt" data-a="map">🗺️ Träna på kartan</button></div></div>`;
  $('[data-a=again]').onclick = () => go(startBoss, wi);
  $('[data-a=map]').onclick = () => go(showMap);
}

/* ---------- Snabbrunda ---------- */
function startQuick() {
  const open = WORLDS.filter((_, wi) => worldOpen(wi));
  G = { mode: 'quick', score: 0, streak: 0, end: performance.now() + 60000, open };
  mount(topbar('⚡ Snabbrunda', showHome, '✖'), `
    <div class="card" style="text-align:center;margin-bottom:10px">
      <p style="font-size:1.2rem;margin:0 0 12px">Svara rätt på så många frågor du kan på <b>60 sekunder</b>!<br>Rekord: <b>${S.quickBest}</b></p>
      <button class="btn green start" style="font-size:1.4rem">▶ Starta!</button></div>`);
  $('.start').onclick = () => {
    SFX.click();
    G.end = performance.now() + 60000;
    app.innerHTML = topbar('⚡ Snabbrunda', showHome, '✖').html + `
      <div class="timerbar"><div class="timerfill" style="width:100%"></div></div>
      <div class="hud"><span class="score">Poäng: 0</span><span class="secs">60 s</span></div>
      <div id="qarea" class="card"></div>`;
    $('.back').onclick = () => go(showHome);
    const g = G;
    every(() => {
      const left = Math.max(0, g.end - performance.now());
      $('.timerfill').style.width = `${left / 600}%`;
      $('.timerfill').classList.toggle('low', left < 10000);
      $('.secs').textContent = `${Math.ceil(left / 1000)} s`;
      if (left <= 0) quickEnd();
    }, 100);
    nextQuickQ();
  };
}
function nextQuickQ() {
  const g = G;
  const w = pick(g.open);
  const types = w.h24 ? ['from24Phrase', 'match24', 'readChoice'] : ['readChoice', 'readDigitalChoice', 'digitalToPhrase', 'matchAnalog'];
  const q = makeFreshQ(pick(types), w);
  renderQ($('#qarea'), q, w, {
    fast: true,
    onAnswer: ok => {
      if (ok) { g.score++; g.streak++; S.totalCorrect++; S.bestStreak = Math.max(S.bestStreak, g.streak); SFX.ok(); }
      else { g.streak = 0; SFX.bad(); }
      $('.score').textContent = `Poäng: ${g.score}`;
      checkRewards();
    },
    onNext: () => { if (G === g && !g.done) nextQuickQ(); },
  });
}
function quickEnd() {
  const g = G; if (!g || g.done) return;
  g.done = true; clearTimers(); keyHandler = null;
  const rec = g.score > S.quickBest;
  if (rec) S.quickBest = g.score;
  addCoins(g.score); checkRewards();
  if (rec || g.score >= 10) { SFX.win(); confetti(); }
  app.innerHTML = `<div class="card result">
    <div class="trophy">${rec ? '🥇' : '⚡'}</div>
    <h2>${rec ? 'NYTT REKORD!' : 'Bra kämpat!'}</h2>
    <p style="font-size:1.6rem;font-weight:700">${g.score} poäng</p>
    <p>Rekord: ${S.quickBest} · +${g.score} 🪙</p>
    <div class="btnrow"><button class="btn green" data-a="again">🔁 Igen</button><button class="btn alt" data-a="home">🏠 Hem</button></div></div>`;
  $('[data-a=again]').onclick = () => go(startQuick);
  $('[data-a=home]').onclick = () => go(showHome);
}

/* ---------- Butik ---------- */
function showShop() {
  const av = AVATARS.map(([e, p]) => {
    const own = S.avatars.includes(e), eq = S.avatar === e;
    return `<button class="item ${eq ? 'equipped' : ''} ${!own && S.coins < p ? 'cant' : ''}" data-av="${e}" data-p="${p}"><span class="ie">${e}</span><span>${eq ? '✔ Vald' : own ? 'Välj' : `🪙 ${p}`}</span></button>`;
  }).join('');
  const sk = Object.entries(SKINS).map(([id, s]) => {
    const own = S.skins.includes(id), eq = S.skin === id;
    return `<button class="item ${eq ? 'equipped' : ''} ${!own && S.coins < s.p ? 'cant' : ''}" data-sk="${id}" data-p="${s.p}">${clockSVG(10, 10, { size: 70, skin: id })}<span>${s.n}</span><span>${eq ? '✔ Vald' : own ? 'Välj' : `🪙 ${s.p}`}</span></button>`;
  }).join('');
  mount(topbar('🛍️ Butik'), `<div class="card">
    <h3 class="section-title">Figurer</h3><div class="shopgrid">${av}</div>
    <h3 class="section-title">Klockor</h3><div class="shopgrid">${sk}</div>
    <p style="color:#457b9d;margin:0">Tjäna mynt genom att svara rätt, klara nivåer och besegra bossar!</p></div>`);
  const buy = (list, id, price, equip) => {
    if (!S[list].includes(id)) {
      if (S.coins < price) { toast(`Du behöver ${price - S.coins} mynt till! 🪙`); SFX.bad(); return; }
      S.coins -= price; S[list].push(id); S.bought = true; SFX.coin(); toast('Köpt! 🎉'); confetti(60);
    } else SFX.click();
    S[equip] = id; checkRewards(); showShop();
  };
  $$('[data-av]').forEach(b => b.onclick = () => buy('avatars', b.dataset.av, +b.dataset.p, 'avatar'));
  $$('[data-sk]').forEach(b => b.onclick = () => buy('skins', b.dataset.sk, +b.dataset.p, 'skin'));
}

/* ---------- Medaljer ---------- */
function showBadges() {
  const html = BADGES.map(b => {
    const has = S.badges.includes(b.id);
    return `<div class="badge ${has ? '' : 'locked'}"><div class="be">${b.e}</div><b>${b.n}</b><small>${b.d}</small></div>`;
  }).join('');
  mount(topbar('🏅 Medaljer'), `<div class="card" style="margin-bottom:12px;text-align:center">
    <b style="font-size:1.2rem">${S.badges.length} av ${BADGES.length} medaljer</b><br>
    <span style="color:#457b9d">Rätt svar totalt: ${S.totalCorrect} · Bästa svit: ${S.bestStreak} i rad · Snabbrekord: ${S.quickBest}</span></div>
    <div class="badges">${html}</div>`);
}

/* ---------- Inställningar ---------- */
function showSettings() {
  mount(topbar('⚙️ Inställningar'), `<div class="card settings">
    <label>Namn <input type="text" id="sname" maxlength="16" value="${S.name.replace(/"/g, '&quot;')}"></label>
    <label>Ljud <input type="checkbox" id="ssound" ${S.sound ? 'checked' : ''}></label>
    <label>Läs upp frågorna automatiskt <input type="checkbox" id="sspeak" ${S.speakAuto ? 'checked' : ''}></label>
    <label>Visa minutsiffror runt klockan <input type="checkbox" id="shelp" ${S.help ? 'checked' : ''}></label>
    <div class="btnrow"><button class="btn red" id="sreset">🗑️ Börja om från början</button></div></div>`);
  $('#sname').oninput = e => { const v = e.target.value.trim(); if (v) { S.name = v; save(); } };
  $('#ssound').onchange = e => { S.sound = e.target.checked; save(); SFX.click(); };
  $('#sspeak').onchange = e => { S.speakAuto = e.target.checked; save(); };
  $('#shelp').onchange = e => { S.help = e.target.checked; save(); };
  $('#sreset').onclick = () => {
    if (confirm('Vill du verkligen radera alla stjärnor, mynt och medaljer?')) { const n = S.name; S = defaultState(); S.name = n; save(); go(showHome); }
  };
}

/* ---------- Välkommen: skriv ditt namn ---------- */
function showWelcome() {
  let chosen = S.avatar;
  const free = AVATARS.filter(([, p]) => p === 0).map(([e]) => e);
  app.innerHTML = `
    <h1 class="logo">⏰ Klocktränaren</h1>
    <div class="card welcome">
      <div class="bigavatar" style="text-align:center">⏰</div>
      <h2 style="text-align:center;margin:8px 0">Välkommen, klockhjälte!</h2>
      <p style="text-align:center;font-size:1.15rem;margin:0 0 14px">Vad heter du?</p>
      <input type="text" id="wname" maxlength="16" autocomplete="off" placeholder="Skriv ditt namn" aria-label="Ditt namn">
      <p style="text-align:center;font-size:1.1rem;margin:16px 0 8px">Välj din figur:</p>
      <div class="wavatars">${free.map(e => `<button class="item ${e === chosen ? 'equipped' : ''}" data-av="${e}"><span class="ie">${e}</span></button>`).join('')}</div>
      <p class="whint" style="text-align:center;color:#e63946;min-height:1.4em;margin:8px 0"></p>
      <button class="btn green wgo" style="width:100%;font-size:1.4rem">▶ Starta äventyret!</button>
    </div>`;
  const inp = $('#wname');
  inp.value = S.name;
  later(() => inp.focus(), 100);
  $$('[data-av]').forEach(b => b.onclick = () => {
    SFX.click(); chosen = b.dataset.av;
    $$('[data-av]').forEach(x => x.classList.toggle('equipped', x === b));
  });
  const start = () => {
    const v = inp.value.trim();
    if (!v) { $('.whint').textContent = 'Skriv ditt namn först! ✏️'; inp.focus(); SFX.bad(); return; }
    S.name = v; S.avatar = chosen; save();
    SFX.win(); confetti(120);
    speak(`Hej ${v}! Nu kör vi!`);
    go(showHome);
  };
  $('.wgo').onclick = start;
  inp.onkeydown = e => { if (e.key === 'Enter') start(); };
}

/* ---------- Föräldrakod: #lasupp i adressen låser upp allt (#laslas låser igen) ---------- */
function checkHash() {
  const h = decodeURIComponent(location.hash).toLowerCase();
  if (h !== '#lasupp' && h !== '#laslas') return;
  S.unlockAll = h === '#lasupp'; save();
  history.replaceState(null, '', location.pathname + location.search);
  toast(S.unlockAll ? '🔓 Alla världar är upplåsta!' : '🔒 Världarna är låsta igen');
  if (S.name) go(showHome);
}
window.addEventListener('hashchange', checkHash);
checkHash();

/* ---------- Start ---------- */
try { speechSynthesis.getVoices(); } catch (e) { /* ok */ }
go(S.name ? showHome : showWelcome);
