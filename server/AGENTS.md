# server/ rules
- `MEDIA_ROOT` is resolved to an absolute path once in `config.ts`; production refuses a folder inside the deploy directory and checks it is writable at start — GitHub redeploys replace the app folder.
- Google sign-in reads `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`/`GOOGLE_REDIRECT_URL`, and `AUTH_SECRET` signs the flow cookie — names the owner configures on Hostinger.
