require('dotenv').config()

const express = require('express')
const session = require('express-session')
const MemoryStore = require('memorystore')(session)
const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const { Server } = require('socket.io')
const cors = require('cors')
const path = require('path')
const LRU = require('lru-cache')
const mongoose = require('mongoose')

const { getIceCredentials, iceConfigSummary } = require('./api/turnAPI')


// Memory cache

    // Defaults are sized for a local demo; override with LRU_CACHE_OPTIONS_MAX / LRU_CACHE_OPTIONS_MAXSIZE.
    const cacheOptions = {
        max: parseInt(process.env.LRU_CACHE_OPTIONS_MAX) || 10000, // Max pairs
        maxSize: parseInt(process.env.LRU_CACHE_OPTIONS_MAXSIZE) || 5000000, // Max size in bytes
        ttl: 43200000, // 12hours
        sizeCalculation: (value, key) => {
            if (value) {
                return Buffer.byteLength(JSON.stringify(value) + JSON.stringify(key))
            } else {
                return Buffer.byteLength(JSON.stringify(key))
            }
        }
    }

    const searchingCache = module.exports.searchingCache = new LRU(cacheOptions)
    const inSessionCache = module.exports.inSessionCache = new LRU(cacheOptions)
    const usersCache = module.exports.usersCache = new LRU(cacheOptions)
    // Counts how often the same two users were matched (see MAX_REPEAT_MATCHES)
    const skipHistoryCache = module.exports.skipHistoryCache = new LRU(cacheOptions)

    cacheOptions.ttl = 30000 // 30seconds
    const connectingCache = module.exports.connectingCache = new LRU(cacheOptions)



// - - - - //


const app = module.exports.app = express()

// The front-end is served from this origin (or proxied to it by the CRA dev server),
// so cross-origin access is only enabled when explicitly configured.
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
if (corsOrigins.length) {
    app.use(cors({ origin: corsOrigins }))
}
app.use(express.json({ limit: '10kb' }))

if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY)
}

// Return static front-end build
const buildPath = path.join(__dirname, '..', 'build')
app.use(express.static(buildPath))


const server = http.createServer(app)


// Express-session

    const expressSessionAge = 86400000 // 24hours

    let sessionSecret = process.env.SESSION_SECRET
    if (!sessionSecret) {
        sessionSecret = crypto.randomBytes(32).toString('hex')
        console.log('[NOTICE] SESSION_SECRET not set - using a random per-process secret (sessions reset on restart)')
    } else if (sessionSecret === 'replace-with-a-long-random-string') {
        console.log('[WARN] SESSION_SECRET is still the .env.example placeholder - fine for a local demo, never for a shared deployment')
    }

    const sessionStore = module.exports.sessionStore = new MemoryStore({
        checkPeriod: expressSessionAge
    })

    const sessionMiddleware = session({
        name: 'video-chat-app.sid',
        secret: sessionSecret,
        cookie: { maxAge: expressSessionAge, httpOnly: true, sameSite: 'lax' },
        saveUninitialized: true, // false
        resave: false, // false
        store: sessionStore
    })

    app.use(sessionMiddleware)

// - - - - //



