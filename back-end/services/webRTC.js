const { app } = require('../server')
const io = app.get('socketio')

// How long two browsers get to reach RTCPeerConnection.connectionState === 'connected'
const CONNECT_TIMEOUT_MS = parseInt(process.env.WEBRTC_CONNECT_TIMEOUT_MS) || 20000


// webRTC connect two users
module.exports.connect = function (user_1, user_2) {
    return new Promise((promiseResolve, promiseReject) => {

        const u1_socket = io.sockets.sockets.get(user_1.user_socket_id)
        const u2_socket = io.sockets.sockets.get(user_2.user_socket_id)

        if (u1_socket && u2_socket) {
            // Offer/answer relay. The server never inspects or stores the SDP.
            u1_socket.emit('webRTC_initiate', (offer) => {
                u2_socket.emit('webRTC_offer', offer, (answer) => {
                    u1_socket.emit('webRTC_answer', answer, (callback) => {
                        if (callback !== 'ok') {
                            console.log(`[FAILURE] [webRTC.connect] [webRTC_answer callback] user_id: ${user_1.uid}`)
                            clearSockets()
                            promiseReject('webRTC_answer not accepted')
                        }
                    })
                })
            })

            const u1_iceCadidateListener = (iceCandidate) => {
                u2_socket.emit('webRTC_iceCadidate', iceCandidate)
            }

            const u2_iceCadidateListener = (iceCandidate) => {
                u1_socket.emit('webRTC_iceCadidate', iceCandidate)
    
            }

            u1_socket.on('webRTC_iceCadidate', u1_iceCadidateListener)
            u2_socket.on('webRTC_iceCadidate', u2_iceCadidateListener)

            let connectTimeoutID

            function clearSockets() {
                clearTimeout(connectTimeoutID)
                u1_socket.off('webRTC_iceCadidate', u1_iceCadidateListener)
                u2_socket.off('webRTC_iceCadidate', u2_iceCadidateListener)

                u1_socket.off('webRTC_connectionState', u1_connectionStateListener)
                u2_socket.off('webRTC_connectionState', u2_connectionStateListener)
            }

            function connectionStateHandler(connectionState, promiseResolve, promiseReject) {
                switch (connectionState) {
                    case 'new':
                        break
                    case 'connecting':
                        break
                    case 'connected':
                        return promiseResolve()
                    case 'disconnected':
                        return promiseReject('webRTC_connectionState: disconnected')
                    case 'failed':
                        return promiseReject('webRTC_connectionState: failed')
                    case 'closed':
                        return promiseReject('webRTC_connectionState: closed')
                    default:
                         console.log(`[ERROR] [webRTC_connectionState] [switch] connectionState not matched: ${connectionState}`)
                }
            }

            
            
            let u1_connectionStateListener
            let u2_connectionStateListener
            
            const promise1 = new Promise((promiseResolve, promiseReject) => {
                u1_connectionStateListener = (connectionState) => {
                    return connectionStateHandler(connectionState, promiseResolve, promiseReject)
                }
                u1_socket.on('webRTC_connectionState', u1_connectionStateListener)
            })
            const promise2 = new Promise((promiseResolve, promiseReject) => {
                u2_connectionStateListener = (connectionState) => {
                    return connectionStateHandler(connectionState, promiseResolve, promiseReject)
                }
                u2_socket.on('webRTC_connectionState', u2_connectionStateListener)
            })
            
            connectTimeoutID = setTimeout(() => {
                clearSockets()
                promiseReject(`webRTC connection timed out after ${CONNECT_TIMEOUT_MS}ms`)
            }, CONNECT_TIMEOUT_MS)

            Promise.all([promise1, promise2]).then(() => {
                clearSockets()
                promiseResolve()
            }, (err) => {
                clearSockets()
                promiseReject(err)
            })


        }else {
            console.log(`[ERROR] [webRTC.connect] [u1_socket or u2_socket undefined] u1_socket: ${u1_socket} | u2_socket: ${u2_socket}`)
            promiseReject('u1_socket or u2_socket undefined')
        }

    })
}

// webRTC close connection
module.exports.close = function (user_1_socket_id, user_2_socket_id) {
    const u1_socket = io.sockets.sockets.get(user_1_socket_id)
    const u2_socket = io.sockets.sockets.get(user_2_socket_id)
    if (u1_socket) u1_socket.emit('webRTC_PeerConnectionClose')
    if (u2_socket) u2_socket.emit('webRTC_PeerConnectionClose')
}