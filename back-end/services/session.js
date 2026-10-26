const status = require('./status')
const chat = require('./chat')
const searching = require('./searching')
const { usersCache, inSessionCache, connectingCache } = require('../server')
const webRTC = require('./webRTC')
const { v4: uuidv4 } = require('uuid')
const { app } = require('../server')
const io = app.get('socketio')
const Connecting_log = require('../models/connecting_log')
const In_session_log = require('../models/in_session_log')
const mongoose = require('mongoose')

// Log write errors are only reported while MongoDB is connected (it is optional)
function logError(err) { if (err && mongoose.connection.readyState === 1) { console.log(err) } }


module.exports.start = function (uid1, uid2) {

    const sid = uuidv4()
    let sessionStartPromiseReject
    // Set once the start has failed or been cancelled, so late acknowledgements are ignored
    let startFailed = false

    const start_time = Date.now()
    const Connecting_log_promise = Connecting_log.create({
        status: 'connecting',
        sid,
        start_time
    }).catch(logError)

    const u1 = usersCache.get(uid1)
    const u2 = usersCache.get(uid2)

    function matchFoundEmit(callback) {

        function matchEmit(user_id, user_socket_id, partner_id) {
            return new Promise((resovle, reject) => {
                io.to(user_socket_id).timeout(10000).emit('match-found', { partner_id, user_id }, (err, callback) => {
                    if (err) {
                        console.log(`[searching.start] [match-found] [err] User: ${user_id} | user_socket_id: ${user_socket_id} | Error: ${err}`)
                        reject(user_id)
                    } else {
                        if (callback.length && callback[0].status === 'ok') {
                            resovle()
                        } else {
                            console.log(`[session.start] [match-found] [callback.status !== 'ok'] User: ${user_id} | user_socket_id: ${user_socket_id}`)
                            reject(user_id)
                        }
                    }
                })
            })
        }

        const promise1 = matchEmit(u1.uid, u1.user_socket_id, u2.uid)
        const promise2 = matchEmit(u2.uid, u2.user_socket_id, u1.uid)
        Promise.all([promise1, promise2]).then(() => {

            if (startFailed) return

            // Both users are ready to start connect
            searching.remove(u1.uid, 'match_found')
            searching.remove(u2.uid, 'match_found')
            return callback()

        }, (uid_rejected) => {
            if (startFailed) return
            console.log(`[FAILURE] [searching.findMatch] [emit('match-found)] uid_rejected: ${uid_rejected}`)
            failStart({
                err: `[FAILED] [session.start] [match-found not acknowledged] uid: ${uid_rejected}`,
                failCode: 4,
                uid: uid_rejected
            })
        })

    }

    const sessionStartPromise = new Promise((promiseResolve, promiseReject) => {

        sessionStartPromiseReject = promiseReject

        if (!u1 || !u2) {
            return promiseReject({
                err: `[FAILED] [session.start] user not found: u1: ${Boolean(u1)} | u2: ${Boolean(u2)}`,
                failCode: 1
            })
        }

        matchFoundEmit(() => {
            webRTC.connect(u1, u2).then(() => {
                // Connected
                promiseResolve()
            }).catch((err) => {
                // Promise rejected / Error
                promiseReject({
                    err: `[FAILED] [session.start] [webRTC.connect] err: ${err}`,
                    failCode: 2
                })
            })

        })


    })

    function failStart(data) {
        startFailed = true
        sessionStartPromiseReject(data)
    }

    function connectingFail() {
        connectingCache.delete(uid1)
        connectingCache.delete(uid2)
        const end_time = Date.now()
        Connecting_log_promise.then(() => {
            Connecting_log.findOneAndUpdate( { sid } , { status: 'failed', end_time }, logError)
        })
    }

    sessionStartPromise.then(() => {

        // On success
        inSessionCache.set(sid, {
            sid,
            uid1,
            uid2,
            start_time: Date.now()
        })

        status.in_session(uid1)
        status.in_session(uid2)
        chat.createRoom(u1, u2, sid)
        connectingCache.delete(uid1)
        connectingCache.delete(uid2)

        const end_time = Date.now()

        Connecting_log_promise.then(() => {
            Connecting_log.findOneAndUpdate( { sid } , { status: 'successful', end_time }, logError)
        })

        In_session_log.create({
            sid,
            users: {
                u1: {
                    uid: u1.uid,
                    matching_pref: u1.matching_pref
                },
                u2: {
                    uid: u2.uid,
                    matching_pref: u2.matching_pref
                }
            },
            start_time: end_time,
        }).catch(logError)

    }, (data) => {
        // On fail
        startFailed = true

        // failCode 1 - connecting with user that doesn't exists
        // failCode 2 - failed to establish webRTC connection. Reseting search for both users
        // failCode 3 - user canceled connection. Reseting search for other user
        // failCode 4 - a user did not acknowledge the match. Reset that user, return the other to searching
        console.log(data.err)
        connectingFail()
        switch (data.failCode){
            case 1:
                if (u1) searching.remove(u1.uid, 'error')
                if (u2) searching.remove(u2.uid, 'error')
                if (u1) io.to(u1.user_socket_id).emit('searching-reset', { reason: 'partner-unavailable' })
                if (u2) io.to(u2.user_socket_id).emit('searching-reset', { reason: 'partner-unavailable' })
                break
            case 2:
                io.to(u2.user_socket_id).emit('searching-reset', { reason: 'connection-failed' })
                io.to(u1.user_socket_id).emit('searching-reset', { reason: 'connection-failed' })
                break
            case 3:
                data.uid === uid1 ? io.to(u2.user_socket_id).emit('searching-reset', { reason: 'partner-left' }) : io.to(u1.user_socket_id).emit('searching-reset', { reason: 'partner-left' })
                break
            case 4: {
                const [ rejected, other ] = data.uid === uid1 ? [ u1, u2 ] : [ u2, u1 ]
                searching.remove(rejected.uid, 'error')
                searching.remove(other.uid, 'match_failed')
                io.to(rejected.user_socket_id).emit('hard-reset')
                io.to(other.user_socket_id).emit('searching-reset', { reason: 'partner-unavailable' })
                break
            }
            default:
                break
        }

    })

    // Add to connecting
    connectingCache.set(uid1, failStart)
    connectingCache.set(uid2, failStart)


}