// SOCKET IO //

    const io = new Server(server, {
        allowRequest: (req, callback) => {
            const fakeRes = {
            getHeader() {
                return []
            },
            setHeader(key, values) {
                req.cookieHolder = values[0]
            },
            writeHead() {},
            };
            sessionMiddleware(req, fakeRes, () => {
            if (req.session) {
                fakeRes.writeHead()
                req.session.save()
            }
                callback(null, true)
            })
        },
        cors: corsOrigins.length ? { origin: corsOrigins, methods: ['GET', 'POST'] } : undefined
    })

    io.engine.on("initial_headers", (headers, req) => {
        if (req.cookieHolder) {
        headers["set-cookie"] = req.cookieHolder;
        delete req.cookieHolder;
        }
    })

    app.set('socketio', io)

    const sessionService = require('./services/session')
    const searchingService = require('./services/searching')

    // Connection count - the number of open Socket.IO connections (browser tabs),
    // not unique people. Broadcast whenever it changes.
    function countConnectedSessions() {
        return io.engine.clientsCount
    }

    function broadcastConnectedSessions() {
        io.emit('connectedSessionsUpdate', countConnectedSessions())
    }



    io.on('connection', async (socket) => {

        // Save socket.id to Express Session
        socket.request.session.reload((err) => {
            if (err) {
                console.log(`[ERR] [socketIO] [on.connection] [socket.request.session.reload] error: ${err}`)
                return socket.disconnect()
            }

            // One active socket per browser session: a second tab sharing the same session cookie
            // would otherwise overwrite user_socket_id and mix up both tabs. The newest tab wins.
            const previousSocketId = socket.request.session.user_socket_id
            if (previousSocketId && previousSocketId !== socket.id) {
                const previousSocket = io.sockets.sockets.get(previousSocketId)
                if (previousSocket) {
                    previousSocket.emit('session-replaced')
                    previousSocket.disconnect(true)
                }
            }

            socket.request.session.user_socket_id = socket.id
            socket.request.session.save()
        })

        broadcastConnectedSessions()
        socket.on('getConnectedSessionsUpdate', (callback) => {
            if (typeof callback === 'function') callback(countConnectedSessions())
        })


        // WebRTC Signaling
        socket.on('webRTC_getIceCredentials', async (callback) => {
            if (typeof callback !== 'function') return
            try {
                const iceCredentials = await getIceCredentials(socket.request.headers)
                callback(iceCredentials)
            } catch (e) {
                console.log(`[ERR] [turnAPI.getIceCredentials] error: ${e}`)
                callback({ iceServers: [], iceTransportPolicy: 'all' })
            }
        })


        // Update user_socket_id to cache
        if (socket.request.session.uid) {
            try {
                const obj = usersCache.get(socket.request.session.uid)
                if (obj && obj.user_socket_id !== socket.id) {
                    obj.user_socket_id = socket.id
                    usersCache.set(socket.request.session.uid, obj)
                }
            } catch(err) {
                console.log(`[ERROR] [io.on.connection] [update user_socket_id]: uid: ${socket.request.session.uid} | user_socket_id: ${socket.id} | err: ${err}`)
            }
        }

        const MAX_MESSAGE_LENGTH = 2000

        socket.on('message', (message) => {
            if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) return
            let rooms = Array.from(socket.rooms)
            if (rooms.length <= 2) {
                socket.to(rooms.pop()).emit('message', message)
            } else {
                socket.to(rooms.pop()).emit('message', message)
                console.log(`[ERR] [socket.connection] [on.message] [To many rooms] socket_id: ${socket.id}`)
            }
        })

        socket.on('typing', () => {
            let rooms = Array.from(socket.rooms)
            if (rooms.length <= 2) {
                socket.to(rooms.pop()).emit('typing')
            } else {
                socket.to(rooms.pop()).emit('typing')
                console.log(`[ERR] [socket.connection] [on.typing] [To many rooms] socket_id: ${socket.id}`)
            }
        })


        // On disconnect
        socket.on('disconnect', () => {

            broadcastConnectedSessions()

            usersCache.find((value) => {
                if (value.user_session_id === socket.request.session.id) {

                    const user = value

                    // Remove from searching
                    if (searchingCache.has(user.uid)) {
                        searchingService.remove(user.uid, 'disconnect')
                    }

                    // Remove from connecting
                    if (connectingCache.has(user.uid)) {
                        sessionService.end(value.uid)
                    }


                    // Session disconnect
                    inSessionCache.find((value, key) => {
                        if ([value.uid1, value.uid2].includes(user.uid)) {
                            value.uid1 === user.uid ? sessionService.end(value.uid1) : sessionService.end(value.uid2)
                            return
                        }
                    })

                    return

                }
            })
        })
    })

// - - - - //


// Routes //

    const sessionSetupRoute = require('./routes/sessionSetup')
    const searchingRoute = require('./routes/searching')
    const sessionRoute = require('./routes/inSession')

    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            connectedSessions: countConnectedSessions()
        })
    })

    app.use('/api/session-settings', sessionSetupRoute)
    app.use('/api/searching', searchingRoute)
    app.use('/api/inSession', sessionRoute)

    // Unknown API routes return JSON instead of the SPA
    app.use('/api', (req, res) => {
        res.status(404).json({ error: 'Not found' })
    })

// - - - - //


// On load/reload serve the SPA
app.use('/*',  (req, res) => {
    const indexFile = path.join(buildPath, 'index.html')
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile)
    } else {
        res.status(404).type('text').send('Front-end build not found. Run "npm run build" first, or use the dev server ("npm run front-end", http://localhost:3000).')
    }
})


// MongoDB is optional - it only stores matchmaking/session activity logs.
// If it isn't reachable, the app still runs and activity logging is switched off.
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017'
const mongoDb = process.env.MONGO_DB || 'video_chat_app'

function redactMongoUri(uri) {
    return uri.replace(/\/\/[^@/]*@/, '//<credentials>@')
}

mongoose.set("strictQuery", false)

mongoose.connect(mongoUri, {
        dbName: mongoDb,
        serverSelectionTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS) || 5000
    })
    .then(() => {
        console.log(`[NOTICE] MongoDB: ${redactMongoUri(mongoUri)} (db: ${mongoDb}) - activity logging is on`)
        mongoose.connection.on('disconnected', () => console.log('[WARN] [mongoose] MongoDB connection lost - activity logs are not being written'))
        mongoose.connection.on('reconnected', () => console.log('[NOTICE] [mongoose] MongoDB reconnected'))
    })
    .catch(() => {
        // Fail log writes immediately instead of queueing them in memory
        mongoose.set('bufferCommands', false)
        console.log(`[NOTICE] MongoDB not reachable at ${redactMongoUri(mongoUri)} - running without activity logging.`)
        console.log('         The app works normally. To record logs, start MongoDB and restart the server.')
    })

const port = parseInt(process.env.PORT) || 8000
const host = process.env.HOST || '127.0.0.1'
server.listen(port, host, () => {
    console.log(`App is listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)
    console.log(`[NOTICE] ICE: ${iceConfigSummary()}`)
})
server.on('error', (err) => {
    console.error(`[FATAL] Could not start HTTP server on ${host}:${port}: ${err.message}`)
    process.exit(1)
})
