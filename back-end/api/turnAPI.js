const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const countryCoordinates = require('./countryCoordinates')

// ICE (STUN/TURN) configuration handed to each browser before it creates an RTCPeerConnection.
//
// ICE_MODE
//   local     (default) iceServers: [] - host candidates only, enough for two clients on one machine/LAN
//   static    ICE_SERVERS_JSON is sent as-is (e.g. a STUN server you run). Anything in it is visible to browsers.
//   turn-rest Regional coturn servers (ICE_REGIONS_FILE) with short-lived HMAC credentials derived from
//             TURN_SECRET (coturn "use-auth-secret"). The shared secret never leaves the server.
//   xirsys    Credentials fetched from the Xirsys API (XIRSYS_IDENT / XIRSYS_SECRET / XIRSYS_CHANNEL).
//
// Nothing is contacted unless a non-local mode is configured explicitly. An invalid configuration
// is logged and falls back to local mode so the server still starts.

const LOCAL_ICE_CONFIG = Object.freeze({ iceServers: [], iceTransportPolicy: 'all' })

function loadIceConfig(env = process.env) {

    const warnings = []
    const mode = (env.ICE_MODE || 'local').trim().toLowerCase()
    let iceTransportPolicy = (env.ICE_TRANSPORT_POLICY || 'all').trim().toLowerCase()

    if (!['all', 'relay'].includes(iceTransportPolicy)) {
        warnings.push(`ICE_TRANSPORT_POLICY "${iceTransportPolicy}" is not "all" or "relay" - using "all"`)
        iceTransportPolicy = 'all'
    }

    const config = {
        mode,
        iceTransportPolicy,
        warnings,
        regions: [],
        staticServers: [],
        regionCount: parseInt(env.ICE_REGION_COUNT) || 3,
        countryHeader: (env.ICE_COUNTRY_HEADER || 'cf-ipcountry').toLowerCase(),
        credentialTtl: parseInt(env.TURN_CREDENTIAL_TTL_SECONDS) || 60,
        usernameSuffix: env.TURN_USERNAME_SUFFIX || 'video-chat-app',
        turnSecret: env.TURN_SECRET || null,
        xirsys: { ident: env.XIRSYS_IDENT, secret: env.XIRSYS_SECRET, channel: env.XIRSYS_CHANNEL }
    }

    function fallBackToLocal(reason) {
        warnings.push(`${reason} - falling back to ICE_MODE=local`)
        config.mode = 'local'
    }

    switch (mode) {
        case 'local':
            break

        case 'static':
            try {
                const servers = JSON.parse(env.ICE_SERVERS_JSON || '[]')
                if (!Array.isArray(servers) || !servers.length || !servers.every(isValidIceServer)) {
                    throw new Error('expected a non-empty array of { urls, username?, credential? }')
                }
                config.staticServers = servers
            } catch (err) {
                fallBackToLocal(`ICE_SERVERS_JSON is invalid (${err.message})`)
            }
            break

        case 'turn-rest':
            try {
                config.regions = loadRegions(env)
            } catch (err) {
                fallBackToLocal(`ICE regions could not be loaded (${err.message})`)
                break
            }
            if (!config.turnSecret) {
                fallBackToLocal('TURN_SECRET is not set')
            }
            break

        case 'xirsys':
            if (!config.xirsys.ident || !config.xirsys.secret || !config.xirsys.channel) {
                fallBackToLocal('XIRSYS_IDENT, XIRSYS_SECRET and XIRSYS_CHANNEL are required')
            }
            break

        default:
            fallBackToLocal(`Unknown ICE_MODE "${mode}"`)
    }

    // Relay-only without any TURN server would leave no candidates at all
    if (config.mode === 'local' && config.iceTransportPolicy === 'relay') {
        warnings.push('ICE_TRANSPORT_POLICY=relay needs TURN servers - using "all" in local mode')
        config.iceTransportPolicy = 'all'
    }

    return config
}

function isValidIceServer(server) {
    if (!server || typeof server !== 'object') return false
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
    return urls.length > 0 && urls.every((url) => typeof url === 'string' && /^(stun|stuns|turn|turns):/.test(url))
}

function loadRegions(env) {
    let raw
    if (env.ICE_REGIONS_JSON) {
        raw = env.ICE_REGIONS_JSON
    } else if (env.ICE_REGIONS_FILE) {
        raw = fs.readFileSync(path.resolve(process.cwd(), env.ICE_REGIONS_FILE), 'utf8')
    } else {
        throw new Error('set ICE_REGIONS_FILE or ICE_REGIONS_JSON')
    }

    const regions = JSON.parse(raw)
    if (!Array.isArray(regions) || !regions.length) {
        throw new Error('expected a non-empty array')
    }
    regions.forEach((region, i) => {
        const valid = region &&
            Array.isArray(region.coordinates) && region.coordinates.length === 2 &&
            region.coordinates.every((n) => typeof n === 'number') &&
            region.ice && Array.isArray(region.ice.stun) && Array.isArray(region.ice.turn) &&
            [...region.ice.stun, ...region.ice.turn].every((url) => typeof url === 'string' && /^(stun|stuns|turn|turns):/.test(url))
        if (!valid) {
            throw new Error(`region #${i} must look like { name, coordinates: [lat, lon], ice: { stun: [...], turn: [...] } }`)
        }
    })
    return regions
}

