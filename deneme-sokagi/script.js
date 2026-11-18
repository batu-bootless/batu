// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.main-nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});

// Carousels: arrows, dots, autoplay (paused on hover)
document.querySelectorAll('[data-carousel]').forEach((root) => {
  const slides = [...root.querySelectorAll('.slide')];
  const dotsWrap = root.querySelector('.dots');
  let i = 0;
  let timer;

  const dots = slides.map((_, n) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', `Go to slide ${n + 1}`);
    b.addEventListener('click', () => go(n));
    dotsWrap.appendChild(b);
    return b;
  });

  function go(n) {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  }
  const start = () => { stop(); timer = setInterval(() => go(i + 1), 5000); };
  const stop = () => clearInterval(timer);

  root.querySelector('.prev').addEventListener('click', () => go(i - 1));
  root.querySelector('.next').addEventListener('click', () => go(i + 1));
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);

  go(0);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) start();
});

// Fit an element onto a 4-corner quad (TL, TR, BR, BL) with a CSS matrix3d homography.
// Any element with data-quad="x,y x,y x,y x,y" is fitted onto that quad.
function fitQuad(el) {
  const pts = el.dataset.quad.trim().split(/\s+/).map((p) => p.split(',').map(Number));
  const w = el.offsetWidth, h = el.offsetHeight;
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  // Solve the 8 unknowns of the projective transform via Gaussian elimination.
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = pts[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let m = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
    [A[c], A[m]] = [A[m], A[c]]; [B[c], B[m]] = [B[m], B[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      B[r] -= f * B[c];
    }
  }
  const [a, b, c, d, e, f, g, hh] = B.map((v, i) => v / A[i][i]);
  el.style.transform = `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
document.querySelectorAll('[data-quad]').forEach(fitQuad);
