/* ===========================
   NIGHT — main.js
   =========================== */

// ---- Sticky nav
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 10);
});

// ---- Mobile menu
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');
hamburger.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  if (mobileNav.classList.contains('open')) {
    spans[0].style.transform = 'translateY(6.5px) rotate(45deg)';
    spans[1].style.opacity  = '0';
    spans[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
  } else {
    spans[0].style.transform = '';
    spans[1].style.opacity   = '';
    spans[2].style.transform = '';
  }
});

// ---- Pricing toggle
const toggleBtns = document.querySelectorAll('.toggle-btn');
const monthlyPrices = { free: '$0', starter: '$3.99', pro: '$9.99', enterprise: '$24.99' };
const yearlyPrices  = { free: '$0', starter: '$2.99', pro: '$7.99', enterprise: '$19.99' };

toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    toggleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isYearly = btn.dataset.period === 'yearly';
    const prices = isYearly ? yearlyPrices : monthlyPrices;
    document.getElementById('price-free').textContent      = prices.free;
    document.getElementById('price-starter').textContent   = prices.starter;
    document.getElementById('price-pro').textContent       = prices.pro;
    document.getElementById('price-enterprise').textContent= prices.enterprise;
    document.querySelectorAll('.plan-period').forEach(el => {
      el.textContent = isYearly ? '/ month, billed yearly' : '/ month';
    });
  });
});

// ---- FAQ accordion
document.querySelectorAll('.faq-q').forEach(q => {
  q.addEventListener('click', () => {
    const item = q.parentElement;
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});

// ---- Terminal typewriter
const lines = [
  { prefix: '$ ', text: 'git push night main', color: 'white' },
  { prefix: '',   text: 'Deploying community-bot...', color: 'dim' },
  { prefix: '',   text: '✓ Build complete  (2.1s)', color: 'green' },
  { prefix: '',   text: '✓ Container started', color: 'green' },
  { prefix: '',   text: 'Logged in as NightBot#0001', color: 'blue' },
  { prefix: '',   text: 'Serving 1,204 guilds', color: 'blue' },
];
const terminal = document.getElementById('terminal-output');
if (terminal) {
  let lineIdx = 0, charIdx = 0;
  function type() {
    if (lineIdx >= lines.length) {
      setTimeout(() => {
        terminal.innerHTML = '';
        lineIdx = 0; charIdx = 0;
        type();
      }, 3200);
      return;
    }
    const line = lines[lineIdx];
    const full = line.prefix + line.text;
    if (charIdx === 0) {
      const el = document.createElement('div');
      el.className = `t-${line.color}`;
      el.id = 'current-line';
      terminal.appendChild(el);
    }
    const el = document.getElementById('current-line');
    el.textContent = full.slice(0, charIdx + 1) + (charIdx < full.length - 1 ? '▌' : '');
    charIdx++;
    if (charIdx >= full.length) {
      el.id = '';
      el.textContent = full;
      lineIdx++; charIdx = 0;
      setTimeout(type, lineIdx < lines.length ? 320 : 0);
    } else {
      setTimeout(type, charIdx < line.prefix.length ? 60 : 38);
    }
  }
  setTimeout(type, 800);
}

// ---- Scroll-reveal (simple IntersectionObserver)
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  });
}, { threshold: 0.1 });
revealEls.forEach(el => io.observe(el));
