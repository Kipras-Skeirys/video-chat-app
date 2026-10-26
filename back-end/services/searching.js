const status = require('./status')
const session = require('./session')
const { app } = require('../server')
const { searchingCache, usersCache, connectingCache, inSessionCache, skipHistoryCache } = require('../server')
const { v4: uuidv4 } = require('uuid')
const Searching_log = require('../models/searching_log')
const { isCompatible, canRematch, maxRepeatMatches } = require('./matchingRules')
const mongoose = require('mongoose')

// Log write errors are only reported while MongoDB is connected (it is optional)
function logError(err) { if (err && mongoose.connection.readyState === 1) { console.log(err) } }

const io = app.get('socketio')
const MAX_REPEAT_MATCHES = maxRepeatMatches()

module.exports.remove = function (uid, reason) {

    searchingCache.delete(uid)
    Searching_log.findOne( { uid, $or: [ { end_time: { $exists: false } }, { end_time: { $eq: null } } ] }  ).sort( { start_time: -1} ).updateOne(
        {
            end_time: Date.now(),
            end_reason: reason
        }, logError)

    return 'ok'
}

module.exports.add = function (uid, matching_pref) {

    const start_time = Date.now()
    searchingCache.set(uid, matching_pref)
    status.searching(uid)

    Searching_log.create({
        uid,
        matching_pref,
        start_time
    }).catch(logError)

    this.findMatch(uid, matching_pref)

    return 'ok'
}

function isInSession(uid) {
    return Boolean(inSessionCache.find((value) => value.uid1 === uid || value.uid2 === uid))
}

// A searching entry is only matchable while its user still has a live socket
function isConnected(user) {
    return Boolean(user && user.user_socket_id && io.sockets.sockets.has(user.user_socket_id))
}

module.exports.findMatch = function (uid, matching_pref) {

    const user = usersCache.get(uid)
    if (!user || !isConnected(user) || !searchingCache.has(uid) || connectingCache.has(uid) || isInSession(uid)) {
        return null
    }

    let partner_id
    const staleEntries = []
    for (const [ match_id, match_pref ] of searchingCache.rentries()) {

        // Never match a user with themselves, or with another tab/socket of the same browser session
        if (match_id === uid) continue
        const match = usersCache.get(match_id)
        if (!match || !isConnected(match)) {
            staleEntries.push(match_id)
            continue
        }
        if (match.user_session_id === user.user_session_id || match.user_socket_id === user.user_socket_id) continue

        // Skip anyone already being connected or in a session (no duplicate matching)
        if (connectingCache.has(match_id) || isInSession(match_id)) continue

        if (isCompatible(matching_pref, match_pref)) {
            const skipHistory = skipHistoryCache.find(value => [match_id, uid].every(uid => value.uids.includes(uid)))

            if (canRematch(skipHistory, MAX_REPEAT_MATCHES)) {

                const cacheID = skipHistory ? skipHistory.cacheID : uuidv4()

                skipHistoryCache.set(cacheID, {
                    cacheID,
                    uids: skipHistory ? skipHistory.uids : [uid, match_id],
                    skipCount: skipHistory ? skipHistory.skipCount + 1 : 1
                })

                // MATCH FOUND
                partner_id = match_id
                break
            }
        }
    }

    // Stale-session cleanup: searchers whose socket has gone away
    staleEntries.forEach((stale_id) => this.remove(stale_id, 'stale'))

    if (!partner_id) {
        return null
    }

    session.start(uid, partner_id)
    return partner_id

}
