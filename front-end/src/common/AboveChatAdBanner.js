import { useEffect, useState, useRef } from 'react'

function AboveChatAdBanner() {

    // Hooks
    const [ ad, setAd ] = useState()

    // Refs
    const bannerRef = useRef()

    function loadDesktopChatBanner(callback) {

        const desktopChatBannerIframe = document.getElementById('desktopChatBannerIframe')

        if (!desktopChatBannerIframe) {
            // Create iframe
            const iframe = document.createElement('iframe')
            iframe.id = 'desktopChatBannerIframe'
            document.getElementById('chat-side-ad').appendChild(iframe)
            // iframe style
            iframe.style.width = '300px'
            iframe.style.height = '250px'
            iframe.contentWindow.document.documentElement.style.backgroundColor = '#13212C'
            iframe.contentWindow.document.body.style.overflow = 'hidden'
            iframe.contentWindow.document.body.style.margin = '0px'     
                        
            // Add banner element - a static local placeholder
            const div = document.createElement('div')
            div.id = 'aboveChatBanner'
            div.textContent = 'banner ad placeholder'
            div.style.width = '300px'
            div.style.height = '250px'
            div.style.display = 'flex'
            div.style.justifyContent = 'center'
            div.style.alignItems = 'center'
            div.style.backgroundColor = '#3A4048'
            div.style.color = '#B8B8B8'
            div.style.fontFamily = "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            div.style.fontSize = '0.9375rem'
            iframe.contentWindow.document.body.appendChild(div)

            if (callback) callback(iframe)
        }

        if (desktopChatBannerIframe && callback) callback(desktopChatBannerIframe)

    }

    useEffect(() => {
        bannerRef.current.style.height = '0'
        bannerRef.current.style.marginBottom = '0'
        bannerRef.current.style.overflow = 'hidden'
        loadDesktopChatBanner((iframe) => {

            setAd(iframe)

            const banner = iframe.contentWindow.document.getElementById('aboveChatBanner')
            if (!banner.innerHTML) {
                bannerRef.current.style.height = '0'
                bannerRef.current.style.marginBottom = '0'
                bannerRef.current.style.overflow = 'hidden'
            } else {
                bannerRef.current.style.height = 'auto'
                bannerRef.current.style.marginBottom = '0.5rem'
                bannerRef.current.style.overflow = 'visible'
            }
            const observer = new MutationObserver(function(mutations) {
                if (!banner.innerHTML) {
                    bannerRef.current.style.height = '0'
                    bannerRef.current.style.marginBottom = '0'
                    bannerRef.current.style.overflow = 'hidden'
                } else {
                    bannerRef.current.style.height = 'auto'
                    bannerRef.current.style.marginBottom = '0.5rem'
                    bannerRef.current.style.overflow = 'visible'
                }
            })
            observer.observe(banner, { attributes: false, childList: true, characterData: false })

        })
    }, [])
    
    useEffect(() => {
        return () => {
            if (ad) {
                ad.remove()
            }
        }
    }, [ad])

    return ( 
        <div className="chat-side-ad" id='chat-side-ad' ref={bannerRef} />
    )
}

export default AboveChatAdBanner