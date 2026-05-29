(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  let canvas = null, ctx = null, parts = [], raf = null;
  const COLORS = ['#EAF7F1', '#FF7EA6', '#FFD56B', '#ECECEC'];

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function ensure() {
    if (canvas) return true;
    canvas = document.getElementById('confetti-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return true;
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vy += 0.25;            // gravity
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.99;
      p.rot += p.vrot;
      p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function burst(x, y) {
    if (!ensure()) return;
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 7;
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 4,
        size: 4 + Math.random() * 5,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.4,
        life: 50 + Math.random() * 25,
      });
    }
    if (raf == null) raf = requestAnimationFrame(tick);
  }

  window.Confetti = { burst };
})();
