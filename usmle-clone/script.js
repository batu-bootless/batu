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
