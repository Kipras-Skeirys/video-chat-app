import { io } from 'socket.io-client'

// Same origin as the page: the Express server in production mode, or the CRA dev server,
// which proxies Socket.IO (including WebSocket upgrades) to the backend - see "proxy" in package.json.
// closeOnBeforeunload: close the connection cleanly when the tab is closed or reloaded, so the server
// ends any search/chat immediately (default in socket.io-client 4.5, which the app was written against).
const socket = io({ closeOnBeforeunload: true })

socket.on("connect_error", (err) => {
    console.log(`[err] [socket.io] connect_error due to ${err.message}`)
})

export default socket
