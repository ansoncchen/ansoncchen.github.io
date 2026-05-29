(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  const FACES = {
    idle:    '(=^·ω·^=)',
    blink:   '(=^-ω-^=)',
    moving:  '(=≡ω≡=)',
    curious: '(=⊙ω⊙=)?',
    happy:   '(=^▽^=)ﾉ',
  };

  let el = null;
  let x = 0, y = 0;       // rendered position
  let tx = 0, ty = 0;     // target (cursor)
  let raf = null;
  let state = 'idle';
  let stateLock = 0;      // ms timestamp until which state is held
  let blinkAt = 0;
  let hovering = false;   // pointer is over a card — hold curious until it leaves
  let hidden = false;

  function setFace(name) {
    if (!el) return;
    state = name;
    el.textContent = FACES[name] || FACES.idle;
  }

  function loop(now) {
    // spring toward cursor with lag
    x += (tx - x) * 0.18;
    y += (ty - y) * 0.18;
    if (el) el.style.transform = 'translate3d(' + (x + 16) + 'px,' + (y + 16) + 'px,0)';
    const speed = Math.abs(tx - x) + Math.abs(ty - y);
    if (now > stateLock) {
      if (hovering) {
        if (state !== 'curious') setFace('curious');
      } else if (speed > 6) {
        setFace('moving');
      } else if (now > blinkAt) {
        setFace('blink');
        blinkAt = now + 1000 + Math.random() * 2000;
        stateLock = now + 750;
      } else if (state !== 'idle') {
        setFace('idle');
      }
    }
    raf = requestAnimationFrame(loop);
  }

  function init() {
    el = document.getElementById('cat-companion');
    if (!el || hidden) return;
    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
    setFace('idle');
    if (raf == null) raf = requestAnimationFrame(loop);
  }

  function curious() { if (!hidden) { hovering = true; setFace('curious'); stateLock = 0; } }
  function happy()   { if (!hidden) { hovering = false; setFace('happy'); stateLock = performance.now() + 3000; } }
  function idle()    { hovering = false; }
  function hide()    { hidden = true; if (raf) { cancelAnimationFrame(raf); raf = null; } if (el) el.style.display = 'none'; }

  window.CatCompanion = { init, curious, happy, idle, hide };
})();
