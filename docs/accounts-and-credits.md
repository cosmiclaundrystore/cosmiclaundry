# Customer accounts and credits

## How it works

- Customers sign in at `/account/login` with **email + password** or **Google** (account icon in the header).
  Guest checkout still works; only orders placed while signed in earn credits.
- **Credits:** 100 per tee, 200 per Custom tee, added when the order is marked **Delivered** in the admin.
- **Reward:** every 1,000 credits unlock one reward: **20% off the tees + free delivery** on one order. It's ticked at
  checkout ("Use my reward"). Credits and rewards don't expire.
- **Safety:** a reward is *held* while its order is unpaid, *used* when paid, and *returned* if the order is cancelled or
  refunded (the daily clean-up job cancels unpaid orders holding a reward after 24 hours). A refund also takes back the
  order's credits. All of this happens in the database (`supabase/migrations/*_customer_credits.sql`), so it applies
  however an order changes.
- **Past guest orders:** when a customer's email is confirmed, earlier guest orders with that email are linked to the
  account and the delivered ones are credited.
- Account page `/account`: name, email, credit bar, rewards, recent orders with status and tracking.

## Setup you need to do (Supabase dashboard → your project)

1. **Authentication → URL Configuration**
   - Site URL: your live domain, e.g. `https://cosmiclaundry.lk`
   - Redirect URLs: add `https://cosmiclaundry.lk/auth/callback` and `http://localhost:3000/auth/callback`
2. **Authentication → Sign In / Providers → Email:** keep **Confirm email** ON. (It stops someone signing up with another
   person's email to see their guest orders.)
3. **Emails (needed before launch).** Supabase's built-in sender only sends a few emails per hour. Connect a free email
   service: create a [Resend](https://resend.com) account, verify your domain, then Supabase → Authentication → Emails →
   SMTP Settings → enable custom SMTP with Resend's details (host `smtp.resend.com`, port 465, user `resend`,
   password = your Resend API key, sender e.g. `hello@cosmiclaundry.lk`).
4. **Google sign-in:** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
   Authorised redirect URI: `https://ibepqtmpoqdwqtqcqtzf.supabase.co/auth/v1/callback`. Copy the Client ID and secret into
   Supabase → Authentication → Providers → Google, and turn it on.

Until Google is turned on, its button shows "coming soon" and point people to email sign-in.

## Where things live

- `app/(account)/` — sign-in, sign-up, reset and account pages; `app/(account)/auth/callback` — return from Google and emails
- `lib/account/` — session helpers, sign-in actions, account data, credit numbers
- Checkout: `app/api/checkout*` (links the order, applies the reward), `lib/checkout/pricing.ts` (discount, credits)
