<div align="center">

> This is a locally runnable portfolio refactor from a 2024 private production repo.<br>
Branding and marketing material scrubbed and replaced with a neutral theme.

# video-chat-app

A peer-to-peer random video chat React web app<br>
Match with random users based on selected preferences

![Node.js 22](https://img.shields.io/badge/Node.js-22_LTS-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Express 4](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)
![Socket.IO 4](https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socketdotio&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-peer--to--peer-333333?style=flat-square&logo=webrtc&logoColor=white)
![MongoDB optional](https://img.shields.io/badge/MongoDB-optional-47A248?style=flat-square&logo=mongodb&logoColor=white)

</div>

<p align="center">
  <img src="docs/images/demo.gif" alt="Two browser windows matching and starting a video chat with the test camera" width="800">
</p>

## UI/UX design

Designed and built from scratch, with no UI frameworks or component libraries. The layout works on desktop, mobile and everything in between.

## Tech stack

### Front-end
- **React**: *created using CRA (Create React App) as that was the recommended way to start a React SPA by documentation at the time*
- **WebRTC**: *used for real-time peer-to-peer video and audio communication*
- **`socket.io-client`**: *used as signalling for WebRTC, chat and the online user count*
- **`react-router-dom`**: *to control navigation URL without reloading the page*


### Back-end
- **Node.js**: *as the runtime*
- **Express**: *framework for HTTP server and API routing*
- **`express-session`**: *to create and save client session data between requests*
- **`socket.io`**: *relays WebRTC signalling and chat between matched users, and tracks connected sessions*
- **`lru-cache`**: *in-memory state for users, matchmaking and sessions*
- **Mongoose**: *library for MongoDB*

### Database
- **MongoDB**: *for logging matching activity. No IP addresses or chat content are logged*

### TURN servers
- **[Coturn](https://github.com/coturn/coturn)**: *deployed on a VPS for WebRTC connections that are blocked by NAT and require a relay (TURN) server*


## How it works

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant A as Browser A
    participant S as Server
    participant B as Browser B

    Note over A,B: Matchmaking
    A->>S: HTTP POST · /api/session-settings
    B->>S: HTTP POST · /api/session-settings
    Note over S: validateData() → validateUser()
    A->>S: HTTP GET · /api/searching
    B->>S: HTTP GET · /api/searching
    Note over S: findMatch() → session.start(A, B)
    S->>A: Socket.IO emit · match-found
    S->>B: Socket.IO emit · match-found
    A->>S: Socket.IO emit · webRTC_getIceCredentials
    B->>S: Socket.IO emit · webRTC_getIceCredentials
    Note over S: getIceCredentials()
    S-->>A: Socket.IO ack · webRTC_getIceCredentials
    S-->>B: Socket.IO ack · webRTC_getIceCredentials
    A-->>S: Socket.IO ack · match-found
    B-->>S: Socket.IO ack · match-found

    Note over A,B: WebRTC signalling
    Note over S: webRTC.connect(A, B)
    S->>A: Socket.IO emit · webRTC_initiate
    A-->>S: Socket.IO ack · webRTC_initiate
    S->>B: Socket.IO emit · webRTC_offer (relayed)
    B-->>S: Socket.IO ack · webRTC_offer
    S->>A: Socket.IO emit · webRTC_answer (relayed)
    A->>S: Socket.IO emit · webRTC_iceCadidate
    S->>B: Socket.IO emit · webRTC_iceCadidate (relayed)
    B->>S: Socket.IO emit · webRTC_iceCadidate
    S->>A: Socket.IO emit · webRTC_iceCadidate (relayed)
    A->>S: Socket.IO emit · webRTC_connectionState
    B->>S: Socket.IO emit · webRTC_connectionState

    Note over A,B: Text chat (private room)
    Note over S: chat.createRoom(A, B)
    S->>A: Socket.IO emit · join-chat
    S->>B: Socket.IO emit · join-chat
    A<<->>S: Socket.IO emit · message / typing
    S<<->>B: Socket.IO emit · message / typing

    Note over A,B: Media (peer-to-peer, not via the server)
    A<<->>B: WebRTC · audio + video
```

### Matchmaking
- `POST /api/session-settings`: *creates user and saves selected preferences to user session*
- `GET /api/searching`: *adds user to the search queue*
- `match-found`: *notifies both browsers that a match has been found*
- `webRTC_getIceCredentials`: *getting STUN/TURN config. Each browser prepares an `RTCPeerConnection`*
- `match-found` (ack): *each browser confirms within 10s, otherwise the match is cancelled. Once both confirm, they leave the search queue*

### WebRTC signalling
- `webRTC_initiate`, `webRTC_offer` and `webRTC_answer`: *SDP exchange*
- `webRTC_iceCadidate`: *network candidates passed through the server so the browsers can find a route to each other*
- `webRTC_connectionState`: *once both browsers report `connected`, the session starts. If that doesn't happen within 20s, both go back to searching*

### Text chat
- `join-chat`: *both users confirm, then the server puts their sockets in a private room*
- `message` / `typing`: *relayed only to the other user in the room. Messages are not stored*

### Media
- *Audio and video go directly between the browsers over `RTCPeerConnection`. If NAT blocks a direct connection, a TURN server relays the media*

## Run it locally

Requires **Node.js 22+**

```bash
git clone https://github.com/Kipras-Skeirys/video-chat-app.git
cd video-chat-app
```

```bash
npm ci          # install dependency versions from package-lock.json
npm run build   # build the React front end into ./build
npm start       # serve the app and API on http://localhost:8000
```

Open `http://localhost:8000` in two separate browser **sessions**, for example a normal window and a private window. Two tabs in the same window share a session, so the newer tab takes over.


All settings have working defaults. To change any, copy `.env.example` to `.env`.


<details>
<summary>Development mode</summary>

Hot reload, in two terminals:

```bash
npm run back-end    # API + Socket.IO on :8000
npm run front-end   # dev server on http://localhost:3000
```

</details>

<details>
<summary>Two devices on a LAN</summary>

Browsers only allow camera access on `https://` or `http://localhost`. Run these in two terminals:

**Terminal 1:**

```bash
npm run back-end               # API + Socket.IO on :8000
```

**Terminal 2:**

```bash
HTTPS=true npm run front-end   # HTTPS dev server on https://<your-LAN-IP>:3000
```

Open `https://<your-LAN-IP>:3000` on both devices and accept the certificate warning. If the devices can't reach each other directly, you'll need TURN.

</details>
