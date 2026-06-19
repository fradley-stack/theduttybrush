/* ==========================================================================
   home.js — cinematic landing logic, wired to Supabase
   ========================================================================== */
import {
  fetchProjects, fetchTestimonials, fetchReactions, bumpReaction,
  subscribe, submitRecipeRequest, submitCommission,
  optimize, el, toast, initNav, initReveal, $, $$,
} from './core.js';

const FALLBACK_IMG = 'assets/img/featured.jpg';

/* ---------------- hero marquee ---------------- */
function marqueeTrack(images, reverse) {
  const row = el('div', { class: `marquee${reverse ? ' rev' : ''}` });
  [...images, ...images].forEach((src) => row.append(el('img', { src: optimize(src, 500), alt: '', loading: 'lazy' })));
  return row;
}
function buildHero(projects) {
  const imgs = projects.map((p) => p.thumbnail).filter(Boolean);
  let pool = imgs.length ? [...imgs, FALLBACK_IMG] : [FALLBACK_IMG];
  while (pool.length < 6) pool = [...pool, ...pool];
  const bg = $('#cine-bg');
  bg.append(marqueeTrack(pool, false));
  bg.append(marqueeTrack([...pool].reverse(), true));
  const em = $('#embers');
  for (let i = 0; i < 14; i++) {
    em.append(el('span', { class: 'ember', style: `left:${(i * 67) % 100}%; animation-delay:${(i * 0.6).toFixed(1)}s; animation-duration:${6 + (i % 4)}s;` }));
  }
}

/* ---------------- vault + tutorials ---------------- */
function vaultCard(p) {
  const steps = Object.entries(p.paints || {}).slice(0, 4);
  const peek = el('div', { class: 'vc-peek' },
    steps.length
      ? steps.map(([stage, val]) => el('div', { class: 'step' }, [el('b', { text: `${stage}: ` }), document.createTextNode(val || '—')]))
      : [el('div', { class: 'step', text: 'Recipe coming soon' })]);
  return el('a', { class: 'card vault-card', href: `vault.html?p=${p.slug}` }, [
    el('div', { class: 'vc-media' }, [el('img', { src: optimize(p.thumbnail, 500), alt: p.title, loading: 'lazy' }), peek]),
    el('div', { class: 'vc-body' }, [
      el('h3', { text: p.title }),
      el('div', { class: 'meta', text: `${p.faction} · ${steps.length || 0} paint steps` }),
    ]),
  ]);
}
function tutCard(p, i) {
  const labels = ['Primer to base', 'Mid-tones & shading', 'Highlights & edges', 'Basing & varnish'];
  return el('a', { class: 'card tut', href: `gallery.html?p=${p.slug}` }, [
    el('div', { class: 't-media' }, [el('img', { src: optimize(p.thumbnail, 500), alt: p.title, loading: 'lazy' })]),
    el('div', { class: 't-body' }, [
      el('span', { class: 'eyebrow acc', text: `Step-by-step · ${labels[i % labels.length]}` }),
      el('h3', { style: 'font-size:1.05rem', text: `Painting ${p.title}` }),
    ]),
  ]);
}

/* ---------------- testimonials ---------------- */
function quoteCard(t) {
  const initial = (t.author || '?').trim().charAt(0).toUpperCase();
  return el('article', { class: 'card quote' }, [
    el('p', { text: `“${t.quote}”` }),
    el('div', { class: 'who' }, [
      el('div', { class: 'av', text: initial }),
      el('div', {}, [
        el('div', { class: 'n', text: t.author }),
        t.handle ? el('div', { class: 'h', text: t.handle }) : null,
      ]),
    ]),
  ]);
}

/* ---------------- reactions ---------------- */
async function buildReactions() {
  const wrap = $('#reacts');
  if (!wrap) return;
  const rows = await fetchReactions();
  if (!rows.length) { wrap.append(el('span', { class: 'eyebrow', text: 'Reactions warming up…' })); return; }
  const seen = JSON.parse(localStorage.getItem('dutty_reacts') || '{}');
  rows.forEach((r) => {
    const count = el('b', { text: String(r.count) });
    const btn = el('button', { class: `react${seen[r.kind] ? ' on' : ''}` }, [document.createTextNode(`${r.label} `), count]);
    btn.addEventListener('click', async () => {
      if (seen[r.kind]) { toast('Already reacted 🙂', ''); return; }
      const n = await bumpReaction(r.kind);
      if (n == null) { toast('Could not react', 'err'); return; }
      count.textContent = String(n);
      btn.classList.add('on');
      seen[r.kind] = true;
      localStorage.setItem('dutty_reacts', JSON.stringify(seen));
    });
    wrap.append(btn);
  });
}

/* ---------------- forms ---------------- */
function busy(btn, on, label) {
  btn.disabled = on;
  if (on) btn.replaceChildren(el('span', { class: 'spinner' }));
  else btn.textContent = label;
}

function wireForms() {
  // Recipe request
  const rf = $('#request-form');
  rf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txt = $('#rq-text').value.trim();
    if (!txt) return;
    const btn = rf.querySelector('button');
    busy(btn, true);
    try { await submitRecipeRequest(txt); rf.reset(); toast('Request logged — cheers!', 'ok'); }
    catch (err) { toast(err.message || 'Could not send', 'err'); }
    finally { busy(btn, false, 'Request'); }
  });

  // Newsletter
  const nf = $('#news-form');
  nf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#news-email').value.trim();
    if (!email) return;
    const btn = nf.querySelector('button');
    busy(btn, true);
    try { await subscribe(email); nf.reset(); toast("You're in the warband ⚔", 'ok'); }
    catch (err) { toast(err.message || 'Could not subscribe', 'err'); }
    finally { busy(btn, false, 'Enlist'); }
  });

  // Commission
  const cf = $('#commission-form');
  cf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('#c-website').value) return;  // honeypot
    const payload = {
      name: $('#c-name').value.trim(), email: $('#c-email').value.trim(),
      faction: $('#c-faction').value.trim() || null, model_count: $('#c-count').value.trim() || null,
      tier: $('#c-tier').value, brief: $('#c-brief').value.trim(),
    };
    if (!payload.name || !payload.email) { toast('Name and email are required', 'err'); return; }
    const btn = $('#c-submit');
    busy(btn, true);
    try { await submitCommission(payload); cf.reset(); toast('Brief sent — talk soon!', 'ok'); }
    catch (err) { toast(err.message || 'Could not send — please email instead', 'err'); }
    finally { busy(btn, false, 'Send the brief'); }
  });
}

/* ---------------- init ---------------- */
async function init() {
  initNav();
  wireForms();
  buildReactions();

  try {
    const projects = await fetchProjects();
    buildHero(projects);
    const vault = $('#vault-grid');
    if (vault) projects.slice(0, 6).forEach((p) => vault.append(vaultCard(p)));
    const tut = $('#tut-grid');
    if (tut) projects.slice(0, 4).forEach((p, i) => tut.append(tutCard(p, i)));
  } catch (err) {
    console.error(err);
    buildHero([]);
  }

  // Testimonials — show the section only if there are real ones
  const quotes = await fetchTestimonials();
  if (quotes.length) {
    const cont = $('#quotes');
    quotes.forEach((t) => cont.append(quoteCard(t)));
    $('#testimonials-section').hidden = false;
  }

  initReveal();
}

init();
