// Vercel Serverless Function
// Receives Stripe webhook events and keeps Firestore's `isMember` flag in sync.
//
// This is the automated half of Rebuttal's membership system:
// - checkout.session.completed  -> grants membership (monthly or lifetime)
// - customer.subscription.deleted -> revokes membership for MONTHLY members only
//   (lifetime members never have a subscription, so this never fires for them —
//   nothing extra needed to keep lifetime members permanent)
//
// Required environment variables (set these in Vercel: Project -> Settings -> Environment Variables):
//   STRIPE_SECRET_KEY            - from Stripe Dashboard -> Developers -> API keys
//   STRIPE_WEBHOOK_SECRET        - from Stripe Dashboard -> Developers -> Webhooks -> your endpoint -> Signing secret
//   FIREBASE_SERVICE_ACCOUNT_KEY - the full JSON content of a Firebase service account key, as one string
//                                  (Firebase Console -> Project settings -> Service accounts -> Generate new private key)
//
// See the README in this repo for the full step-by-step setup.

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
  });
}
const db = getFirestore();

// Stripe needs the raw, unparsed request body to verify the webhook signature.
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function grantMembership(email, { stripeCustomerId, membershipType }) {
  if (!email) {
    console.warn('checkout.session.completed had no customer email — cannot match to a Rebuttal account');
    return;
  }
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) {
    console.warn(`No Rebuttal account found for email ${email} — payment succeeded but nothing to grant`);
    return;
  }
  await snap.docs[0].ref.update({
    isMember: true,
    membershipType,
    stripeCustomerId: stripeCustomerId || null,
    membershipGrantedAt: new Date().toISOString(),
  });
  console.log(`Granted ${membershipType} membership to ${email}`);
}

async function revokeMembershipByCustomerId(stripeCustomerId) {
  const snap = await db.collection('users').where('stripeCustomerId', '==', stripeCustomerId).limit(1).get();
  if (snap.empty) {
    console.warn(`No Rebuttal account found for Stripe customer ${stripeCustomerId} — nothing to revoke`);
    return;
  }
  const doc = snap.docs[0];
  const data = doc.data();
  if (data.membershipType === 'lifetime') {
    // Should never happen (lifetime purchases don't create subscriptions), but never revoke a lifetime member.
    console.warn(`Subscription-deleted event matched a lifetime member (${stripeCustomerId}) — ignoring`);
    return;
  }
  await doc.ref.update({
    isMember: false,
    membershipRevokedAt: new Date().toISOString(),
  });
  console.log(`Revoked membership for Stripe customer ${stripeCustomerId}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  let event;
  try {
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email;
        const membershipType = session.mode === 'subscription' ? 'monthly' : 'lifetime';
        await grantMembership(email, { stripeCustomerId: session.customer, membershipType });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await revokeMembershipByCustomerId(subscription.customer);
        break;
      }
      default:
        // Other event types are ignored — this webhook only cares about the two above.
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error handling Stripe webhook:', err);
    res.status(500).send('Webhook handler error');
  }
}
