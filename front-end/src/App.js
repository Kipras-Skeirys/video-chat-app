import { useEffect, useState, createContext, useRef, lazy, Suspense } from 'react'
import { Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom'
import TopBar from './common/TopBar'
import ConnectionStatus from './common/ConnectionStatus'
import Welcome from './welcome/Welcome'
import Loading from './common/Loading'
const Home = lazy(() => import('./home/Home'))
const Session = lazy(() => import('./session/Session'))


export const LocalStreamContext = createContext()

function App() {

  let location = useLocation()
  let navigate = useNavigate()

  const [ localStream, setLocalStream ] = useState()
  const [ mutedLocalStream, setMutedLocalStream ] = useState()

  // Mock-ad scheduling (kept here so it survives leaving and re-entering a session):
  // playVideoAdRef - whether an ad is due at the next ad transition
  // videoAdTimeoutIDRef - timer that makes the next ad due again (see MOCK_AD_INTERVAL_MS)
  const playVideoAdRef = useRef()
  const videoAdTimeoutIDRef = useRef()

  useEffect(() => {
    return () => {
      if (videoAdTimeoutIDRef.current) clearTimeout(videoAdTimeoutIDRef.current)
    }
  }, [])

  useEffect(() => {
    // Show the introduction once per browser session
    if (!sessionStorage.getItem('welcome_acknowledged') && location.pathname !== '/welcome') {
        navigate('/welcome', { replace: true })
    }
  })

  return (
    <div className="App">
        <TopBar />
        <ConnectionStatus />
        <main id='main'>
          <LocalStreamContext.Provider value={ { localStream, setLocalStream, mutedLocalStream, setMutedLocalStream } }>
            <Routes>
              <Route path='/welcome' element={ <Welcome/> } />

              <Route path='/home' element={<Suspense fallback={ <Loading /> }> <Home /> </Suspense>} />
              <Route path='/' element={<Suspense fallback={ <Loading /> }> <Home /> </Suspense>} />

              <Route path='/session' element={<Suspense fallback={ <Loading /> }> <Session playVideoAdRef={playVideoAdRef} videoAdTimeoutIDRef={videoAdTimeoutIDRef} /> </Suspense>} />

              <Route path='*' element={ <Navigate to='/home' replace /> } />
            </Routes>
          </LocalStreamContext.Provider>
        </main>
    </div>
  )
}

export default App
