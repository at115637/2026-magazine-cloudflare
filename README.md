# 2026 Magazine — Cloudflare build

Self-hosted magazine with a password-protected admin where you build
articles from **text**, **image** and **embed** blocks — no code, no git push.

Stack (all Cloudflare, like the Dr0ne site):
- **Pages** – hosts the static site + Functions
- **R2** – stores uploaded images (converted to WebP in the browser first)
- **D1** – stores articles and their ordered blocks
- **Functions** – the API (auth, upload, article save/list, delete, image serve)

---

## One-time setup

You need the Cloudflare CLI (`wrangler`). In this project folder:

```bash
npm install -g wrangler
wrangler login
```

### 1. Create the R2 bucket
```bash
wrangler r2 bucket create mag-r2
```

### 2. Create the D1 database
```bash
wrangler d1 create mag-d1
```
Copy the `database_id` it prints into `wrangler.toml` (replace `REPLACE_WITH_YOUR_D1_ID`).

### 3. Initialise the database tables
```bash
wrangler d1 execute mag-d1 --remote --file=schema.sql
```

### 4. Create the Pages project & deploy
```bash
wrangler pages project create mag
wrangler pages deploy .
```

### 5. Set the two secrets
In the Cloudflare dashboard → Workers & Pages → **mag** → Settings → Variables and Secrets,
add (type: Secret):
- `ADMIN_PASSWORD` – your login password
- `JWT_SECRET` – a random string, e.g. from `openssl rand -hex 32`

Also bind R2 and D1 to the Pages project there (Settings → Functions →
R2 bucket bindings: `BUCKET` → mag-r2; D1 database bindings: `DB` → mag-d1),
or they are picked up from `wrangler.toml` on deploy.

### 6. (Later) point the domain
Dashboard → mag → Custom domains → add `2026-magazine.com` once you're happy.

---

## Everyday use — adding a contribution

1. Go to `https://<your-site>/admin.html`
2. Enter the password
3. **+ new contribution**
4. Fill title / author / date, upload a title image
5. Add **+ text**, **+ image**, **+ embed** blocks in any order; reorder with ↑ ↓
6. **save** (uncheck *published* to keep it a draft)

Images are auto-converted to WebP and resized in the browser before upload,
so large phone photos upload fast. Everything works from a phone browser too.

### Text formatting
Inside a text block: `**bold**`, `*italic*`, `<u>underline</u>`, `<br>` for a line break.

### Embeds
Paste a SoundCloud or Vimeo `<iframe>` into an embed block.

---

## Local preview
```bash
wrangler pages dev .
```
