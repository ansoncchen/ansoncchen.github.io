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

  // Loose grid with guaranteed spacing. Rows keep a fixed height so cards never
  // overlap; when the block is taller than the viewport the desk scrolls.
  // Returns [{x, y, rot}] in px (card-center coords) with a `.contentHeight` prop.
  function computeLayout(count, vw, vh, cardW, cardH) {
    const cols = Math.max(1, Math.min(count, Math.floor(vw / (cardW * 1.35)) || 1));
    const rows = Math.ceil(count / cols);
    const cellW = vw / cols;
    const cellH = cardH * 1.5;        // fixed row pitch — ~85px vertical breathing room
    const topPad = 96;                // clearance under the nav
    const botPad = 88;                // clearance above the hint
    const blockH = rows * cellH;
    const fits = topPad + blockH + botPad <= vh;
    // Center the block when it all fits; otherwise top-align and let it scroll.
    const startY = fits ? (vh - blockH) / 2 + cellH / 2 : topPad + cellH / 2;
    const positions = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const itemsInRow = (r === rows - 1) ? (count - cols * r) : cols;
      const rowStartX = (vw - itemsInRow * cellW) / 2 + cellW / 2;
      positions.push({
        x: rowStartX + c * cellW + (deterministicJitter(i) - 0.5) * cellW * 0.12,
        y: startY + r * cellH + (deterministicJitter(i + 99) - 0.5) * cellH * 0.12,
        rot: (deterministicJitter(i + 7) - 0.5) * 10, // base rotation in deg (~±5)
      });
    }
    // Total scrollable height (>= viewport so the centered case never scrolls).
    positions.contentHeight = Math.max(vh, topPad + blockH + botPad);
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

  // Push overlapping cards apart along the axis of least penetration (AABB).
  // opts = { minDX, minDY, push, vel, slop }. A card with `dragging` is
  // immovable, so it shoves neighbors aside without being pushed back.
  //
  // Soft constraint: each frame we correct only `push` of the remaining overlap
  // (beyond a `slop` band) and bleed a little of that into velocity. Cards ease
  // apart over several frames instead of snapping, which keeps the motion smooth
  // and lets the home-spring + bob carry the settle rather than fighting a hard
  // teleport. `slop` ignores sub-pixel overlaps so neighbors don't micro-jitter.
  function resolveCollisions(list, opts) {
    const minDX = opts.minDX, minDY = opts.minDY;
    const push = opts.push, vel = opts.vel, slop = opts.slop || 0;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = minDX - Math.abs(dx); // overlap on x
        const oy = minDY - Math.abs(dy); // overlap on y
        if (ox <= 0 || oy <= 0) continue; // boxes clear on at least one axis
        const aMov = a.dragging ? 0 : 1;
        const bMov = b.dragging ? 0 : 1;
        const tot = aMov + bMov;
        if (tot === 0) continue; // both pinned (can't happen with one pointer)
        if (ox < oy) {
          const dir = dx < 0 ? -1 : 1;
          const corr = Math.max(0, ox - slop) * push;
          a.x -= dir * corr * (aMov / tot);
          b.x += dir * corr * (bMov / tot);
          a.vx -= dir * corr * vel * (aMov / tot);
          b.vx += dir * corr * vel * (bMov / tot);
        } else {
          const dir = dy < 0 ? -1 : 1;
          const corr = Math.max(0, oy - slop) * push;
          a.y -= dir * corr * (aMov / tot);
          b.y += dir * corr * (bMov / tot);
          a.vy -= dir * corr * vel * (aMov / tot);
          b.vy += dir * corr * vel * (bMov / tot);
        }
      }
    }
    return list;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { deterministicJitter, computeLayout, resolveEdges, stepCard, resolveCollisions };
  }

  // ----------------------------------------------------------------------
  // DOM glue (browser only)
  // ----------------------------------------------------------------------
  if (typeof document === 'undefined') return;

  const CARD_W = 240;
  const CARD_H = 170;
  let cards = [];          // { el, id, x, y, ... , homeX, homeY, baseRot }
  let onOpen = null;
  let deskEl = null;       // the scroll container
  let spacerEl = null;     // sized to contentHeight so the desk can scroll
  let deskHeight = 0;      // current scrollable content height (px)

  // Convert viewport coords (clientX/Y) into desk-content coords. The desk is an
  // internal scroll container, so its rect stays put while content scrolls —
  // add scrollLeft/scrollTop to reach content space.
  function toContent(clientX, clientY) {
    if (!deskEl) return { x: clientX, y: clientY };
    const r = deskEl.getBoundingClientRect();
    return {
      x: clientX - r.left + deskEl.scrollLeft,
      y: clientY - r.top + deskEl.scrollTop,
    };
  }

  // Project-type legend: label + fixed display order. Only categories that
  // actually appear in the data are rendered (see buildLegend).
  const CATEGORY_META = {
    research: 'Research',
    internship: 'Internship',
    hackathon: 'Hackathon',
    personal: 'Personal project',
  };
  const CATEGORY_ORDER = ['research', 'internship', 'hackathon', 'personal'];

  function buildCard(project, index) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'desk-card';
    el.dataset.projectId = project.id;
    el.dataset.index = String(index);
    if (project.category) el.dataset.category = project.category;
    el.setAttribute('aria-label', 'Open project: ' + project.title);
    el.innerHTML =
      '<span class="desk-card__frame"><img class="desk-card__img" src="' +
      project.carouselImage + '" alt="" draggable="false"></span>' +
      '<span class="desk-card__label">' + project.title + '</span>';
    return el;
  }

  function buildLegend(projects) {
    const present = {};
    projects.forEach((p) => { if (p.category) present[p.category] = true; });
    const used = CATEGORY_ORDER.filter((c) => present[c]);
    if (used.length < 2) return null; // a single category needs no key
    const key = document.createElement('ul');
    key.className = 'desk-key';
    key.setAttribute('aria-label', 'Project type legend');
    key.innerHTML = used.map((c) =>
      '<li class="desk-key__item"><span class="desk-key__dot" data-category="' +
      c + '"></span>' + CATEGORY_META[c] + '</li>'
    ).join('');
    return key;
  }

  function layoutCards() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const positions = computeLayout(cards.length, vw, vh, CARD_W, CARD_H);
    deskHeight = positions.contentHeight || vh;
    if (spacerEl) spacerEl.style.height = deskHeight + 'px';
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
  // Card-vs-card collision: min center distance per axis, with a soft per-frame
  // push so shoved cards glide apart instead of snapping (smoother, less jitter).
  const COLLIDE = { minDX: CARD_W * 0.92, minDY: CARD_H * 0.92, push: 0.3, vel: 0.08, slop: 0.5 };
  let cursor = null;
  let rafId = null;
  let reduced = false;

  function bounds() {
    const w = deskEl ? deskEl.clientWidth : window.innerWidth;
    const h = deskHeight || window.innerHeight;
    return {
      minX: CARD_W / 2 + 8,
      maxX: w - CARD_W / 2 - 8,
      minY: CARD_H / 2 + 70,           // below nav (content coords; first screen)
      maxY: h - CARD_H / 2 - 8,        // bottom of the scrollable content
    };
  }

  function frame() {
    const b = bounds();
    for (const card of cards) {
      if (card.dragging) continue; // position owned by the drag handler
      stepCard(card, params, cursor, b, 16);
    }
    // A dragged card participates as an immovable obstacle, shoving the rest.
    resolveCollisions(cards, COLLIDE);
    for (const card of cards) {
      if (!card.dragging) resolveEdges(card, b, params.restitution);
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

  window.addEventListener('pointermove', (e) => { cursor = toContent(e.clientX, e.clientY); });
  window.addEventListener('pointerout', (e) => { if (!e.relatedTarget) cursor = null; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  function init(projects, openCb) {
    onOpen = openCb;
    const desk = document.getElementById('desk');
    if (!desk) return;
    deskEl = desk;
    desk.innerHTML = '';
    // Spacer gives the scroll container its height (cards are absolute and don't).
    spacerEl = document.createElement('div');
    spacerEl.className = 'desk-spacer';
    spacerEl.setAttribute('aria-hidden', 'true');
    desk.appendChild(spacerEl);
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
    // Legend lives outside the scrolling desk so it stays pinned to the corner.
    const legend = buildLegend(projects);
    if (legend) (desk.parentNode || desk).appendChild(legend);
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
      // Grab offset in desk-content coords so dragging tracks the cursor after scroll.
      const p = toContent(e.clientX, e.clientY);
      card.grabDX = card.x - p.x;
      card.grabDY = card.y - p.y;
    });

    el.addEventListener('pointermove', (e) => {
      if (!card.dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      velX = (e.clientX - lastX) / dt * 16;
      velY = (e.clientY - lastY) / dt * 16;
      lastX = e.clientX; lastY = e.clientY; lastMoveT = now;
      const p = toContent(e.clientX, e.clientY);
      card.x = p.x + card.grabDX;
      card.y = p.y + card.grabDY;
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
        if (window.Confetti) window.Confetti.burst(card.x, card.y);
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
