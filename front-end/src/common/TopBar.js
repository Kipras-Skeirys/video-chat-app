import { Link } from "react-router-dom"
import { useEffect, useState, useRef } from 'react'
import socket from '../api/socket'

function TopBar() {

    // Number of open real-time connections to this server (one per browser tab), not unique people
    const [ connectedSessions, setConnectedSessions ] = useState('-')
    const navBarRef = useRef()

    useEffect(() => {

        const requestCount = () => {
            socket.emit('getConnectedSessionsUpdate', (count) => {
                if (Number.isInteger(count)) {
                    setConnectedSessions(count)
                }
            })
        }
        requestCount()

        const connectedSessionsUpdateListener = (count) => {
            setConnectedSessions(count)
        }
        const disconnectListener = () => {
            setConnectedSessions('-')
        }
        socket.on('connectedSessionsUpdate', connectedSessionsUpdateListener)
        socket.on('connect', requestCount)
        socket.on('disconnect', disconnectListener)

        return () => {
            socket.off('connectedSessionsUpdate', connectedSessionsUpdateListener)
            socket.off('connect', requestCount)
            socket.off('disconnect', disconnectListener)
        }

    }, [])

    function handleNavBar(action) {
        switch(action) {
            case 'toggle':
                navBarRef.current.style.display === 'block' ? navBarRef.current.style.display = 'none' : navBarRef.current.style.display = 'block'
                break
            case 'open':
                navBarRef.current.style.display = 'block'
                break
            case 'close':
                navBarRef.current.style.display = 'none'
                break
            default:
                break
        }
    }

    return (
        <header className="topBar" id="topBar" onMouseLeave={() => { handleNavBar('close') }}>
            <div className="topBar-cont">
                <div className="topBar-align-left">
                    <Link to='/home' className='logo-container' aria-label="Go home" >
                        <span className="logo-text">video-chat-app</span>
                    </Link>
                    <div className="expandable-nav-bar-cont">
                        <button className="expand-nav-bar-button" aria-label="Expand navigation bar" onClick={() => { handleNavBar('toggle') }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512"><path d="M64 360a56 56 0 100 112 56 56 0 100-112zm0-160a56 56 0 100 112 56 56 0 100-112zm56-104A56 56 0 108 96a56 56 0 10112 0z"></path></svg>
                        </button>
                        <nav className="expandable-nav-bar" ref={navBarRef}>
                            <ul>
                                <li><Link to='/welcome' onClick={() => { handleNavBar('close') }}>About this demo</Link></li>
                                <li><Link to='/home' onClick={() => { handleNavBar('close') }}>Home</Link></li>
                            </ul>
                        </nav>
                    </div>
                </div>
                <div className="topBar-align-right">
                    <div className="onlineUsers-cont" title="Open browser tabs connected to this server right now. This counts connections, not unique people.">
                        <span style={{fontWeight: 500, color: 'gray'}}>Connected sessions: <b style={{fontWeight: 600, color: 'white'}}>{connectedSessions}</b></span>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default TopBar
