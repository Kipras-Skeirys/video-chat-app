const express = require('express')
const { usersCache } = require('../server')
const { v4: uuidv4 } = require('uuid')
const { isValidPreferences, normalizePreferences } = require('../services/matchingRules')

const router = express.Router()


function validateData(req, res, next) {
    if (isValidPreferences(req.body)) {
        req.session.matching_pref = normalizePreferences(req.body)
        next()
    }else {
        req.session.searching_auth = false
        res.status(400).json({error: 'Invalid matching preferences submitted'})
    }
}

async function validateUser(req, res, next) {
    const existing = usersCache.find((value) => value.user_session_id === req.session.id && value.user_socket_id === req.session.user_socket_id)
    if (!existing) {
        // Create new user
        const uid = uuidv4()
        if (req.session.user_socket_id) {
            usersCache.set(uid, {
                uid,
                user_session_id: req.session.id,
                user_state: 'online',
                user_socket_id: req.session.user_socket_id,
                matching_pref: req.session.matching_pref,
            })
            req.session.uid = uid
            next()
        } else {
            console.log(`[ERROR] [sessionSetup.route] [validateUser] [no socket.id in req] user_socket_id: ${req.session.user_socket_id}`);
            req.session.searching_auth = false
            res.status(409).json({error: 'Not connected to the real-time server yet. Wait a moment and try again.'})
        }
    } else {
        // User already exists - keep their latest preferences
        existing.matching_pref = req.session.matching_pref
        usersCache.set(existing.uid, existing)
        req.session.uid = existing.uid
        next()
    }
}

router.post('/', validateData, validateUser, async (req, res) => {
    req.session.searching_auth = true
    res.status(200).end()
})

module.exports = router
