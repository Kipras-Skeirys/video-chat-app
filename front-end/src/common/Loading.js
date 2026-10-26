import { useRef, useState } from 'react'

function LoadingBottom(props) {

    // Props
    const logo = props.logo
    const text = props.children

    let element

    if (logo === true){
        element = <span className="loading-logo med-semibold">video-chat-app</span>
    }else if(text) {
        element = <span className="med-semibold">{text}</span>
    }else{
        return null
    }

    return ( 
        <div className="loading-bottom">
            {element}
        </div>
     )
}

function Loading(props) {

    // Props
    const paused = props.paused
    const secondaryText = props.secondaryText

    // Hooks
    const loadingRef = useRef()

    // State
    const [ secondaryTextClose, setSecondaryTextClose] = useState(false)

    if (paused && loadingRef.current) {
        loadingRef.current.style.animationPlayState = 'paused'
        loadingRef.current.style.filter = 'grayscale(1)'
    }else if (loadingRef.current) {
        loadingRef.current.style.animationPlayState = 'running'
        loadingRef.current.style.filter = 'grayscale(0)'
    }

    function handleDismiss() {
        setSecondaryTextClose(true)
    }

    return (
        <div className="loading-cont">
            <div className="loading">
                <svg ref={loadingRef} className="loading-icon" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" data-name="Layer 1" viewBox="0 0 44 44" > <defs> <linearGradient id="linear-gradient" x1="0.34" x2="43.67" y1="5.5" y2="5.5" gradientTransform="translate(-.08 .06)" gradientUnits="userSpaceOnUse" > <stop offset="0.01" stopColor="#2563eb"></stop> <stop offset="1" stopColor="#60a5fa"></stop> </linearGradient> <linearGradient id="linear-gradient-2" x1="0.34" x2="43.67" y1="38.5" y2="38.5" xlinkHref="#linear-gradient" ></linearGradient> <linearGradient id="linear-gradient-3" x1="0.34" x2="43.67" y1="22" y2="22" xlinkHref="#linear-gradient" ></linearGradient> <linearGradient id="linear-gradient-5" x1="0.34" x2="43.67" y1="13.75" y2="13.75" xlinkHref="#linear-gradient" ></linearGradient> <linearGradient id="linear-gradient-6" x1="0.34" x2="43.67" y1="30.25" y2="30.25" xlinkHref="#linear-gradient" ></linearGradient> <linearGradient id="linear-gradient-7" x1="0.34" x2="43.67" y1="36.29" y2="36.29" xlinkHref="#linear-gradient" ></linearGradient> <linearGradient id="linear-gradient-8" x1="0.34" x2="43.67" y1="7.71" y2="7.71" xlinkHref="#linear-gradient" ></linearGradient> <linearGradient id="linear-gradient-10" x1="0.34" x2="43.67" y1="30.25" y2="30.25" xlinkHref="#linear-gradient" ></linearGradient> <linearGradient id="linear-gradient-11" x1="0.34" x2="43.67" y1="7.71" y2="7.71" xlinkHref="#linear-gradient" ></linearGradient> <linearGradient id="linear-gradient-12" x1="0.34" x2="43.67" y1="36.29" y2="36.29" xlinkHref="#linear-gradient" ></linearGradient> </defs> <g data-name="Group 66"> <path fill="url(#linear-gradient)" d="M22 11a2 2 0 01-2-2V2a2 2 0 114 0v7a2 2 0 01-2 2z" data-name="Line 25" ></path> <path fill="url(#linear-gradient-2)" d="M22 44a2 2 0 01-2-2v-7a2 2 0 014 0v7a2 2 0 01-2 2z" data-name="Line 26" ></path> <path fill="url(#linear-gradient-3)" d="M42 24h-7a2 2 0 010-4h7a2 2 0 010 4z" data-name="Line 27" ></path> <path fill="url(#linear-gradient-3)" d="M9 24H2a2 2 0 110-4h7a2 2 0 010 4z" data-name="Line 34" ></path> <path fill="url(#linear-gradient-5)" d="M33.25 17.49a2 2 0 01-1.73-1 2 2 0 01.73-2.73l6.06-3.5a2 2 0 112 3.47l-6.06 3.5a2 2 0 01-1 .26z" data-name="Line 28" ></path> <path fill="url(#linear-gradient-6)" d="M4.67 34a2 2 0 01-1.73-1 2 2 0 01.73-2.73l6.06-3.5a2 2 0 112 3.47l-6.06 3.5a2 2 0 01-1 .26z" data-name="Line 35" ></path> <path fill="url(#linear-gradient-7)" d="M32 41.31a2 2 0 01-1.74-1l-3.5-6.06a2 2 0 013.47-2l3.5 6.06a2 2 0 01-.73 2.74 2 2 0 01-1 .26z" data-name="Line 29" ></path> <path fill="url(#linear-gradient-8)" d="M15.5 12.74a2 2 0 01-1.74-1l-3.5-6.06a2 2 0 013.47-2l3.5 6.06a2 2 0 01-1.73 3z" data-name="Line 30" ></path> <path fill="url(#linear-gradient-5)" d="M10.73 17.49a2 2 0 01-1-.26l-6.06-3.5a2 2 0 012-3.47l6.06 3.5a2 2 0 01-1 3.73z" data-name="Line 36" ></path> <path fill="url(#linear-gradient-10)" d="M39.31 34a2 2 0 01-1-.26l-6.06-3.5a2 2 0 012-3.47l6.06 3.5a2 2 0 01-1 3.73z" data-name="Line 31" ></path> <path fill="url(#linear-gradient-11)" d="M28.49 12.74a2 2 0 01-1.73-3l3.5-6.06a2 2 0 013.47 2l-3.5 6.06a2 2 0 01-1.74 1z" data-name="Line 32" ></path> <path fill="url(#linear-gradient-12)" d="M12 41.31a2 2 0 01-1.73-3l3.5-6.06a2 2 0 013.47 2l-3.5 6.06a2 2 0 01-1.74 1z" data-name="Line 33" ></path> </g> </svg>
                <LoadingBottom {...props}/>
                { secondaryText && !secondaryTextClose ?
                    <div className="loading-secondaryText">
                        <span>{secondaryText}<button type="button" className="loading-dismiss" onClick={handleDismiss}>Dismiss</button></span>
                    </div>
                    :
                    null
                }
            </div>
        </div>
     )
}

export default Loading