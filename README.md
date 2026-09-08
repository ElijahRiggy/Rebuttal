# Rebuttal

A one-page debate site: post a topic, argue Pro or Con, vote on arguments, and message other debaters directly.

This repo is a single static file (`index.html`) — no build step, no server. That makes it trivial to host on GitHub Pages, but it comes with one important tradeoff explained below.

## Deploy it on GitHub Pages

1. **Create a new repo on GitHub** (github.com → New repository). Public, no README/template needed since you already have one here.
2. **Push this folder to it:**
   ```bash
   cd site
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```
3. **Turn on Pages:** in the repo, go to *Settings → Pages*. Under "Build and deployment", set Source to "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
4. Wait about a minute — GitHub will give you a URL like `https://YOUR-USERNAME.github.io/YOUR-REPO/`. That's your live site.

## Point a custom domain at it — for free

You don't have to buy a domain. Two solid free options:

**Option A — just use the GitHub Pages URL.** Once Pages is on, your site is live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`, at no cost. Want to drop the `/YOUR-REPO/` part? Rename the repo itself to `YOUR-USERNAME.github.io` — GitHub treats that repo name specially and serves it at the bare `https://YOUR-USERNAME.github.io`.

**Option B — get a free `is-a.dev` subdomain.** [is-a.dev](https://github.com/is-a-dev/register) is a real, actively-maintained free subdomain service (e.g. `rebuttal.is-a.dev`) aimed at developers hosting on GitHub Pages, Vercel, etc. No signup or payment — you register it by opening a pull request against their repo with a small JSON file pointing at your GitHub Pages site, and their bot reviews and merges it. Steps:
1. Fork `https://github.com/is-a-dev/register`
2. Add a file at `domains/rebuttal.json` (or whatever name you want) following their documented format, pointing `cname` at `YOUR-USERNAME.github.io`
3. Open a pull request — once merged, `rebuttal.is-a.dev` resolves to your site
4. Read their docs first (linked in the repo) — they're strict about the request being for a real, working site

If you'd rather use a paid domain later, the earlier A-record/CNAME instructions in this README still apply — nothing about the free routes locks you out of switching.

## Important: how data actually persists here

The app stores debates, arguments, and messages using a storage API (`window.storage`) that only exists inside Claude's own artifact preview. Once this is a plain static site on GitHub Pages, that API won't be present, so the app automatically falls back to:

1. `localStorage` in the visitor's own browser, or
2. an in-memory store if even that's blocked.

**What this means in practice:** each visitor gets their own private copy of the site's data, tied to their browser. If you post a debate and a friend visits the same URL from their own computer, they won't see it — and the "Debate" / private messaging feature won't actually reach them, since there's no shared backend to relay it.

The site will work great for one person testing it solo, or for a demo. It will *not* work as a real multi-person debate platform until it's connected to a real shared backend (a small database). If you want that next, the common lightweight options are:

- **Firebase (Firestore)** — free tier, no server to manage, works well from a static site. You'd create a free Firebase project yourself (this needs your own Google account, so it's a step you'd do), then I can wire the app's storage calls up to it.
- **Supabase** — similar idea, Postgres-based, also has a free tier.

Happy to do that integration whenever you're ready — just say the word and let me know which you'd rather use.
