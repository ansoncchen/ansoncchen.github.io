(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  // Reduced-motion: mirror the rest of the site's preference handling.
  let reduced = false;
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced = mq.matches;
    mq.addEventListener('change', (e) => {
      reduced = e.matches;
      if (reduced) { stopBoilTimer(); clearTimeout(idleTimer); hideHint(); }
      else { startBoilTimer(); if (catReady) scheduleHint(); }
    });
  } catch (_) {}

  // ------------------------------------------------------------------
  // Trackers (elimelt homage) — little localStorage counters
  // ------------------------------------------------------------------
  const STORE_KEY = 'whimsy.stats.v1';
  const stats = loadStats();

  function loadStats() {
    const def = { flung: 0, curious: 0, confetti: 0, opened: 0, rolls: 0, seconds: 0 };
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && typeof s === 'object') return Object.assign(def, s);
    } catch (_) {}
    return def;
  }

  let saveQueued = false;
  function saveStats() {
    if (saveQueued) return;
    saveQueued = true;
    setTimeout(() => {
      saveQueued = false;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(stats)); } catch (_) {}
    }, 400);
  }
  function bump(k, n) { stats[k] = (stats[k] || 0) + (n || 1); saveStats(); }

  setInterval(() => { if (!document.hidden) { stats.seconds++; saveStats(); } }, 1000);

  // Non-invasive: wrap existing global methods to count without editing their files.
  function wrap(obj, name, after) {
    if (!obj || typeof obj[name] !== 'function') return;
    const orig = obj[name];
    obj[name] = function () {
      const r = orig.apply(this, arguments);
      try { after.apply(this, arguments); } catch (_) {}
      return r;
    };
  }
  if (window.CatCompanion) {
    wrap(window.CatCompanion, 'curious', () => bump('curious'));
    wrap(window.CatCompanion, 'happy', () => bump('opened'));
    // init runs on loader dismiss (and never under reduced-motion) — start hints then.
    wrap(window.CatCompanion, 'init', () => { catReady = true; scheduleHint(); });
  }
  if (window.Confetti) {
    wrap(window.Confetti, 'burst', (x, y) => { bump('confetti'); if (!bcApplying) bcSend({ type: 'confetti', x: x, y: y }); });
  }

  // "Cards flung" — drag-release that wasn't a click-open (mirrors desk-physics test).
  let downPt = null;
  document.addEventListener('pointerdown', (e) => {
    const card = e.target.closest && e.target.closest('.desk-card');
    downPt = card ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  }, true);
  document.addEventListener('pointerup', (e) => {
    if (!downPt) return;
    const moved = Math.abs(e.clientX - downPt.x) + Math.abs(e.clientY - downPt.y);
    const elapsed = performance.now() - downPt.t;
    const isClick = elapsed < 200 && moved < 6;
    if (!isClick && moved > 20) bump('flung');
    downPt = null;
  }, true);

  function statsText() {
    return [
      'cards flung ......... ' + stats.flung,
      'cat got curious ..... ' + stats.curious,
      'confetti popped ..... ' + stats.confetti,
      'projects opened ..... ' + stats.opened,
      'dice rolled ......... ' + stats.rolls,
      'seconds loitered .... ' + stats.seconds,
    ].join('\n');
  }

  // ------------------------------------------------------------------
  // Squigglevision — animate the shared filters' turbulence seed
  // ------------------------------------------------------------------
  const SEEDS = [2, 19, 43];
  let seedIdx = 0;
  let turbs = null;
  let boilTimer = null;

  function getTurbs() {
    if (!turbs || !turbs.length) turbs = document.querySelectorAll('.squiggle-defs feTurbulence');
    return turbs;
  }
  function startBoilTimer() {
    if (reduced || boilTimer) return;
    boilTimer = setInterval(() => {
      seedIdx = (seedIdx + 1) % SEEDS.length;
      const t = getTurbs();
      for (let i = 0; i < t.length; i++) t[i].setAttribute('seed', SEEDS[seedIdx]);
    }, 150);
  }
  function stopBoilTimer() {
    if (boilTimer) { clearInterval(boilTimer); boilTimer = null; }
  }
  startBoilTimer();

  function boilToggle(force) {
    const on = (force == null) ? !document.body.classList.contains('boil') : !!force;
    document.body.classList.toggle('boil', on);
    return on;
  }

  // ------------------------------------------------------------------
  // Warp (ratty homage) — bend the desk into weird shapes
  // ------------------------------------------------------------------
  let warpOn = false, mobiusOn = false, warpAmt = 1;

  function applyWarp() {
    document.body.style.setProperty('--warp-rx', (16 * warpAmt).toFixed(1) + 'deg');
    document.body.style.setProperty('--warp-ry', (-12 * warpAmt).toFixed(1) + 'deg');
  }
  function warpToggle(force) {
    warpOn = (force == null) ? !warpOn : !!force;
    document.body.classList.toggle('warp', warpOn);
    if (!warpOn) { mobiusOn = false; document.body.classList.remove('mobius'); }
    applyWarp();
    return warpOn;
  }
  function warpStep(delta) {
    if (!warpOn) warpToggle(true);
    warpAmt = Math.max(0.2, Math.min(2.4, warpAmt + delta));
    applyWarp();
  }
  function mobiusToggle() {
    if (!warpOn) warpToggle(true);
    mobiusOn = !mobiusOn;
    document.body.classList.toggle('mobius', mobiusOn);
    return mobiusOn;
  }

  // ------------------------------------------------------------------
  // Y2K mode — momentary CRT flashback
  // ------------------------------------------------------------------
  let y2kTimer = null, y2kBanner = null;
  function y2k() {
    document.body.classList.add('y2k');
    if (!y2kBanner) {
      y2kBanner = document.createElement('div');
      y2kBanner.className = 'wm-y2k-banner';
      y2kBanner.textContent = '✦ Y2K MODE ✦';
      y2kBanner.setAttribute('aria-hidden', 'true');
      document.body.appendChild(y2kBanner);
    }
    // force reflow so re-trigger restarts the transition
    void y2kBanner.offsetWidth;
    y2kBanner.classList.add('show');
    clearTimeout(y2kTimer);
    y2kTimer = setTimeout(() => {
      document.body.classList.remove('y2k');
      if (y2kBanner) y2kBanner.classList.remove('show');
    }, 5000);
  }

  // ------------------------------------------------------------------
  // Toast — feedback for effects fired outside the terminal
  // ------------------------------------------------------------------
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'wm-toast';
      toastEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // ------------------------------------------------------------------
  // Roll (elimelt homage) — luck spinner
  // ------------------------------------------------------------------
  const FORTUNES = [
    'today is a good day to fling a card.',
    'the cat believes in you.',
    'ship it. the worst case is a rollback.',
    'a bug you fear is smaller than you think.',
    'press ` again later. there might be more.',
    'mint green is just white that went outside.',
  ];
  function center() { return { x: window.innerWidth / 2, y: window.innerHeight / 2 }; }
  function roll() {
    bump('rolls');
    const outcomes = [
      () => { const c = center(); if (window.Confetti) window.Confetti.burst(c.x, c.y); return '🎉 confetti! the cat approves.'; },
      () => { warpToggle(true); setTimeout(() => warpToggle(false), 1400); return '🌀 woah — the desk tipped over.'; },
      () => { y2k(); return '📺 blast back to the year 2000.'; },
      () => { boilToggle(true); setTimeout(() => boilToggle(false), 2500); return '〰 everything went hand-drawn.'; },
      () => { if (window.CatCompanion) window.CatCompanion.happy(); return '😺 the cat is pleased.'; },
      () => '🥠 ' + FORTUNES[(Math.random() * FORTUNES.length) | 0],
    ];
    return outcomes[(Math.random() * outcomes.length) | 0]();
  }

  // ------------------------------------------------------------------
  // Hidden terminal — the hub
  // ------------------------------------------------------------------
  const BANNER =
    'anson.os v2.0  —  type "help" for commands.  (esc or ` to close)';
  const HELP = [
    'help ...... this list',
    'whoami .... who is poking around',
    'cat ....... a cat',
    'ls ........ look around',
    'stats ..... your little trackers',
    'life ...... conway\'s game of life ("life stop" ends it)',
    'fractal ... mandelbrot set ("fractal zoom" to dive in)',
    'dig ....... real DNS-over-HTTPS lookup (dig github.com MX)',
    'ip ........ your public ip + rough location (live)',
    'mine ...... sha-256 proof-of-work in a web worker (mine 20)',
    'synth ..... chiptune + live ascii spectrum (web audio)',
    'tabs ...... cross-tab presence (open a 2nd tab!)',
    'roll ...... try your luck 🎲',
    'warp ...... bend the desk (ctrl+alt+enter; ↑/↓ to dial; ctrl+alt+m = möbius)',
    'boil ...... squigglevision, site-wide',
    'y2k ....... flash back to 2000',
    'clear / exit',
  ].join('\n');
  const CAT_ART = [
    '   /\\_/\\',
    '  ( o.o )',
    '   > ^ <   meow.',
  ].join('\n');

  let term = null, termLog = null, termInput = null, termOpen = false;
  const cmdHistory = [];
  let hIdx = 0;

  function buildTerminal() {
    if (term) return;
    term = document.createElement('div');
    term.className = 'wm-terminal';
    term.setAttribute('role', 'dialog');
    term.setAttribute('aria-label', 'hidden terminal');
    term.innerHTML =
      '<div class="wm-terminal__bar">' +
        '<span class="wm-dot wm-dot--r"></span>' +
        '<span class="wm-dot wm-dot--y"></span>' +
        '<span class="wm-dot wm-dot--g"></span>' +
        '<span class="wm-terminal__title">guest@anson — ~/portfolio</span>' +
      '</div>' +
      '<div class="wm-terminal__log"></div>' +
      '<div class="wm-terminal__inputline">' +
        '<span class="wm-prompt">$</span>' +
        '<input class="wm-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="terminal input">' +
      '</div>';
    document.body.appendChild(term);
    termLog = term.querySelector('.wm-terminal__log');
    termInput = term.querySelector('.wm-input');
    termInput.addEventListener('keydown', onTermKey);
    const closeDot = term.querySelector('.wm-dot--r');
    if (closeDot) {
      closeDot.setAttribute('title', 'close');
      closeDot.addEventListener('click', closeTerm);
    }
    println(BANNER);
  }

  function println(s) {
    if (!termLog) return;
    const div = document.createElement('div');
    div.textContent = s;
    termLog.appendChild(div);
    termLog.scrollTop = termLog.scrollHeight;
  }

  function openTerm() {
    buildTerminal();
    termOpen = true;
    hideHint();
    term.classList.add('open');
    setTimeout(() => { if (termInput) termInput.focus(); }, 10);
  }
  function closeTerm() {
    if (!term) return;
    termOpen = false;
    lifeStop(); synthStop(); mineStop();
    term.classList.remove('open');
    if (termInput) termInput.blur();
  }
  function toggleTerm() { termOpen ? closeTerm() : openTerm(); }

  function runCommand(raw) {
    const line = (raw || '').trim();
    if (line) { cmdHistory.push(line); hIdx = cmdHistory.length; }
    println('$ ' + line);
    lifeStop(); synthStop(); mineStop();            // any command ends a running sim/tune/miner
    const parts = line.split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    switch (cmd) {
      case '': break;
      case 'help': println(HELP); break;
      case 'whoami': println("anson — cs @ uw seattle. you're guest, snooping around. (hi!)"); break;
      case 'cat': println(CAT_ART); break;
      case 'ls': println('projects/  about/  resume.pdf  secrets/  cat.gif'); break;
      case 'sudo': println("nice try. you don't have root on my heart. 🐾"); break;
      case 'stats': println(statsText()); break;
      case 'life':
        if ((parts[1] || '').toLowerCase() === 'stop') println('life stopped at gen ' + lifeGen + '.');
        else startLife();
        break;
      case 'fractal': case 'mandelbrot': case 'mandel': {
        const sub = (parts[1] || '').toLowerCase();
        if (sub === 'zoom' || sub === 'in') fracZoom = Math.min(8, fracZoom + 1);
        else if (sub === 'out') fracZoom = Math.max(0, fracZoom - 1);
        else fracZoom = 0;                            // bare/`reset` = full set
        renderFractal();
        break;
      }
      case 'dig': digLookup(parts[1], parts[2]); break;
      case 'ip': case 'whereami': ipLookup(); break;
      case 'mine':
        if ((parts[1] || '').toLowerCase() === 'stop') println('mining aborted.');
        else startMine(parts[1]);
        break;
      case 'synth': case 'play':
        if ((parts[1] || '').toLowerCase() === 'stop') println('synth cut.');
        else playSynth();
        break;
      case 'tabs': {
        const n = tabCount();
        println(n + ' tab' + (n === 1 ? '' : 's') + ' connected via BroadcastChannel' +
          (n === 1 ? '. open a 2nd tab — the cats find each other. 🐾' : ' — ghost cats are live. 🐾'));
        break;
      }
      case 'roll': println(roll()); break;
      case 'warp': println(warpToggle() ? 'warp engaged. ctrl+alt+↑/↓ to bend, ctrl+alt+m for möbius.' : 'warp off.'); break;
      case 'mobius': case 'möbius': println('möbius ' + (mobiusToggle() ? 'on' : 'off') + '.'); break;
      case 'y2k': y2k(); println('loading windows 2000... ▓▓▓▓ done.'); break;
      case 'boil': println(boilToggle() ? 'squigglevision on — everything is hand-drawn now.' : 'squigglevision off.'); break;
      case 'echo': println(parts.slice(1).join(' ')); break;
      case 'clear': if (termLog) termLog.innerHTML = ''; break;
      case 'exit': case 'quit': closeTerm(); break;
      default: println('command not found: ' + cmd + "  (try 'help')");
    }
  }

  function onTermKey(e) {
    if (e.key === 'Enter') {
      runCommand(termInput.value);
      termInput.value = '';
      e.preventDefault();
    } else if (e.key === 'Escape') {
      closeTerm();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      if (cmdHistory.length) { hIdx = Math.max(0, hIdx - 1); termInput.value = cmdHistory[hIdx] || ''; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (cmdHistory.length) { hIdx = Math.min(cmdHistory.length, hIdx + 1); termInput.value = cmdHistory[hIdx] || ''; }
      e.preventDefault();
    }
  }

  // ------------------------------------------------------------------
  // Conway's Game of Life — a real cellular automaton, live in the terminal
  // ------------------------------------------------------------------
  let lifeEl = null, lifeTimer = null, lifeGrid = null;
  let lifeCols = 0, lifeRows = 0, lifeGen = 0;
  const LIFE_ROWS = 22, LIFE_MAX_GEN = 900, LIFE_MS = 110;

  // Fit as many columns as the terminal can show: measure the monospace
  // advance width with a hidden probe rather than hardcoding a width.
  function lifeMeasureCols() {
    const probe = document.createElement('span');
    probe.textContent = '0'.repeat(50);
    probe.style.cssText = 'visibility:hidden;white-space:pre;';
    lifeEl.appendChild(probe);
    const charW = (probe.offsetWidth / 50) || 7;
    probe.remove();
    const avail = lifeEl.clientWidth || 360;
    return Math.max(24, Math.min(72, Math.floor(avail / charW)));
  }

  function lifeSeed() {
    const g = new Uint8Array(lifeCols * lifeRows);
    // Gosper glider gun (emits gliders forever) when it fits; else a
    // random "soup". Coordinates are the canonical 36x9 pattern.
    if (lifeCols >= 38 && lifeRows >= 11) {
      const gun = [[24,0],[22,1],[24,1],[12,2],[13,2],[20,2],[21,2],[34,2],[35,2],
        [11,3],[15,3],[20,3],[21,3],[34,3],[35,3],[0,4],[1,4],[10,4],[16,4],[20,4],[21,4],
        [0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],[10,6],[16,6],[24,6],
        [11,7],[15,7],[12,8],[13,8]];
      for (let i = 0; i < gun.length; i++) {
        const x = gun[i][0] + 1, y = gun[i][1] + 1;
        g[y * lifeCols + x] = 1;
      }
    } else {
      for (let i = 0; i < g.length; i++) g[i] = Math.random() < 0.32 ? 1 : 0;
    }
    return g;
  }

  function lifeStep() {
    const c = lifeCols, r = lifeRows, g = lifeGrid, next = new Uint8Array(c * r);
    for (let y = 0; y < r; y++) {
      for (let x = 0; x < c; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;        // bounded edges = dead
            if (nx >= 0 && nx < c && ny >= 0 && ny < r) n += g[ny * c + nx];
          }
        }
        const alive = g[y * c + x];
        next[y * c + x] = (alive ? (n === 2 || n === 3) : n === 3) ? 1 : 0;
      }
    }
    lifeGrid = next;
    lifeGen++;
  }

  function lifeRender(note) {
    let out = '', pop = 0;
    for (let y = 0; y < lifeRows; y++) {
      let row = '';
      for (let x = 0; x < lifeCols; x++) {
        const v = lifeGrid[y * lifeCols + x];
        pop += v;
        row += v ? '█' : ' ';
      }
      out += row + '\n';
    }
    lifeEl.textContent = out + 'gen ' + lifeGen + ' · pop ' + pop + '   —   ' + note;
  }

  function startLife() {
    lifeStop();
    lifeEl = document.createElement('div');
    lifeEl.className = 'wm-life';
    termLog.appendChild(lifeEl);
    lifeCols = lifeMeasureCols();
    lifeRows = LIFE_ROWS;
    lifeGrid = lifeSeed();
    lifeGen = 0;
    if (reduced) {                                  // honor reduced-motion
      lifeRender('reduced-motion: one still generation');
      termLog.scrollTop = termLog.scrollHeight;
      return;
    }
    lifeRender('"life stop" or any command to end');
    termLog.scrollTop = termLog.scrollHeight;
    lifeTimer = setInterval(() => {
      lifeStep();
      lifeRender('"life stop" or any command to end');
      if (lifeGen >= LIFE_MAX_GEN) lifeStop();
    }, LIFE_MS);
  }

  function lifeStop() {
    if (lifeTimer) { clearInterval(lifeTimer); lifeTimer = null; }
  }

  // ------------------------------------------------------------------
  // Mandelbrot set — escape-time iteration rendered as shaded ASCII
  // ------------------------------------------------------------------
  const FRAC_ROWS = 24;
  const FRAC_RAMP = ' .:-=+*#%';            // exterior halo: fast→slow escape
  const SEAHORSE = { x: -0.743644, y: 0.131826 };  // classic deep-zoom target
  const FRAC_STEP = 0.32;                   // view shrink per zoom level
  let fracZoom = 0;                         // 0 = full set

  // Measure a single monospace cell so the complex plane maps without
  // distortion (terminal cells are taller than they are wide).
  function measureCell(el) {
    const probe = document.createElement('span');
    probe.textContent = '0';
    probe.style.cssText = 'visibility:hidden;white-space:pre;display:inline-block;';
    el.appendChild(probe);
    const w = probe.offsetWidth || 7, h = probe.offsetHeight || 12;
    probe.remove();
    return { w: w, h: h };
  }

  function renderFractal() {
    const el = document.createElement('div');
    el.className = 'wm-fractal';
    termLog.appendChild(el);
    const cell = measureCell(el);
    const cols = Math.max(24, Math.min(80, Math.floor((el.clientWidth || 360) / cell.w)));
    const rows = FRAC_ROWS;
    const H = 1.2 * Math.pow(FRAC_STEP, fracZoom);            // vertical half-extent
    const W = H * (cols * cell.w) / (rows * cell.h);          // derive width from aspect
    const cx = fracZoom > 0 ? SEAHORSE.x : -0.6;
    const cy = fracZoom > 0 ? SEAHORSE.y : 0;
    const maxIter = 70 + fracZoom * 55;
    let out = '';
    for (let row = 0; row < rows; row++) {
      const im = cy + ((row / (rows - 1)) - 0.5) * 2 * H;
      let line = '';
      for (let col = 0; col < cols; col++) {
        const re = cx + ((col / (cols - 1)) - 0.5) * 2 * W;
        let zr = 0, zi = 0, it = 0;
        while (zr * zr + zi * zi <= 4 && it < maxIter) {
          const t = zr * zr - zi * zi + re;
          zi = 2 * zr * zi + im;
          zr = t;
          it++;
        }
        if (it >= maxIter) line += '█';                       // inside the set
        else {
          const f = Math.pow(it / maxIter, 0.4);              // gamma for a softer halo
          line += FRAC_RAMP[Math.min(FRAC_RAMP.length - 1, (f * FRAC_RAMP.length) | 0)];
        }
      }
      out += line + '\n';
    }
    const mag = Math.round(1 / Math.pow(FRAC_STEP, fracZoom));
    const where = fracZoom > 0 ? ('seahorse valley · ×' + mag) : 'full set';
    el.textContent = out + 'mandelbrot · ' + where + ' · ' + maxIter +
      ' iters   —   "fractal zoom" to dive, "fractal reset" to back out';
    termLog.scrollTop = termLog.scrollHeight;
  }

  // ------------------------------------------------------------------
  // Live networking — real requests from a "static" GitHub Pages site.
  // No backend exists; the browser is the compute, third-party APIs the
  // backend we never deployed.
  // ------------------------------------------------------------------
  const DIG_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'];
  const DNS_TYPE_NAME = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX', 16: 'TXT', 28: 'AAAA' };
  const DNS_STATUS = { 0: 'NOERROR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 5: 'REFUSED' };

  // `dig <domain> [TYPE]` — real DNS resolution via DNS-over-HTTPS (RFC 8484,
  // Google's JSON endpoint).
  async function digLookup(rawName, rawType) {
    const name = (rawName || '').trim().toLowerCase().replace(/\.$/, '');
    if (!name || !/^[a-z0-9.-]+$/.test(name) || name.indexOf('.') === -1) {
      println('usage: dig <domain> [A|AAAA|MX|TXT|NS|CNAME|SOA]   e.g. dig github.com MX');
      return;
    }
    let type = (rawType || 'A').toUpperCase();
    if (DIG_TYPES.indexOf(type) === -1) type = 'A';
    println('; <<>> dig over https <<>> ' + name + ' ' + type);
    try {
      const url = 'https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + type;
      const res = await fetch(url, { headers: { accept: 'application/dns-json' } });
      const d = await res.json();
      if (d.Status !== 0) { println(';; status: ' + (DNS_STATUS[d.Status] || d.Status) + ' — no records'); return; }
      const ans = d.Answer || [];
      if (!ans.length) { println(';; no ' + type + ' records for ' + name); return; }
      for (let i = 0; i < ans.length; i++) {
        const a = ans[i];
        println(a.name + '  ' + a.TTL + '  ' + (DNS_TYPE_NAME[a.type] || a.type) + '  ' + a.data);
      }
      println(';; ' + ans.length + ' answer' + (ans.length === 1 ? '' : 's') + ' · via dns.google');
    } catch (e) {
      println(';; lookup failed — dns-over-https needs a live connection.');
    }
  }

  // `ip` / `whereami` — your public IP + rough geolocation, fetched live.
  async function ipLookup() {
    println('; resolving your connection…');
    const show = (d, isp) => {
      const loc = [d.city, d.region, d.country].filter(Boolean).join(', ') || '—';
      println('ip ........ ' + (d.ip || '—'));
      println('location .. ' + loc);
      println('isp ....... ' + (isp || '—'));
      if (d.latitude && d.longitude) println('coords .... ' + d.latitude + ', ' + d.longitude);
      println(';; only you can see this — nothing is stored. 🐾');
    };
    try {
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json');
      const d = await r.json();
      show(d, d.organization_name || d.organization);
      return;
    } catch (e1) {}
    try {                                            // fallback provider
      const r = await fetch('https://ipapi.co/json/');
      const d = await r.json();
      show({ ip: d.ip, city: d.city, region: d.region, country: d.country_name,
             latitude: d.latitude, longitude: d.longitude }, d.org);
      return;
    } catch (e2) {}
    println(';; lookup failed — offline, or both providers blocked the request.');
  }

  // ------------------------------------------------------------------
  // Proof-of-work miner — real SHA-256 PoW in a Web Worker (off the main
  // thread, so the page never freezes), hashing via crypto.subtle.
  // ------------------------------------------------------------------
  const MINE_WORKER_SRC = [
    'self.onmessage = async function (e) {',
    '  var prefix = e.data.prefix, bits = e.data.bits;',
    '  var enc = new TextEncoder();',
    '  var fz = bits >> 3, rem = bits & 7;',
    '  var nonce = 0, hashes = 0;',
    '  var start = performance.now(), last = start;',
    '  for (;;) {',
    '    var dg = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(prefix + nonce)));',
    '    hashes++;',
    '    var ok = true, i;',
    '    for (i = 0; i < fz; i++) { if (dg[i] !== 0) { ok = false; break; } }',
    '    if (ok && rem) { if ((dg[fz] >> (8 - rem)) !== 0) ok = false; }',
    '    if (ok) {',
    '      var hex = "";',
    '      for (i = 0; i < dg.length; i++) hex += dg[i].toString(16).padStart(2, "0");',
    '      self.postMessage({ type: "found", nonce: nonce, hash: hex, hashes: hashes });',
    '      return;',
    '    }',
    '    nonce++;',
    '    if ((hashes & 2047) === 0) {',
    '      var now = performance.now();',
    '      if (now - last > 200) { self.postMessage({ type: "progress", hashes: hashes, rate: hashes / ((now - start) / 1000) }); last = now; }',
    '    }',
    '  }',
    '};'
  ].join('\n');

  let mineWorker = null, mineEl = null, mineStart = 0;

  function mineStop() {
    if (mineWorker) { mineWorker.terminate(); mineWorker = null; }
  }

  function startMine(bitsArg) {
    mineStop();
    let bits = parseInt(bitsArg, 10);
    if (!Number.isFinite(bits)) bits = 18;
    bits = Math.max(8, Math.min(28, bits));
    const prefix = 'anson@portfolio/' + Date.now() + '/';
    println('; mining: find a sha-256 with ' + bits + ' leading zero bits…  ("mine stop" to abort)');
    mineEl = document.createElement('div');
    termLog.appendChild(mineEl);
    mineStart = performance.now();
    try {
      const blob = new Blob([MINE_WORKER_SRC], { type: 'application/javascript' });
      mineWorker = new Worker(URL.createObjectURL(blob));
    } catch (e) { println(';; web workers unavailable here.'); return; }
    mineWorker.onmessage = (ev) => {
      const m = ev.data;
      const secs = (performance.now() - mineStart) / 1000;
      if (m.type === 'progress') {
        mineEl.textContent = '⛏  ' + m.hashes.toLocaleString() + ' hashes · ' +
          Math.round(m.rate).toLocaleString() + ' H/s · ' + secs.toFixed(1) + 's';
        termLog.scrollTop = termLog.scrollHeight;
      } else if (m.type === 'found') {
        mineEl.textContent = '⛏  solved in ' + secs.toFixed(1) + 's after ' + m.hashes.toLocaleString() + ' hashes';
        println('nonce ..... ' + m.nonce);
        println('sha256 .... ' + m.hash);
        println(';; ' + bits + ' leading zero bits — real proof-of-work, in a web worker. 🐾');
        mineStop();
        try { if (window.Confetti) Confetti.burst(window.innerWidth / 2, window.innerHeight / 2); } catch (_) {}
      }
    };
    mineWorker.postMessage({ prefix: prefix, bits: bits });
  }

  // ------------------------------------------------------------------
  // Cross-tab presence + ghost cats via BroadcastChannel — open the site
  // in 2+ tabs/windows and they sync (cursors, confetti, a live count).
  // ------------------------------------------------------------------
  let bc = null, bcApplying = false;
  const TAB_ID = Math.random().toString(36).slice(2, 9);
  const peers = new Map();                       // id -> { x, y, last, el }

  function bcSend(msg) { if (bc) { msg.id = TAB_ID; try { bc.postMessage(msg); } catch (_) {} } }

  function initBroadcast() {
    if (typeof BroadcastChannel === 'undefined') return;
    try { bc = new BroadcastChannel('whimsy.tabs.v1'); } catch (_) { return; }
    bc.onmessage = (e) => {
      const m = e.data;
      if (!m || m.id === TAB_ID) return;
      let p = peers.get(m.id);
      if (!p) { p = { x: 0, y: 0, last: 0, el: null }; peers.set(m.id, p); }
      p.last = performance.now();
      if (m.type === 'cursor') { p.x = m.x; p.y = m.y; updateGhost(p); }
      else if (m.type === 'confetti') { bcApplying = true; try { if (window.Confetti) Confetti.burst(m.x, m.y); } catch (_) {} bcApplying = false; }
      else if (m.type === 'leave') { removeGhost(p); peers.delete(m.id); }
    };
    let lastMove = 0;
    window.addEventListener('pointermove', (e) => {
      const t = performance.now();
      if (t - lastMove < 45) return;
      lastMove = t;
      bcSend({ type: 'cursor', x: e.clientX, y: e.clientY });
    });
    setInterval(() => {                          // heartbeat + prune dead peers
      bcSend({ type: 'ping' });
      const now = performance.now();
      peers.forEach((p, id) => { if (now - p.last > 2500) { removeGhost(p); peers.delete(id); } });
    }, 1000);
    window.addEventListener('pagehide', () => bcSend({ type: 'leave' }));
    bcSend({ type: 'ping' });
  }

  function updateGhost(p) {
    if (reduced) return;
    if (!p.el) {
      p.el = document.createElement('div');
      p.el.className = 'wm-ghost-cat';
      p.el.textContent = '(=^·ω·^=)';
      p.el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(p.el);
    }
    p.el.style.transform = 'translate3d(' + (p.x + 16) + 'px,' + (p.y + 16) + 'px,0)';
    p.el.classList.add('show');
  }
  function removeGhost(p) { if (p && p.el) { p.el.remove(); p.el = null; } }
  function tabCount() {
    const now = performance.now();
    let n = 1;
    peers.forEach((p) => { if (now - p.last <= 2500) n++; });
    return n;
  }

  // ------------------------------------------------------------------
  // Chiptune synth — Web Audio oscillators + ADSR, visualized with a
  // live AnalyserNode FFT drawn as an ASCII spectrum.
  // ------------------------------------------------------------------
  const TUNE = [          // [freq Hz, beats]
    [523, 1], [659, 1], [784, 1], [1047, 1], [784, 1], [659, 1],
    [587, 1], [698, 1], [880, 1], [1175, 1], [880, 1], [698, 1],
    [523, 1], [784, 1], [659, 1], [523, 2],
  ];
  let actx = null, synthRaf = null, synthEl = null, synthAnalyser = null, synthMaster = null;

  function synthCtx() {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); }
    return actx;
  }

  function playSynth() {
    const ctx = synthCtx();
    if (!ctx) { println(';; web audio not available here.'); return; }
    synthStop();
    if (ctx.state === 'suspended') ctx.resume();
    const master = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    synthMaster = master;
    synthAnalyser = analyser;
    const now = ctx.currentTime;
    master.gain.setValueAtTime(0.28, now);
    const beat = 0.16;
    let t = now + 0.05;
    for (let i = 0; i < TUNE.length; i++) {
      const freq = TUNE[i][0], dur = TUNE[i][1] * beat;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);                       // ADSR
      g.gain.linearRampToValueAtTime(0.6, t + 0.012);         // attack
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);    // decay → sustain
      g.gain.setValueAtTime(0.25, t + dur - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);   // release
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + dur + 0.02);
      t += dur;
    }
    const ms = (t - now) * 1000;
    synthEl = document.createElement('div');
    synthEl.className = 'wm-fractal';
    termLog.appendChild(synthEl);
    println('♪ synth: square-wave chiptune + live fft   ("synth stop" to cut)');
    if (reduced) synthEl.textContent = '(spectrum animation off — reduced motion)';
    else synthSpectrumLoop();
    setTimeout(synthStop, ms + 400);
    termLog.scrollTop = termLog.scrollHeight;
  }

  function synthSpectrumLoop() {
    const bins = synthAnalyser.frequencyBinCount;
    const data = new Uint8Array(bins);
    const COLS = 48, ROWS = 8;
    const draw = () => {
      if (!synthAnalyser) return;
      synthAnalyser.getByteFrequencyData(data);
      const grid = [];
      for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(' '));
      for (let c = 0; c < COLS; c++) {
        const bin = Math.floor((c / COLS) * bins * 0.7);      // lower 70% of spectrum
        const h = Math.round((data[bin] / 255) * ROWS);
        for (let r = 0; r < h; r++) grid[ROWS - 1 - r][c] = '█';
      }
      synthEl.textContent = grid.map((row) => row.join('')).join('\n');
      synthRaf = requestAnimationFrame(draw);
    };
    draw();
  }

  function synthStop() {
    if (synthRaf) { cancelAnimationFrame(synthRaf); synthRaf = null; }
    if (synthMaster && actx) {                                // silence if cut mid-tune
      try {
        const now = actx.currentTime;
        synthMaster.gain.cancelScheduledValues(now);
        synthMaster.gain.setValueAtTime(0.0001, now);
      } catch (_) {}
    }
    synthMaster = null;
    synthAnalyser = null;
  }

  // ------------------------------------------------------------------
  // Cat hints — the companion suggests an easter egg every ~10s
  // ------------------------------------------------------------------
  const HINTS = [
    'psst… hit ` for a hidden terminal',
    'ctrl+alt+enter tips the whole desk 🌀',
    "type 'roll' in my terminal 🎲",
    "'boil' makes the site hand-drawn 〰",
    'know the konami code? ↑↑↓↓←→←→ B A',
    "try 'stats' to see what you've done",
    "type 'life' for conway's game of life 🦠",
    "'fractal' renders the mandelbrot set 🌀",
    "try 'dig github.com MX' — real DNS in your browser 🌐",
    "'mine' runs real sha-256 proof-of-work ⛏",
    "'synth' = chiptune + a live spectrum ♪",
    'open a 2nd tab — the cats find each other 🐾',
    'fling a card across the desk →',
  ];
  let hintIdx = -1;
  let catReady = false;
  let bubble = null, bubbleRaf = null, idleTimer = null, idleWired = false;

  function ensureBubble() {
    if (bubble) return;
    bubble = document.createElement('div');
    bubble.className = 'wm-cat-hint';
    bubble.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bubble);
  }
  function positionBubble() {
    const cat = document.getElementById('cat-companion');
    if (!cat || !bubble) return;
    const r = cat.getBoundingClientRect();
    const bw = bubble.offsetWidth || 170;
    const bh = bubble.offsetHeight || 28;
    let x = r.right + 8;          // default: upper-right of the cat
    let y = r.top - bh - 6;
    if (x + bw > window.innerWidth - 8) x = r.left - bw - 8;  // flip left near edge
    if (x < 8) x = 8;
    if (y < 8) y = r.bottom + 8;                             // drop below near top
    bubble.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
  }
  function followTick() { positionBubble(); bubbleRaf = requestAnimationFrame(followTick); }
  function hideHint() {
    if (bubble) bubble.classList.remove('show');
    if (bubbleRaf) { cancelAnimationFrame(bubbleRaf); bubbleRaf = null; }
  }
  function showHint() {
    if (reduced || !catReady || termOpen) return false;
    const cat = document.getElementById('cat-companion');
    if (!cat) return false;
    const cs = getComputedStyle(cat);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    ensureBubble();
    let i;
    do { i = (Math.random() * HINTS.length) | 0; } while (HINTS.length > 1 && i === hintIdx);
    hintIdx = i;
    bubble.textContent = HINTS[i];
    positionBubble();
    bubble.classList.add('show');
    positionBubble();
    if (bubbleRaf == null) bubbleRaf = requestAnimationFrame(followTick);
    return true;
  }

  // Idle-gated hints: a bubble only surfaces after the cursor has sat still for
  // IDLE_MS. While the cursor stays idle the hints keep cycling — each shows for
  // VISIBLE_MS, hides, pauses GAP_MS, then a fresh one appears. Any mouse
  // movement (or button press) hides the bubble at once and restarts the idle
  // countdown, so a single twitch stops the cycle until things settle again.
  const IDLE_MS = 3000;     // stillness required before the first hint
  const VISIBLE_MS = 4500;  // how long each hint stays up
  const GAP_MS = 1200;      // breather between hints while still idle
  function armIdle() {
    clearTimeout(idleTimer);
    if (reduced || !catReady) return;
    idleTimer = setTimeout(cycleHint, IDLE_MS);
  }
  function cycleHint() {
    clearTimeout(idleTimer);
    if (showHint()) {
      // hold it, then hide and queue the next one (still idle = keep cycling)
      idleTimer = setTimeout(() => {
        hideHint();
        idleTimer = setTimeout(cycleHint, GAP_MS);
      }, VISIBLE_MS);
    } else {
      idleTimer = setTimeout(cycleHint, IDLE_MS); // term open / cat hidden — retry
    }
  }
  function onPointerActivity() {
    hideHint();   // fade away immediately on any movement
    armIdle();    // ...and restart the countdown to the next idle reveal
  }
  function scheduleHint() {
    clearTimeout(idleTimer);
    if (reduced || !catReady) return;
    if (!idleWired) {
      document.addEventListener('mousemove', onPointerActivity, { passive: true });
      document.addEventListener('mousedown', onPointerActivity, { passive: true });
      idleWired = true;
    }
    armIdle();    // also reveal after IDLE_MS if the cursor never moves post-load
  }

  // ------------------------------------------------------------------
  // Global keys: ` opens terminal, Ctrl+Alt+… warps, Konami → y2k
  // ------------------------------------------------------------------
  const KONAMI = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
  let kPos = 0;

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);

    if (e.key === '`' || e.code === 'Backquote') {
      if (typing && e.target !== termInput) return; // never hijack a real input
      e.preventDefault();
      toggleTerm();
      return;
    }

    if (e.ctrlKey && e.altKey) {
      if (e.code === 'Enter' || e.key === 'Enter') { e.preventDefault(); warpToggle(); return; }
      if (e.code === 'ArrowUp') { e.preventDefault(); warpStep(0.25); return; }
      if (e.code === 'ArrowDown') { e.preventDefault(); warpStep(-0.25); return; }
      if (e.code === 'KeyM') { e.preventDefault(); mobiusToggle(); return; }
    }

    if (!typing && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.keyCode === KONAMI[kPos]) {
        kPos++;
        if (kPos === KONAMI.length) { kPos = 0; y2k(); toast('🕹 konami unlocked'); }
      } else {
        kPos = (e.keyCode === KONAMI[0]) ? 1 : 0;
      }
    }
  });

  // Public surface (handy for the console / future hooks)
  window.Whimsy = {
    terminal: toggleTerm,
    warp: warpToggle,
    mobius: mobiusToggle,
    boil: boilToggle,
    y2k: y2k,
    life: () => { openTerm(); startLife(); },
    fractal: () => { openTerm(); fracZoom = 0; renderFractal(); },
    dig: (name, type) => { openTerm(); digLookup(name, type); },
    ip: () => { openTerm(); ipLookup(); },
    mine: (bits) => { openTerm(); startMine(bits); },
    synth: () => { openTerm(); playSynth(); },
    tabs: () => tabCount(),
    roll: () => toast(roll()),
    hint: showHint,
    stats: () => stats,
  };

  initBroadcast();
})();
