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
      el.addEventListener('click', () => { if (onOpen) onOpen(project.id); });
      return card;
    });
    layoutCards();
    window.addEventListener('resize', layoutCards);
  }

  window.Desk = { init: init };
})();
