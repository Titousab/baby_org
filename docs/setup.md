# Putting Ezra's app online

About 15 minutes: the app runs on **Vercel**, and its data lives in a Postgres database on your **Railway** account.

## 1. Import the project

1. Go to [vercel.com/new](https://vercel.com/new) and sign in.
2. Under **Import Git Repository**, pick **baby_org** (connect GitHub if Vercel asks).
3. **Project Name:** `ezras-day` (or the closest name Vercel accepts). This becomes the web address, for example `ezras-day.vercel.app`, and **it can't change later** without everyone reinstalling the app.
4. Leave everything else as it is. Don't click Deploy yet. If you already did, that's fine: the first deploy just won't have a database. Carry on below and redeploy at the end.

## 2. Create the database on Railway

1. In [railway.com](https://railway.com), open the project you want to use, or click **New Project → Empty Project**. A new project named "ezra" keeps things tidy.
2. In the project, click **+ Create** (or **New**) → **Database** → **PostgreSQL**. Wait until it shows as running.
3. Click the Postgres service → **Variables** tab. Find **`DATABASE_PUBLIC_URL`** and copy its value. It starts with `postgresql://` and contains a host like `something.proxy.rlwy.net`.
   - Use the **public** one. The plain `DATABASE_URL` there only works inside Railway, and the app runs on Vercel.
   - Keep it private: it includes the database password.
4. Optional but recommended: in the Postgres service's **Backups** tab, turn on automatic backups.

## 3. Connect the database and create your account

In the Vercel project, go to **Settings → Environment Variables** and add these four for **Production** only:

| Name | Value |
|---|---|
| `DATABASE_URL` | The `DATABASE_PUBLIC_URL` you copied from Railway |
| `OWNER_NAME` | The name the app should show for you, for example `Dad` |
| `OWNER_EMAIL` | The email you'll sign in with |
| `OWNER_PASSWORD` | A starting password (at least 8 characters) |

## 4. Deploy

Go to **Deployments** and click **Deploy** (or **Redeploy** on the latest one). Each deploy prepares the database automatically. The build log says `Database ready; created the first account…` the first time. When it finishes, open the address and sign in with the email and password from step 3.

**If the deploy fails with "The server does not support SSL connections":** in Vercel, edit `DATABASE_URL` and add `?sslmode=disable` to the end of the address, then redeploy. The app encrypts its connection to Railway by default, and this switches that off for servers that don't offer it.

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
