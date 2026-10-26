const express = require('express')
const searching = require('../services/searching')
const { searchingCache } = require('../server')

const router = express.Router()

router.get('/', async (req, res) => {
    if (req.session.searching_auth && req.session.uid) {

        if (!searchingCache.has(req.session.uid)) {
            const response = await searching.add(req.session.uid, req.session.matching_pref)

            if (response === 'ok') {
                res.status(200).end()
            } else {
                res.status(500).json({error: 'Internal Server Error: failed to start searching'})
            }
        } else {
            // Already searching (e.g. returned to searching after a failed connection) - try again, no duplicate entry
            searching.findMatch(req.session.uid, req.session.matching_pref)
            res.status(200).end()
        }

    } else {
        res.status(401).json({error: 'Choose your matching preferences on the home page first'})
    }

})

router.get('/remove', async (req, res) => {

    if (searchingCache.has(req.session.uid)) {
        const response = await searching.remove(req.session.uid, 'stop')
        if (response === 'ok') {
            res.status(200).end()
        } else {
            res.status(500).json({error: 'Internal Server Error'})
        }
    }else {
        res.status(200).end()
    }

})

module.exports = router
