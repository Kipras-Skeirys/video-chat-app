# video-chat-app

A one-to-one video chat application with preference-based matchmaking, live video and audio, and text messaging. Users choose their interests, connect with another participant, and move on to a new conversation whenever they want.

I independently designed and developed in the second half of 2022 and deployed the original application, which was live from February 2023 to October 2024

According to Google Analytics, the application averaged approximately 1,500 daily users and reached a peak of approximately 65,000 monthly active users. Supporting analytics reports are available upon request.

This repository is a locally runnable portfolio edition adapted from that project.

## Background and my role

I started developing this project in the second half of 2022, building on my existing HTML, CSS and JavaScript knowledge. React and Node.js were new to me: I spent approximately two months learning React before starting the application and learned Node.js as part of developing the backend.

**As the sole designer and developer of the original application, I was responsible for:**

- **UI/UX and visual design:** designing the interface and user flows, from initial setup through matching, chatting and moving to the next conversation.
- **Frontend development:** building the React interface, client-side session handling, media controls and real-time interactions.
- **Backend development:** implementing the Node.js/Express server, matchmaking, Socket.IO signalling, text chat and MongoDB activity logging.
- **Deployment and infrastructure:** deploying the application and configuring Linux VPS instances, HTTPS certificates and TURN servers across multiple geographic regions.
- **Operation and maintenance:** running the live service and troubleshooting application and connectivity issues.

The project gave me practical experience taking an application from an initial idea through deployment and operation with real users.

The original application was my independent work. The October 2026 portfolio preparation used Claude Code to help clean up the repository, make it runnable locally and address selected reliability issues, as outlined below. The original production repository is available for review upon request.

## Features

- Preference-based matchmaking between real, connected participants. Each user picks their matching preferences. Nobody is ever matched with themselves, with a second tab of the same browser session, or with someone who is already connecting or in a chat.
- Peer-to-peer WebRTC audio/video, with offer/answer/ICE signalling over Socket.IO.
- Text chat with typing indicator. Messages are relayed through the server and never stored.
- Skip / next match, pause / resume searching, mute and camera switching.
- Clean-up when a participant disconnects, closes the tab or stalls mid-connection. The partner is told, and stale searchers are never matched.
- A "Connected sessions" counter that shows open real-time connections (socket.io connections).
- Static local placeholders where the original showed ads: a skippable 5-second **video ad placeholder** between chats and a **banner ad placeholder** above the chat (details below).
- Optional STUN/TURN integration (static servers, regional coturn with short-lived credentials, or Xirsys). It's off by default.

## Stack and architecture

| Part | Technology |
| --- | --- |
| Front-end | React 18 (Create React App 5 via `react-app-rewired`), React Router 6, Sass, `socket.io-client`, `webrtc-adapter` |
| Back-end | Node.js, Express 4, `express-session` (in-memory store), Socket.IO 4 |
| State | In-memory LRU caches: users, searching, connecting, in-session, repeat-match history |
| Database | MongoDB via Mongoose 6, **optional**. Used only for activity logs (searches, connection attempts, sessions with random IDs and chosen interests; no IP addresses or chat content) |

```
 Browser A                        Express + Socket.IO server                    Browser B
 ─────────                        ──────────────────────────                    ─────────
 POST /api/session-settings ───▶  validate interests, create user
 GET  /api/searching        ───▶  searchingCache ─ findMatch() ─▶ session.start(A, B)
                            ◀───  match-found ───────────────────────────────▶  match-found
                                  webRTC_getIceCredentials  (local: iceServers: [])
 webRTC_initiate → offer    ───▶  relay offer ───────────────────────────────▶  answer
                            ◀───  relay answer / ICE candidates ◀────────────▶
                                  both report connectionState "connected"
                            ◀───  join-chat (Socket.IO room) ────────────────▶
 chat messages / typing     ◀──▶  relayed within the room only  ◀───────────▶

 ══════════════ audio + video: direct RTCPeerConnection (DTLS-SRTP), not via the server ══════════════
```

- **Matchmaking and signalling** (`back-end/services/searching.js`, `session.js`, `webRTC.js`, `chat.js`) always go through the server. The server pairs users, relays SDP and ICE candidates without inspecting them, and opens a chat room once both browsers report `connected`. If the connection doesn't come up within `WEBRTC_CONNECT_TIMEOUT_MS`, both users go back to searching with an explanation.
- **Media transport** is peer-to-peer WebRTC. With the default local ICE configuration the browsers only use host candidates. That's enough for two browser sessions on one machine, or usually two devices on the same LAN. Across the internet, a TURN relay is often required (see [Optional STUN/TURN](#optional-stunturn)).
- The session flow on the client is a single state machine in `front-end/src/session/Session.js`: `searching → connecting → in_session → post_session`, with `ad` and `searching_paused` as additional states.

## Requirements

