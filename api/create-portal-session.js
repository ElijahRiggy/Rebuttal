// Vercel Serverless Function
// Creates a Stripe Customer Portal session for the logged-in user, so members
// can cancel or manage their own subscription without you doing it manually.
//
// The client sends the user's Firebase ID token in the Authorization header.
// This function verifies that token with Firebase Admin (so nobody can request
// a portal session for someone else's account), looks up their stripeCustomerId
// in Firestore, and returns a one-time-use Stripe-hosted portal URL to redirect to.
//
// Requires the same three environment variables as stripe-webhook.js
// (STRIPE_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT_KEY) — no new ones needed.
//
// IMPORTANT: this only works once you've activated the Customer Portal in
// Stripe (Dashboard -> Settings -> Billing -> Customer portal -> Activate).
// See the README for the full walkthrough.

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
  });
}
const db = getFirestore();
const adminAuth = getAuth();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired login' });
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const stripeCustomerId = userDoc.exists ? userDoc.data().stripeCustomerId : null;

    if (!stripeCustomerId) {
      res.status(400).json({ error: 'No Stripe customer on file for this account (are you a Member yet?)' });
      return;
    }

    const returnUrl = req.body?.returnUrl || 'https://rebuttaldebate.vercel.app/';
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creating portal session:', err);
    res.status(500).json({ error: 'Could not create a management session. Try again in a bit.' });
  }
}
