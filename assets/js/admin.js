/* ==========================================================================
   admin.js — studio CMS on Supabase
   Email + password auth (Supabase Auth, JWT sessions), CRUD on the project
   model, Storage image uploads, and the commissions inbox. All writes are
   gated by Postgres row-level security — the browser never holds a key that
   can write to the repo or bypass RLS.
   ========================================================================== */
import { FACTIONS, el, $, $$, toast, clampPct, slugify, getSupabase } from './core.js';
import { STORAGE_BUCKET } from './config.js';

const ICON_UPLOAD =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';

export function initAdmin(ctx) {
  const sb = getSupabase();
  let session = null;
  let currentId = null;     // uuid of the project being edited (null = new)
  let currentSlug = null;

  const isLoggedIn = () => Boolean(session);
  const show = (sel) => { $(sel).classList.add('open'); document.body.style.overflow = 'hidden'; };
  const hide = (sel) => { $(sel).classList.remove('open'); };

  if (!sb) {
    // No Supabase configured — hide the editor entirely; site stays read-only.
    const btn = $('#admin-btn'); if (btn) btn.style.display = 'none';
    return { isLoggedIn: () => false, openForge: () => {} };
  }

  /* -------------------------------------------------------------- auth -- */
  async function refreshSession() {
    const { data } = await sb.auth.getSession();
    session = data.session;
    updateAuthUI();
  }
  function updateAuthUI() {
    const btn = $('#admin-btn');
    if (btn) btn.textContent = isLoggedIn() ? 'The Forge' : 'Studio Login';
  }

  async function onLogin(e) {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const submit = $('#login-submit');
    submit.disabled = true;
    submit.replaceChildren(el('span', { class: 'spinner' }));
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshSession();
      $('#login-password').value = '';
      hide('#login-modal');
      toast('Studio unlocked', 'ok');
      await ctx.reload();
      openForge();
    } catch (err) {
      toast(err.message || 'Login failed', 'err');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Unlock the Forge';
    }
  }

  async function logout() {
    await sb.auth.signOut();
    session = null;
    updateAuthUI();
    $$('.modal.open').forEach((m) => m.classList.remove('open'));
    document.body.style.overflow = '';
    toast('Logged out', '');
    await ctx.reload();
  }

  /* ------------------------------------------------------------ uploads -- */
  function pickFile() {
    return new Promise((resolve) => {
      const input = el('input', { type: 'file', accept: 'image/*' });
      input.style.display = 'none';
      document.body.append(input);
      input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
      input.click();
    });
  }
  async function uploadImage(file) {
    const folder = slugify($('#f-title').value) || 'misc';
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    const path = `${folder}/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  async function handleUpload(targetInput) {
    try {
      const file = await pickFile();
      if (!file) return;
      toast('Uploading…');
      targetInput.value = await uploadImage(file);
      toast('Image uploaded', 'ok');
    } catch (err) {
      toast(err.message || 'Upload failed', 'err');
    }
  }

  /* -------------------------------------------------------- dynamic rows -- */
  function galleryRow(value = '') {
    const input = el('input', { class: 'g-input', type: 'url', placeholder: 'https://… or upload →', value });
    const up = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Upload image', html: ICON_UPLOAD });
    up.addEventListener('click', () => handleUpload(input));
    const del = el('button', { type: 'button', class: 'del-btn', 'aria-label': 'Remove', text: '×' });
    del.addEventListener('click', () => del.closest('.dyn-row').remove());
    return el('div', { class: 'dyn-row' }, [input, up, del]);
  }
  function paintRow(part = '', val = '') {
    const del = el('button', { type: 'button', class: 'del-btn', 'aria-label': 'Remove', text: '×' });
    del.addEventListener('click', () => del.closest('.dyn-row').remove());
    return el('div', { class: 'dyn-row' }, [
      el('input', { class: 'p-part', placeholder: 'Stage', value: part, style: 'flex:0 0 34%' }),
      el('input', { class: 'p-val', placeholder: 'Paints used', value: val }),
      del,
    ]);
  }

  /* ------------------------------------------------------------- form -- */
  function populateFactions() {
    const sel = $('#f-faction');
    if (sel.options.length) return;
    FACTIONS.forEach((f) => sel.append(el('option', { value: f, text: f })));
  }
  function populateSelector() {
    const sel = $('#project-selector');
    sel.replaceChildren(el('option', { value: '', text: '+ New registry entry' }));
    ctx.getProjects().forEach((p) => sel.append(el('option', { value: p.slug, text: p.title })));
  }
  function resetForm() {
    $('#forge-form').reset();
    $('#f-published').checked = true;
    $('#gallery-fields').replaceChildren();
    $('#paint-fields').replaceChildren();
    $('#delete-btn').hidden = true;
    currentId = null; currentSlug = null;
  }
  function loadIntoForge(slug) {
    const p = ctx.getProjects().find((x) => x.slug === slug);
    if (!p) { resetForm(); return; }
    currentId = p.id; currentSlug = p.slug;
    $('#f-title').value = p.title;
    $('#f-progress').value = p.progress;
    $('#f-faction').value = FACTIONS.includes(p.faction) ? p.faction : FACTIONS[0];
    $('#f-category').value = p.category || 'Commission';
    $('#f-thumb').value = p.thumbnail || '';
    $('#f-notes').value = p.notes || '';
    $('#f-published').checked = p.is_published !== false;
    const gf = $('#gallery-fields'); gf.replaceChildren();
    p.gallery.forEach((url) => gf.append(galleryRow(url)));
    const pf = $('#paint-fields'); pf.replaceChildren();
    Object.entries(p.paints).forEach(([stage, val]) => pf.append(paintRow(stage, val)));
    $('#delete-btn').hidden = false;
  }

  function readForm() {
    const gallery = $$('#gallery-fields .g-input').map((i) => i.value.trim()).filter(Boolean);
    const paints = $$('#paint-fields .dyn-row').map((row) => ({
      stage: row.querySelector('.p-part').value.trim(),
      paints: row.querySelector('.p-val').value.trim(),
    })).filter((p) => p.stage);
    return {
      title: $('#f-title').value.trim(),
      faction: $('#f-faction').value,
      progress: clampPct($('#f-progress').value),
      category: $('#f-category').value,
      cover_url: $('#f-thumb').value.trim(),
      notes: $('#f-notes').value.trim(),
      is_published: $('#f-published').checked,
      gallery, paints,
    };
  }
  function validate(p) {
    if (!p.title) return 'Name is required';
    if (!p.cover_url) return 'Cover image is required';
    try { new URL(p.cover_url); } catch { return 'Cover image must be a valid URL'; }
    if (!FACTIONS.includes(p.faction)) return 'Pick a valid faction';
    return null;
  }

  /* ----------------------------------------------------- write children -- */
  async function replaceChildRows(projectId, gallery, paints) {
    await sb.from('project_images').delete().eq('project_id', projectId);
    await sb.from('project_paints').delete().eq('project_id', projectId);
    if (gallery.length) {
      const rows = gallery.map((url, sort) => ({ project_id: projectId, url, sort }));
      const { error } = await sb.from('project_images').insert(rows);
      if (error) throw error;
    }
    if (paints.length) {
      const rows = paints.map((p, sort) => ({ project_id: projectId, stage: p.stage, paints: p.paints, sort }));
      const { error } = await sb.from('project_paints').insert(rows);
      if (error) throw error;
    }
  }

  function setBusy(on) {
    const btn = $('#save-btn');
    btn.disabled = on;
    $('#delete-btn').disabled = on;
    btn.replaceChildren(on ? el('span', { class: 'spinner' }) : document.createTextNode('Save project'));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = readForm();
    const error = validate(form);
    if (error) { toast(error, 'err'); return; }
    setBusy(true);
    try {
      const core = {
        title: form.title, faction: form.faction, progress: form.progress,
        category: form.category, notes: form.notes, cover_url: form.cover_url,
        is_published: form.is_published,
      };
      let projectId = currentId;
      if (projectId) {
        const { error: e1 } = await sb.from('projects').update(core).eq('id', projectId);
        if (e1) throw e1;
      } else {
        let slug = slugify(form.title) || `project-${Date.now()}`;
        if (ctx.getProjects().some((p) => p.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
        const { data, error: e2 } = await sb.from('projects')
          .insert({ ...core, slug, sort: Math.floor(Date.now() / 1000) })
          .select('id,slug').single();
        if (e2) throw e2;
        projectId = data.id; currentId = data.id; currentSlug = data.slug;
      }
      await replaceChildRows(projectId, form.gallery, form.paints);
      await ctx.reload();
      populateSelector();
      $('#project-selector').value = currentSlug;
      $('#delete-btn').hidden = false;
      toast('Project saved', 'ok');
    } catch (err) {
      toast(err.message || 'Save failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!currentId) return;
    if (!confirm(`Delete “${$('#f-title').value}”? This removes it and its photos/recipe.`)) return;
    setBusy(true);
    try {
      const { error } = await sb.from('projects').delete().eq('id', currentId);
      if (error) throw error;
      await ctx.reload();
      resetForm();
      populateSelector();
      $('#project-selector').value = '';
      toast('Project deleted', 'ok');
    } catch (err) {
      toast(err.message || 'Delete failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  /* ====================================================== STUDIO DESK ===== */
  const STATUSES = ['new', 'quoted', 'in_progress', 'done', 'declined'];
  const RQ_STATUSES = ['new', 'planned', 'done', 'declined'];
  let editTestiId = null;

  const when = (ts) => new Date(ts).toLocaleString();
  const field = (label, node) => el('div', { class: 'field' }, [el('label', { text: label }), node]);
  const emptyMsg = (text) => el('div', { class: 'empty-state' }, [el('p', { text })]);

  function statusSelect(table, row, statuses) {
    const sel = el('select', { class: 'field', style: 'width:auto;' });
    statuses.forEach((s) => sel.append(el('option', { value: s, text: s.replace('_', ' '), selected: s === row.status })));
    sel.addEventListener('change', async () => {
      const { error } = await sb.from(table).update({ status: sel.value }).eq('id', row.id);
      toast(error ? error.message : `Marked ${sel.value.replace('_', ' ')}`, error ? 'err' : 'ok');
    });
    return sel;
  }
  function deleteButton(table, id, msg) {
    const del = el('button', { class: 'btn btn-ghost danger btn-sm', text: 'Delete' });
    del.addEventListener('click', async () => {
      if (!confirm(msg)) return;
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) return toast(error.message, 'err');
      del.closest('.card').remove();
      toast('Deleted', 'ok');
    });
    return del;
  }

  // -- Commissions --
  async function renderCommissions(c) {
    const { data, error } = await sb.from('commissions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    if (!data.length) { c.replaceChildren(emptyMsg('No commission requests yet.')); return; }
    c.replaceChildren(...data.map((x) => el('div', { class: 'card', style: 'padding:20px; margin-bottom:14px;' }, [
      el('div', { style: 'display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:baseline;' }, [
        el('strong', { text: x.name || '—' }), el('span', { class: 'eyebrow', text: when(x.created_at) }),
      ]),
      el('div', { style: 'margin:8px 0 12px; color:var(--mut); font-size:.85rem;' }, [
        el('a', { href: `mailto:${x.email}`, style: 'color:var(--acc)', text: x.email }),
        document.createTextNode(`  ·  ${x.faction || '—'}  ·  ${x.model_count || '—'}  ·  ${x.tier || '—'}`),
      ]),
      el('p', { class: 'spec-notes', text: x.brief || '(no brief)' }),
      el('div', { style: 'display:flex; gap:12px; align-items:center; margin-top:14px;' }, [
        el('label', { class: 'eyebrow', text: 'Status', style: 'margin:0;' }),
        statusSelect('commissions', x, STATUSES), deleteButton('commissions', x.id, 'Delete this request?'),
      ]),
    ])));
  }

  // -- Recipe requests --
  async function renderRequests(c) {
    const { data, error } = await sb.from('recipe_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    if (!data.length) { c.replaceChildren(emptyMsg('No recipe requests yet.')); return; }
    c.replaceChildren(...data.map((r) => el('div', { class: 'card', style: 'padding:18px; margin-bottom:12px;' }, [
      el('div', { style: 'display:flex; justify-content:space-between; gap:12px; align-items:baseline;' }, [
        el('strong', { text: r.request }), el('span', { class: 'eyebrow', text: when(r.created_at) }),
      ]),
      r.email ? el('div', { style: 'margin-top:6px;' }, [el('a', { href: `mailto:${r.email}`, style: 'color:var(--acc); font-size:.85rem;', text: r.email })]) : null,
      el('div', { style: 'display:flex; gap:12px; align-items:center; margin-top:12px;' }, [
        statusSelect('recipe_requests', r, RQ_STATUSES), deleteButton('recipe_requests', r.id, 'Delete this request?'),
      ]),
    ])));
  }

  // -- Subscribers --
  async function renderSubscribers(c) {
    const { data, error } = await sb.from('subscribers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    if (!data.length) { c.replaceChildren(emptyMsg('No subscribers yet.')); return; }
    const copy = el('button', { class: 'btn btn-ghost btn-sm', text: `Copy all ${data.length} emails` });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(data.map((s) => s.email).join(', ')); toast('Emails copied', 'ok'); }
      catch { toast('Copy failed', 'err'); }
    });
    c.replaceChildren(
      el('div', { style: 'margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; gap:12px;' }, [
        el('span', { class: 'eyebrow', text: `${data.length} subscriber${data.length === 1 ? '' : 's'}` }), copy,
      ]),
      ...data.map((s) => el('div', { class: 'card', style: 'padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:12px;' }, [
        el('div', {}, [el('a', { href: `mailto:${s.email}`, style: 'color:var(--tx)', text: s.email }), el('div', { class: 'eyebrow', style: 'margin-top:4px;', text: when(s.created_at) })]),
        deleteButton('subscribers', s.id, 'Remove this subscriber?'),
      ])),
    );
  }

  // -- Testimonials (CRUD; powers the public testimonials section) --
  async function renderTestimonials(c) {
    const { data, error } = await sb.from('testimonials').select('*').order('sort', { ascending: false });
    if (error) throw error;

    const fQuote = el('textarea', { rows: '2', placeholder: 'What they said…' });
    const fAuthor = el('input', { placeholder: 'Name' });
    const fHandle = el('input', { placeholder: '@handle (optional)' });
    const fSort = el('input', { type: 'number', value: '0' });
    const fPub = el('input', { type: 'checkbox' }); fPub.checked = true;
    const saveBtn = el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Add testimonial' });
    const reset = () => { editTestiId = null; fQuote.value = ''; fAuthor.value = ''; fHandle.value = ''; fSort.value = '0'; fPub.checked = true; saveBtn.textContent = 'Add testimonial'; };

    saveBtn.addEventListener('click', async () => {
      const payload = { quote: fQuote.value.trim(), author: fAuthor.value.trim(), handle: fHandle.value.trim() || null, sort: parseInt(fSort.value, 10) || 0, is_published: fPub.checked };
      if (!payload.quote || !payload.author) { toast('Quote and author required', 'err'); return; }
      const res = editTestiId
        ? await sb.from('testimonials').update(payload).eq('id', editTestiId)
        : await sb.from('testimonials').insert(payload);
      if (res.error) { toast(res.error.message, 'err'); return; }
      toast('Testimonial saved', 'ok'); reset(); renderTestimonials(c);
    });

    const form = el('div', { class: 'fieldset' }, [
      field('Quote', fQuote),
      el('div', { class: 'form-grid', style: 'margin-top:12px;' }, [field('Author', fAuthor), field('Handle', fHandle)]),
      el('div', { style: 'display:flex; gap:18px; align-items:flex-end; margin-top:12px; flex-wrap:wrap;' }, [
        field('Sort', fSort),
        el('label', { class: 'eyebrow', style: 'display:flex; gap:8px; align-items:center; margin:0 0 12px;' }, [fPub, document.createTextNode('Published')]),
        saveBtn,
      ]),
    ]);

    const rows = data.length ? data.map((t) => {
      const edit = el('button', { class: 'btn btn-ghost btn-sm', text: 'Edit' });
      edit.addEventListener('click', () => {
        editTestiId = t.id; fQuote.value = t.quote; fAuthor.value = t.author; fHandle.value = t.handle || '';
        fSort.value = t.sort; fPub.checked = t.is_published; saveBtn.textContent = 'Update testimonial';
        $('#dash-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return el('div', { class: 'card', style: 'padding:18px; margin-bottom:12px;' }, [
        el('p', { class: 'spec-notes', text: `“${t.quote}”` }),
        el('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:12px; flex-wrap:wrap;' }, [
          el('div', {}, [
            el('strong', { text: t.author }),
            t.handle ? el('span', { class: 'eyebrow', style: 'margin-left:8px;', text: t.handle }) : null,
            el('span', { class: 'eyebrow', style: 'margin-left:8px;', text: t.is_published ? '· published' : '· hidden' }),
          ]),
          el('div', { style: 'display:flex; gap:8px;' }, [edit, deleteButton('testimonials', t.id, 'Delete this testimonial?')]),
        ]),
      ]);
    }) : [emptyMsg('No testimonials yet — add your first above.')];

    c.replaceChildren(form, el('hr', { class: 'divider', style: 'margin:24px 0;' }), ...rows);
  }

  // -- Reactions --
  async function renderReactions(c) {
    const { data, error } = await sb.from('reactions').select('*').order('kind');
    if (error) throw error;
    const reset = el('button', { class: 'btn btn-ghost danger btn-sm', text: 'Reset all' });
    reset.addEventListener('click', async () => {
      if (!confirm('Reset all reaction counts to 0?')) return;
      const { error: e } = await sb.from('reactions').update({ count: 0 }).gte('count', 0);
      if (e) return toast(e.message, 'err');
      toast('Counts reset', 'ok'); renderReactions(c);
    });
    c.replaceChildren(
      el('div', { style: 'display:flex; justify-content:flex-end; margin-bottom:14px;' }, [reset]),
      ...data.map((r) => el('div', { class: 'card', style: 'padding:16px 18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;' }, [
        el('span', { text: r.label }),
        el('strong', { class: 'accent', style: 'font-family:var(--disp); font-style:italic; font-size:1.5rem;', text: String(r.count) }),
      ])),
    );
  }

  const TABS = [
    ['commissions', 'Commissions', renderCommissions],
    ['requests', 'Requests', renderRequests],
    ['subscribers', 'Subscribers', renderSubscribers],
    ['testimonials', 'Testimonials', renderTestimonials],
    ['reactions', 'Reactions', renderReactions],
  ];
  let activeTab = 'commissions';

  function buildTabs() {
    const bar = $('#dash-tabs');
    bar.replaceChildren(...TABS.map(([key, label]) => {
      const b = el('button', { class: `filter-btn${key === activeTab ? ' active' : ''}`, text: label });
      b.addEventListener('click', () => selectTab(key));
      return b;
    }));
  }
  async function selectTab(key) {
    activeTab = key;
    if (key === 'testimonials') editTestiId = null;
    buildTabs();
    const c = $('#dash-content');
    c.replaceChildren(el('p', { class: 'eyebrow', text: 'Loading…' }));
    const tab = TABS.find((t) => t[0] === key);
    try { await tab[2](c); } catch (e) { c.replaceChildren(el('p', { class: 'eyebrow', text: e.message || 'Error' })); }
  }
  function openDesk() { show('#inbox-modal'); selectTab(activeTab); }

  /* ------------------------------------------------------------- wire -- */
  function openForge(slug) {
    populateFactions();
    populateSelector();
    if (slug) { loadIntoForge(slug); $('#project-selector').value = slug; }
    else resetForm();
    show('#forge-modal');
  }
  function handleAdminClick() {
    if (isLoggedIn()) openForge();
    else show('#login-modal');
  }

  $('#admin-btn')?.addEventListener('click', handleAdminClick);
  $('#login-form')?.addEventListener('submit', onLogin);
  $('#logout-btn')?.addEventListener('click', logout);
  $('#inbox-btn')?.addEventListener('click', openDesk);
  $('#forge-form')?.addEventListener('submit', onSubmit);
  $('#delete-btn')?.addEventListener('click', onDelete);
  $('#add-gallery')?.addEventListener('click', () => $('#gallery-fields').append(galleryRow()));
  $('#add-paint')?.addEventListener('click', () => $('#paint-fields').append(paintRow()));
  $('#upload-cover')?.addEventListener('click', () => handleUpload($('#f-thumb')));
  $('#project-selector')?.addEventListener('change', (e) => loadIntoForge(e.target.value));
  sb.auth.onAuthStateChange((_evt, s) => { session = s; updateAuthUI(); });
  refreshSession();

  return { isLoggedIn, openForge };
}
