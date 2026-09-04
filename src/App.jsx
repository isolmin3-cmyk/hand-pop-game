import { useEffect, useRef, useState } from 'react'
import './App.css'

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]]
const FRAME_COUNT = 64
const frameUrl = (index) => `/flower-frames/frame-${String(index + 1).padStart(3, '0')}.jpg`
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0))

function getClosedness(hand) {
  const palm = Math.max(distance(hand[0], hand[9]), 0.001)
  const fingerRatios = [[8,5],[12,9],[16,13],[20,17]].map(([tip, base]) => distance(hand[tip], hand[0]) / Math.max(distance(hand[base], hand[0]), palm * 0.6))
  const average = fingerRatios.reduce((sum, value) => sum + value, 0) / fingerRatios.length
  const openness = Math.min(1, Math.max(0, (average - 1.12) / 0.78))
  return 1 - openness
}

function App() {
  const [cameraState, setCameraState] = useState('off')
  const [frameIndex, setFrameIndex] = useState(0)
  const cameraRef = useRef(null)
  const overlayRef = useRef(null)
  const landmarkerRef = useRef(null)
  const streamRef = useRef(null)
  const animationRef = useRef(null)
  const smoothedClosedRef = useRef(0)

  function drawHand(hand) {
    const canvas = overlayRef.current
    const video = cameraRef.current
    if (!canvas || !video) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!hand) return
    const point = (landmark) => ({ x: (1 - landmark.x) * canvas.width, y: landmark.y * canvas.height })
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = 'rgba(255,255,255,.88)'
    context.lineWidth = Math.max(3, canvas.width / 150)
    HAND_CONNECTIONS.forEach(([from, to]) => {
      const start = point(hand[from]); const end = point(hand[to])
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke()
    })
    hand.forEach((landmark, index) => {
      const p = point(landmark)
      context.beginPath(); context.arc(p.x, p.y, index % 4 === 0 ? 7 : 4, 0, Math.PI * 2)
      context.fillStyle = index % 4 === 0 ? '#ffcbda' : '#ffffff'; context.fill()
    })
  }

  async function startCamera() {
    if (cameraState === 'loading' || cameraState === 'on') return
    setCameraState('loading')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
      if (!landmarkerRef.current) {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks('/wasm')
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' },
          runningMode: 'VIDEO', numHands: 1,
          minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.55, minTrackingConfidence: 0.55,
        })
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      streamRef.current = stream
      cameraRef.current.srcObject = stream
      await cameraRef.current.play()
      setCameraState('on')

      let lastVideoTime = -1
      const detect = () => {
        const video = cameraRef.current
        if (!video || !landmarkerRef.current || !streamRef.current) return
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime
          const result = landmarkerRef.current.detectForVideo(video, performance.now())
          const hand = result.landmarks?.[0]
          drawHand(hand)
          if (hand) {
            const rawClosed = getClosedness(hand)
            smoothedClosedRef.current += (rawClosed - smoothedClosedRef.current) * 0.2
            const nextFrame = Math.round(smoothedClosedRef.current * (FRAME_COUNT - 1))
            setFrameIndex((current) => current === nextFrame ? current : nextFrame)
          }
        }
        animationRef.current = requestAnimationFrame(detect)
      }
      detect()
    } catch (error) {
      console.error(error)
      stopCamera(false)
      setCameraState('error')
    }
  }

  function stopCamera() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (cameraRef.current) cameraRef.current.srcObject = null
    drawHand(null)
    setCameraState('off')
  }

  useEffect(() => {
    const images = Array.from({ length: FRAME_COUNT }, (_, index) => {
      const image = new Image()
      image.src = frameUrl(index)
      return image
    })
    return () => {
      images.forEach((image) => { image.src = '' })
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      landmarkerRef.current?.close()
    }
  }, [])

  return (
    <main className="flower-experience">
      <img className="flower-film" src={frameUrl(frameIndex)} alt="손을 오므리면 활짝 피는 꽃" draggable="false" />

      <section className={`camera-pip ${cameraState === 'on' ? 'is-on' : ''}`} aria-label="손 인식 카메라">
        <video ref={cameraRef} className="pip-video" muted playsInline aria-label="실시간 카메라 화면" />
        <canvas ref={overlayRef} className="pip-overlay" aria-hidden="true" />
        {cameraState !== 'on' && <button type="button" className="camera-start" onClick={startCamera} disabled={cameraState === 'loading'} aria-label="카메라 켜기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h7A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 16.5v-9Zm12 3 4-2v7l-4-2v-3Z" /></svg></button>}
        {cameraState === 'on' && <i className="live-dot" aria-hidden="true" />}
      </section>
    </main>
  )
}

export default App
