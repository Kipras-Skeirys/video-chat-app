const { app } = require('../server')
const io = app.get('socketio')
const sessionService = require('./session')
const { inSessionCache, connectingCache } = require('../server')

// Send message to user
function send(user, message) {
    io.to(user).emit(message)
    // Add message to messages Databse
}

// Announce to all in room
module.exports.chatAnnounceAll = function (room, message) {
    io.in(room).emit('announcement', message)
}

// Announce to socket in room
module.exports.chatAnnounceTo = function (socket_id, message) {
    io.in(socket_id).emit('announcement', message)
}

// Create in_session socketIO
module.exports.createRoom = async function (u1, u2, inSession_id) {
    
    function matchEmit(user_id, user_socket_id, partner_id) {
        return new Promise((resolve, reject) => {
            io.to(user_socket_id).timeout(10000).emit('join-chat', (err, callback) => {
                if (err) {
                    reject({ uid_rejected: user_id, user_socket_id })
                } else {
                    if (callback.length && callback[0].status === 'ok') {
                        resolve()
                    } else {
                        reject({ uid_rejected: user_id, user_socket_id })
                    }
                }
            })
        })
    }

    const promise1 = matchEmit(u1.uid, u1.user_socket_id, u2.uid)
    const promise2 = matchEmit(u2.uid, u2.user_socket_id, u1.uid)
    Promise.all([promise1, promise2]).then(() => {
        io.in([u1.user_socket_id, u2.user_socket_id]).socketsJoin(inSession_id)
        this.chatAnnounceAll(inSession_id, 'You have successfully been matched with a partner')
    }, ({ uid_rejected, user_socket_id }) => {
        if (connectingCache.has(uid_rejected) || inSessionCache.has(inSession_id)) {
            sessionService.end(uid_rejected)
        }
        io.to(user_socket_id).emit('hard-reset')
    })
}

// Destroy in_session socketIO
module.exports.destroyRoom = function (inSession_id, ended_by) {
    io.socketsLeave(inSession_id)
}
