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
      allow update: if request.auth != null && (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['votes','voterChoices','proCount','conCount']) ||
        (request.auth.uid == resource.data.createdBy &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['title','description','category','closed']))
      );
      allow delete: if request.auth != null && request.auth.uid == resource.data.createdBy;

      match /arguments/{argId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update: if request.auth != null && (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['votes','voterChoices','replyCount']) ||
          (request.auth.uid == resource.data.authorUid &&
           request.resource.data.diff(resource.data).affectedKeys().hasOnly(['text','editedAt']))
        );
        allow delete: if request.auth != null && (
          request.auth.uid == resource.data.authorUid ||
          request.auth.uid == get(/databases/$(database)/documents/topics/$(topicId)).data.createdBy
        );

        match /replies/{replyId} {
          allow read: if true;
          allow create: if request.auth != null;
          allow delete: if request.auth != null && request.auth.uid == resource.data.authorUid;
        }
      }
    }
    match /threads/{threadId} {
      allow read, write: if request.auth != null;
      match /messages/{msgId} {
        allow read, create: if request.auth != null;
        allow delete: if request.auth != null && request.auth.uid == resource.data.authorUid;
      }
    }
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /reports/{reportId} {
      allow read: if false;
      allow create: if request.auth != null;
    }
    match /blocks/{blockId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.blockerUid;
      allow delete: if request.auth != null && request.auth.uid == resource.data.blockerUid;
    }
    match /follows/{followId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.followerUid;
      allow delete: if request.auth != null && request.auth.uid == resource.data.followerUid;
    }
    match /notifications/{notifId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.recipientUid;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid == resource.data.recipientUid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
    }
  }
}
```

   This is a real ownership model now, not just a UI-level suggestion: editing/deleting a topic or argument requires the request to actually come from its creator (Firestore checks this server-side, not just "does the button show up"). Votes and reply counts stay open to any logged-in user since that's how voting works — anyone updating someone else's vote count is legitimate. Reports write-only (nobody can read others' reports from the client — you'll see them yourself in the Firestore **Data** tab in the Firebase console, which uses your own admin access and bypasses these rules entirely). Blocks are enforced by the app before sending a message, not by these rules — a technically sophisticated user could bypass a client-side check, so treat blocking as a deterrent, not a guarantee. Thread/message reads remain open to any logged-in user rather than locked to just the two participants, for the same reason as before — genuinely private threads need more complex rules than Firestore's query model makes convenient.

6. Open `index.html`, find the `firebaseConfig` object near the top of the `<script type="module">` block, and replace the placeholder values with your real ones from step 2.
7. Commit and push — Vercel/GitHub Pages redeploys automatically.

Until you do this, the live site shows a plain "connect Firebase" setup screen instead of the app — so it's obvious what's missing rather than silently broken.

### What you get once it's connected
- Every visitor sees the same public list of debates, filterable by category.
- Real accounts (email + password) — sign up, log in, log out.
- Voting, arguments, and topics sync live across everyone's browsers.
- A **Share** button on each debate copies a direct link (`?topic=...`) that opens straight to that debate for anyone.
- Messaging is real — if you challenge someone by name and they're logged in on their own device, they'll see it in their inbox.

### Trust & safety features
- **Edit/delete** your own topics, arguments, and messages.
- **Report** any topic or argument — reports go to a `reports` collection you can review yourself in the Firebase console's **Data** tab (there's no in-app admin panel, by design — the console is your admin panel).
- **Block** — from someone's profile or a chat header. This stops them from messaging you (checked before every send), but it's enforced by the app, not by Firestore rules — treat it as a strong deterrent, not an unbreakable wall.
- **Email verification** — sent automatically on signup, with a dismissible banner and resend option. Doesn't block any actions, just nudges toward real accounts.
- **Per-field profile privacy** — gender, occupation, and political leaning each have their own visibility toggle in Edit Profile.

### A couple of honest limitations
- **"Arguments you've made" on profiles** uses a Firestore collection-group query. The very first time it runs, Firestore may need you to create an index for it — if that section doesn't load, open your browser's console (F12), and Firebase will print a one-click link to create the index. You only ever have to do this once.
- **Link previews (Open Graph tags)** are static and site-wide — every shared link shows the same generic "Rebuttal — pick a side" preview, not a per-debate one. A single static HTML file can't generate a different preview per URL; that needs a server, which is outside what a free static-hosting setup like this can do.
- **Browser notifications** (toggle in your profile menu) only fire while this tab is open somewhere in your browser (even in the background) — not when the browser or tab is fully closed. True push-when-closed notifications need Firebase Cloud Functions, which requires upgrading to Firebase's paid Blaze plan even though actual usage would stay free — so this wasn't implemented.

### Newest additions
- **Dark mode** — toggle in the header (or your profile menu once logged in). Remembers your choice, respects your system preference on first visit.
- **In-app notifications** — the bell icon in the header. You get one when someone replies to your argument, or when someone you follow starts a new debate.
- **Following** — Follow/Unfollow on anyone's profile.
- **Close a debate** — as the owner, stop new arguments from being added without deleting it.
- **"Most convincing" badge** — highlights the top-voted argument on each side of a debate.
- **Sort arguments by newest** — a toggle next to "Message someone about this" on any debate.
- **A soft posting cooldown** (20 seconds between your own posts) to slow down flooding. Like blocking, this is enforced client-side — a deterrent against casual spam, not a hard server-side rate limit. A determined bad actor could still script around it; stopping that properly would need Cloud Functions (same billing tradeoff as real push notifications).
