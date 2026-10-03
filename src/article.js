// src/article.js — renders a single article and its ordered blocks

const el = document.getElementById('article');

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || '');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// Minimal, safe inline markdown: **bold**, *italic*, <u>…</u> kept as-is.
function inlineMd(raw) {
  let s = esc(raw);
  // restore <u>…</u> (allow underline tags the editor inserts)
  s = s.replace(/&lt;u&gt;/g, '<u>').replace(/&lt;\/u&gt;/g, '</u>');
  s = s.replace(/&lt;br\s*\/?&gt;/g, '<br>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return s;
}

function imgUrl(r2key) {
  return `/img/${r2key}`;
}

async function load() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { el.innerHTML = '<div class="loading">Not found.</div>'; return; }

  try {
    const res = await fetch(`/api/article?id=${encodeURIComponent(id)}`);
    if (!res.ok) { el.innerHTML = '<div class="loading">Not found.</div>'; return; }
    const { article, blocks } = await res.json();

    let html = '';

    // Cover / title image
    if (article.cover_r2_key && article.cover_r2_key !== '-') {
      html += `
        <div class="cover"><img src="${imgUrl(article.cover_r2_key)}" alt=""></div>
        ${article.cover_credit && article.cover_credit !== '-'
          ? `<p class="image-credit">${esc(article.cover_credit)}</p>` : ''}
      `;
    }

    // Header
    html += `
      <header class="article-header">
        <div class="article-title-main">${esc(article.title)}</div>
        <div class="article-date">${fmtDate(article.date)}</div>
        <div class="article-author">by ${esc(article.author)}</div>
      </header>
      <div class="article-body">
    `;

    // Blocks
    for (const b of (blocks || [])) {
      if (b.kind === 'text') {
        html += `<div class="block-text">${inlineMd(b.content)}</div>`;
      } else if (b.kind === 'image' && b.r2_key && b.r2_key !== '-') {
        html += `
          <figure class="block-image">
            <img src="${imgUrl(b.r2_key)}" alt="">
            ${b.caption && b.caption !== '-'
              ? `<figcaption class="block-caption">${esc(b.caption)}</figcaption>` : ''}
          </figure>`;
      } else if (b.kind === 'embed') {
        html += `<div class="block-embed">${b.content}</div>`;
      }
    }

    html += `</div><a class="back-top" href="/">↑</a>`;
    el.innerHTML = html;
    document.title = `${article.title} — 2026 Magazine`;
  } catch (err) {
    console.error(err);
    el.innerHTML = '<div class="loading">Could not load.</div>';
  }
}

load();
