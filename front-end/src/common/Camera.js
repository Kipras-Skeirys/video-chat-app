import { LocalStreamContext } from '../App'
import { useState, useRef, useEffect, useContext } from "react"

function describeMediaError(err) {
    switch (err && err.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Camera/microphone permission was denied. Allow access in your browser\'s site settings, then try again.'
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'No camera or microphone was found. Connect one (or use a virtual/fake device for testing) and try again.'
        case 'NotReadableError':
        case 'AbortError':
            return 'The camera or microphone is in use by another application or could not be started.'
        default:
            return `Could not access camera/microphone${err && err.message ? `: ${err.message}` : '.'}`
    }
}

// Asks for camera + microphone. If one of them doesn't exist (e.g. a virtual camera on a Mac without a
// microphone), falls back to whichever is available instead of failing.
function getUserMediaWithFallback(video) {
    return navigator.mediaDevices.getUserMedia({ audio: true, video })
        .catch((err) => {
            if (err.name !== 'NotFoundError' && err.name !== 'OverconstrainedError') throw err
            return navigator.mediaDevices.getUserMedia({ video })
                .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }))
                .catch(() => { throw err })
        })
}

function describePartialStream(stream) {
    if (!stream.getAudioTracks().length) return 'No microphone found - you will join with video only.'
    if (!stream.getVideoTracks().length) return 'No camera found - you will join with audio only.'
    return null
}

