/* ==========================================================================
   vault.js — the free recipe library
   ========================================================================== */
import { fetchProjects, optimize, el, $, $$, initNav, initReveal, toast } from './core.js';

const state = { projects: [], filter: 'all', query: '' };

function recipeCard(p) {
  const steps = Object.entries(p.paints || {});
  const peek = el('div', { class: 'vc-peek' },
    steps.slice(0, 4).length
      ? steps.slice(0, 4).map(([s, v]) => el('div', { class: 'step' }, [el('b', { text: `${s}: ` }), document.createTextNode(v || '—')]))
      : [el('div', { class: 'step', text: 'Recipe coming soon' })]);
  const node = el('article', {
    class: 'card vault-card', role: 'button', tabindex: '0',
    'aria-label': `${p.title} recipe`, dataset: { slug: p.slug },
  }, [
    el('div', { class: 'vc-media' }, [el('img', { src: optimize(p.thumbnail, 500), alt: p.title, loading: 'lazy' }), peek]),
    el('div', { class: 'vc-body' }, [
      el('h3', { text: p.title }),
      el('div', { class: 'meta', text: `${p.faction} · ${steps.length} paint step${steps.length === 1 ? '' : 's'}` }),
    ]),
  ]);
  const open = () => openRecipe(p);
  node.addEventListener('click', open);
  node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  return node;
}

function render() {
  const grid = $('#vault-grid');
  grid.replaceChildren();
  let list = state.projects;
  if (state.filter !== 'all') list = list.filter((p) => p.faction === state.filter);
  if (state.query) {
    const q = state.query.toLowerCase();
    list = list.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.faction.toLowerCase().includes(q) ||
      Object.entries(p.paints || {}).some(([s, v]) => `${s} ${v}`.toLowerCase().includes(q)));
  }
  $('#empty').hidden = list.length > 0;
  list.forEach((p) => grid.append(recipeCard(p)));
}

function buildFilters() {
  const cont = $('#filters');
  cont.replaceChildren();
  const present = [...new Set(state.projects.map((p) => p.faction))].sort();
  const make = (label, value) => {
    const btn = el('button', {
      class: `filter-btn${value === state.filter ? ' active' : ''}`, text: label,
      onclick: () => { state.filter = value; $$('.filter-btn', cont).forEach((b) => b.classList.remove('active')); btn.classList.add('active'); render(); },
    });
    return btn;
  };
  cont.append(make('All Recipes', 'all'));
  present.forEach((f) => cont.append(make(f, f)));
}

function openLightbox(src) { $('#lightbox-img').src = src; $('#lightbox').classList.add('open'); }
function closeLightbox() { $('#lightbox').classList.remove('open'); }

function openRecipe(p) {
  $('#r-title').textContent = p.title;
  $('#r-faction').textContent = p.faction;
  $('#r-progress').textContent = `${p.progress}%`;
  const main = $('#r-main');
  main.src = optimize(p.thumbnail, 1000); main.alt = p.title;
  main.onclick = () => openLightbox(p.thumbnail);

  const gal = $('#r-gallery'); gal.replaceChildren();
  p.gallery.forEach((src) => {
    const img = el('img', { src: optimize(src, 300), alt: `${p.title} detail`, loading: 'lazy' });
    img.addEventListener('click', () => openLightbox(src));
    gal.append(img);
  });

  const paints = $('#r-paints'); paints.replaceChildren();
  const entries = Object.entries(p.paints || {});
  if (entries.length) {
    entries.forEach(([stage, val]) => paints.append(el('div', { class: 'recipe-item' }, [
      el('label', { text: stage }), el('div', { class: 'val', text: val }),
    ])));
  } else {
    paints.append(el('div', { class: 'val', style: 'color:var(--faint)', text: 'Recipe coming soon.' }));
  }

  const notesWrap = $('#r-notes-wrap');
  if (p.notes) { $('#r-notes').textContent = p.notes; notesWrap.hidden = false; } else { notesWrap.hidden = true; }
  $('#r-cta').href = `index.html#commission`;

  const m = $('#recipe-modal');
  m.classList.add('open'); document.body.style.overflow = 'hidden';
  m.querySelector('.modal-close')?.focus();
  history.pushState({ p: p.slug }, '', `${location.pathname}?p=${p.slug}`);
}

function closeModal() {
  $$('.modal.open').forEach((m) => m.classList.remove('open'));
  document.body.style.overflow = '';
  if (location.search) history.pushState({}, '', location.pathname);
}

function handleDeepLink() {
  const slug = new URLSearchParams(location.search).get('p');
  if (!slug) return;
  const t = state.projects.find((p) => p.slug === slug);
  if (t) openRecipe(t);
}

async function init() {
  initNav();
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]') || e.target.classList.contains('modal')) closeModal();
  });
  $('#lightbox').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#lightbox').classList.contains('open')) closeLightbox(); else closeModal();
  });
  window.addEventListener('popstate', () => { closeModal(); handleDeepLink(); });
  $('#search').addEventListener('input', (e) => { state.query = e.target.value.trim(); render(); });

  try {
    state.projects = await fetchProjects();
    buildFilters();
    render();
    handleDeepLink();
  } catch (err) {
    console.error(err);
    $('#vault-grid').replaceChildren(el('p', { class: 'eyebrow', text: 'Could not load the Vault.' }));
    toast('Failed to load recipes', 'err');
  }
  initReveal();
}

init();
