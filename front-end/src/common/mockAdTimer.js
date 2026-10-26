// Timing for the video ad placeholder shown between chats.

export const MOCK_AD_DURATION_MS = 5000

// Minimum time between two mock ads (frequency cap).
export const MOCK_AD_INTERVAL_MS = (() => {
    const value = parseInt(process.env.REACT_APP_MOCK_AD_INTERVAL_MS, 10)
    return Number.isInteger(value) && value >= 0 ? value : 30000
})()

// Starts the countdown. onComplete(reason) is called exactly once - with 'timeout' after durationMs
// or 'skipped' when skip() is called first. cancel() stops everything without completing
// (used on navigation, unmount and disconnect).
export function startMockAdTimer({ durationMs = MOCK_AD_DURATION_MS, onTick, onComplete }) {

    let done = false
    const endsAt = Date.now() + durationMs

    function secondsLeft() {
        return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    }

    function tick() {
        if (!done && onTick) onTick(secondsLeft())
    }

    const intervalID = setInterval(tick, 250)
    const timeoutID = setTimeout(() => finish('timeout'), durationMs)

    function clearTimers() {
        clearInterval(intervalID)
        clearTimeout(timeoutID)
    }

    function finish(reason) {
        if (done) return false
        done = true
        clearTimers()
        onComplete(reason)
        return true
    }

    tick()

    return {
        skip: () => finish('skipped'),
        cancel: () => {
            if (done) return
            done = true
            clearTimers()
        },
        isDone: () => done
    }
}
