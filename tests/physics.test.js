const assert = require('assert');
const path = require('path');
const { stepCard, resolveEdges, computeLayout } = require(path.join('..', 'desk-physics.js'));

const PARAMS = {
  stiffness: 0.012, damping: 0.86, bobSpeed: 0, bobAmp: 0,
  repelRadius: 0, repelStrength: 0, restitution: 0.6,
  tiltFactor: 0, rotStiffness: 0.08,
};
const BIG = { minX: -1e4, maxX: 1e4, minY: -1e4, maxY: 1e4 };

// Edge bounce: a card past the left edge clamps and reverses vx.
(function testEdgeBounce() {
  const card = { x: -10, y: 50, vx: -5, vy: 0, rot: 0, vrot: 0, baseRot: 0, homeX: 0, homeY: 50, phase: 0, t: 0 };
  resolveEdges(card, { minX: 0, maxX: 100, minY: 0, maxY: 100 }, 0.6);
  assert.strictEqual(card.x, 0, 'clamps x to minX');
  assert.ok(card.vx > 0, 'vx should reverse to positive, got ' + card.vx);
  console.log('ok: edge bounce reverses velocity');
})();

// Spring convergence: a displaced card settles near its home with no other forces.
(function testSpringConverges() {
  const card = { x: 400, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, baseRot: 0, homeX: 0, homeY: 0, phase: 0, t: 0 };
  for (let i = 0; i < 4000; i++) stepCard(card, PARAMS, null, BIG, 16);
  assert.ok(Math.abs(card.x) < 1, 'card should settle near home x, got ' + card.x);
  assert.ok(Math.abs(card.vx) < 0.1, 'velocity should decay, got ' + card.vx);
  console.log('ok: spring converges to home');
})();

// Layout: returns one finite position per card.
(function testLayout() {
  const pos = computeLayout(5, 1280, 800, 240, 170);
  assert.strictEqual(pos.length, 5, 'one position per card');
  pos.forEach((p, i) => {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'finite coords at ' + i);
  });
  console.log('ok: layout produces finite positions');
})();

console.log('ALL PASS');
