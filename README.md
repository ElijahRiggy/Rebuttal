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
      allow create: if request.auth != null &&
        request.resource.data.title.size() <= 150 &&
        (!('description' in request.resource.data) || request.resource.data.description.size() <= 500) &&
        (
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isMember == true ||
          !('lastTopicPostAt' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data) ||
          request.time > get(/databases/$(database)/documents/users/$(request.auth.uid)).data.lastTopicPostAt + duration.value(24, 'h')
        );
      allow update: if request.auth != null && (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['votes','voterChoices','proCount','conCount']) ||
        (request.auth.uid == resource.data.createdBy &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['title','description','category','closed']))
      );
      allow delete: if request.auth != null && request.auth.uid == resource.data.createdBy;

      match /arguments/{argId} {
        allow read: if true;
        allow create: if request.auth != null && request.resource.data.text.size() <= 1200;
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
          allow create: if request.auth != null && request.resource.data.text.size() <= 500;
          allow delete: if request.auth != null && request.auth.uid == resource.data.authorUid;
        }
      }
    }
    match /threads/{threadId} {
      allow read, write: if request.auth != null;
      match /messages/{msgId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null && request.resource.data.text.size() <= 1200;
        allow delete: if request.auth != null && request.auth.uid == resource.data.authorUid;
      }
    }
    match /users/{uid} {
      allow read: if true;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update: if request.auth != null && request.auth.uid == uid &&
        !request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['isMember','membershipType','stripeCustomerId','membershipGrantedAt','membershipRevokedAt']);
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

### Legal pages, account deletion, content limits, and AdSense

**Terms of Service and Privacy Policy** pages are live, linked from the footer of every page. Both say clearly, in the page itself, that they're general templates and not legal advice — have an actual lawyer review them before this is a serious business, especially once ads or revenue are involved. The Privacy Policy already discloses Firebase as your data processor and AdSense/cookie use in roughly the language Google expects to see.

