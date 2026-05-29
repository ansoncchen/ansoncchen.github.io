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
      if (reduced) { stopBoilTimer(); clearTimeout(hintNextTimer); hideHint(); }
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
    wrap(window.Confetti, 'burst', () => bump('confetti'));
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
    term.classList.remove('open');
    if (termInput) termInput.blur();
  }
  function toggleTerm() { termOpen ? closeTerm() : openTerm(); }

  function runCommand(raw) {
    const line = (raw || '').trim();
    if (line) { cmdHistory.push(line); hIdx = cmdHistory.length; }
    println('$ ' + line);
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
  // Cat hints — the companion suggests an easter egg every ~10s
  // ------------------------------------------------------------------
  const HINTS = [
    'psst… hit ` for a hidden terminal',
    'ctrl+alt+enter tips the whole desk 🌀',
    "type 'roll' in my terminal 🎲",
    "'boil' makes the site hand-drawn 〰",
    'know the konami code? ↑↑↓↓←→←→ B A',
    "try 'stats' to see what you've done",
    'fling a card across the desk →',
  ];
  let hintIdx = -1;
  let catReady = false;
  let bubble = null, bubbleRaf = null, hintHideTimer = null, hintNextTimer = null;

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
    clearTimeout(hintHideTimer);
    hintHideTimer = setTimeout(hideHint, 4500);
    return true;
  }
  function scheduleHint() {
    clearTimeout(hintNextTimer);
    hintNextTimer = setTimeout(() => { scheduleHint(); showHint(); }, 9000 + Math.random() * 6000);
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
    roll: () => toast(roll()),
    hint: showHint,
    stats: () => stats,
  };
})();
