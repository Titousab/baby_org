# Putting Ezra's app online

About 15 minutes. The data lives in a Postgres database on your **Railway** account, and the app runs on **Vercel**. Do Railway first, because Vercel needs the database's address.

## Part A: Railway (the database)

1. Go to [railway.com](https://railway.com) and sign in.
2. Click **New** (or **+ New Project**) → **Database** → **PostgreSQL**. If it asks, choose **Deploy PostgreSQL**.
3. Wait until the Postgres box shows a green **Active** or **Online** status (under a minute).
4. Optional: click the project name at the top and rename it **ezra**, so it's easy to find later.
5. Turn on public access, so Vercel can reach the database. It's off by default.
   - Click the **Postgres** box → **Settings** tab → **Networking** → **Public Networking**.
   - Click **TCP Proxy** (it may read **+ TCP Proxy** or **Generate TCP Proxy**). If it asks for a port, enter **5432**.
   - Railway shows an address like `something.proxy.rlwy.net:12345`.
6. Go to the **Variables** tab. Find **`DATABASE_PUBLIC_URL`**: it only appears after step 5. Click the eye icon to reveal it, then copy it.
   - If it's still missing, build it from the other variables: `postgresql://PGUSER:PGPASSWORD@<proxy address>:<proxy port>/PGDATABASE`. Use the values shown for `PGUSER`, `PGPASSWORD` and `PGDATABASE`, and the address and port from step 5.
   - It starts with `postgresql://` and contains something like `…proxy.rlwy.net:12345/railway`.
   - Use the **public** one, not `DATABASE_URL`. That one only works inside Railway, and the app runs on Vercel.
   - It contains the database password, so keep it private.
7. Recommended: on the Postgres box, open **Backups** and turn on a daily backup schedule.

## Part B: Vercel (the app)

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New…** → **Project**.
3. Under **Import Git Repository**, find **baby_org** and click **Import**.
   - If it isn't listed, click **Adjust GitHub App Permissions** (or **Configure GitHub App**), give Vercel access to the `baby_org` repository, then come back.
4. On the **Configure Project** screen:
   - **Project Name:** `ezras-day`. This becomes the address `ezras-day.vercel.app`. If that name is taken, pick another, but **choose carefully: it can't change later** without everyone reinstalling the app.
   - **Framework Preset:** Next.js (it's detected automatically).
   - **Root Directory:** leave as `./`.
   - **Build and Output Settings:** leave as they are.
5. Open **Environment Variables** on the same screen and add these four, one per row:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | The `DATABASE_PUBLIC_URL` you copied from Railway |
   | `OWNER_NAME` | The name the app shows for you, for example `Dad` |
   | `OWNER_EMAIL` | The email you'll sign in with |
   | `OWNER_PASSWORD` | A starting password, at least 8 characters |

6. Click **Deploy** and wait about 2 minutes.
   - The build log shows `Database ready; created the first account from OWNER_* settings.` That means the database is set up and your account exists.
7. Click **Continue to Dashboard**, then **Visit** (or open `https://ezras-day.vercel.app`). Sign in with the email and password from step 5.

### If the deploy fails

- **"The server does not support SSL connections":** in Vercel go to **Settings → Environment Variables**, edit `DATABASE_URL` and add `?sslmode=disable` to the end. Then go to **Deployments**, click **⋯** on the latest one → **Redeploy**.
- **"password authentication failed" or "ENOTFOUND":** the address was copied incompletely, or it's the private one. Copy `DATABASE_PUBLIC_URL` again, edit `DATABASE_URL` in Vercel, and redeploy.
- **Signed in fails with "That email and password don't match":** check `OWNER_EMAIL` and `OWNER_PASSWORD` in Vercel. The account is created only on the first successful deploy, when the database is still empty.

## Part C: Tidy up and invite everyone

1. In Vercel: **Settings → Environment Variables** → delete **`OWNER_PASSWORD`**. It's only used once.
2. In the app: tap your initial (top right) → **Your password** → change it.
3. Still in that sheet, under **Settings**:
   - Enter Ezra's birthday.
   - Check the days and hours someone needs to be with him (it starts at weekdays, 8:00 am – 6:30 pm).
   - Tap **Save settings**.
4. Tap **Add someone**, once for each person:
   - **Mom:** Family
   - **Lauren:** Family
   - **Selina:** Caretaker (she can log Ezra's day and see everything, but can't change the schedule)
5. **Juju's House** is already on the schedule list. Add daycare hours from **Calendar → Caretakers → Add shift**.
6. Text each person:

   > Here's Ezra's app: https://ezras-day.vercel.app
   > Sign in with your email and this password: ______ (you can change it inside the app)
   > To keep it on your phone: iPhone, open the link in Safari, tap Share → Add to Home Screen. Android, open it in Chrome, tap ⋮ → Add to Home screen (or Install app).

   **On iPhone, sign in from the home-screen icon, not from Safari.** The home-screen app keeps its own sign-in. Once signed in, it stays signed in as long as it's opened at least once a year.

## Later

- **Forgotten password:** a family member taps their initial → taps that person → **Reset password**, then texts them the new one.
- **Updates:** every change pushed to `main` on GitHub goes live automatically within a couple of minutes, including any database updates.
- **Your data:** it's all in the Railway Postgres. Railway's **Data** tab on the Postgres box lets you browse it.
