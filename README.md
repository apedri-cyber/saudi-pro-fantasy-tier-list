# Saudi Pro Fantasy Tier List

React/Vite tier-list app for the Saudi Pro Fantasy 2026 league.

## Permanent roster

Alex · Tommy · CK · JP · Stephen · Fedgi · Matty B · Will · Enzo · Maria · Marco · A Smokes

## Shared database

This version uses Supabase. Ballots are stored in the shared `tier_ballots` table, so votes and community results are shared across devices.

Each manager has one ballot. Submitting again updates that manager's existing ballot.

## Run locally

```bash
npm install
npm run dev
```

The included `.env.local` points to the league's Supabase project. `.env.local` is ignored by Git so it will not be committed when we create the GitHub repository.

## Production

When we deploy to Vercel, add these environment variables in the Vercel project settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Architecture

GitHub → Vercel → Supabase