**Account deletion** — "Danger zone" at the bottom of Edit Profile. Deletes your profile document and Firebase login. Your past debates and arguments stay up (deleting them would break other people's replies and conversations), but they're no longer tied to a real, loggable-into account — the same pattern most established sites use for "deleted user."

**Content limits** are enforced two ways: `maxlength` on every input (so you can't even type past the limit), and matching size checks in the Firestore rules below (so someone couldn't bypass the limit by talking to Firestore directly). Current caps: debate title 150 chars, description 500, arguments 1200, replies 500, chat messages 1200, bio 300.

**AdSense** — the script tag and ad slot are already in `index.html`, wired up correctly, but commented out. To turn them on:

1. Go to **adsense.google.com** and apply with your own Google account. This needs your real identity and payment details — something only you can do, not something I can set up for you.
2. Google reviews the site before approving it. Having a live Privacy Policy (done) and real content (your debates) helps; very new or low-traffic sites are sometimes asked to wait and reapply later.
3. Once approved, get your **Publisher ID** (looks like `ca-pub-1234567890123456`) from your AdSense dashboard.
4. In `index.html`, uncomment the `<script async src="https://pagead2.googlesyndication.com/...">` line near the top of `<head>`, and replace `ca-pub-XXXXXXXXXXXXXXXX` with your real publisher ID.
5. Create an ad unit in AdSense (**Ads → By ad unit → Display ads**), which gives you an ad slot ID (a number like `1234567890`).
6. Near the bottom of `index.html`, uncomment the `<div class="ad-slot-wrap">...</div>` block, and replace both `ca-pub-XXXXXXXXXXXXXXXX` and `0000000000` with your real publisher ID and ad slot ID.
7. Push the change. Ads can take a little while to actually start appearing even after everything's correctly configured — that's normal on Google's end, not a sign something's broken.

### Debate cooldown and Stripe Membership

Free accounts can start **one new debate every 24 hours**. Arguing, voting, replying, and messaging are all unlimited regardless — the cooldown only applies to starting brand-new debates. **Members** (paid, via Stripe) skip this entirely.

**How the cooldown is enforced:** every time you post a debate, the timestamp is saved to your own user profile in Firestore (not just kept in the browser), so refreshing the page doesn't reset it. It's also checked in the Firestore rules below, so it's not purely a client-side suggestion. Being fully honest about the limits of that: since your own account already has permission to edit your own profile (needed for normal profile editing), a technically determined person could still directly rewrite that timestamp field via Firestore's API and bypass the wait — the same category of limitation as the block feature and the old posting cooldown. It stops casual bypassing (like just hitting refresh), not a determined attacker; a fully tamper-proof version would need a Cloud Function, which brings back the same billing tradeoff mentioned elsewhere in this doc.

**Setting up Stripe Membership:**

1. Go to **stripe.com** and create an account (your own identity/payment details — this part has to be you, same as AdSense).
2. In the Stripe Dashboard, create a **Product** (e.g. "Rebuttal Membership") with a **recurring Price** (e.g. $3/month — whatever you want to charge).
3. Create a **Payment Link** for that price (Stripe Dashboard → Payment Links → New). This gives you a URL like `https://buy.stripe.com/xxxxxxxx` that works immediately with zero code — no backend required just to *accept* the payment.
4. In `index.html`, find `const MEMBERSHIP_URL = 'https://buy.stripe.com/YOUR_PAYMENT_LINK';` near the top of the `<script type="module">` block, and replace it with your real Payment Link.
5. Push the change — the "Become a Member" prompt (in the account dropdown menu, and shown when someone hits the cooldown) now points at your real checkout page.

**That gets payments working. Turning a payment into an unlocked account still needs one more step**, and you have two options:

- **Manual (works today, zero extra building):** Stripe emails you when someone subscribes. Open Firestore's **Data** tab, find that person's document under `users`, and add a field `isMember` set to `true` (boolean). They'll see the Member badge and unlimited debates on their next page load. To revoke it if someone cancels, Stripe also emails you about that — just flip the field back to `false`.
- **Automated (bigger lift, but genuinely free):** since you're already hosting on Vercel, its free tier includes serverless functions — a small API endpoint that receives Stripe's webhook events (`checkout.session.completed` for new members, `customer.subscription.deleted` for cancellations) and writes `isMember` to Firestore automatically using the Firebase Admin SDK. Unlike Ko-fi, Stripe's webhooks reliably report *both* the start and the end of a subscription, so this can be fully automatic in both directions. This is now built — see the walkthrough below.

Update your Firestore rules to the version below regardless — it adds the server-side half of the cooldown check, and now also blocks the client from ever setting `isMember` on its own account directly (previously, since your own account can edit its own profile, someone could technically have opened the browser console and granted themselves membership for free — this closes that).

### Automated Stripe webhook — full setup

This is now built and live in the code, in `api/stripe-webhook.js`, plus a `package.json` so Vercel knows to install its two dependencies (`stripe` and `firebase-admin`). It listens for two events: a successful payment (grants membership) and a cancelled subscription (revokes it — never touches lifetime members, since they don't have a subscription to cancel in the first place). Three things need to be set up before it actually works:

1. **Get a Firebase service account key.** Firebase Console → your project → the gear icon → Project settings → **Service accounts** tab → **Generate new private key**. This downloads a JSON file — keep it private, it's essentially a master key to your database.
2. **Add three environment variables in Vercel.** Vercel Dashboard → your project → Settings → Environment Variables. Add:
   - `STRIPE_SECRET_KEY` — from Stripe Dashboard → Developers → API keys (the **secret** key, not the publishable one)
   - `STRIPE_WEBHOOK_SECRET` — you'll get this in the next step
   - `FIREBASE_SERVICE_ACCOUNT_KEY` — open the JSON file from step 1 and paste its *entire contents* as the value (it's fine that it's long)
3. **Register the webhook endpoint in Stripe.** Stripe Dashboard → Developers → Webhooks → **Add endpoint**. The URL is `https://rebuttaldebate.vercel.app/api/stripe-webhook` (swap in your real domain if different). Under "Select events," add exactly two: `checkout.session.completed` and `customer.subscription.deleted`. After creating it, Stripe shows you a **Signing secret** (starts with `whsec_`) — copy that into the `STRIPE_WEBHOOK_SECRET` variable in Vercel from step 2.
4. **Push this code and redeploy.** Vercel will pick up the new `api/` folder automatically and install the dependencies from `package.json`.
5. **Test it.** Stripe Dashboard → Developers → Webhooks → your endpoint → **Send test webhook**, pick `checkout.session.completed`, and send it. Check Vercel's function logs (your project → Deployments → the deployment → Functions) to see if it ran without errors. Note: a *test* webhook uses a fake email, so it'll log "No Rebuttal account found" — that's expected and means the signature verification and connection all worked; it just couldn't find a matching account for the fake test email, which is correct.
6. **Do one real end-to-end test with a real account** before trusting it fully: sign up for your own Monthly membership with a real card (you can refund yourself after), confirm `isMember` actually flips to `true` on your Firestore user doc within a few seconds, then cancel the subscription in Stripe and confirm it flips back to `false`.

One honest limitation: this matches payments to accounts **by email**. If someone pays with a different email than the one their Rebuttal account uses, the webhook won't find a match (you'll see it in the function logs) and you'd need to grant it manually that one time.

### Letting members cancel themselves — Stripe Customer Portal

Members can now cancel or manage their own subscription from inside Rebuttal, via a "Manage membership" button (shows up on the Membership page once you're a monthly member — lifetime members don't see it, since there's nothing recurring to cancel). This uses `api/create-portal-session.js`, a second small serverless function that securely verifies who's asking (via their Firebase login) and redirects them into Stripe's own hosted portal. It reuses the same `STRIPE_SECRET_KEY` and `FIREBASE_SERVICE_ACCOUNT_KEY` you already set up — no new environment variables needed.

**One thing you must do before this works:** Stripe → Settings → Billing → **Customer portal** → Activate it. Until you do, clicking "Manage membership" will fail with an error, since Stripe won't have a portal configured to redirect into. While you're in there, it's worth setting your business name/logo so the portal looks like it belongs to Rebuttal rather than a generic Stripe page.

### Member perks (current)

- **Unlimited debates** (vs. one every 24 hours on the free plan)
- **A "★ Member" badge** — shown on their profile, in the account menu, and to anyone chatting with them
- **A custom profile accent color** — a small colored ring around their avatar, picked from a palette in Edit Profile. Free accounts see a locked teaser pointing at the Membership page instead of the picker.
- **Ad-free browsing**, once AdSense is live — the ad slot automatically hides for members and never re-appears for them. (Not visible yet since ads themselves aren't turned on.)

Arguing, voting, and messaging stay unlimited for everyone regardless of membership — those were never gated, by design.
