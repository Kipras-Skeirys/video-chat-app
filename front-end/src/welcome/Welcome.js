import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PopUp from '../common/PopUp'

function Welcome() {

    let navigate = useNavigate()

    useEffect(() => {
        document.title = "Welcome - video-chat-app"
    }, [])

    function handleClick(e) {
        e.preventDefault()
        sessionStorage.setItem('welcome_acknowledged', 'true')
        navigate('/home')
    }

    return (
        <PopUp isCloseHidden={true} isBackHidden={true}>
            <div className="welcome">
                <div className="welcome-cont">
                    <h1 className="welcome-title big-bold">video-chat-app</h1>
                    <h2 className="welcome-text med-regular">Random one-to-one video chat, prepared as a local portfolio demo.</h2>
                    <ul className="welcome-list sml-regular gray">
                        <li>Pick an interest, allow camera and microphone access, and start matching. You are only ever matched with another real, connected participant.</li>
                        <li>Matchmaking, signalling and text chat go through this app's server (Socket.IO). Audio and video flow directly between the two browsers (WebRTC).</li>
                        <li>To try it alone, open the app in a second, independent browser session - another browser, browser profile or private window.</li>
                        <li>Ad slots from the original app are shown as gray placeholders: a 5-second (skippable) video ad placeholder between some chats and a banner placeholder above the chat. No ad networks, analytics or tracking are used.</li>
                    </ul>
                    <div className="welcome-button-cont">
                        <button type="button" name="accept" className="welcome-btn btn-red" onClick={(e) => handleClick(e)}>Get started</button>
                    </div>
                </div>
            </div>
        </PopUp>
     )
}

export default Welcome
