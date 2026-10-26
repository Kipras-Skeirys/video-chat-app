// Matching preferences: each user picks one interest of their own and the interests they would
// like their partner to have. Two users match only when each satisfies the other's preferences.

const INTERESTS = ['technology', 'music', 'gaming', 'travel', 'sports', 'art']

module.exports.INTERESTS = INTERESTS

module.exports.isValidPreferences = function (pref) {
    return Boolean(
        pref &&
        INTERESTS.includes(pref.user_interest) &&
        Array.isArray(pref.partner_interests) &&
        pref.partner_interests.length > 0 &&
        pref.partner_interests.length <= INTERESTS.length &&
        pref.partner_interests.every((i) => INTERESTS.includes(i))
    )
}

// Only the validated fields are kept (never the raw request body)
module.exports.normalizePreferences = function (pref) {
    return {
        user_interest: pref.user_interest,
        partner_interests: [...new Set(pref.partner_interests)]
    }
}

module.exports.isCompatible = function (a, b) {
    return Boolean(
        a && b &&
        b.partner_interests.includes(a.user_interest) &&
        a.partner_interests.includes(b.user_interest)
    )
}

// How many times the same two users may be matched within the skip-history window (12h).
// 0 = unlimited, which keeps a two-person local demo able to rematch indefinitely.
module.exports.maxRepeatMatches = function (env = process.env) {
    const value = parseInt(env.MAX_REPEAT_MATCHES)
    return Number.isInteger(value) && value > 0 ? value : 0
}

module.exports.canRematch = function (skipHistory, limit) {
    return !skipHistory || limit === 0 || skipHistory.skipCount < limit
}
