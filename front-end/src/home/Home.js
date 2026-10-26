import SessionSetup from './SessionSettings'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function Home() {

    const location = useLocation()
    // Errors from a failed search/session are passed back here via navigation state
    const error = location.state && location.state.error

    useEffect(() => {
        document.title = "Home - video-chat-app"
    }, [])

    return (
        <div className="home">
            <div className="home-cont">
                { error ? <div className="home-error" role="alert">{error}</div> : null }
                <SessionSetup />
            </div>
        </div>
     )
}

export default Home
