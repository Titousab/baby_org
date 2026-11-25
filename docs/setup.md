# Putting Ezra's app online

About 10 minutes, all in the Vercel website. You don't need Railway.

## 1. Import the project

1. Go to [vercel.com/new](https://vercel.com/new) and sign in.
2. Under **Import Git Repository**, pick **baby_org** (connect GitHub if Vercel asks).
3. **Project Name:** `ezras-day` (or the closest name Vercel accepts). This becomes the web address, for example `ezras-day.vercel.app`, and **it can't change later** without everyone reinstalling the app.
4. Leave everything else as it is. Don't click Deploy yet. If you already did, that's fine: the first deploy just won't have a database. Carry on below and redeploy at the end.

## 2. Add the database (free)

1. Open the project in Vercel and go to the **Storage** tab.
2. Click **Create Database**, choose **Neon** (Serverless Postgres), and accept the free plan.
3. Connect it to the project for **all environments**. Vercel adds the `DATABASE_URL` setting for you.

## 3. Your account

In the project, go to **Settings → Environment Variables** and add these three for **Production**:

| Name | Value |
|---|---|
| `OWNER_NAME` | The name the app should show for you, for example `Dad` |
| `OWNER_EMAIL` | The email you'll sign in with |
| `OWNER_PASSWORD` | A starting password (at least 8 characters) |

## 4. Deploy

Go to **Deployments** and click **Deploy** (or **Redeploy** on the latest one). When it finishes, open the address and sign in with the email and password from step 3.

Then, for safety:

1. In Vercel, **delete `OWNER_PASSWORD`**. It's only used once, when the first account is created.
2. In the app, tap your initial (top right) → **Your password** and change it.

## 5. Set it up for everyone

In the app, tap your initial (top right):

1. **Settings:** enter Ezra's birthday. Check the days and hours someone needs to be with him (weekdays 8:00 am – 6:30 pm to start).
2. **Add someone**, once for each person:
   - Mom: **Family**
   - Lauren: **Family**
   - Selina: **Caretaker** (she can log Ezra's day and see everything, but can't change the schedule)
3. **Juju's House** is already on the schedule list, so you can add daycare hours as shifts.

Text each person:

> Here's Ezra's app: https://ezras-day.vercel.app
> Sign in with your email and this password: ______ (you can change it inside the app)
> To keep it on your phone: iPhone, tap Share → Add to Home Screen. Android, tap ⋮ → Install app.

**Important on iPhone:** they should sign in **from the home-screen icon**, not from Safari. The home-screen app keeps its own sign-in. Once signed in, they stay signed in for a year.

## If someone forgets their password

A family member taps their initial → taps that person → **Reset password**, then texts them the new one.

## Updates

Every change merged into `main` on GitHub goes live automatically, including any database updates.