- **Node.js 22 LTS** - see `.nvmrc`.
- **MongoDB** 6+ is **optional** (see [MongoDB (optional)](#mongodb-optional)).
- A browser with WebRTC support (current Chrome, Firefox, Safari or Edge) and a camera and microphone. A fake device works too (see below).

## Run it locally

Only Node.js 22 or newer is needed.

```bash
npm ci          # install the exact versions pinned in package-lock.json
npm run build   # build the React app into ./build
npm start       # serve the app + API on http://localhost:8000
```

Then open `http://localhost:8000` and follow [Two-client test](#two-client-test). All settings have working defaults. To change any, copy `.env.example` to `.env` (see [Configuration](#configuration)).

### MongoDB (optional)

MongoDB only stores activity logs (searches, connection attempts and sessions). Matchmaking, video and chat don't use it. If no database is reachable at `MONGO_URI` (default `mongodb://127.0.0.1:27017`), the server starts anyway, prints a notice and doesn't record logs.

To record logs, start MongoDB 6+ before the server. Any installation works, or with Docker: `npm run mongo:up` (stop with `npm run mongo:down`). If MongoDB starts after the server, restart the server.

> **Change from the original:** the original server only started listening after it had connected to MongoDB, so without a database the app never started. To make the demo runnable with Node.js alone, the server now starts straight away. If MongoDB isn't reachable, activity logging is switched off and log-write errors aren't printed. See `back-end/server.js` and the `logError` helpers in `back-end/services/searching.js` and `session.js`.

**Development mode** (hot reload), in two terminals:

```bash
npm run back-end             # API/Socket.IO on :8000, restarts on back-end changes
npm run front-end            # CRA dev server on http://localhost:3000, proxies /api + Socket.IO to :8000
```

## Two-client test

Each participant needs an **independent browser session**: a second browser, a separate browser profile, or a private/incognito window. Two tabs in the same window share one session cookie. The newest tab takes over and the older one shows a notice saying so.

1. Open `http://localhost:8000` in session A. Click **Get started**, then **Request Camera Access** and allow it, then **Start Matching**. A waits; after a few seconds it explains that matches only happen between real participants.
2. Open `http://localhost:8000` in session B and do the same. Both are matched, and the remote video and audio start. "Connected sessions" shows 2.
3. Send a few chat messages both ways.
4. After more than 10 seconds, end the chat in A (**Disconnect → Yes**). B sees the **mock ad**. Press **Skip ad** in B, and B goes to the post-chat screen.
5. In A press **Next Match**. A sees the mock ad and it finishes on its own after 5 seconds, then A searches.
6. In B press **Next Match**. No ad this time (one was just shown), and A and B are matched again.
7. Close session B's tab. A is told that the partner ended the session, and the counter drops to 1.

To use **fake media**, launch Chromium/Chrome with `--use-fake-device-for-media-stream` (a synthetic camera and tone), and optionally `--use-fake-ui-for-media-stream` to auto-accept the permission prompt. Firefox has `media.navigator.streams.fake = true` in `about:config`.

**Two devices on a LAN:** browsers only allow camera access on `https://` or `http://localhost`. One way to do this:

```bash
npm run back-end                       # backend stays on 127.0.0.1:8000
HTTPS=true npm run front-end           # dev server with a self-signed certificate on https://<your-LAN-IP>:3000
```

Open `https://<your-LAN-IP>:3000` on both devices and accept the certificate warning. The dev server proxies the API and WebSockets to the backend. If the devices can't reach each other directly (client isolation, VPN, separate networks), you'll need TURN.

## Linting

```bash
npm run lint           # ESLint (react-app config)
```

## Configuration

All settings are optional environment variables, read from `.env` (see `.env.example`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `HOST` | `8000` / `127.0.0.1` | Where the server listens. Use `HOST=0.0.0.0` to accept other devices. |
| `SESSION_SECRET` | random per process | Signs the session cookie. Set a long random value for anything beyond a local run. |
| `MONGO_URI` / `MONGO_DB` | `mongodb://127.0.0.1:27017` / `video_chat_app` | Optional activity-log database (see [MongoDB (optional)](#mongodb-optional)) |
| `CORS_ORIGINS` | *(empty: same origin only)* | Comma-separated origins allowed to call the API/Socket.IO cross-origin |
| `TRUST_PROXY` | *(off)* | Express `trust proxy`, only when behind a reverse proxy |
| `MAX_REPEAT_MATCHES` | `0` (unlimited) | How often the same two users may be matched within 12 h. The original used 2. |
| `WEBRTC_CONNECT_TIMEOUT_MS` | `20000` | Time for both peers to reach `connected` before they return to searching |
| `LRU_CACHE_OPTIONS_MAX` / `LRU_CACHE_OPTIONS_MAXSIZE` | `10000` / `5000000` | In-memory cache limits |
| `ICE_*`, `TURN_*`, `XIRSYS_*` | `ICE_MODE=local` | See below |
| `REACT_APP_MOCK_AD_INTERVAL_MS` | `30000` | Minimum time between mock ads. Build-time setting, so rebuild after changing it. |

### Optional STUN/TURN

By default the server hands every browser `{ iceServers: [], iceTransportPolicy: "all" }`. No STUN or TURN server is contacted, public or otherwise. Missing or invalid ICE settings never stop the server. They're logged, and it falls back to local mode. The active mode is printed at startup.

| `ICE_MODE` | What the browser receives |
| --- | --- |
| `local` (default) | `iceServers: []` |
| `static` | `ICE_SERVERS_JSON` as-is, e.g. `[{"urls":"stun:stun.example.invalid:3478"}]`. Anything in it, including static TURN credentials, is visible to browsers. |
| `turn-rest` | STUN/TURN URLs for the regions in `ICE_REGIONS_FILE`/`ICE_REGIONS_JSON` nearest to the client, plus a short-lived username/credential derived with HMAC-SHA1 from `TURN_SECRET` (coturn `use-auth-secret` / "TURN REST API"). **The shared secret stays on the server.** |
| `xirsys` | Credentials fetched server-side from the Xirsys API with `XIRSYS_IDENT`/`XIRSYS_SECRET`/`XIRSYS_CHANNEL` |

- Regional selection (kept from the original) reads a country code from `ICE_COUNTRY_HEADER` (default `cf-ipcountry`, set by Cloudflare). It sorts regions by distance from that country's centroid and offers the nearest `ICE_REGION_COUNT`. Without a known country it offers all regions. Outside such a proxy the header is client-controlled, but it only affects which of your servers are listed.
- `config/ice-regions.example.json` shows the format. Its hostnames use the reserved `.invalid` domain and **don't work**. Copy it to `config/ice-regions.json` (git-ignored) and replace them with your own servers.
- `ICE_TRANSPORT_POLICY=relay` forces all media through TURN. It has to be set explicitly, and it's ignored in local mode, where it would leave no usable candidates.
- Browsers behind symmetric NATs, corporate firewalls or some mobile networks often can't connect directly. TURN fixes that, but the local demo doesn't guarantee connectivity between arbitrary internet hosts. Relay connectivity was **not** tested during this preparation because no TURN server was available.

Example `turn-rest` setup with your own coturn (`static-auth-secret` = `TURN_SECRET`):

```bash
ICE_MODE=turn-rest
ICE_REGIONS_FILE=./config/ice-regions.json
TURN_SECRET=<your coturn static-auth-secret>
```

## Mock advertisement

The original application included third-party advertising. This demo replaces those integrations with local placeholders that make no external requests and perform no tracking.

Video placeholder: a five-second screen displayed at selected transitions between conversations, with an immediately available Skip button.

Banner placeholder: a static banner above the desktop chat interface. Set `REACT_APP_CHAT_AD_ENABLED=false` to hide it.

The video placeholder interval is controlled by `REACT_APP_MOCK_AD_INTERVAL_MS`. Users remain outside the matchmaking queue while it is displayed.

## Known limitations

- All matchmaking state is in memory: one server process, and a restart drops current searches and sessions. Express sessions use an in-memory store.
- Two tabs of the same browser session can't be two participants (the newer tab takes over).
- With the default local ICE mode, only same-machine or same-network peers can be expected to connect. Internet-wide use needs TURN, which is not available for this local demo.
- Without MongoDB nothing is logged. A MongoDB started after the server is only picked up after a server restart.
- Some legacy code patterns remain (ESLint reports warnings but no errors, mostly React hook dependency lists).
- Dependencies are the versions pinned by the original lockfile, minus the removed packages. The exception is network-facing runtime packages (Express, express-session, Socket.IO server/client, Mongoose/MongoDB driver, React Router, proxy-addr): their lockfile entries were moved to patched releases *within the semver ranges `package.json` already declared*, to pick up security fixes. No major versions changed. `npm audit` still reports advisories, mostly in the Create React App 5 build toolchain, which would need a migration away from CRA to fix. Two runtime findings were left because they need major upgrades and don't affect how this app uses the packages: the React Router open-redirect (the app only navigates to fixed internal paths) and `uuid` v3/v5/v6 buffer handling (the app only uses v4).

## About this portfolio edition

This portfolio edition was prepared in October 2026 from the original production repository of my application, which operated during 2023–2024. It preserves the overall architecture and much of the original coding style while adapting the project for local demonstration.

**The preparation included:**

- Replacing the original branding and adult-oriented content with a neutral, interest-based presentation.
- Removing third-party advertising, analytics, monitoring integrations and production-specific configuration.
- Making MongoDB optional and STUN/TURN services configurable.
- Replacing advertisements with local placeholders and removing IP addresses from activity logs.
- Applying selected matchmaking and signalling fixes, updating some dependencies within their existing version ranges, and adding local setup documentation.

These changes were made using Claude Code. The repository demonstrates the original project with subsequent adaptations. It is not an unchanged archive of the production application. The original production repository is available for review upon request.

Production infrastructure is not included.