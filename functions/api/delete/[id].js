// functions/api/delete/[id].js
// DELETE /api/delete/:id — removes an article, its blocks, and all R2 images. Protected.

export async function onRequestDelete(context) {
  const { env, params } = context;
  const { id } = params;
  if (!id) return json({ error: 'Missing id' }, 400);

  try {
    // Collect all R2 keys to clean up (cover + image blocks)
    const article = await env.DB.prepare(
      `SELECT cover_r2_key FROM articles WHERE id = ?`
    ).bind(id).first();
    if (!article) return json({ error: 'Not found' }, 404);

    const { results: blocks } = await env.DB.prepare(
      `SELECT r2_key FROM blocks WHERE article_id = ? AND kind = 'image'`
    ).bind(id).all();

    const keys = [];
    if (article.cover_r2_key && article.cover_r2_key !== '-') keys.push(article.cover_r2_key);
    for (const b of (blocks ?? [])) {
      if (b.r2_key && b.r2_key !== '-') keys.push(b.r2_key);
    }

    // Delete DB rows (blocks first, then article)
    await env.DB.prepare(`DELETE FROM blocks WHERE article_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM articles WHERE id = ?`).bind(id).run();

    // Best-effort R2 cleanup
    for (const k of keys) { try { await env.BUCKET.delete(k); } catch {} }

    return json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    return json({ error: 'Delete failed' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
