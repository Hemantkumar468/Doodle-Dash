# Draw & Guess

A mobile-first, real-time drawing and guessing game inspired by skribbl.io. A Node/Express/Socket.IO server owns every room and game decision; a React/Redux client renders the lobby, canvas, chat, scores, and device-scoped game history. MongoDB stores the reusable word list and completed-game records while active games stay in server memory for low-latency play.

**Live URL: TODO**

## Requirements

- Node.js 20 or newer and npm
- A local MongoDB instance or a MongoDB Atlas connection string
- Current Chrome, Edge, Firefox, or Safari

## Quick start

1. Install all three workspaces:

   ```bash
   npm run install:all
   ```

2. Create local environment files from the checked-in examples:

   ```powershell
   Copy-Item server/.env.example server/.env
   Copy-Item client/.env.example client/.env
   ```

   On macOS or Linux, use `cp` instead. Set `MONGODB_URI` in `server/.env`. The default ports already agree: the API uses `5000` and Vite uses `5173`.

3. Add the initial word list:

   ```bash
   npm run seed
   ```

4. Start both applications:

   ```bash
   npm run dev
   ```

5. Open <http://localhost:5173>. The API health endpoint is <http://localhost:5000/health>.

Do not commit either `.env` file. The app intentionally has no offline or fake-room mode: if MongoDB or the game server is unavailable, the Home screen reports that honestly.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Validate the local ports, then run client and server together |
| `npm run dev:lan` | Print the private-network URL, then run both applications |
| `npm test` | Run server integration/unit tests and client component/unit tests |
| `npm run build` | Validate the server and create the production client bundle |
| `npm run seed` | Upsert the bundled words into MongoDB |
| `npm run check:env` | Fail when `VITE_SERVER_URL` and `PORT` disagree |
| `npm run kill-ports` | Stop processes listening on development ports 5000 and 5173 |
| `npm run test:server` | Run only server tests |
| `npm run test:client` | Run only client tests |

Vite has `strictPort: true`, so it stops with a clear error instead of silently moving to another port.

## How to play

1. Enter a display name and choose an avatar.
2. Create a room, join a public room, enter a six-character code, or follow an invite link.
3. In the lobby, the host chooses the round, timer, word, hint, privacy, and custom-word settings. Other players can mark themselves ready.
4. The host starts once at least two players are present.
5. On your drawing turn, choose a word and draw with the brush, colors, sizes, eraser, undo, or clear controls. On other turns, type guesses in chat.
6. Correct guesses score more when made quickly. After every player has drawn in every round, the final leaderboard appears; players can open the saved game details and the host can start a new game.

Room membership is stored in `sessionStorage`, so each browser tab is a separate player. A long random `deviceId` in `localStorage` grants access to games played in that browser profile; it is separate from the tab's player session and is never returned in public socket or REST payloads. Refreshing a tab rejoins the same player and restores the timer, chat, scores, and canvas. Explicitly choosing Leave removes the player immediately; closing or refreshing uses a short reconnection grace period.

## Play over the same Wi-Fi

Run:

```bash
npm run dev:lan
```

The command prints a URL such as `http://192.168.1.24:5173`. Share that exact URL with devices on the same private Wi-Fi; no client environment edit is needed. The client derives the API hostname from the page hostname and uses port 5000.

On Windows, allow Node.js through Windows Defender Firewall on **Private networks** when prompted. If it was previously denied, open **Windows Security > Firewall & network protection > Allow an app through firewall**, enable Node.js for Private networks, and keep Public networks disabled. Some guest Wi-Fi networks isolate devices; use a normal private network or hotspot if phones cannot connect.

## Environment variables

The authoritative lists and defaults live in [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example).

Server settings include:

- `PORT` — HTTP and Socket.IO port; defaults to `5000`
- `MONGODB_URI` — MongoDB connection string (required)
- `CLIENT_URL` — comma-separated production client origins
- lobby, game, and drawer disconnect grace periods
- `HISTORY_RETENTION_DAYS` — days before MongoDB's TTL index removes completed games; defaults to `30`
- `HISTORY_STORE_STROKES` — set to `false` to retain scores and turns without replay drawings; defaults to `true`

The client accepts only `VITE_SERVER_URL`. Leave it blank during local or LAN development so the browser uses its current hostname with port 5000. Set it to the public API origin in production, with no path required. Trailing slashes are removed by the shared client config.

