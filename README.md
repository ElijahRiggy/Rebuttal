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

## Important: this now needs a free Firebase project

To make debates genuinely public — everyone who visits sees the same topics, categories, votes, and messages — this version stores everything in **Firebase** (Firestore + Authentication) instead of browser-only storage. That's the tradeoff for making the "public topics" and "real accounts" features actually work between different people.

### One-time setup (about 5 minutes, free, no credit card)

1. Go to **console.firebase.google.com** and create a project.
2. Click the **`</>`** (web app) icon to register a web app — it hands you a `firebaseConfig` object.
3. Go to **Authentication → Sign-in method** and enable **Email/Password**.
4. Go to **Firestore Database → Create database**. Choose "production mode."
5. In Firestore, go to the **Rules** tab and paste this in (replacing the default), then Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /topics/{topicId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      match /arguments/{argId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update: if request.auth != null;
      }
    }
    match /threads/{threadId} {
      allow read, write: if request.auth != null;
      match /messages/{msgId} {
        allow read, write: if request.auth != null;
      }
    }
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

   This lets anyone read topics/arguments (so debates are public), but only logged-in users can post, vote, or message. Note: thread/message reads are open to any logged-in user rather than locked to just the two participants — Firestore's query rules make strict per-thread privacy more involved, so this is a pragmatic simplification, not bank-grade privacy.

6. Open `index.html`, find the `firebaseConfig` object near the top of the `<script type="module">` block, and replace the placeholder values with your real ones from step 2.
7. Commit and push — Vercel/GitHub Pages redeploys automatically.

Until you do this, the live site shows a plain "connect Firebase" setup screen instead of the app — so it's obvious what's missing rather than silently broken.

### What you get once it's connected
- Every visitor sees the same public list of debates, filterable by category.
- Real accounts (email + password) — sign up, log in, log out.
- Voting, arguments, and topics sync live across everyone's browsers.
- A **Share** button on each debate copies a direct link (`?topic=...`) that opens straight to that debate for anyone.
- Messaging is real — if you challenge someone by name and they're logged in on their own device, they'll see it in their inbox.
