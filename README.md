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

## Point a custom domain at it

1. Buy a domain anywhere (Namecheap, Porkbun, Google Domains successor, etc.).
2. In your DNS provider, add either:
   - **A records** for the apex domain (`example.com`) pointing at GitHub's IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, or
   - **A CNAME record** for a subdomain (`www.example.com` or `debate.example.com`) pointing at `YOUR-USERNAME.github.io`.
3. Back in *Settings → Pages*, enter your domain under "Custom domain" and save — GitHub will commit a `CNAME` file to your repo automatically. Check "Enforce HTTPS" once the certificate provisions (can take up to 24h).

## Important: how data actually persists here

The app stores debates, arguments, and messages using a storage API (`window.storage`) that only exists inside Claude's own artifact preview. Once this is a plain static site on GitHub Pages, that API won't be present, so the app automatically falls back to:

1. `localStorage` in the visitor's own browser, or
2. an in-memory store if even that's blocked.

**What this means in practice:** each visitor gets their own private copy of the site's data, tied to their browser. If you post a debate and a friend visits the same URL from their own computer, they won't see it — and the "Debate" / private messaging feature won't actually reach them, since there's no shared backend to relay it.

The site will work great for one person testing it solo, or for a demo. It will *not* work as a real multi-person debate platform until it's connected to a real shared backend (a small database). If you want that next, the common lightweight options are:

- **Firebase (Firestore)** — free tier, no server to manage, works well from a static site. You'd create a free Firebase project yourself (this needs your own Google account, so it's a step you'd do), then I can wire the app's storage calls up to it.
- **Supabase** — similar idea, Postgres-based, also has a free tier.

Happy to do that integration whenever you're ready — just say the word and let me know which you'd rather use.
