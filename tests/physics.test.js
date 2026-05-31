const assert = require('assert');
const path = require('path');
const { stepCard, resolveEdges, computeLayout, resolveCollisions } = require(path.join('..', 'desk-physics.js'));

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

const COLL = { minDX: 100, minDY: 100, push: 0.5, vel: 0.1, slop: 0 };

// Collision: two overlapping free cards ease apart symmetrically (soft push).
(function testCollisionSeparates() {
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 10, y: 0, vx: 0, vy: 0 }; // heavy overlap on x, identical y
  resolveCollisions([a, b], COLL);
  assert.ok(b.x > 10 && a.x < 0, 'both should move apart, got a=' + a.x + ' b=' + b.x);
  // Soft: each moves only a fraction of the 90px overlap, and symmetrically.
  const moveA = Math.abs(a.x - 0), moveB = Math.abs(b.x - 10);
  assert.ok(Math.abs(moveA - moveB) < 1e-9, 'free cards move symmetrically');
  assert.ok(moveB < 90, 'soft push moves less than the full overlap, got ' + moveB);
  console.log('ok: collision eases overlapping cards apart');
})();

// Collision: a dragging card is immovable and shoves the free card (soft, partial).
(function testCollisionDraggedImmovable() {
  const dragged = { x: 0, y: 0, vx: 0, vy: 0, dragging: true };
  const free = { x: 10, y: 0, vx: 0, vy: 0 };
  resolveCollisions([dragged, free], COLL);
  assert.strictEqual(dragged.x, 0, 'dragged card must not move, got ' + dragged.x);
  // overlap = 90, push 0.5 → free moves 45px right (10 → 55), not the full 100.
  assert.ok(free.x > 10 && free.x < 100, 'free card shoved partway clear, got ' + free.x);
  assert.ok(free.vx > 0, 'free card gains rightward velocity, got ' + free.vx);
  console.log('ok: dragged card is immovable and shoves neighbor');
})();

// Collision: repeated frames converge the free card to just clear of the dragged one.
(function testCollisionConverges() {
  const dragged = { x: 0, y: 0, vx: 0, vy: 0, dragging: true };
  const free = { x: 10, y: 0, vx: 0, vy: 0 };
  for (let i = 0; i < 40; i++) { free.vx = 0; resolveCollisions([dragged, free], COLL); }
  assert.ok(free.x > 99 && free.x <= 100, 'free card converges to minDX clearance, got ' + free.x);
  console.log('ok: soft push converges to non-overlapping rest state');
})();

// Collision: cards already clear on an axis are untouched.
(function testCollisionNoOverlap() {
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 200, y: 0, vx: 0, vy: 0 };
  resolveCollisions([a, b], COLL);
  assert.strictEqual(a.x, 0, 'a untouched');
  assert.strictEqual(b.x, 200, 'b untouched');
  console.log('ok: separated cards are left alone');
})();

console.log('ALL PASS');
