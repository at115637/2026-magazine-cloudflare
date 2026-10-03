// src/admin.js — login, dashboard, block editor

const TOKEN_KEY = 'mag_token';

// ─── Auth helpers ───────────────────────────────────────
const getToken = () => localStorage.getItem(TOKEN_KEY);
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });
function isLoggedIn() {
  const t = getToken();
  if (!t) return false;
  try { return Date.now() < JSON.parse(atob(t.split('.')[0])).exp; }
  catch { return false; }
}

// ─── Views ──────────────────────────────────────────────
const loginView  = document.getElementById('login-view');
const dashView   = document.getElementById('dash-view');
const editorView = document.getElementById('editor-view');

function show(view) {
  loginView.hidden  = view !== 'login';
  dashView.hidden   = view !== 'dash';
  editorView.hidden = view !== 'editor';
}

// ─── Login ──────────────────────────────────────────────
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const pw = document.getElementById('pw').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  try {
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    if (!res.ok) throw new Error('wrong password');
    const { token } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    openDash();
  } catch (e) { err.textContent = e.message; }
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  show('login');
});

// ─── Dashboard ──────────────────────────────────────────
async function openDash() {
  show('dash');
  const listEl = document.getElementById('admin-list');
  listEl.innerHTML = '<div class="loading">…</div>';
  try {
    const res = await fetch('/api/article');
    const { articles } = await res.json();
    if (!articles || !articles.length) {
      listEl.innerHTML = '<div class="loading">no contributions yet</div>';
      return;
    }
    listEl.innerHTML = articles.map(a => `
      <div class="admin-item" data-id="${a.id}">
        <div class="admin-item-main" data-edit="${a.id}">
          <span class="admin-item-title ${a.published === 0 ? 'draft' : ''}">${esc(a.title)}</span>
          <span class="admin-item-meta">${esc(a.date)} · ${esc(a.author)}</span>
        </div>
        <div class="admin-item-actions">
          <button data-edit="${a.id}">edit</button>
          <button data-del="${a.id}" class="ghost">delete</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-edit]').forEach(el =>
      el.addEventListener('click', () => openEditor(el.dataset.edit)));
    listEl.querySelectorAll('[data-del]').forEach(el =>
      el.addEventListener('click', () => delArticle(el.dataset.del)));
  } catch (e) {
    listEl.innerHTML = '<div class="loading">could not load</div>';
  }
}

async function delArticle(id) {
  if (!confirm('Delete this contribution permanently?')) return;
  await fetch(`/api/delete/${id}`, { method: 'DELETE', headers: authHeaders() });
  openDash();
}

document.getElementById('new-btn').addEventListener('click', () => openEditor(null));
document.getElementById('back-btn').addEventListener('click', openDash);

// ─── Editor state ───────────────────────────────────────
let current = null;   // { id, cover_r2_key } | null

async function openEditor(id) {
  show('editor');
  resetEditor();
  current = { id: id || null, cover_r2_key: '-' };

  if (id) {
    const res = await fetch(`/api/article?id=${encodeURIComponent(id)}`);
    const { article, blocks } = await res.json();
    document.getElementById('e-title').value  = article.title === '-' ? '' : article.title;
    document.getElementById('e-author').value = article.author === '-' ? '' : article.author;
    document.getElementById('e-date').value   = /^\d{4}-\d{2}-\d{2}/.test(article.date) ? article.date.slice(0,10) : '';
    document.getElementById('e-cover-credit').value = article.cover_credit === '-' ? '' : article.cover_credit;
    document.getElementById('published').checked = article.published !== 0;
    current.cover_r2_key = article.cover_r2_key || '-';
    if (current.cover_r2_key !== '-') {
      const img = document.getElementById('cover-preview');
      img.src = `/img/${current.cover_r2_key}`;
      document.getElementById('cover-drop').classList.add('has-image');
    }
    for (const b of blocks) addBlock(b.kind, b);
  } else {
    // sensible default date = today
    document.getElementById('e-date').value = new Date().toISOString().slice(0,10);
  }
}

function resetEditor() {
  document.getElementById('e-title').value = '';
  document.getElementById('e-author').value = '';
  document.getElementById('e-date').value = '';
  document.getElementById('e-cover-credit').value = '';
  document.getElementById('published').checked = true;
  document.getElementById('cover-preview').src = '';
  document.getElementById('cover-drop').classList.remove('has-image');
  document.getElementById('blocks').innerHTML = '';
  document.getElementById('editor-error').textContent = '';
}

// ─── Cover upload ───────────────────────────────────────
const coverDrop = document.getElementById('cover-drop');
const coverFile = document.getElementById('cover-file');
coverDrop.addEventListener('click', () => coverFile.click());
coverFile.addEventListener('change', async () => {
  const f = coverFile.files[0]; if (!f) return;
  const hint = document.getElementById('cover-hint');
  hint.textContent = 'uploading…';
  try {
    const key = await uploadImage(f);
    current.cover_r2_key = key;
    const img = document.getElementById('cover-preview');
    img.src = `/img/${key}`;
    coverDrop.classList.add('has-image');
  } catch (e) {
    hint.textContent = 'upload failed — try again';
  }
});

// ─── Blocks ─────────────────────────────────────────────
document.querySelectorAll('.add-block').forEach(btn =>
  btn.addEventListener('click', () => addBlock(btn.dataset.kind)));

function addBlock(kind, data = {}) {
  const wrap = document.getElementById('blocks');
  const el = document.createElement('div');
  el.className = 'block';
  el.dataset.kind = kind;
  el.dataset.r2 = data.r2_key && data.r2_key !== '-' ? data.r2_key : '';

  let inner = `
    <div class="block-head">
      <span class="block-kind">${kind}</span>
      <div class="block-ctrls">
        <button data-up title="move up">↑</button>
        <button data-down title="move down">↓</button>
        <button data-remove title="remove">×</button>
      </div>
    </div>`;

  if (kind === 'text') {
    inner += `<textarea placeholder="text…">${data.content ? esc(data.content) : ''}</textarea>
      <div class="md-hint">**bold** · *italic* · &lt;u&gt;underline&lt;/u&gt; · &lt;br&gt; for a line break</div>`;
  } else if (kind === 'image') {
    const hasImg = data.r2_key && data.r2_key !== '-';
    inner += `
      <div class="img-drop ${hasImg ? 'has-image' : ''}">
        <img ${hasImg ? `src="/img/${data.r2_key}"` : ''} alt="">
        <span class="img-hint">click to upload image</span>
        <input type="file" accept="image/*" hidden>
      </div>
      <input class="caption" type="text" placeholder="caption / credit (optional)"
             value="${data.caption && data.caption !== '-' ? esc(data.caption) : ''}">`;
  } else if (kind === 'embed') {
    inner += `<textarea placeholder="paste embed HTML (e.g. SoundCloud / Vimeo iframe)…">${data.content ? esc(data.content) : ''}</textarea>
      <div class="md-hint">Paste an &lt;iframe&gt; embed code. It will render as-is on the page.</div>`;
  }

  el.innerHTML = inner;
  wrap.appendChild(el);

  // controls
  el.querySelector('[data-remove]').addEventListener('click', () => el.remove());
  el.querySelector('[data-up]').addEventListener('click', () => {
    if (el.previousElementSibling) wrap.insertBefore(el, el.previousElementSibling);
  });
  el.querySelector('[data-down]').addEventListener('click', () => {
    if (el.nextElementSibling) wrap.insertBefore(el.nextElementSibling, el);
  });

  // image upload within block
  if (kind === 'image') {
    const drop = el.querySelector('.img-drop');
    const file = el.querySelector('input[type=file]');
    const hint = el.querySelector('.img-hint');
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      hint.textContent = 'uploading…';
      try {
        const key = await uploadImage(f);
        el.dataset.r2 = key;
        const img = el.querySelector('img');
        img.src = `/img/${key}`;
        drop.classList.add('has-image');
      } catch { hint.textContent = 'upload failed — try again'; }
    });
  }
}

// ─── Save ───────────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', save);

async function save() {
  const err = document.getElementById('editor-error');
  err.textContent = '';

  const blocks = [...document.querySelectorAll('#blocks .block')].map(el => {
    const kind = el.dataset.kind;
    if (kind === 'text' || kind === 'embed') {
      return { kind, content: el.querySelector('textarea').value };
    }
    if (kind === 'image') {
      return { kind, r2_key: el.dataset.r2 || '-', caption: el.querySelector('.caption').value };
    }
    return null;
  }).filter(Boolean);

  const payload = {
    id: current.id || undefined,
    title:  document.getElementById('e-title').value,
    author: document.getElementById('e-author').value,
    date:   document.getElementById('e-date').value,
    cover_r2_key: current.cover_r2_key || '-',
    cover_credit: document.getElementById('e-cover-credit').value,
    published: document.getElementById('published').checked ? 1 : 0,
    blocks
  };

  const btn = document.getElementById('save-btn');
  btn.textContent = 'saving…'; btn.disabled = true;
  try {
    const res = await fetch('/api/article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('save failed');
    openDash();
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.textContent = 'save'; btn.disabled = false;
  }
}

// ─── Image → WebP → /api/upload ─────────────────────────
async function uploadImage(file) {
  const webp = await convertToWebP(file);
  const fd = new FormData();
  fd.append('image', webp, 'image.webp');
  const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: fd });
  if (!res.ok) throw new Error('upload failed');
  const { r2_key } = await res.json();
  return r2_key;
}

function convertToWebP(file, maxDim = 2400, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const r = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('convert failed')), 'image/webp', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
    img.src = url;
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ─── Boot ───────────────────────────────────────────────
if (isLoggedIn()) openDash(); else show('login');