## Testing and manual verification

Run automated checks with:

```bash
npm test
npm run build
# With the local client and server running:
npm run test:history
```

For the final browser check, use three independent sessions (a normal window and two incognito profiles works) and make one viewport 360 x 800. Verify create, join by code, join by invite URL, word choice, drawing, wrong/close/correct guesses, refresh during a turn, canvas restoration, round end, game over, Play Again, and Leave. Open History in every session and verify its own rank, replay/PNG export, per-device delete, clear-all, and the empty state. The browser console should contain no React exceptions or repeated WebSocket failures.

## Deploy the server (Render or Railway)

Socket.IO needs a long-lived Node process and in-memory room ownership. Do **not** deploy this server as a Vercel serverless function: instances are ephemeral, requests may reach different instances, and persistent WebSocket connections are not a serverless guarantee.

1. Create a MongoDB Atlas cluster and a least-privilege database user.
2. Allow network access from the chosen host (or temporarily `0.0.0.0/0` only when paired with a strong rotated password).
3. Create a Render Web Service or Railway service from this repository.
4. Use `server` as the root directory, `npm install` as the build command, and `npm start` as the start command.
5. Set `MONGODB_URI`, `CLIENT_URL`, `NODE_ENV=production`, `HISTORY_RETENTION_DAYS`, `HISTORY_STORE_STROKES`, and the documented grace-period variables. Most platforms supply `PORT`; do not override it unless the platform says to.
6. Seed once using the provider shell or a one-off job: `npm run seed`.
7. Confirm `https://YOUR-SERVER/health` responds successfully before deploying the client.

After the first production start, verify that Atlas created the `createdAt` TTL index for the `gamehistories` collection. Monitor the Atlas storage limit, especially on the free tier. Drawing data is retained only when `HISTORY_STORE_STROKES=true`; changing the retention value later may require updating the existing TTL index in Atlas rather than only restarting the app.

Render's free services can sleep when idle, so the first connection may take a while and the Home screen can briefly show the server as offline. For a demo, use a paid always-on instance or an uptime monitor at a reasonable interval if the provider's terms allow it. Never create an aggressive self-ping loop.

This single-process, in-memory design is deliberately easy to understand. Horizontal scaling requires sticky sessions plus a shared Socket.IO adapter and external room/game storage; see [ARCHITECTURE.md](ARCHITECTURE.md).

## Deploy the client (Vercel)

1. Import the same repository and set the root directory to `client`.
2. Use the Vite defaults (`npm run build`, output directory `dist`).
3. Set `VITE_SERVER_URL=https://YOUR-SERVER` before building.
4. Deploy, then add the exact Vercel origin to the server's comma-separated `CLIENT_URL` and restart the server.
5. Test a direct visit to `/room/ABC123`; `vercel.json` rewrites client-side routes to `index.html`.

Production CORS accepts only configured origins. Preview deployment origins must be added explicitly or they will be rejected.

## Security notes

- Never commit `.env` files, Atlas connection strings, API keys, or copied production logs containing credentials.
- If a secret is ever pasted into chat, source control, an issue, or a screenshot, rotate it immediately; deleting the text does not make the old credential safe.
- Use a dedicated Atlas user with only the permissions this database needs and a unique password.
- Socket payloads are validated with zod, chat is length-limited/sanitized, guesses are rate-limited, and the server independently checks host and drawer permissions. These controls reduce abuse but are not a substitute for authentication or a production moderation system.
- History REST requests use `X-Device-Id`, are validated/rate-limited, and return private no-store responses. Deleting history revokes only that device's access while preserving the shared leaderboard for remaining players.

## Project layout

```text
.
├── client/                 React, Redux Toolkit, Vite, Tailwind, Canvas
├── server/                 Express, Socket.IO, Mongoose, game engine
├── scripts/                Environment and LAN helpers
├── package.json            Root orchestration commands
├── README.md               Setup, usage, LAN, and deployment
└── ARCHITECTURE.md         State, realtime flows, and design rationale
```

## What you must supply

The repository is deployment-ready but does not create third-party accounts. You must create the Atlas cluster, copy both example environment files locally, choose and rotate real credentials, set the environment variables on Render/Railway and Vercel, and monitor Atlas storage/TTL behavior. Update the **Live URL** line after deployment.
