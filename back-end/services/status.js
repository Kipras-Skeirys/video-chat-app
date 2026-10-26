const { sessionStore } = require('../server')
const { usersCache } = require('../server')

// async function updateDatabase (user_id, status) {
//     try {
//         const [ rows ] = await db.query(`
//             UPDATE users
//             SET user_status = '${status}'
//             WHERE user_id = '${user_id}'
//         `)
//         if (!rows.affectedRows) {
//             console.log(`[FAILED] [status.updateDatabase] [USER NOT FOUND] user_id: ${user_id} | status: ${status}`)
//         }
//     } catch (err) { console.log(err) }
// }

async function updateSession (user_id, status, isAuth, req) {
    
    if (req && req.session.user_id === user_id) {
        req.session.user_status = status
        req.session.isAuth = isAuth
    } else {
        const sid = usersCache.get(user_id).user_session_id
        if (sid) {
            sessionStore.get(sid, (err, session) => {
                if (err) {
                    console.log(`[ERR] [status.updateSession] [sessionStore.get] user_id: ${user_id} | err: ${err}`)
                }else {
                    session.user_status = status
                    session.isAuth = isAuth
                    sessionStore.set(sid, session, (err) => {
                        if (err) {
                            console.log(`[ERR] [status.updateSession] [sessionStore.set] user_id: ${user_id} | err: ${err}`)
                        }
                    })
                }
            })
        } else {
            console.log(`[FAILED] [status.updateSession] [SESSION NOT FOUND] user_id: ${user_id} | status: ${status}`)
        }
    }

}

// Online
module.exports.online = function (user_id, req) {
    const status = 'online'
    // updateDatabase(user_id, status)
    // updateSession(user_id, status, false, req)
}

// Searching
module.exports.searching = function (user_id, req) {
    const status = 'searching'
    // updateDatabase(user_id, status)
    // updateSession(user_id, status, true, req)
}

// In Session
module.exports.in_session = function (user_id, req) {
    const status = 'in_session'
    // updateDatabase(user_id, status)
    // updateSession(user_id, status, true, req)
}

// Offline
module.exports.offline = function (user_id, req) {
    const status = 'offline'
    // updateDatabase(user_id, status)
    // updateSession(user_id, status, false, req)
}

// Away
module.exports.away = function (user_id, req) {
    const status = 'away'
    // updateDatabase(user_id, status)
    // updateSession(user_id, status, false, req)
}

