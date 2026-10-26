import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../api/socket'
import Loading from './Loading'
import in_sessionAPI from '../api/in_sessionAPI'

function ChatMain(props) {

    // Props
    const messagesEndRef = props.messagesEndRef
    const chatRef = props.chatRef

    return ( 
        <div className="chat-main" ref={chatRef}>
            {props.children}
            <div ref={messagesEndRef}></div>
        </div>
            
     )
}

function ChatMessages(props) {

    // Props
    const userId = props.userId
    const chatMessages = props.chatMessages
    const typing = props.typing
    const setTyping = props.setTyping
    let timeoutID = props.timeoutID
    let messages

    useEffect(() => {
        if (chatMessages && chatMessages.length && chatMessages[chatMessages.length -1].sender_id && chatMessages[chatMessages.length -1].sender_id !== userId ) {
            if (typing) {
                setTyping(false)
                clearTimeout(timeoutID)
                timeoutID = null
            }
        }
    }, [chatMessages])
    
    // Creating message bubbles
    if (chatMessages) {
        messages = chatMessages.map((e, i) => {
            const whosMessage = e.sender_id === userId ? 'user' : 'partner'
            return(
                <div className={e.announcement ? 'announcement-cont' : `${whosMessage}-message-cont`} key={i}>
                    <span className={e.announcement ? 'announcement' : `${whosMessage}-message`}>{e.message}</span>
                </div>
            )
        })
    }

    return (
        <>
            { messages ? messages : null }
        </>
    )
}

function Typing() {


    return (
        <div className='typing'>
            <span className='dot-cont'>
                <div className="dot-1"></div>
                <div className="dot-2"></div>
                <div className="dot-3"></div>
            </span>
        </div>
    )
}


