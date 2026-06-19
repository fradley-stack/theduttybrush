/* ==========================================================================
   core.js — shared utilities (ES module)
   Supabase data layer (with static data.json fallback), safe DOM building,
   toasts, nav + scroll reveal. No third-party dependencies beyond the
   locally-vendored supabase-js (window.supabase).
   ========================================================================== */
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_READY } from './config.js';

export const DATA_URL = 'data.json';

/** Canonical faction list — used by the gallery filters and the Forge editor. */
export const FACTIONS = [
  'Adeptus Astartes', 'Chaos Space Marines', 'Aeldari', 'Necrons', 'Orks',
  'Tyranids', "T'au Empire", 'Leagues of Votann', 'Astra Militarum',
  'Adepta Sororitas', 'Adeptus Custodes', 'Adeptus Mechanicus', 'Grey Knights',
  'Death Guard', 'World Eaters', 'Thousand Sons', 'Drukhari',
  'Genestealer Cults', 'Imperial Knights', 'Chaos Knights',
];

/* -------------------------------------------------------- Supabase client -- */
let _sb = null;
export function getSupabase() {
  if (_sb) return _sb;
  if (!SUPABASE_READY || !globalThis.supabase?.createClient) return null;
  _sb = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  return _sb;
}

/* ----------------------------------------------------------- DOM helpers -- */

/** Build a DOM node safely. children may be nodes or strings (auto text). */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;            // only ever called with trusted, code-authored markup
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Escape a string for safe interpolation into an attribute/text context. */
export function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** URL-safe, human-readable slug for deep links. */
export function slugify(str = '') {
  return String(str).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------ Data layer -- */

export function clampPct(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

/** Normalize a project record — tolerant of legacy/static field names. */
export function normalizeProject(p = {}) {
  return {
    id:        p.id ?? null,
    slug:      p.slug || slugify(p.title ?? p.name ?? 'untitled'),
    title:     p.title ?? p.name ?? 'Untitled',
    faction:   p.faction ?? 'Unaligned',
    progress:  clampPct(p.progress ?? p.percentage ?? 0),
    category:  p.category ?? p.type ?? 'Personal',
    thumbnail: p.thumbnail ?? p.cover_url ?? p.image ?? 'assets/img/avatar.jpg',
    notes:     p.notes ?? '',
    gallery:   Array.isArray(p.gallery) ? p.gallery.filter(Boolean) : [],
    paints:    (p.paints && typeof p.paints === 'object') ? p.paints : {},
  };
}

/** Flatten a Supabase row (with nested images/paints) into the UI shape. */
function mapRow(r) {
  const gallery = (r.tdb_project_images ?? [])
    .slice().sort((a, b) => a.sort - b.sort).map((i) => i.url);
  const paints = {};
  (r.tdb_project_paints ?? []).slice().sort((a, b) => a.sort - b.sort)
    .forEach((p) => { paints[p.stage] = p.paints; });
  return {
    id: r.id, slug: r.slug, title: r.title, faction: r.faction, category: r.category,
    progress: r.progress, notes: r.notes, thumbnail: r.cover_url, gallery, paints,
  };
}

const PROJECT_SELECT =
  'id,slug,title,faction,category,progress,notes,cover_url,is_published,sort,' +
  'tdb_project_images(url,alt,sort),tdb_project_paints(stage,paints,sort)';

/** Primary read path: Supabase. Falls back to the committed data.json snapshot. */
export async function fetchProjects({ includeUnpublished = false } = {}) {
  const sb = getSupabase();
  if (sb) {
    try {
      let q = sb.from('tdb_projects').select(PROJECT_SELECT).order('sort', { ascending: false });
      if (!includeUnpublished) q = q.eq('is_published', true);
      const { data, error } = await q;
      if (error) throw error;
      if (Array.isArray(data)) return data.map(mapRow).map(normalizeProject);
    } catch (e) {
      console.warn('Supabase read failed — using data.json fallback.', e);
    }
  }
  return fetchProjectsStatic();
}

/** Static snapshot fallback (also used for local preview before provisioning). */
export async function fetchProjectsStatic() {
  const res = await fetch(`${DATA_URL}?v=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
  });
  if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('data.json is not an array');
  return raw.map(normalizeProject);
}

/* ---- Community reads/writes (all RLS-guarded; anon may insert, admin reads) -- */

/** Published testimonials, newest-curated first. Returns [] on any failure. */
export async function fetchTestimonials() {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('tdb_testimonials')
      .select('quote,author,handle').eq('is_published', true).order('sort', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch { return []; }
}

/** Global reaction counters. Returns [] on failure. */
export async function fetchReactions() {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('tdb_reactions').select('kind,label,count').order('kind');
    if (error) throw error;
    return data ?? [];
  } catch { return []; }
}

/** Increment a reaction via the SECURITY DEFINER RPC; returns new count or null. */
export async function bumpReaction(kind) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('tdb_bump_reaction', { k: kind });
  return error ? null : data;
}

export async function subscribe(email) {
  const sb = getSupabase();
  if (!sb) throw new Error('Newsletter unavailable');
  const { error } = await sb.from('tdb_subscribers').insert({ email });
  if (error && error.code !== '23505') throw error;   // ignore "already subscribed"
}

export async function submitRecipeRequest(request, email = null) {
  const sb = getSupabase();
  if (!sb) throw new Error('Requests unavailable');
  const { error } = await sb.from('tdb_recipe_requests').insert({ request, email });
  if (error) throw error;
}

export async function submitCommission(payload) {
  const sb = getSupabase();
  if (!sb) throw new Error('Form unavailable');
  const { error } = await sb.from('tdb_commissions').insert(payload);
  if (error) throw error;
}

/** Cloudinary on-the-fly optimisation; passes other URLs (incl. Storage) through. */
export function optimize(url, width = 600) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com/')) return url;
  if (url.includes('/upload/f_') || url.includes('/upload/q_')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}

/* ---------------------------------------------------------------- Toast -- */
let toastTimer;
export function toast(message, type = '') {
  let node = $('#toast');
  if (!node) {
    node = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(node);
  }
  node.className = `toast ${type}`;
  node.textContent = message;
  requestAnimationFrame(() => node.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3600);
}

/* ----------------------------------------------------------------- Nav -- */
export function initNav() {
  const nav = $('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  const toggle = $('.nav-toggle');
  const links = $('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (e) => { if (e.target.closest('a')) links.classList.remove('open'); });
  }
  $$('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });
}

/* -------------------------------------------------------- Scroll reveal -- */
export function initReveal() {
  const items = $$('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) { items.forEach((i) => i.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  items.forEach((i) => io.observe(i));
}