function Camera(props) {

    // Hooks
    const [ frontCameraToggle, setFrontCameraToggle ] = useState(true)
    const [ facingMode, setFacingMode ] = useState(true)
    const [ mute, setMute ] = useState(sessionStorage.getItem('mute') !== 'undefined' ? JSON.parse(sessionStorage.getItem('mute')) : false)
    const [ mediaError, setMediaError ] = useState()


    // Props
    const peerConnection = props.peerConnection

    // Refs
    const videoRef = useRef()
    const cameraContRef = useRef()

    const {localStream, setLocalStream} = useContext(LocalStreamContext)
    const {mutedLocalStream, setMutedLocalStream} = useContext(LocalStreamContext)
    const mediaNotice = localStream ? describePartialStream(localStream) : null
    const hasMicrophone = Boolean(localStream && localStream.getAudioTracks().length)


    let micClosedSvg = <svg className="micClosed-svg" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 20"><g id="mic-off"><path d="M12.12,3.75a3.74,3.74,0,0,0-6.8-2.17l6.8,6.8Z"/><path d="M15.25,10V8.12a.63.63,0,0,0-.63-.62H14a.62.62,0,0,0-.62.62V9.64l1.73,1.73A6.84,6.84,0,0,0,15.25,10Z"/><path d="M8.38,13.75A3.68,3.68,0,0,0,9,13.7L4.62,9.36V10A3.75,3.75,0,0,0,8.38,13.75Z"/><path d="M11.5,18.12H9.31V16.81a6.7,6.7,0,0,0,2.1-.66L10,14.73A5.16,5.16,0,0,1,8.36,15l-.48,0a5.16,5.16,0,0,1-4.5-5.2V8.12a.62.62,0,0,0-.62-.62H2.12a.62.62,0,0,0-.62.62V9.69a7.09,7.09,0,0,0,5.94,7.1v1.34H5.25a.63.63,0,0,0-.63.62v.63a.64.64,0,0,0,.63.62H11.5a.62.62,0,0,0,.62-.62v-.63A.62.62,0,0,0,11.5,18.12Z"/><path d="M16.71,15.79l-2.38-2.38L12.94,12l-1-1L4.62,3.7,1.71.79A1,1,0,0,0,.29,2.21L4.62,6.54l6.25,6.25.88.88L13.08,15l2.21,2.21a1,1,0,0,0,1.42,0A1,1,0,0,0,16.71,15.79Z"/></g></svg>
    let micOpenSvg = <svg className="micOpen-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13.75 20"><g id="mic-on"><path d="M6.88,13.75A3.75,3.75,0,0,0,10.63,10V3.75a3.75,3.75,0,0,0-7.5,0V10A3.74,3.74,0,0,0,6.88,13.75Z"/><path d="M13.13,7.5H12.5a.62.62,0,0,0-.62.63V10a5,5,0,0,1-5,5l-.48,0a5.16,5.16,0,0,1-4.5-5.2V8.13a.63.63,0,0,0-.63-.63H.63A.63.63,0,0,0,0,8.13V9.69a7.09,7.09,0,0,0,5.94,7.1v1.34H3.75a.62.62,0,0,0-.62.62v.63a.62.62,0,0,0,.62.62H10a.63.63,0,0,0,.63-.62v-.63a.62.62,0,0,0-.63-.62H7.81V16.81A6.9,6.9,0,0,0,13.75,10V8.13A.63.63,0,0,0,13.13,7.5Z"/></g></svg>

    function initLocalStream(e, cameraToggle = true, callback) {
        if (e) { e.preventDefault() }
        if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setMediaError('Camera access needs a secure page: open the app via http://localhost or over HTTPS.')
            return
        }
        setMediaError(null)
        getUserMediaWithFallback(
                {
                    facingMode: cameraToggle ? 'user' : 'environment',
                    // width: { ideal: 1920 },
                    // height: { ideal: 1080 }
                })
            .then(stream => {
                const [ audioTrack ] = stream.getAudioTracks()
                if (sessionStorage.getItem('mute') === 'undefined') {
                    sessionStorage.setItem('mute', false)
                    setMute(false)
                } else if (audioTrack) {
                    audioTrack.enabled = !mute
                }
                setLocalStream(stream)
                if (callback) {
                    callback(stream)
                }
            }).catch((err) => {
                console.log(err)
                if (localStream) {
                    // Switching cameras failed - keep the current one
                    setFacingMode(false)
                } else {
                    setMediaError(describeMediaError(err))
                }
            })

    }

    function muteToggle() {

        setMute((prev) => {

            sessionStorage.setItem('mute', !prev)
            localStream.getAudioTracks().forEach((track) => { track.enabled = prev })
            if (peerConnection) {
                peerConnection.getSenders().forEach((sender) => {
                    if (sender.track && sender.track.kind === 'audio') {
                        sender.track.enabled = prev
                    }
                })
            }

            return !prev
        })

    }

    useEffect(() => {
        if (localStream && videoRef.current.srcObject !== localStream){

            // Remove audioTrack for local use(chrome autoplay w/ audio fix)
            const muted = localStream.clone()
            const audioTrack = muted.getAudioTracks()
            if (audioTrack.length > 0) {
                muted.removeTrack(audioTrack[0])
            }

            if (!videoRef.current.srcObject) {
                videoRef.current.srcObject = muted
            } else if (videoRef.current.srcObject !== localStream) {
                videoRef.current.srcObject = muted

            }

            videoRef.current.play().catch( () => {} )

            setMutedLocalStream(muted)

        }
    }, [localStream])

    useEffect(() => {
        if (videoRef && videoRef.current) {
            videoRef.current.addEventListener( "loadedmetadata", function (e) {
                if (videoRef && videoRef.current && cameraContRef && cameraContRef.current) {
                    if (this.videoWidth >= this.videoHeight) {
                        cameraContRef.current.style.width = '100%'
                        cameraContRef.current.style.height = 'fit-content'
                        videoRef.current.style.width = '100%'
                        videoRef.current.style.height = 'auto'
                    } else {
                        cameraContRef.current.style.width = 'fit-content'
                        cameraContRef.current.style.height = '100%'
                        videoRef.current.style.width = 'auto'
                        videoRef.current.style.height = '100%'
                    }
                }
            })
        }
    })

    function facingModeToggle (e) {

        if (frontCameraToggle) {
            initLocalStream(e, false)
        } else {
            initLocalStream(e, true)
        }

        setFrontCameraToggle((prev) => {
            return !prev
        })
        
    }

    return (
        <div className="camera-cont" id='camera-cont' ref={cameraContRef}>
            { !localStream
                ?
                <div className="request-camera-cont">
                    <div className="request-camera-button-cont">
                        <input type="button" value={mediaError ? 'Try Again' : 'Request Camera Access'} className="request-camera-button" onClick={() => initLocalStream()}/>
                        { mediaError ? <p className="camera-error" role="alert">{mediaError}</p> : null }
                    </div>
                </div>
                :
                <>
                    <video className="camera" ref={videoRef} autoPlay={true} playsInline={true} muted={true}>
                    </video>
                    { hasMicrophone ?
                        <div className="mic-control-cont" onClick={ () => muteToggle() }>
                            <input type="checkbox" className="mic-control" readOnly={true} checked={!mute}></input>
                            {mute ? micClosedSvg : micOpenSvg}
                        </div>
                        :
                        null
                    }
                    { mediaNotice ? <p className="camera-notice" role="status">{mediaNotice}</p> : null }
                    { facingMode
                        ?
                        <div className="rotate-camera-cont" onClick={(e) => { facingModeToggle(e) }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="17.5" viewBox="0 0 20 17.5"><defs></defs><path d="M5.824,33.281,5.418,34.5H2.5A2.5,2.5,0,0,0,0,37V47a2.5,2.5,0,0,0,2.5,2.5h15A2.5,2.5,0,0,0,20,47V37a2.5,2.5,0,0,0-2.5-2.5H14.582l-.406-1.219A1.87,1.87,0,0,0,12.4,32H7.6A1.87,1.87,0,0,0,5.824,33.281ZM15,40.75a.627.627,0,0,1-.625.625h-3a.442.442,0,0,1-.312-.754l.926-.926a2.829,2.829,0,0,0-4,.012l-.77.77A.936.936,0,0,1,5.9,39.152l.77-.77a4.706,4.706,0,0,1,6.648-.016l.926-.926a.442.442,0,0,1,.754.312ZM5,43.25a.627.627,0,0,1,.625-.625h3a.442.442,0,0,1,.312.754l-.926.926a2.829,2.829,0,0,0,4-.012l.77-.77A.936.936,0,1,1,14.1,44.848l-.77.77a4.706,4.706,0,0,1-6.648.016l-.926.926A.442.442,0,0,1,5,46.246Z" transform="translate(0 -32)"/></svg>
                        </div>
                        :
                        null
                    }
                </>

            }
        </div>
     )
}

export default Camera