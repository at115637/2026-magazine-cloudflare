// src/home.js — fetches all articles and renders the centered list

const listEl = document.getElementById('article-list');

function fmtDate(iso) {
  // "2026-09-27" → "27.09.2026"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || '');
}

async function load() {
  try {
    const res = await fetch('/api/article');
    const { articles } = await res.json();

    const visible = (articles || []).filter(a => a.published !== 0);
    if (!visible.length) {
      listEl.innerHTML = '<div class="loading">No contributions yet.</div>';
      return;
    }

    listEl.innerHTML = visible.map(a => `
      <a class="article-row" href="/article.html?id=${encodeURIComponent(a.id)}">
        <span class="article-title">${esc(a.title)}</span>
        <span class="article-meta">${fmtDate(a.date)} · ${esc(a.author)}</span>
      </a>
    `).join('');
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div class="loading">Could not load.</div>';
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

load();