module.exports.end = async function (uid, data) {

    let u1
    let u2
    let sid
    let partner_data

    const end_time = Date.now()

    if (connectingCache.has(uid)) {

        const promiseReject = connectingCache.get(uid)
        if (promiseReject) {
            promiseReject({
                err: `[CANCELED] [session.start] [connection canceled by user] uid: ${uid}`,
                failCode: 3,
                uid
            })
        }

    } else {

        try {
            inSessionCache.find((value, key) => {
                if ([value.uid1, value.uid2].includes(uid)) {
                    sid = key
                    inSessionCache.delete(key)
                    if (value.uid1 === uid) {
                        u1 = usersCache.get(value.uid1)
                        u2 = usersCache.get(value.uid2)
                    } else {
                        u2 = usersCache.get(value.uid1)
                        u1 = usersCache.get(value.uid2)
                    }
                    return true
                }
            })
            if (u1 && u2) {
                try {
                    status.online(u1.uid)
                    status.online(u2.uid)
                    chat.chatAnnounceTo(u1.user_socket_id, 'You have ended the session')
                    chat.chatAnnounceTo(u2.user_socket_id, 'Partner has ended the session')
                    const ended_by = u1.uid
                    io.to(u1.user_socket_id).timeout(10000).emit('in_session_end', ended_by, (err, callback) => { })
                    const u2DataPromise = new Promise((resolve, reject) => {
                        io.to(u2.user_socket_id).timeout(10000).emit('in_session_end', ended_by, (err, callback) => {
                            if (err) {
                                resolve()
                            } else {
                                if (callback && callback[0] && callback[0].bytesIO && callback[0].candidates) {
                                    partner_data = {
                                        ...callback[0].bytesIO,
                                        ...callback[0].candidates
                                    }
                                }
                                resolve()
                            }
                        })
                    })
                    chat.destroyRoom(sid, u1.uid)
                    webRTC.close(u1.user_socket_id, u2.user_socket_id)

                    u2DataPromise.then(() => {

                        In_session_log.findOne( { sid, $or: [ { end_time: { $exists: false } }, { end_time: { $eq: null } } ] }, (err, doc) => {
                            if (!err && doc) {
                                let databaseU1
                                let databaseU2
                                const correctOrder = doc.users.u1.uid === uid
                                databaseU1 = {
                                    uid: doc.users.u1.uid,
                                    matching_pref: doc.users.u1.matching_pref,
                                    webrtc_data: correctOrder ? data : partner_data
                                }
                                databaseU2 = {
                                    uid: doc.users.u2.uid,
                                    matching_pref: doc.users.u2.matching_pref,
                                    webrtc_data: !correctOrder ? data : partner_data
                                }
                                In_session_log.findOne( { sid, $or: [ { end_time: { $exists: false } }, { end_time: { $eq: null } } ] }  ).updateOne({
                                    users: {
                                        u1: databaseU1,
                                        u2: databaseU2
                                    },
                                    end_time,
                                    ended_by: uid,
                                }, logError)
                            } else {
                                In_session_log.findOne( { sid, $or: [ { end_time: { $exists: false } }, { end_time: { $eq: null } } ] }  ).updateOne({
                                    end_time,
                                    ended_by: uid,
                                }, logError)
                            }
                        })

                    })

                    return 'ok'
                } catch(err) {
                    console.log(`[FAILED] [session.end] [general] ERROR: ${err}`)
                    return 'ok'
                }
            } else if (sid) {
                console.log(`[ERROR] [session.end] [undefined: u1 && u2] ERROR: u1:${Boolean(u1)}, u2:${Boolean(u2)}`)
                // Still tell whoever is left that the session is over
                const remaining = u1 || u2
                if (remaining) {
                    io.to(remaining.user_socket_id).emit('in_session_end', null, () => {})
                }
                chat.destroyRoom(sid)
            }

        }catch(err) {
            console.log(`[FAILED] [session.end] [inSessionCache.find] ERROR: ${err}`)
            return 'ok'
        }

    }


}