function Chat(props) {
    
    // Props
    const chatStatus = props.chatStatus
    const partnerId = props.partnerId
    const userId = props.userId
    const chatMessages = props.chatMessages
    const updateChatMessages = props.updateChatMessages
    const setSessionStatus = props.setSessionStatus
    const chatControlsDisabled = props.chatControlsDisabled
    const sessionStatusAfterAd = props.sessionStatusAfterAd
    const setSessionStatusAfterAd = props.setSessionStatusAfterAd
    const playVideoAdRef = props.playVideoAdRef
    const candidates = props.candidates
    const bytesIO = props.bytesIO

    // React Hooks
    const inputRef = useRef()
    const messagesEndRef = useRef()
    const chatRef = useRef()
    const navigate = useNavigate()
    const [ confirmationToggle, setConfirmationToggle ] = useState(true)
    const [ isChatDisabled, setIsChatDisabled ] = useState()
    const [ isDisconnectDisabled, setIsDisconnectDisabled ] = useState(false)
    const [ contentEditable, setContentEditable ] = useState(false)
    const [ typing, setTyping ] = useState(false)
    
    // chatStatus variables
    let partnerNameElement
    let isReportDisabled
    let chatPlaceholder
    let sessionControls
    let color
    let loading
    let block
    let timeoutID
    let timeout2ID

    switch (chatStatus) {
        case 'searching':
            if (isChatDisabled !== true) { setIsChatDisabled(true) }
            if (contentEditable !== false) { setContentEditable(false) }
            sessionControls = [
                <button type="button" className="session-home btn-dark" onClick={handleHome} disabled={chatControlsDisabled}>Home</button>,
                <button type="button" className="session-pause btn-red" onClick={handlePause} disabled={chatControlsDisabled}>Pause</button>
            ]
            partnerNameElement = <span className='gray'>Searching...</span>
            isReportDisabled = true
            chatPlaceholder = "Type your message here..."
            loading = <Loading />
            color = 'gray'
            break
        case 'searching_paused':
            if (isChatDisabled !== true) { setIsChatDisabled(true) }
            if (contentEditable !== false) { setContentEditable(false) }
            sessionControls = [
                <button type="button" className="session-home btn-dark" onClick={handleHome} disabled={chatControlsDisabled}>Home</button>,
                <button type="button" className="session-resume btn-red" onClick={handleResume} disabled={chatControlsDisabled}>Resume</button>
            ]
            partnerNameElement = <span className='gray'></span>
            isReportDisabled = true
            chatPlaceholder = "Type your message here..."
            loading = <Loading paused={true} />
            color = 'gray'
            break
        case 'connecting':
            if (isChatDisabled !== true) { setIsChatDisabled(true) }
            if (contentEditable !== false) { setContentEditable(false) }
            sessionControls = [
                <button type="button" className="session-disconnect btn-red" onClick={toggleConfirmation} disabled={isDisconnectDisabled}>Disconnect</button>
            ]
            partnerNameElement = <span><span style={{fontWeight: 500, color: 'gray'}}>User ID:</span>{` ${partnerId}`}</span>
            isReportDisabled = true
            chatPlaceholder = "Type your message here..."
            loading = <Loading />
            color = 'gray'
            break
        case 'in_session':
            if (confirmationToggle && isChatDisabled !== false) { setIsChatDisabled(false) }
            if (contentEditable !== true) { setContentEditable(true) }
            sessionControls = [
                <button type="button" className="session-disconnect btn-red" onClick={toggleConfirmation} disabled={isDisconnectDisabled}>Disconnect</button>
            ]
            partnerNameElement = <span><span style={{fontWeight: 500, color: 'gray'}}>User ID:</span>{` ${partnerId}`}</span>
            isReportDisabled = false
            chatPlaceholder = "Say hello..."
            color = 'white'
            loading = null
            break
        case 'post_session':
            if (isChatDisabled !== true) { setIsChatDisabled(true) }
            if (contentEditable !== false) { setContentEditable(false) }
            sessionControls = [
                <button type="button" className="session-stop btn-dark" onClick={handleHome}>Home</button>,
                <button type="button" className="session-next btn-red" onClick={handleNext}>Next Match</button>
            ]
            partnerNameElement = <span><span style={{fontWeight: 500, color: 'gray'}}>User ID:</span>{` ${partnerId}`}</span>
            isReportDisabled = false
            chatPlaceholder = "Type your message here..."
            loading = null
            color = 'gray'
            break
        case 'ad':
            if (sessionStatusAfterAd === 'searching') {
                partnerNameElement = <span className='gray'>Searching starts after the ad</span>
                isReportDisabled = true
                loading = <Loading />
            } else if (sessionStatusAfterAd === 'post_session') {
                partnerNameElement = <span><span style={{fontWeight: 500, color: 'gray'}}>User ID:</span>{` ${partnerId}`}</span>
                isReportDisabled = false
                loading = null
            }
            if (isChatDisabled === true) { setIsChatDisabled(false) }
            if (contentEditable !== false) { setContentEditable(false) }
            // "Skip ad" lives on the mock ad itself (see MockAd.js)
            sessionControls = [
                <button type="button" className="session-stop btn-dark" onClick={handleHome} disabled={chatControlsDisabled}>Home</button>
            ]
            chatPlaceholder = "Type your message here..."
            color = 'gray'
            break
        case 'loading':
            break
        default:
            break

    }

    useEffect(() => {
        
        let isDisconnectDisabledTimeoutID

        switch(chatStatus) {
            case 'connecting':
                setIsDisconnectDisabled(true)
                isDisconnectDisabledTimeoutID= setTimeout(() => {
                    setIsDisconnectDisabled(false)
                }, 10000)

                return () => {
                    setIsDisconnectDisabled(false)
                    if (isDisconnectDisabledTimeoutID) { clearTimeout(isDisconnectDisabledTimeoutID) }
                }
            case 'in_session':
                const typingListener = () => {
                    if (!timeoutID) {
                        setTyping(true)
                    } else {
                        if (!typing) {
                            setTyping(true)
                        }
                        clearTimeout(timeoutID)
                        timeoutID = null
                    }

                    timeoutID = setTimeout(() => {
                        setTyping(false)
                        timeoutID = null
                    }, 3000)

                }
                socket.on('typing', typingListener)

                return () => {
                    socket.off('typing', typingListener)
                    setTyping(false)
                    setConfirmationToggle(true)
                    if (isDisconnectDisabledTimeoutID) { clearTimeout(isDisconnectDisabledTimeoutID) }
                }

            default:
                break
        }

    }, [chatStatus])

    useEffect(() => {
        messagesEndRef.current.scrollIntoView()
    })

    function overflowFadeControl(e) {
        // Control overflow border fade
    }

    function handleReport() {
        // Toggle report Window
    }

    function handlePause() {
        setSessionStatus('searching_paused')
    }

    function handleHome() {
        navigate('/home', {replace: true})
        
    }

    function handleResume() {
        setSessionStatus('searching')
    }

    function handleDisconnect() {
        in_sessionAPI.end({ candidates: candidates.current, bytesIO: bytesIO.current })
        setSessionStatus('post_session')
        
        setConfirmationToggle(true)

    }

    function toggleConfirmation() {
        setConfirmationToggle((prev) => {
            if (prev) {
                setIsChatDisabled(true)
            }
            return !prev
        })
    }

    function handleNext() {
        if (playVideoAdRef.current) {
            setSessionStatusAfterAd('searching')
            setSessionStatus('ad')
        } else {
            setSessionStatus('searching')
        }
    }
    
    function handleSend(e) {
        if (!e.shiftKey && e.key === 'Enter' || e.type === 'click') {

            e.preventDefault()

            if (inputRef.current.textContent.replace(/\s+/g, '') && !isChatDisabled) {
                updateChatMessages([
                    {
                        sender_id: userId,
                        message: inputRef.current.textContent,
                        time: Date.now(),
                        sent: false
                    }
                ])
                inputRef.current.textContent = ''

                setTimeout(() => {messagesEndRef.current.scrollIntoView()}, 0)

                clearTimeout(timeout2ID)
                timeout2ID = null
                block = false
            }
        }
    }

    function handleTyping() {
        if (!block) {
            socket.emit('typing')
            block = true
            timeout2ID = setTimeout(() => { block = false }, 2000)
        }
    }

    return ( 
        <div className="chat">
            <div className="chat-cont">

                <div className="chat-header">
                    <div className="chat-header-userInfo-cont">

                        <svg xmlns="http://www.w3.org/2000/svg" width="43.891" height="43.891" viewBox="0 0 43.891 43.891"> <g id="Group_69" data-name="Group 69" transform="translate(0 0)"> <circle id="Ellipse_23" data-name="Ellipse 23" cx="8.376" cy="8.376" r="8.376" transform="translate(13.569 9.549)" fill={color}/> <path id="Path_5" data-name="Path 5" d="M1530.22,840.423a21.946,21.946,0,1,0,21.946,21.946A21.97,21.97,0,0,0,1530.22,840.423Zm0,28.982a21.48,21.48,0,0,0-13.535,5.207,18.263,18.263,0,1,1,27.215-.167A22.781,22.781,0,0,0,1530.22,869.4Z" transform="translate(-1508.274 -840.423)" fill={color}/> </g> </svg>
                        
                        <div className="userName-cont">
                            <span className="userName sml-semibold">{partnerNameElement}</span>
                        </div>

                    </div>

                    {/* <div className="chat-header-report-cont" hidden={isReportDisabled}>
                        <button type="button" className="report btn-darkest" onClick={handleReport}>Report</button>
                    </div> */}

                </div>

                <div className="main-and-controls">


                    <div className="chat-main-cont" onScroll={(e) => overflowFadeControl(e)}>

                        {/* <div className="fade-overlay">
                            <div className="fade-top"></div>
                            <div className="fade-bottom"></div>
                        </div> */}
                        <div className="pre-chat-main" >
                            <ChatMain chatStatus={chatStatus} messagesEndRef={messagesEndRef} chatRef={chatRef}>

                                {loading ? loading : <ChatMessages userId={userId} chatMessages={chatMessages} typing={typing} setTyping={setTyping} timeoutID={timeoutID}/>}
                                
                            </ChatMain>
                            { typing ? <Typing /> : null }
                        </div>
                    </div>
                        
                    <div className="confirmation" style={confirmationToggle ? {display: 'none'} : {display: 'flex'}}>
                        <span className="confirmation-text">Are you sure you want to end this session?</span>
                        <div className="confirmation-buttons-cont">
                            <div className="confirmation-buttons">
                                <button type="button" className="confirmation-no btn-dark" onClick={toggleConfirmation}>No</button>
                                <button type="button" className="confirmation-yes btn-red" onClick={() => handleDisconnect()} disabled={isDisconnectDisabled}>Yes</button>
                            </div>
                        </div>
                    </div>
                    <div className="session-controls">
                        {sessionControls && sessionControls.map((e, i) => <div key={i}>{e}</div>)}
                    </div>

                </div>
                
                <div className="chat-input-cont">
                    <span className="chat-input" ref={inputRef} contentEditable={contentEditable} onInput={handleTyping} placeholder={chatPlaceholder} onKeyDown={handleSend}></span>
                    <button type="button" className="chat-send" disabled={isChatDisabled} onClick={handleSend}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="15.591" height="16" viewBox="0 0 15.591 16"> <path id="arrow-up-solid" d="M6.695,41.147,5.9,40.354a.854.854,0,0,1,0-1.211L12.84,32.2a.854.854,0,0,1,1.211,0l6.939,6.939a.854.854,0,0,1,0,1.211l-.793.793a.858.858,0,0,1-1.225-.014l-4.1-4.3V47.093a.855.855,0,0,1-.857.857H12.876a.855.855,0,0,1-.857-.857V36.83l-4.1,4.3a.852.852,0,0,1-1.225.014Z" transform="translate(-5.65 -31.95)" fill="#fff"/> </svg>
                    </button>
                </div>
                
            </div>
        </div>
     )
}

export default Chat