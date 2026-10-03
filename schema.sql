-- Run once to initialize the D1 database:
-- wrangler d1 execute mag-d1 --remote --file=schema.sql

-- Articles: one row per article
CREATE TABLE IF NOT EXISTS articles (
  id           TEXT    PRIMARY KEY,
  created_at   TEXT    NOT NULL,
  date         TEXT    NOT NULL DEFAULT '-',   -- display date (YYYY-MM-DD)
  title        TEXT    NOT NULL DEFAULT '-',
  author       TEXT    NOT NULL DEFAULT '-',
  cover_r2_key TEXT    NOT NULL DEFAULT '-',   -- title image (R2 key) or '-'
  cover_credit TEXT    NOT NULL DEFAULT '-',   -- credit under title image
  published    INTEGER NOT NULL DEFAULT 1      -- 1 = visible, 0 = draft
);

-- Blocks: ordered content blocks belonging to an article
CREATE TABLE IF NOT EXISTS blocks (
  id          TEXT    PRIMARY KEY,
  article_id  TEXT    NOT NULL,
  position    INTEGER NOT NULL,                -- order within the article
  kind        TEXT    NOT NULL,                -- 'text' | 'image' | 'embed'
  content     TEXT    NOT NULL DEFAULT '',     -- text body OR embed HTML
  r2_key      TEXT    NOT NULL DEFAULT '-',    -- for image blocks
  caption     TEXT    NOT NULL DEFAULT '-',    -- image caption / credit
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_articles_date   ON articles(date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_pub    ON articles(published);
CREATE INDEX IF NOT EXISTS idx_blocks_article  ON blocks(article_id, position);
