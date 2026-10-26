import { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate, useSearchParams } from "react-router-dom"
import Chat from '../common/Chat'
import Camera from '../common/Camera'
import RemoteCamera from './RemoteCamera'
import Loading from '../common/Loading'
import MockAd from '../common/MockAd'
import AboveChatAdBanner from '../common/AboveChatAdBanner'
import { MOCK_AD_INTERVAL_MS } from '../common/mockAdTimer'
import searchingAPI from '../api/searchingAPI'
import in_sessionAPI from '../api/in_sessionAPI'
import socket from '../api/socket'
import { LocalStreamContext } from '../App'
import adapter from 'webrtc-adapter'

// Used when the server does not answer with an ICE configuration in time
const LOCAL_ICE_CONFIG = { iceServers: [], iceTransportPolicy: 'all' }

const WAITING_NOTICE = (
    <>
        <h2>Waiting for another participant</h2>
        <p>Matches only happen between real, connected participants - nobody else is searching with compatible preferences right now.</p>
        <p>To try it locally, open the app in a second, independent browser session (another browser, profile or private window) and start matching there too.</p>
    </>
)

const RESET_NOTICES = {
    'connection-failed': 'Could not establish a direct connection with that participant. On restrictive networks a TURN relay may be required (see README). Searching again...',
    'partner-left': 'The other participant left before the call started. Searching again...',
    'partner-unavailable': 'The other participant stopped responding before the call started. Searching again...'
}


