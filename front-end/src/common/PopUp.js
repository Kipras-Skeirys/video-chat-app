import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

function PopUp(props) {

    // Props
    const isBackHidden = props.isBackHidden
    const isCloseHidden = props.isCloseHidden
    const setPopUpActive = props.setPopUpActive
    const children = props.children

    let navigate = useNavigate()

    function handleClick(e) {
        let name = e.target.closest('[role="button"]').getAttribute("name")
        if (name === 'back') {
            navigate(-1)
        }else if (name === 'close') {
            setPopUpActive(false)
        }
    }

    return (
        <div className="popUp">
            <div className="popUp-cont">
                <div className="popUp-top">
                    <div className="popUp-top-cont">
                        <div className="backBtn-cont" name="back" role="button" aria-label="Back" onClick={handleClick} hidden={isBackHidden}>
                            <div className="backBtn">
                            <svg xmlns="http://www.w3.org/2000/svg"  height="24" viewBox="0 0 25 24.367" > <path fill="#fff" d="M14.371 22.735l-1.239 1.239a1.334 1.334 0 01-1.892 0L.393 13.132a1.334 1.334 0 010-1.892L11.24.393a1.334 1.334 0 011.892 0l1.239 1.239a1.341 1.341 0 01-.021 1.918l-6.725 6.4h16.036A1.336 1.336 0 0125 11.289v1.786a1.336 1.336 0 01-1.339 1.339H7.625l6.725 6.407a1.331 1.331 0 01.022 1.914z" ></path> </svg>
                            </div>
                        </div>
                        <div className="closeBtn-cont" name="close" role="button" aria-label="Close" onClick={handleClick} hidden={isCloseHidden} >
                            <div className="closeBtn">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13.828" height="13.828" viewBox="0 0 13.828 13.828"> <g transform="translate(571.914 -139.086)"> <line y1="11" x2="11" transform="translate(-570.5 140.5)" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2" /> <line x1="11" y1="11" transform="translate(-570.5 140.5)" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2" /> </g> </svg>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="popUp-main">
                    {children}
                </div>
            </div>
        </div>
     )
}

export default PopUp