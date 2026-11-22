'use strict';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* Header: shadow on scroll + mobile menu */
const header = $('#header'), burger = $('#burger'), menu = $('#menu');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 10);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

const toggleMenu = (open) => {
  menu.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
};
burger.addEventListener('click', () => toggleMenu(!menu.classList.contains('open')));
$$('a', menu).forEach(a => a.addEventListener('click', () => toggleMenu(false)));
addEventListener('keydown', e => e.key === 'Escape' && toggleMenu(false));

/* Active link on scroll */
const links = $$('.menu a:not(.btn)');
const spy = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) links.forEach(l => l.classList.toggle('active', l.hash === '#' + en.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach(s => spy.observe(s));

/* Reveal animations + counters */
const animateCount = el => {
  const target = +el.dataset.count, start = performance.now(), dur = 1400;
  const step = t => {
    const p = Math.min((t - start) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const reveal = new IntersectionObserver((entries, obs) => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('visible');
    $$('[data-count]', en.target).forEach(animateCount);
    obs.unobserve(en.target);
  });
}, { threshold: .15 });
$$('.reveal').forEach(el => reveal.observe(el));

/* Contact form validation (front-end only: no backend) */
const form = $('#contactForm'), status = $('#formStatus');
const rules = {
  name: v => v.trim().length >= 3 || 'Veuillez saisir votre nom complet (3 caractères minimum).',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'Veuillez saisir une adresse email valide.',
  subject: v => v.trim().length >= 3 || 'Veuillez indiquer un sujet.',
  message: v => v.trim().length >= 10 || 'Votre message doit contenir au moins 10 caractères.'
};
const validate = input => {
  const res = rules[input.name](input.value), field = input.closest('.field');
  const ok = res === true;
  field.classList.toggle('invalid', !ok);
  input.setAttribute('aria-invalid', !ok);
  $('.error', field).textContent = ok ? '' : res;
  return ok;
};
const inputs = $$('input, textarea', form);
inputs.forEach(i => {
  i.addEventListener('blur', () => validate(i));
  i.addEventListener('input', () => i.closest('.field').classList.contains('invalid') && validate(i));
});
/* Si le front tourne sur Live Server (port 5500), l'API est sur le port 3000 */
const API_URL = location.port === '5500' ? 'http://localhost:3000/api/contact' : '/api/contact';
const submitBtn = $('button[type="submit"]', form);

form.addEventListener('submit', async e => {
  e.preventDefault();
  const valid = inputs.map(validate).every(Boolean);
  if (!valid) { status.textContent = ''; inputs.find(i => i.getAttribute('aria-invalid') === 'true')?.focus(); return; }

  submitBtn.disabled = true;
  status.textContent = 'Envoi en cours…';
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const data = await res.json();
    status.textContent = data.message || (res.ok ? 'Message envoyé.' : 'Erreur.');
    if (res.ok) form.reset();
  } catch {
    status.textContent = "Impossible de joindre le serveur. Vérifiez qu'il est démarré (npm start).";
  } finally {
    submitBtn.disabled = false;
  }
});

$('#year').textContent = new Date().getFullYear();
