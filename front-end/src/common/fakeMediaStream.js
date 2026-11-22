// Builds a synthetic camera + microphone stream so the app can be tested without real devices.
// Video: a canvas with a random colour and a running clock (to tell windows apart and see frames arrive).
// Audio: a quiet continuous tone (so the mute button has something to mute).
// Must be called from a click handler - browsers only start audio after a user gesture.
export function createFakeMediaStream() {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')
    const hue = Math.floor(Math.random() * 360)

    function draw() {
        ctx.fillStyle = `hsl(${hue}, 60%, 45%)`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'white'
        ctx.textAlign = 'center'
        ctx.font = 'bold 40px sans-serif'
        ctx.fillText('Test camera', canvas.width / 2, canvas.height / 2 - 20)
        ctx.font = '32px monospace'
        ctx.fillText(new Date().toLocaleTimeString(), canvas.width / 2, canvas.height / 2 + 30)
    }
    draw()
    setInterval(draw, 1000 / 15)
    const [ videoTrack ] = canvas.captureStream(15).getVideoTracks()

    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const destination = audioContext.createMediaStreamDestination()
    gain.gain.value = 0.03
    oscillator.connect(gain).connect(destination)
    oscillator.start()
    const [ audioTrack ] = destination.stream.getAudioTracks()

    return new MediaStream([ videoTrack, audioTrack ])
}
