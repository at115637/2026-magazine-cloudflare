// functions/api/article.js
// GET  /api/article            → list all articles (public), newest first
// GET  /api/article?id=XYZ     → one article with its ordered blocks (public)
// POST /api/article            → create or update an article + its blocks (protected)
//
// POST body (JSON):
// {
//   id?:        string,         // present → update, absent → create
//   date:       string,         // "YYYY-MM-DD"
//   title:      string,
//   author:     string,
//   cover_r2_key: string,       // "-" if none
//   cover_credit: string,
//   published:  0 | 1,
//   blocks: [
//     { kind: 'text',  content: '...' },
//     { kind: 'image', r2_key: 'images/..', caption: '...' },
//     { kind: 'embed', content: '<iframe ...>' }
//   ]
// }

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (id) {
      const article = await env.DB.prepare(
        `SELECT * FROM articles WHERE id = ?`
      ).bind(id).first();
      if (!article) return json({ error: 'Not found' }, 404);

      const { results: blocks } = await env.DB.prepare(
        `SELECT id, position, kind, content, r2_key, caption
           FROM blocks WHERE article_id = ? ORDER BY position ASC`
      ).bind(id).all();

      return json({ article, blocks: blocks ?? [] });
    }

    // List all (with blocks, so the public site can render everything in one call)
    const { results: articles } = await env.DB.prepare(
      `SELECT * FROM articles ORDER BY date DESC, created_at DESC`
    ).all();

    const { results: allBlocks } = await env.DB.prepare(
      `SELECT id, article_id, position, kind, content, r2_key, caption
         FROM blocks ORDER BY article_id, position ASC`
    ).all();

    const byArticle = {};
    for (const b of (allBlocks ?? [])) {
      (byArticle[b.article_id] ??= []).push(b);
    }
    const withBlocks = (articles ?? []).map(a => ({ ...a, blocks: byArticle[a.id] ?? [] }));

    return json({ articles: withBlocks });
  } catch (err) {
    console.error('DB error:', err);
    return json({ error: 'Database error' }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const clean = (v, fallback = '-') => (String(v ?? '').trim() || fallback);

  const isUpdate = !!body.id;
  const id = body.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const article = {
    date:         clean(body.date),
    title:        clean(body.title),
    author:       clean(body.author),
    cover_r2_key: clean(body.cover_r2_key),
    cover_credit: clean(body.cover_credit),
    published:    body.published === 0 ? 0 : 1,
  };

  const blocks = Array.isArray(body.blocks) ? body.blocks : [];

  try {
    if (isUpdate) {
      await env.DB.prepare(
        `UPDATE articles SET date=?, title=?, author=?, cover_r2_key=?, cover_credit=?, published=?
           WHERE id=?`
      ).bind(article.date, article.title, article.author, article.cover_r2_key,
             article.cover_credit, article.published, id).run();
      // Replace all blocks
      await env.DB.prepare(`DELETE FROM blocks WHERE article_id = ?`).bind(id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO articles (id, created_at, date, title, author, cover_r2_key, cover_credit, published)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, now, article.date, article.title, article.author,
             article.cover_r2_key, article.cover_credit, article.published).run();
    }

    // Insert blocks in order
    let pos = 0;
    for (const b of blocks) {
      const kind = ['text', 'image', 'embed'].includes(b.kind) ? b.kind : 'text';
      await env.DB.prepare(
        `INSERT INTO blocks (id, article_id, position, kind, content, r2_key, caption)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), id, pos++, kind,
        String(b.content ?? ''), clean(b.r2_key), clean(b.caption)
      ).run();
    }

    return json({ success: true, id });
  } catch (err) {
    console.error('Save error:', err);
    return json({ error: 'Save failed' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
