/* ==========================================================================
   gallery.js — workbench: grid, search, faction filter, project viewer
   ========================================================================== */
import { fetchProjects, optimize, slugify, el, $, $$, initNav, toast } from './core.js';
import { initAdmin } from './admin.js';

const state = { projects: [], filter: 'all', query: '' };
let admin = null;

/* -------------------------------------------------------------- Cards --- */
function card(p) {
  const node = el('article', {
    class: 'card work-card', role: 'button', tabindex: '0',
    'aria-label': `${p.title} — ${p.faction}`,
    dataset: { slug: p.slug },
  }, [
    el('div', { class: 'media' }, [
      el('img', { src: optimize(p.thumbnail, 600), alt: p.title, loading: 'lazy' }),
      el('div', { class: 'overlay' }, [el('span', { class: 'chip', text: p.faction })]),
    ]),
    el('div', { class: 'body' }, [
      el('div', { class: 'row' }, [
        el('h3', { text: p.title }),
        el('span', { class: 'pct', text: `${p.progress}%` }),
      ]),
      el('div', { class: 'progress' }, [el('span', { style: `width:${p.progress}%` })]),
    ]),
  ]);
  const open = () => openModal(p);
  node.addEventListener('click', open);
  node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  return node;
}

/* ------------------------------------------------------------- Render --- */
function render() {
  const grid = $('#work-grid');
  grid.replaceChildren();
  let list = state.projects;
  if (state.filter !== 'all') list = list.filter((p) => p.faction === state.filter);
  if (state.query) {
    const q = state.query.toLowerCase();
    list = list.filter((p) => p.title.toLowerCase().includes(q) || p.faction.toLowerCase().includes(q));
  }
  $('#empty').hidden = list.length > 0;
  list.forEach((p) => grid.append(card(p)));
}

function buildFilters() {
  const cont = $('#filters');
  cont.replaceChildren();
  const present = [...new Set(state.projects.map((p) => p.faction))].sort();
  const make = (label, value) => {
    const btn = el('button', {
      class: `filter-btn${value === state.filter ? ' active' : ''}`, text: label,
      onclick: () => {
        state.filter = value;
        $$('.filter-btn', cont).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      },
    });
    return btn;
  };
  cont.append(make('All Projects', 'all'));
  present.forEach((f) => cont.append(make(f, f)));
}

/* --------------------------------------------------------- Project view -- */
function openModal(p) {
  $('#v-title').textContent = p.title;
  $('#v-faction').textContent = p.faction;
  $('#v-progress').textContent = `${p.progress}%`;
  $('#v-notes').textContent = p.notes || 'No field notes yet.';

  const main = $('#v-main');
  main.src = optimize(p.thumbnail, 1000);
  main.alt = p.title;
  main.onclick = () => openLightbox(p.thumbnail);

  const gal = $('#v-gallery');
  gal.replaceChildren();
  p.gallery.forEach((src) => {
    const img = el('img', { src: optimize(src, 300), alt: `${p.title} detail`, loading: 'lazy' });
    img.addEventListener('click', () => openLightbox(src));
    gal.append(img);
  });

  const paints = $('#v-paints');
  paints.replaceChildren();
  const entries = Object.entries(p.paints || {});
  if (entries.length) {
    entries.forEach(([part, val]) => paints.append(
      el('div', { class: 'recipe-item' }, [
        el('label', { text: part }),
        el('div', { class: 'val', text: val }),
      ]),
    ));
  } else {
    paints.append(el('div', { class: 'val', style: 'color:var(--faint)', text: 'Recipe coming soon.' }));
  }

  const adminBox = $('#v-admin');
  if (admin && admin.isLoggedIn()) {
    adminBox.hidden = false;
    $('#v-edit').onclick = () => { closeModals(true); admin.openForge(p.slug); };
  } else {
    adminBox.hidden = true;
  }

  openModalEl('#project-modal');
  const url = `${location.pathname}?p=${p.slug}`;
  history.pushState({ p: p.slug }, '', url);
}

/* ------------------------------------------------------- Modal plumbing -- */
function openModalEl(sel) {
  const m = $(sel);
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  m.querySelector('.modal-close')?.focus();
}

function closeModals(keepUrl = false) {
  $$('.modal.open').forEach((m) => m.classList.remove('open'));
  document.body.style.overflow = '';
  if (!keepUrl && location.search) history.pushState({}, '', location.pathname);
}

function openLightbox(src) {
  const lb = $('#lightbox');
  $('#lightbox-img').src = src;
  lb.classList.add('open');
  lb.setAttribute('aria-hidden', 'false');
}
function closeLightbox() {
  const lb = $('#lightbox');
  lb.classList.remove('open');
  lb.setAttribute('aria-hidden', 'true');
}

/* ---------------------------------------------------------- Deep links -- */
function handleDeepLink() {
  const params = new URLSearchParams(location.search);
  const slug = params.get('p');
  const legacy = params.get('project');
  let target = null;
  if (slug) target = state.projects.find((p) => p.slug === slug);
  else if (legacy) target = state.projects.find((p) => p.title === decodeURIComponent(legacy));
  if (target) openModal(target);
}

/* --------------------------------------------------------------- Init --- */
async function loadProjects() {
  // Admins also see unpublished drafts; the public sees published only.
  state.projects = await fetchProjects({ includeUnpublished: Boolean(admin && admin.isLoggedIn()) });
  buildFilters();
  render();
}

async function load() {
  try {
    await loadProjects();
    handleDeepLink();
  } catch (err) {
    console.error(err);
    $('#work-grid').replaceChildren(el('p', { class: 'eyebrow', text: 'Could not load the catalogue.' }));
    toast('Failed to load projects', 'err');
  }
}

function init() {
  initNav();

  // Admin controller — shares state, reloads the grid after edits/auth changes.
  admin = initAdmin({
    getProjects: () => state.projects,
    reload: () => loadProjects(),
    refresh: () => { buildFilters(); render(); },
  });

  // Search
  $('#search').addEventListener('input', (e) => { state.query = e.target.value.trim(); render(); });

  // Close handlers (delegated)
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]') || e.target.classList.contains('modal')) closeModals();
  });
  $('#lightbox').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#lightbox').classList.contains('open')) closeLightbox();
    else if ($('.modal.open')) closeModals();
  });
  window.addEventListener('popstate', () => { closeModals(true); handleDeepLink(); });

  load();
}

init();
