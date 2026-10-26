import { useEffect, useState } from 'react'
import socket from '../api/socket'

// Banner for problems with the real-time (Socket.IO) connection to the backend
function ConnectionStatus() {

    // null | 'unreachable' | 'replaced'
    const [ problem, setProblem ] = useState(null)

    useEffect(() => {

        const connectListener = () => setProblem(null)
        const connectErrorListener = () => setProblem((prev) => prev === 'replaced' ? prev : 'unreachable')
        const sessionReplacedListener = () => setProblem('replaced')
        // After a server-side disconnect Socket.IO does not reconnect on its own ("Retry now" is shown)
        const disconnectListener = () => setProblem((prev) => prev === 'replaced' ? prev : 'unreachable')

        socket.on('connect', connectListener)
        socket.on('connect_error', connectErrorListener)
        socket.on('session-replaced', sessionReplacedListener)
        socket.on('disconnect', disconnectListener)

        return () => {
            socket.off('connect', connectListener)
            socket.off('connect_error', connectErrorListener)
            socket.off('session-replaced', sessionReplacedListener)
            socket.off('disconnect', disconnectListener)
        }
    }, [])

    function handleReconnect() {
        setProblem(null)
        socket.connect()
    }

    if (!problem) return null

    return (
        <div className="connection-status" role="alert">
            { problem === 'replaced' ?
                <>
                    <span>This app was opened in another tab that shares this browser session, so this tab was disconnected. To test with two participants, use a second browser, browser profile or private window.</span>
                    <button type="button" className="btn-dark" onClick={handleReconnect}>Use this tab instead</button>
                </>
                :
                <>
                    <span>Cannot reach the real-time server. Check that the backend is running ("npm start") - retrying automatically...</span>
                    { socket.connected || socket.active ? null : <button type="button" className="btn-dark" onClick={handleReconnect}>Retry now</button> }
                </>
            }
        </div>
    )
}

export default ConnectionStatus
