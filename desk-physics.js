(function () {
  'use strict';

  // ----------------------------------------------------------------------
  // Pure core (no DOM) — also exported for Node tests
  // ----------------------------------------------------------------------

  // Stable pseudo-random in [0,1) from an integer seed (deterministic layout jitter).
  function deterministicJitter(n) {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  // Loose centered grid; returns [{x, y, rot}] in px (card-center coordinates).
  function computeLayout(count, vw, vh, cardW, cardH) {
    const cols = Math.max(1, Math.min(count, Math.floor(vw / (cardW * 1.35)) || 1));
    const rows = Math.ceil(count / cols);
    const cellW = vw / cols;
    const usableH = vh - 160; // leave room for nav (top) + hint (bottom)
    const cellH = Math.min(cardH * 1.5, usableH / rows);
    const startY = (vh - rows * cellH) / 2 + cellH / 2;
    const positions = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const itemsInRow = (r === rows - 1) ? (count - cols * r) : cols;
      const rowStartX = (vw - itemsInRow * cellW) / 2 + cellW / 2;
      positions.push({
        x: rowStartX + c * cellW + (deterministicJitter(i) - 0.5) * cellW * 0.16,
        y: startY + r * cellH + (deterministicJitter(i + 99) - 0.5) * cellH * 0.16,
        rot: (deterministicJitter(i + 7) - 0.5) * 10, // base rotation in deg (~±5)
      });
    }
    return positions;
  }

  // Clamp a card inside bounds, inverting velocity with restitution on contact.
  function resolveEdges(card, bounds, restitution) {
    if (card.x < bounds.minX) { card.x = bounds.minX; card.vx = Math.abs(card.vx) * restitution; }
    else if (card.x > bounds.maxX) { card.x = bounds.maxX; card.vx = -Math.abs(card.vx) * restitution; }
    if (card.y < bounds.minY) { card.y = bounds.minY; card.vy = Math.abs(card.vy) * restitution; }
    else if (card.y > bounds.maxY) { card.y = bounds.maxY; card.vy = -Math.abs(card.vy) * restitution; }
    return card;
  }

  // Advance one card one frame (mutates and returns it). dtMs is nominal (~16).
  function stepCard(card, params, cursor, bounds, dtMs) {
    const ax = (card.homeX - card.x) * params.stiffness;
    let ay = (card.homeY - card.y) * params.stiffness;
    card.t += dtMs;
    ay += Math.sin(card.t * params.bobSpeed + card.phase) * params.bobAmp;
    if (cursor && params.repelRadius > 0) {
      const dx = card.x - cursor.x;
      const dy = card.y - cursor.y;
      const dist2 = dx * dx + dy * dy;
      const r = params.repelRadius;
      if (dist2 < r * r && dist2 > 0.0001) {
        const dist = Math.sqrt(dist2);
        const force = (1 - dist / r) * params.repelStrength;
        card.vx += (dx / dist) * force;
        card.vy += (dy / dist) * force;
      }
    }
    card.vx = (card.vx + ax) * params.damping;
    card.vy = (card.vy + ay) * params.damping;
    card.x += card.vx;
    card.y += card.vy;
    const targetRot = card.baseRot + card.vx * params.tiltFactor;
    card.vrot = (card.vrot + (targetRot - card.rot) * params.rotStiffness) * params.damping;
    card.rot += card.vrot;
    resolveEdges(card, bounds, params.restitution);
    return card;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { deterministicJitter, computeLayout, resolveEdges, stepCard };
  }

  // ----------------------------------------------------------------------
  // DOM glue (browser only)
  // ----------------------------------------------------------------------
  if (typeof document === 'undefined') return;

  const CARD_W = 240;
  const CARD_H = 170;
  let cards = [];          // { el, id, x, y, ... , homeX, homeY, baseRot }
  let onOpen = null;

  function buildCard(project, index) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'desk-card';
    el.dataset.projectId = project.id;
    el.dataset.index = String(index);
    el.setAttribute('aria-label', 'Open project: ' + project.title);
    el.innerHTML =
      '<span class="desk-card__frame"><img class="desk-card__img" src="' +
      project.carouselImage + '" alt="" draggable="false"></span>' +
      '<span class="desk-card__label">' + project.title + '</span>';
    return el;
  }

  function layoutCards() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const positions = computeLayout(cards.length, vw, vh, CARD_W, CARD_H);
    cards.forEach((card, i) => {
      const p = positions[i];
      card.homeX = card.x = p.x;
      card.homeY = card.y = p.y;
      card.baseRot = card.rot = p.rot;
      applyTransform(card);
    });
  }

  function applyTransform(card) {
    // x,y are card centers; element is positioned with translate from top-left.
    card.el.style.transform =
      'translate3d(' + (card.x - CARD_W / 2) + 'px,' + (card.y - CARD_H / 2) +
      'px,0) rotate(' + card.rot + 'deg)';
  }

  const params = {
    stiffness: 0.014, damping: 0.86, bobSpeed: 0.0016, bobAmp: 0.18,
    repelRadius: 150, repelStrength: 0.5, restitution: 0.55,
    tiltFactor: 0.5, rotStiffness: 0.08,
  };
  let cursor = null;
  let rafId = null;
  let reduced = false;

  function bounds() {
    return {
      minX: CARD_W / 2 + 8,
      maxX: window.innerWidth - CARD_W / 2 - 8,
      minY: CARD_H / 2 + 70,                       // below nav
      maxY: window.innerHeight - CARD_H / 2 - 56,  // above hint
    };
  }

  function frame() {
    const b = bounds();
    for (const card of cards) {
      if (card.dragging) { applyTransform(card); continue; }
      stepCard(card, params, cursor, b, 16);
      applyTransform(card);
    }
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (rafId == null && !reduced) rafId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  window.addEventListener('pointermove', (e) => { cursor = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointerout', (e) => { if (!e.relatedTarget) cursor = null; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  function init(projects, openCb) {
    onOpen = openCb;
    const desk = document.getElementById('desk');
    if (!desk) return;
    desk.innerHTML = '';
    cards = projects.map((project, index) => {
      const el = buildCard(project, index);
      desk.appendChild(el);
      const card = {
        el, id: project.id,
        x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0,
        homeX: 0, homeY: 0, baseRot: 0, phase: index * 1.7, t: 0,
      };
      attachDrag(card);
      return card;
    });
    layoutCards();
    window.addEventListener('resize', layoutCards);
    startLoop();
  }

  function attachDrag(card) {
    const el = card.el;
    let downX = 0, downY = 0, downT = 0;
    let lastX = 0, lastY = 0, lastMoveT = 0;
    let velX = 0, velY = 0;

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      card.dragging = true;
      card.vx = card.vy = 0;
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
      downT = lastMoveT = performance.now();
      card.grabDX = card.x - e.clientX;
      card.grabDY = card.y - e.clientY;
    });

    el.addEventListener('pointermove', (e) => {
      if (!card.dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      velX = (e.clientX - lastX) / dt * 16;
      velY = (e.clientY - lastY) / dt * 16;
      lastX = e.clientX; lastY = e.clientY; lastMoveT = now;
      card.x = e.clientX + card.grabDX;
      card.y = e.clientY + card.grabDY;
      card.rot = card.baseRot + velX * params.tiltFactor;
      applyTransform(card);
    });

    function release(e) {
      if (!card.dragging) return;
      card.dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
      const elapsed = performance.now() - downT;
      if (elapsed < 200 && moved < 6) {
        // Treated as a click: open.
        if (window.CatCompanion) window.CatCompanion.happy();
        if (onOpen) onOpen(card.id);
        return;
      }
      // Fling: hand momentum back to the physics loop.
      card.vx = Math.max(-40, Math.min(40, velX));
      card.vy = Math.max(-40, Math.min(40, velY));
    }

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('pointerenter', () => { if (window.CatCompanion) window.CatCompanion.curious(); });
    el.addEventListener('pointerleave', () => { if (window.CatCompanion) window.CatCompanion.idle(); });

    // Keyboard activation: a <button> fires click with detail 0 on Enter/Space.
    // Mouse clicks (detail >= 1) are already handled by the pointer release path.
    el.addEventListener('click', (e) => {
      if (e.detail === 0 && onOpen) onOpen(card.id);
    });
  }

  function setReducedMotion(value) {
    reduced = !!value;
    if (reduced) { stopLoop(); layoutCards(); }
    else startLoop();
  }

  window.Desk = { init: init, setReducedMotion: setReducedMotion };
})();
