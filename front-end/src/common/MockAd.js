import { useEffect, useRef, useState } from 'react'
import { MOCK_AD_DURATION_MS, startMockAdTimer } from './mockAdTimer'

// Local placeholder for a post-chat video ad.
// No network requests, no tracking. Completes after 5 seconds or when "Skip ad" is pressed.
function MockAd(props) {

    // Props
    const onComplete = props.onComplete
    const durationMs = props.durationMs || MOCK_AD_DURATION_MS

    // Refs
    const timerRef = useRef()
    const onCompleteRef = useRef(onComplete)
    onCompleteRef.current = onComplete

    // State
    const [ secondsLeft, setSecondsLeft ] = useState(Math.ceil(durationMs / 1000))

    useEffect(() => {
        const timer = startMockAdTimer({
            durationMs,
            onTick: setSecondsLeft,
            onComplete: (reason) => onCompleteRef.current(reason)
        })
        timerRef.current = timer

        return () => {
            timer.cancel()
        }
    }, [durationMs])

    function handleSkip() {
        if (timerRef.current) timerRef.current.skip()
    }

    return (
        <div className="MockAd" role="region" aria-label="Video ad placeholder">
            <div className="MockAd-placeholder">video ad placeholder</div>
            <div className="MockAd-footer">
                <span className="MockAd-countdown" aria-live="polite">Continuing in {secondsLeft}s</span>
                <button type="button" className="MockAd-skip btn-red" onClick={handleSkip}>Skip ad</button>
            </div>
        </div>
    )
}

export default MockAd