function Session(props) {

    let navigate = useNavigate()
    let [searchParams, setSearchParams] = useSearchParams()

    // Props
    const playVideoAdRef = props.playVideoAdRef
    const videoAdTimeoutIDRef = props.videoAdTimeoutIDRef

    // Hooks
    const [ userId, setUserId ] = useState()
    const [ isLoadingDisabled, setIsLoadingDisabled ] = useState()
    const [ chatMessages, setChatMessages ] = useState()
    const [ sessionStatus, setSessionStatus ] = useState(playVideoAdRef && playVideoAdRef.current === true ? 'ad' : 'searching')
    const [ sessionStatusAfterAd, setSessionStatusAfterAd ] = useState('searching')
    const [ mobileQueryTrigger, setMobileQueryTrigger ] = useState(window.matchMedia("(max-width: 650px)").matches)
    const [ loadingText, setLoadingText ] = useState()
    const [ loadingPaused, setLoadingPaused ] = useState(false)
    const [ remoteVideoRefState, setRemoteVideoRefState ] = useState()
    const [ chatControlsDisabled, setChatControlsDisabled ] = useState(false)
    const [ remoteTrack, setRemoteTrack ] = useState([])
    const [ secondaryText, setSecondaryText ] = useState()

    // Context
    const {localStream, setLocalStream} = useContext(LocalStreamContext)

    // Refs
    const peerConnection = useRef()
    const tenSecondMarkRef = useRef()
    const candidates = useRef()
    const bytesIO = useRef()
    const partnerId = useRef()
    const sessionStatusRef = useRef(sessionStatus)
    const resetNoticeRef = useRef()
    sessionStatusRef.current = sessionStatus


    async function getIceCredentials() {
        return new Promise((resolve) => {
            socket.timeout(5000).emit('webRTC_getIceCredentials', (err, iceCredentials) => {
                if (err || !iceCredentials || !Array.isArray(iceCredentials.iceServers)) {
                    console.log('[Notice] No ICE configuration from the server - using local mode (no STUN/TURN)')
                    resolve(LOCAL_ICE_CONFIG)
                } else {
                    resolve(iceCredentials)
                }
            })

        })
    }


    function bandwidthControl(peerConnection, videoBandwidth, audioBandwidth) {

        if (peerConnection && (peerConnection.connectionState === 'connecting' || peerConnection.connectionState === 'connected')){
            if (
                (adapter.browserDetails.browser === 'chrome' ||
                adapter.browserDetails.browser === 'safari' ||
                (adapter.browserDetails.browser === 'firefox' &&
                adapter.browserDetails.version >= 64)) &&
                'RTCRtpSender' in window &&
                'setParameters' in window.RTCRtpSender.prototype
            ){
                const senders = peerConnection.getSenders()
                if (senders.length && senders[0].transport && senders[0].transport.state === 'connected') {
                    senders.forEach((sender) => {
                        if (!sender.track) return
                        if (sender.track.kind === 'video'){
                            const parameters = sender.getParameters()
                            if (!parameters.encodings) {
                                parameters.encodings = [{}]
                            }
                            if (videoBandwidth === 'unlimited' && parameters.encodings && parameters.encodings[0] && parameters.encodings[0].hasOwnProperty('maxBitrate')) {
                                delete parameters.encodings[0].maxBitrate
                            } else if (parameters.encodings[0].maxBitrate !== videoBandwidth && videoBandwidth !== 'unlimited') {
                                parameters.encodings[0].maxBitrate = videoBandwidth
                            }
                            sender.setParameters(parameters).catch(e => console.error(e))
                        }
                        if (sender.track.kind === 'audio' && audioBandwidth){
                            const parameters = sender.getParameters()
                            if (!parameters.encodings) {
                                parameters.encodings = [{}]
                            }
                            if (audioBandwidth === 'unlimited' && parameters.encodings && parameters.encodings[0] && parameters.encodings[0].hasOwnProperty('maxBitrate')) {
                                delete parameters.encodings[0].maxBitrate
                            } else if (parameters.encodings && parameters.encodings[0].maxBitrate !== audioBandwidth && audioBandwidth !== 'unlimited') {
                                parameters.encodings[0].maxBitrate = audioBandwidth
                            }
                            sender.setParameters(parameters).catch(e => console.error(e))
                        }

                    })
                }
            } else (
                peerConnection.createOffer()
                    .then(offer => peerConnection.setLocalDescription(offer))
                    .then(() => {
                        const desc = {
                            type: peerConnection.remoteDescription.type,
                            sdp: videoBandwidth === 'unlimited' ?
                            removeSdpBandwidthRestriction(peerConnection.remoteDescription.sdp) :
                            updateSdpBandwidth(peerConnection.remoteDescription.sdp, videoBandwidth)
                        }
                        return peerConnection.setRemoteDescription(desc)
                    })
            )
        }else {
            console.log('[Notice] Unhandled peerConnection closure');
        }
    }

    function updateChatMessages(message) {
        setChatMessages((prev) => {
            if (prev) {
                return([...prev, ...message])
            } else {
                return(message)
            }
        })
        if (message[0].sender_id && !message[0].announcement && message[0].sender_id === userId) {
            socket.emit('message', message[0].message)
        }
    }

    function handleIceCadidates(peerConnection) {
        peerConnection.addEventListener('icecandidate', (e) => {
            if(e.candidate) {
                socket.emit('webRTC_iceCadidate', e.candidate)
            }
        })
    }

    function addTracks(peerConnection) {
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream)
            })
        } else {
            navigate('/home')
        }
    }

    function getSelectedCandidatePair(peerConnection) {
        let localCandidateId
        let remoteCandidateId
        return peerConnection.getStats(null).then((stats) => {
            let localCandidateType
            let remoteCandidateType
            let bytesSent
            let bytesReceived
            stats.forEach((rtcStats) => {
                if (rtcStats.type === 'candidate-pair' && rtcStats.state === 'succeeded') {
                    localCandidateId = rtcStats.localCandidateId
                    remoteCandidateId = rtcStats.remoteCandidateId
                    bytesSent = rtcStats.bytesSent
                    bytesReceived = rtcStats.bytesReceived
                }
            })
            stats.forEach((rtcStats) => {
                if (rtcStats.type === "local-candidate" && localCandidateId && rtcStats.id === localCandidateId) {
                    localCandidateType =  rtcStats.candidateType
                }
                if (rtcStats.type === "remote-candidate" && remoteCandidateId && rtcStats.id === remoteCandidateId) {
                    remoteCandidateType = rtcStats.candidateType
                }
            })
            return {
                candidates: { localCandidateType: localCandidateType, remoteCandidateType: remoteCandidateType },
                bytesIO: { bytesSent: bytesSent, bytesReceived: bytesReceived }
            }
        })
    }

    function connectionStateChange(peerConnection) {
        peerConnection.addEventListener('connectionstatechange', event => {
            socket.emit('webRTC_connectionState', peerConnection.connectionState)
            switch (peerConnection.connectionState) {
                case 'connecting':
                    bandwidthControl(peerConnection, 75000, 10000)
                    // falls through
                case 'connected':
                    setChatControlsDisabled(false)
                    getSelectedCandidatePair(peerConnection).then((data) => {
                        bytesIO.current = data.bytesIO
                        candidates.current = data.candidates
                    }).catch(() => {})
                    break
                case 'failed':
                    // Media path to the partner is gone (sessionStatusRef avoids a stale closure)
                    if (sessionStatusRef.current === 'in_session') {
                        in_sessionAPI.end({ candidates: candidates.current, bytesIO: bytesIO.current })
                        setSessionStatus('post_session')
                    }
                    break
                default:
                    break
            }
        })
    }

    function addRemoteTracks(peerConnection) {
        peerConnection.addEventListener('track', async (event) => {
            setRemoteTrack((prev) => {
                return ( [ ...prev, ...event.streams ] )
            })
        })
    }

    function onnegotiationneededListener(peerConnection) {
        peerConnection.onnegotiationneeded = (event) => {
        }
    }

    function removeSdpBandwidthRestriction(sdp) {
        return sdp.replace(/b=AS:.*\r\n/g, '').replace(/b=TIAS:.*\r\n/g, '');
    }

    function updateSdpBandwidth(sdp, bandwidth) {

        let modifier = 'AS'
        let newSdp

        if (adapter.browserDetails.browser === 'firefox') {
            bandwidth = (bandwidth >>> 0)
            modifier = 'TIAS'
        }

        if (sdp.indexOf('b=' + modifier + ':') === -1) {
            // insert b= after c= line.
            newSdp = sdp.replace(/c=IN (.*)\r\n/g, 'c=IN $1\r\nb=' + modifier + ':' + bandwidth + '\r\n');
        } else {
            newSdp = sdp.replace(new RegExp('b=' + modifier + ':.*\r\n'), 'b=' + modifier + ':' + bandwidth + '\r\n');
        }

        return newSdp

    }

    function mobileQueryChange(state) {
        const topBar = document.getElementById('topBar')
        const main = document.getElementById('main')
        const cameraCont = document.getElementById('camera-cont')
        const cameraSideCamera = document.getElementsByClassName('camera-side-camera')
        if (state === true) {
            if (topBar) { topBar.style.display = 'none' }
            if (main) { main.style.height = '100%' }
            if (cameraCont) { cameraCont.style.position = 'inherit' }
            if (cameraSideCamera.length) { cameraSideCamera[0].style.justifyContent = 'start' }

        } else {
            if (topBar) { topBar.style.display = 'block' }
            if (main) { main.style.height = 'calc(100% - (22px + 2rem))' }
            if (cameraCont) { cameraCont.style.position = 'relative' }
            if (cameraSideCamera.length) { cameraSideCamera[0].style.justifyContent = 'end' }
        }
    }

    function closePeerConnection() {
        if (peerConnection.current) {
            peerConnection.current.close()
            peerConnection.current = null
        }
    }

    // Shared completion for the mock ad - MockAd guarantees this runs once, whether it timed out or was skipped
    function handleAdComplete() {
        if (videoAdTimeoutIDRef.current) {
            clearTimeout(videoAdTimeoutIDRef.current)
            videoAdTimeoutIDRef.current = null
        }
        playVideoAdRef.current = false
        videoAdTimeoutIDRef.current = setTimeout(() => {
            playVideoAdRef.current = true
        }, MOCK_AD_INTERVAL_MS)
        setSessionStatus(sessionStatusAfterAd)
    }

    useEffect( () => {

        if (localStream) {
            switch (sessionStatus) {
                case 'searching':

                    let SearchTimeoutID

                    // Reset before joining the queue: the server can match us while handling /api/searching,
                    // so 'match-found' may arrive over the socket before the HTTP response below.
                    partnerId.current = null
                    setUserId(null)
                    setChatMessages([])
                    document.title = "Searching - video-chat-app"
                    setSearchParams({status: 'searching'})
                    if (isLoadingDisabled !== false) { setIsLoadingDisabled(false) }
                    setLoadingText('Waiting for another participant...')
                    setLoadingPaused(false)
                    setChatControlsDisabled(false)

                    const controller = new AbortController()
                    let sessionSettingsPromise
                    if (!window.sessionSettingsPromise) {
                        sessionSettingsPromise = new Promise( (resolve, reject) => { resolve() } )
                    } else {
                        sessionSettingsPromise = window.sessionSettingsPromise
                    }

                    sessionSettingsPromise.then((settingsSaved) => {
                        if (settingsSaved === false || controller.signal.aborted) return
                        fetch('/api/searching', {
                            method: 'GET',
                            signal: controller.signal
                        })
                            .then(async (response) => {
                                if (!response.ok) {
                                    const json = await response.json().catch(() => ({}))
                                    navigate('/home', { state: { error: json.error || `Could not start searching (HTTP ${response.status})` } })
                                } else {

                                    if (playVideoAdRef && playVideoAdRef.current === undefined) {
                                        playVideoAdRef.current = true
                                    }

                                    // Already matched (or left) while the request was in flight
                                    if (controller.signal.aborted || partnerId.current) return

                                    if (resetNoticeRef.current) {
                                        setSecondaryText(<p>{resetNoticeRef.current}</p>)
                                        resetNoticeRef.current = null
                                    }

                                    SearchTimeoutID = setTimeout(() => {
                                        setSecondaryText(WAITING_NOTICE)
                                    }, 5000)

                                }
                            })
                            .catch((err) => {
                                if (err.name !== 'AbortError') {
                                    navigate('/home', { state: { error: 'Could not reach the server. Check that the backend is running ("npm start").' } })
                                }
                            })
                    })

                    return () => {
                        controller.abort()
                        setSecondaryText(null)
                        if (SearchTimeoutID) clearTimeout(SearchTimeoutID)
                    }

                case 'searching_paused':
                    document.title = "Paused - video-chat-app"
                    setSearchParams({status: 'paused'})
                    if (isLoadingDisabled !== false) { setIsLoadingDisabled(false) }
                    setLoadingText('Paused')
                    setLoadingPaused(true)
                    searchingAPI.stop()

                    break
                case 'connecting':

                    const elem = document.getElementsByClassName('backdrop-blur')
                    if (elem && elem[0]) { elem[0].style.zIndex = '0' }
                    setSessionStatusAfterAd('searching')
                    setLoadingText('Match found...')
                    setSearchParams({status: 'connecting'})
                    setChatControlsDisabled(true)

                    return () => {
                        if (elem && elem[0]) { elem[0].style.zIndex = '-1' }
                    }

                case 'in_session':
                    setChatMessages([])
                    setSessionStatusAfterAd('post_session')
                    document.title = "In Session - video-chat-app"
                    setSearchParams({status: 'in_session'})
                    if (isLoadingDisabled !== true) { setIsLoadingDisabled(true) }

                    // A partner leaving after this mark leads to the mock ad
                    const tenSecondMarkTimeoutID = setTimeout(() => {
                        tenSecondMarkRef.current = true
                    }, 10000)

                    const intervalID = setInterval(() => {
                        if (!peerConnection.current) return
                        getSelectedCandidatePair(peerConnection.current).then((data) => {
                            bytesIO.current = data.bytesIO
                            candidates.current = data.candidates
                            if (data.candidates && peerConnection.current) {
                                if ([data.candidates.localCandidateType, data.candidates.remoteCandidateType].includes('relay')) {
                                    bandwidthControl(peerConnection.current, 75000, 10000)

                                } else {
                                    bandwidthControl(peerConnection.current, 'unlimited', 'unlimited')
                                }
                            }
                        }).catch(() => {})
                    }, 1000)

                    return () => {
                        clearTimeout(tenSecondMarkTimeoutID)
                        clearInterval(intervalID)
                        tenSecondMarkRef.current = false
                    }

                case 'post_session':

                    closePeerConnection()

                    if (playVideoAdRef && playVideoAdRef.current === undefined) {
                        playVideoAdRef.current = true
                    }
                    document.title = "Disconnected - video-chat-app"
                    setSearchParams({status: 'post_session'})
                    setRemoteTrack([])
                    if (isLoadingDisabled !== true) { setIsLoadingDisabled(true) }

                    break
                case 'ad':

                    closePeerConnection()

                    document.title = "Mock ad - video-chat-app"
                    if (isLoadingDisabled !== true) { setIsLoadingDisabled(true) }
                    setSearchParams({status: 'ad'})
                    break
                case 'loading':
                    break
                default:
                    console.log(`Invalid sessionStatus: ${sessionStatus}`)


            }
        } else {
            navigate('/home')
        }

    }, [sessionStatus])

    useEffect(() => {

        const webRTC_iceCadidateListener = async (iceCandidate) => {
            if (peerConnection && peerConnection.current ) {
                try {
                    await peerConnection.current.addIceCandidate(iceCandidate)
                } catch (err) {
                    console.log(err)
                }
            }
        }

        const hard_resetListener = () => {
            navigate('/home')
            window.location.reload(false)
        }

        const webRTC_PeerConnectionCloseListener = () => {
            closePeerConnection()
        }

        const match_foundListener = async (match, callback) => {
            getIceCredentials().then((credentials) => {
                closePeerConnection()
                try {
                    peerConnection.current = new RTCPeerConnection(credentials)
                } catch (err) {
                    console.log(`[ERR] RTCPeerConnection: ${err}`)
                    return callback({ status: 'error' })
                }
                setSessionStatus('connecting')

                partnerId.current = match.partner_id
                setUserId(match.user_id)
                callback({
                    status: "ok"
                })
            })
        }

        const join_chatListener = (callback) => {
            callback({
                status: "ok"
            })
            setChatControlsDisabled(false)
            setSessionStatus('in_session')
        }

        const searchingListener = (data) => {
            closePeerConnection()
            resetNoticeRef.current = data && RESET_NOTICES[data.reason] ? RESET_NOTICES[data.reason] : null
            setSessionStatus('searching')
        }

        const webRTC_answerListener = async (answer, callback) => {
            try {
                await peerConnection.current.setRemoteDescription(answer)
                callback('ok')
            } catch (err) {
                console.log(`[ERR] setRemoteDescription(answer): ${err}`)
                callback('error')
            }
        }

        const webRTC_initiateListener = async (callback) => {

            // Registered once per offer (re-registering would stack duplicate listeners)
            socket.off('webRTC_answer', webRTC_answerListener)
            socket.on('webRTC_answer', webRTC_answerListener)

            addTracks(peerConnection.current)
            addRemoteTracks(peerConnection.current)
            handleIceCadidates(peerConnection.current)
            connectionStateChange(peerConnection.current)
            onnegotiationneededListener(peerConnection.current)

            let offer = await peerConnection.current.createOffer()
            await peerConnection.current.setLocalDescription(offer)
            callback(offer)

            setLoadingText('Connecting...')

        }

        const webRTC_offerListener = async (offer, callback) => {

            // Listeners first: 'track' events fire while the remote offer is being applied
            addRemoteTracks(peerConnection.current)
            handleIceCadidates(peerConnection.current)
            connectionStateChange(peerConnection.current)
            onnegotiationneededListener(peerConnection.current)

            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer))

            addTracks(peerConnection.current)


            let answer = await peerConnection.current.createAnswer()
            await peerConnection.current.setLocalDescription(answer)
            callback(answer)

            setLoadingText('Connecting...')

        }

        const messageListener = (message) => {
            updateChatMessages([
                {
                    sender_id: partnerId.current,
                    message
                }
            ])
        }

        const announcementListener = (message) => {
            updateChatMessages([
                {
                    announcement: true,
                    message
                }
            ])
        }

        const in_session_endListener = (ended_by, callback) => {
            if (ended_by && ended_by === partnerId.current && tenSecondMarkRef.current === true && playVideoAdRef.current !== false) {
                // Partner ended the chat: show the mock ad, then the post-session screen
                playVideoAdRef.current = true
                setSessionStatusAfterAd('post_session')
                setSessionStatus('ad')
            } else {
                setSessionStatus('post_session')
            }
            if (typeof callback === 'function') {
                callback({
                    candidates: candidates.current,
                    bytesIO: bytesIO.current
                })
            }
        }

        // Lost the real-time connection: the server has already ended any search or session
        const disconnectListener = () => {
            closePeerConnection()
            navigate('/home', { state: { error: 'Lost connection to the server. Any search or chat in progress was ended.' } })
        }

        socket.on('webRTC_iceCadidate', webRTC_iceCadidateListener)
        socket.on('hard-reset', hard_resetListener)
        socket.on('webRTC_PeerConnectionClose', webRTC_PeerConnectionCloseListener)
        socket.on('match-found', match_foundListener)
        socket.on('join-chat', join_chatListener)
        socket.on('searching-reset', searchingListener)
        socket.on('webRTC_initiate', webRTC_initiateListener)
        socket.on('webRTC_offer', webRTC_offerListener)
        socket.on('message', messageListener)
        socket.on('announcement', announcementListener)
        socket.on('in_session_end', in_session_endListener)
        socket.on('disconnect', disconnectListener)

        return () => {

            in_sessionAPI.end({ candidates: candidates.current, bytesIO: bytesIO.current })

            socket.off('announcement', announcementListener)
            socket.off('hard-reset', hard_resetListener)
            socket.off('match-found', match_foundListener)
            socket.off('join-chat', join_chatListener)
            socket.off('searching-reset', searchingListener)
            socket.off('message', messageListener)
            socket.off('in_session_end', in_session_endListener)
            socket.off('webRTC_PeerConnectionClose', webRTC_PeerConnectionCloseListener)
            socket.off('webRTC_iceCadidate', webRTC_iceCadidateListener)
            socket.off('webRTC_answer', webRTC_answerListener)
            socket.off('webRTC_offer', webRTC_offerListener)
            socket.off('webRTC_initiate', webRTC_initiateListener)
            socket.off('disconnect', disconnectListener)
        }

    }, [])

    // sessionStatus clean-up
    useEffect( () => {
        return () => {
            switch (sessionStatus) {
                case 'searching':
                    searchingAPI.stop()
                    break
                case 'in_session':
                    closePeerConnection()
                    break
                default:
                    break
            }
        }
    }, [sessionStatus])

    // Update localStream to peerConnection
    useEffect(() => {

        if (peerConnection.current && localStream) {
            const [ videoTrack ] = localStream.getVideoTracks()
            const sender = peerConnection.current.getSenders().find((s) => s.track && videoTrack && s.track.kind === videoTrack.kind)
            if (sender) sender.replaceTrack(videoTrack)
        }

    }, [localStream])


    useEffect(() => {

        mobileQueryChange(mobileQueryTrigger)

        function handleQueryChange1 (e) {
            setMobileQueryTrigger(e.matches)
            mobileQueryChange(e.matches)
        }

        const mediaQuery1 = window.matchMedia("(max-width: 650px)")

        mediaQuery1.addEventListener('change', handleQueryChange1)

        return () => {

            closePeerConnection()

            mediaQuery1.removeEventListener('change', handleQueryChange1)

            const topBar = document.getElementById('topBar')
            if (topBar) topBar.style.display = 'block'
            const main = document.getElementById('main')
            if (main) main.style.height = 'calc(100% - (22px + 2rem))'
        }

    }, [])

    return (
        <div className="session" id='session'>

            <div className="session-cont">
                <div className="camera-side">
                    <div className="camera-side-cont">

                        <RemoteCamera sessionStatus={sessionStatus} setRemoteVideoRefState={setRemoteVideoRefState} remoteTrack={remoteTrack}/>
                        { isLoadingDisabled ? null : <Loading paused={loadingPaused} secondaryText={secondaryText}>{loadingText}</Loading> }
                        { sessionStatus === 'ad' ?

                            <MockAd onComplete={handleAdComplete} />
                            :
                            <div className="camera-side-camera" onLoad={mobileQueryChange(mobileQueryTrigger)}>
                                <div className="camera-side-camera-cont">
                                    <Camera
                                        peerConnection={peerConnection.current}
                                    />
                                </div>
                            </div>
                        }

                    </div>
                </div>

                <div className="chat-side">
                    <div className="chat-side-cont">

                        { !mobileQueryTrigger && (process.env.REACT_APP_CHAT_AD_ENABLED || 'true').toLowerCase() === 'true' ? <AboveChatAdBanner/> : null }

                        <Chat
                            chatStatus={sessionStatus}
                            partnerId={partnerId.current}
                            userId={userId}
                            chatMessages={chatMessages}
                            updateChatMessages={updateChatMessages}
                            setSessionStatus={setSessionStatus}
                            isLoadingDisabled={isLoadingDisabled}
                            chatControlsDisabled={chatControlsDisabled}
                            sessionStatusAfterAd={sessionStatusAfterAd}
                            setSessionStatusAfterAd={setSessionStatusAfterAd}
                            playVideoAdRef={playVideoAdRef}
                            candidates={candidates}
                            bytesIO={bytesIO}
                        />


                    </div>
                </div>
            </div>

        </div>
     )
}

export default Session
