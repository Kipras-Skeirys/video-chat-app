import { useState, useEffect, useContext } from 'react'
import { useNavigate } from "react-router-dom"
import Camera from '../common/Camera'
import { LocalStreamContext } from '../App'

// Keep in sync with INTERESTS in back-end/services/matchingRules.js
const INTERESTS = ['Technology', 'Music', 'Gaming', 'Travel', 'Sports', 'Art']

function FormSelect(props) {

    const form = props.form
    const setForm = props.setForm

    // Handle form changes
    function handleChange(e) {
        const update = {}
        let key = e.target.closest('fieldset').id
        let value = e.target.value
        // 'Radio' change handler (deselects prev. input by default)
        if (e.target.type === "radio") {
            update[key] = value
            setForm( (prevState) => {
                sessionStorage.setItem('matchingPref', JSON.stringify({...prevState, ...update}))
                return {...prevState, ...update}
            })
        } else if (e.target.type === "checkbox") {
            setForm((prevState) => {
                // 'Checkbox' change handler
                if (e.target.checked) {
                    //ADD
                    update[key] = [...prevState[key], ...[value]]
                    sessionStorage.setItem('matchingPref', JSON.stringify({...prevState, ...update}))
                    return({...prevState, ...update})
                }else if (!e.target.checked) {
                    //REMOVE
                    update[key] = prevState[key].slice()
                    update[key].splice(update[key].indexOf(value), 1)
                    sessionStorage.setItem('matchingPref', JSON.stringify({...prevState, ...update}))
                    return({...prevState, ...update})
                }
            })

        }
        }
        
        const [moreHidden, setMoreHidden] = useState(true)
        const hiddenElements = []
        
    function element (e, i) {
            
        const name = props.name
        const value = e.toLowerCase()

        function checkedCheckbox() {
            return form[name].includes(value)
        }

        function checkedRadio() {
            return form[name] === value
        }

        return (
            <div className="sessionSetup-option" key={i}>
                <input type={props.type} name={`${name}-${value}`} id={`${name}-${value}`} value={value} checked={props.type === "radio" ? checkedRadio() : checkedCheckbox()} onChange={(e) => handleChange(e)}/>
                <div className="sessionSetup-optionLabel-cont">
                    <label htmlFor={`${name}-${value}`} >{e}</label>
                </div>
            </div>
        )
    }

    function moreController(e, action) {
        switch(action) {
            case 'toggle':
                setMoreHidden((prevState) => {
                    if (prevState === false) {
                        e.target.closest(".FormSelect").style["z-index"] = "0"
                    } else {
                        e.target.closest(".FormSelect").style["z-index"] = "1"
                    }
                    return !prevState
                })
                break
            case 'close':
                setMoreHidden(true)
                e.target.closest(".FormSelect").style["z-index"] = "0"
                break
            case 'open':
                setMoreHidden(false)
                e.target.closest(".FormSelect").style["z-index"] = "1"
                break
            default:
                break
        }
    }

    function moreOptions(moreElements) {
        
        function handleClick(e) {
            moreController(e, 'toggle')
        }

        return (
            <>
                <button type="button" onClick={(e) => handleClick(e)} className="more-btn" style={{ visibility: moreElements.length ? 'visible' : 'hidden' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className='more-btn-svg' id='more-btn-svg'><path d="M120 256C120 286.9 94.93 312 64 312C33.07 312 8 286.9 8 256C8 225.1 33.07 200 64 200C94.93 200 120 225.1 120 256zM280 256C280 286.9 254.9 312 224 312C193.1 312 168 286.9 168 256C168 225.1 193.1 200 224 200C254.9 200 280 225.1 280 256zM328 256C328 225.1 353.1 200 384 200C414.9 200 440 225.1 440 256C440 286.9 414.9 312 384 312C353.1 312 328 286.9 328 256z"/></svg>
                </button>
                {moreHidden ? null : <div className="moreElements-cont" >{moreElements}</div>}
            </>
        )
    }

    return (
        <div className="FormSelect" onClick={(e) => { e.target.closest(".fieldset-cont").style.boxShadow  = 'none' }}>
            <div className="FormSelect-cont" onMouseLeave={(e) => { moreController(e, 'close') }}>
                <fieldset className='fieldset-cont' id={props.name}>
                    <div className="legent-cont">
                        <legend>{props.legend}</legend>
                    </div>
                    <div className="options-cont">
                        {props.options.map((e, i) => {
                            if (i <= 1) {
                                return (
                                    element(e, i)
                                )
                            }else {
                                hiddenElements.push(element(e, i))
                                return null
                            }
                        })}
                        {moreOptions(hiddenElements)}
                    </div>
                </fieldset>
            </div>
        </div>
    )
}

function SessionSetup() {
    
    let navigate = useNavigate()
    const { localStream } = useContext(LocalStreamContext)
    const [ cameraNotice, setCameraNotice ] = useState()
    
    // Defaults are compatible with each other, so two fresh sessions match straight away
    const [form, setForm] = useState(
        {
            user_interest: 'technology',
            partner_interests: INTERESTS.map((i) => i.toLowerCase())
        }
    )

    useEffect(() => {

        if (sessionStorage.matchingPref) {
            try {
                const saved = JSON.parse(sessionStorage.matchingPref)
                if (saved && typeof saved.user_interest === 'string' && Array.isArray(saved.partner_interests)) {
                    setForm(saved)
                }
            } catch (e) {
                sessionStorage.removeItem('matchingPref')
            }
        }

    }, [])
 
    // Form submit
    async function handleSubmit(e) {
        e.preventDefault()
        if (!localStream) {
            setCameraNotice('Allow camera and microphone access before you start matching.')
            return
        }
        if (form.user_interest && form.partner_interests.length) {
            // POST form data to server - resolves to true once the preferences are saved
            window.sessionSettingsPromise = fetch('/api/session-settings', {
                method: 'POST',
                body: JSON.stringify(form),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(async (response) => {
                    if (!response.ok) {
                        const json = await response.json().catch(() => ({}))
                        navigate('/home', { state: { error: json.error || `Could not save preferences (HTTP ${response.status})` } })
                        return false
                    }
                    return true
                })
                .catch((err) => {
                    console.log(err)
                    navigate('/home', { state: { error: 'Could not reach the server. Check that the backend is running ("npm start").' } })
                    return false
                }) 
            navigate('/session')

        }else{
            //Throw HTML form validation error

            // Throw error
            let invalid = Object.entries(form).map((e) => {
                if (!form[e[0]].length) {
                    document.getElementById(`${e[0]}`).style.boxShadow  = '0px 0px 0px 2px #2563EB'
                    return e[0]
                }else{
                    document.getElementById(`${e[0]}`).style.outline = 'none'
                }
            })
            // Focus on first input of invalid fieldset
            document.getElementById(invalid.find(e => e !== undefined)).getElementsByTagName('input')[0].focus()
        }
    }

    return ( 
        <form action="Submit" onSubmit={(e) => handleSubmit(e)} className="sessionSetup-form">
            <div className="sessionSetup-section">
                <h1 className="sessionSetup-section-title big-bold">About Me</h1>
                <p className="sessionSetup-section-description med-semibold gray">Pick the topic you would most like to talk about.</p>
                <FormSelect
                    form={form}
                    setForm={setForm}
                    type="radio"
                    name="user_interest"
                    legend="My Interest"
                    options={INTERESTS}
                />
            </div>
            <div className="sessionSetup-section">
                <h1 className="sessionSetup-section-title big-bold">Matching Preferences</h1>
                <p className="sessionSetup-section-description med-semibold gray">You are matched with someone whose interest you selected - and who selected yours.</p>
                <FormSelect
                    form={form}
                    setForm={setForm}
                    type="checkbox"
                    name="partner_interests"
                    legend="Partner Interests"
                    options={INTERESTS}
                />
            </div>
            <div className="sessionSetup-camera-cont">
                <div className="sessionSetup-camera-cont-cont">
                    <Camera />
                </div>
            </div>
            { cameraNotice && !localStream ? <p className="sessionSetup-notice" role="alert">{cameraNotice}</p> : null }
            <div className="sessionSetup-button-cont">
                <button className="btn-red">Start Matching</button>
            </div>
        </form>
     )
}

export default SessionSetup