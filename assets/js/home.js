/* ==========================================================================
   home.js — Forge home, wired to Supabase
   ========================================================================== */
import {
  fetchProjects, fetchTestimonials, submitCommission, subscribe, submitRecipeRequest,
  optimize, el, toast, initNav, initReveal, $, $$,
} from './core.js';

const WORK_FALLBACK = Array.from({ length: 12 }, (_, i) => `assets/img/work/work-${String(i + 1).padStart(2, '0')}.jpg`);

/* ---- hero 2x2 grid ---- */
function buildHero(projects) {
  const grid = $('#hero-grid'); if (!grid) return;
  const imgs = (projects.map((p) => p.thumbnail).filter(Boolean).concat(WORK_FALLBACK)).slice(0, 4);
  imgs.forEach((src) => grid.append(
    el('a', { href: '#work' }, [el('img', { src: optimize(src, 600), alt: '', loading: 'eager' })]),
  ));
}

/* ---- work card (shared shape with gallery) ---- */
function workCard(p) {
  return el('a', { class: 'work-card', href: `gallery.html?p=${p.slug}` }, [
    el('div', { class: 'media' }, [
      el('img', { src: optimize(p.thumbnail, 600), alt: p.title, loading: 'lazy' }),
      el('div', { class: 'overlay' }, [el('span', { class: 'chip', text: p.faction })]),
    ]),
    el('div', { class: 'body' }, [el('h3', { text: p.title }), el('span', { class: 'pct', text: `${p.progress}%` })]),
    el('div', { class: 'progress' }, [el('span', { style: `width:${p.progress}%` })]),
  ]);
}

function vaultCard(p) {
  const steps = Object.entries(p.paints || {}).slice(0, 4);
  const peek = el('div', { class: 'vc-peek' }, steps.length
    ? steps.map(([s, v]) => el('div', { class: 'step' }, [el('b', { text: `${s}: ` }), document.createTextNode(v || '—')]))
    : [el('div', { class: 'step', text: 'Recipe coming soon' })]);
  return el('a', { class: 'vault-card', href: `vault.html?p=${p.slug}` }, [
    el('div', { class: 'vc-media' }, [el('img', { src: optimize(p.thumbnail, 500), alt: p.title, loading: 'lazy' }), peek]),
    el('div', { class: 'vc-body' }, [el('h3', { text: p.title }), el('div', { class: 'meta', text: `${p.faction} · ${steps.length} steps` })]),
  ]);
}

function quoteCard(t) {
  return el('article', { class: 'quote' }, [
    el('p', { text: `“${t.quote}”` }),
    el('div', { class: 'who' }, [
      el('div', { class: 'av', text: (t.author || '?').charAt(0).toUpperCase() }),
      el('div', {}, [el('div', { class: 'n', text: t.author }), t.handle ? el('div', { class: 'h', text: t.handle }) : null]),
    ]),
  ]);
}

/* ---- lightbox (for premium macro strip) ---- */
function openLightbox(src) { $('#lightbox-img').src = src; $('#lightbox').classList.add('open'); }
function closeLightbox() { $('#lightbox').classList.remove('open'); }

/* ---- estimator ---- */
function initEstimator() {
  if (!$('#est-range')) return;
  let tier = 10, mult = 1, count = 40;
  const fmt = (n) => '£' + Math.round(n).toLocaleString();
  const recalc = () => {
    $('#est-price').textContent = fmt(count * tier * mult);
    const perWeek = tier <= 10 ? 12 : tier <= 22 ? 7 : 3;
    const weeks = Math.max(2, Math.ceil((count * mult) / perWeek));
    $('#est-turn').textContent = `Rough turnaround ~${weeks} week${weeks === 1 ? '' : 's'}`;
  };
  const seg = (id, attr, set) => {
    const box = $(id);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', box).forEach((x) => x.classList.remove('on')); b.classList.add('on');
      set(parseFloat(b.dataset[attr])); recalc();
    });
  };
  seg('#est-tier', 'tier', (v) => { tier = v; });
  seg('#est-type', 'mult', (v) => { mult = v; });
  $('#est-range').addEventListener('input', (e) => { count = parseInt(e.target.value, 10); $('#est-count').textContent = count; recalc(); });
  recalc();
}

/* ---- forms ---- */
function busy(btn, on, label) { btn.disabled = on; if (on) btn.replaceChildren(el('span', { class: 'spinner' })); else btn.textContent = label; }

function wireForms() {
  const cf = $('#commission-form');
  cf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('#c-website').value) return;
    const payload = {
      name: $('#c-name').value.trim(), email: $('#c-email').value.trim(),
      faction: $('#c-faction').value.trim() || null, model_count: $('#c-count').value.trim() || null,
      tier: $('#c-tier').value, brief: $('#c-brief').value.trim(),
    };
    if (!payload.name || !payload.email) { toast('Name and email are required', 'err'); return; }
    const btn = $('#c-submit'); busy(btn, true);
    try { await submitCommission(payload); cf.reset(); toast('Brief sent — talk soon!', 'ok'); }
    catch (err) { toast(err.message || 'Could not send — email instead', 'err'); }
    finally { busy(btn, false, 'Send the brief'); }
  });

  const nf = $('#news-form');
  nf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#news-email').value.trim(); if (!email) return;
    const btn = nf.querySelector('button'); busy(btn, true);
    try { await subscribe(email); nf.reset(); toast("You're in the warband ⚔", 'ok'); }
    catch (err) { toast(err.message || 'Could not subscribe', 'err'); }
    finally { busy(btn, false, 'Enlist'); }
  });

  const rf = $('#request-form');
  rf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txt = $('#rq-text').value.trim(); if (!txt) return;
    const btn = rf.querySelector('button'); busy(btn, true);
    try { await submitRecipeRequest(txt); rf.reset(); toast('Request logged — cheers!', 'ok'); }
    catch (err) { toast(err.message || 'Could not send', 'err'); }
    finally { busy(btn, false, 'Request'); }
  });
}

async function init() {
  initNav();
  initEstimator();
  wireForms();
  $('#lightbox')?.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  try {
    const projects = await fetchProjects();
    buildHero(projects);

    const grid = $('#work-grid');
    if (grid) projects.slice(0, 8).forEach((p) => grid.append(workCard(p)));

    const vault = $('#vault-grid');
    if (vault) projects.slice(0, 6).forEach((p) => vault.append(vaultCard(p)));

    const macros = projects.flatMap((p) => [p.thumbnail, ...p.gallery]).filter(Boolean).slice(0, 3);
    const mr = $('#prem-macros');
    if (mr) (macros.length ? macros : ['assets/img/featured.jpg']).forEach((src) => {
      const img = el('img', { src: optimize(src, 400), alt: 'detail', loading: 'lazy' });
      img.addEventListener('click', () => openLightbox(src));
      mr.append(img);
    });

    const sc = $('#stat-count'); if (sc) sc.textContent = projects.length ? `${projects.length}+` : '—';
  } catch (err) {
    console.error(err);
    buildHero([]);
  }

  const quotes = await fetchTestimonials();
  if (quotes.length) { const c = $('#quotes'); quotes.forEach((t) => c.append(quoteCard(t))); $('#testimonials-section').hidden = false; }

  initReveal();
}

init();