const activeConfig = loadIceConfig()
activeConfig.warnings.forEach((warning) => console.log(`[WARN] [ICE] ${warning}`))

module.exports.iceConfigSummary = function () {
    switch (activeConfig.mode) {
        case 'local':
            return 'local mode (iceServers: [], iceTransportPolicy: all) - no STUN/TURN servers are used'
        case 'static':
            return `static mode (${activeConfig.staticServers.length} server entr${activeConfig.staticServers.length === 1 ? 'y' : 'ies'}, iceTransportPolicy: ${activeConfig.iceTransportPolicy})`
        case 'turn-rest':
            return `turn-rest mode (${activeConfig.regions.length} region(s), nearest ${activeConfig.regionCount} offered, iceTransportPolicy: ${activeConfig.iceTransportPolicy})`
        case 'xirsys':
            return `xirsys mode (iceTransportPolicy: ${activeConfig.iceTransportPolicy})`
        default:
            return activeConfig.mode
    }
}

function sortByDistanceTo(coordsArray, referenceCoords) {
    const R = 6371e3; // Earth's radius in meters
    const radianConversion = Math.PI / 180;
    const [lat1, lon1] = referenceCoords;

    // calculate the distance between each coordinate and the reference coordinates
    const distances = coordsArray.map(coords => {
        const [lat2, lon2] = coords.coordinates;

        const dLat = (lat2 - lat1) * radianConversion;
        const dLon = (lon2 - lon1) * radianConversion;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * radianConversion) * Math.cos(lat2 * radianConversion) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    });

    // create an array of indices to sort the original array by distance
    const indices = Array.from(coordsArray.keys());
    indices.sort((a, b) => distances[a] - distances[b]);

    // use the sorted indices to create a new array of sorted coordinates
    return indices.map(i => coordsArray[i]);
}

module.exports.selectRegions = function (regions, country_code, regionCount = 3) {
    if (!country_code || country_code === 'T1' || country_code === 'XX' || !Object.hasOwn(countryCoordinates, country_code)) {
        // Unknown location - offer every region
        return regions
    }
    return sortByDistanceTo(regions, countryCoordinates[country_code]).slice(0, regionCount)
}

function turnRestCredentials(config, headers) {

    // TURN REST API / coturn "use-auth-secret": username = "<expiry>:<suffix>", credential = base64(HMAC-SHA1(secret, username))
    const ttl = parseInt(Date.now() / 1000) + config.credentialTtl
    const username = [ttl, config.usernameSuffix].join(':')
    const hmac = crypto.createHmac('sha1', config.turnSecret)
    hmac.update(username)
    const credential = hmac.digest('base64')

    const country_code = headers && typeof headers[config.countryHeader] === 'string' ? headers[config.countryHeader].toUpperCase() : null
    const regions = module.exports.selectRegions(config.regions, country_code, config.regionCount)

    const servers = {
        iceServers: [{
            urls: []
        },{
            username,
            credential,
            urls: []
        }],
        iceTransportPolicy: config.iceTransportPolicy
    }

    regions.forEach((region) => {
        servers.iceServers[0].urls.push(...region.ice.stun)
        servers.iceServers[1].urls.push(...region.ice.turn)
    })

    servers.iceServers = servers.iceServers.filter((server) => server.urls.length)
    return servers
}

module.exports.getIceCredentials = async function (headers) {
    const config = activeConfig
    switch (config.mode) {
        case 'static':
            return { iceServers: config.staticServers, iceTransportPolicy: config.iceTransportPolicy }
        case 'turn-rest':
            return turnRestCredentials(config, headers)
        case 'xirsys':
            try {
                const { iceServers } = await getXirsysIceCredentials(config.xirsys)
                return { iceServers, iceTransportPolicy: config.iceTransportPolicy }
            } catch (err) {
                console.log(`[ERR] [turnAPI.getXirsysIceCredentials] ${err.message} - sending local ICE config`)
                return { ...LOCAL_ICE_CONFIG }
            }
        default:
            return { ...LOCAL_ICE_CONFIG }
    }
}

function getXirsysIceCredentials({ ident, secret, channel }) {
    return new Promise((promiseResolve, promiseReject) => {
        let o = {
            format: "urls"
        }

        let bodyString = JSON.stringify(o)
        let https = require("https")
        let options = {
                host: "global.xirsys.net",
                path: `/_turn/${encodeURIComponent(channel)}`,
                method: "PUT",
                timeout: 5000,
                headers: {
                    "Authorization": "Basic " + Buffer.from(`${ident}:${secret}`).toString("base64"),
                    "Content-Type": "application/json",
                    "Content-Length": bodyString.length
                }
        }
        let httpreq = https.request(options, function(httpres) {
                let str = ""
                httpres.on("data", function(data){ str += data })
                httpres.on("error", function(e){ promiseReject(e) })
                httpres.on("end", function(){
                    try {
                        const iceServers = JSON.parse(str).v.iceServers
                        promiseResolve({ iceServers: Array.isArray(iceServers) ? iceServers : [iceServers] })
                    } catch (e) {
                        promiseReject(new Error(`unexpected Xirsys response (HTTP ${httpres.statusCode})`))
                    }
                })
        })
        httpreq.on("timeout", function(){ httpreq.destroy(new Error('Xirsys request timed out')) })
        httpreq.on("error", function(e){ promiseReject(e) })
        httpreq.end(bodyString)
    })
}
