/**
 * Face tracker — MediaPipe Face Landmarker with blendshape extraction.
 * Copied from webar-face-filters for PSM Portfolio face filter mode.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export class FaceTracker {
  constructor() {
    this.landmarker = null
    this.video = null
    this.isTracking = false
    this._listeners = {}
    this._lastTime = -1
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(fn)
    return this
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach((fn) => fn(data))
  }

  async init() {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    )

    this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    })

    return this
  }

  async startCamera(videoEl) {
    this.video = videoEl
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 },
    })
    videoEl.srcObject = stream
    await new Promise((r) => { videoEl.onloadeddata = r })
    videoEl.play()
    this.isTracking = true
    this._tick()
  }

  _tick() {
    if (!this.isTracking || !this.landmarker || !this.video) return

    const now = performance.now()
    if (now === this._lastTime) {
      requestAnimationFrame(() => this._tick())
      return
    }
    this._lastTime = now

    if (this.video.readyState >= 2) {
      const results = this.landmarker.detectForVideo(this.video, now)

      if (results.faceLandmarks?.length > 0) {
        const landmarks = results.faceLandmarks[0]
        const blendshapes = {}

        if (results.faceBlendshapes?.[0]) {
          results.faceBlendshapes[0].categories.forEach((b) => {
            blendshapes[b.categoryName] = b.score
          })
        }

        const matrix = results.facialTransformationMatrixes?.[0]?.data || null

        this._emit('face', { landmarks, blendshapes, matrix })
      } else {
        this._emit('lost', {})
      }
    }

    requestAnimationFrame(() => this._tick())
  }

  stop() {
    this.isTracking = false
    if (this.video?.srcObject) {
      this.video.srcObject.getTracks().forEach((t) => t.stop())
    }
  }
}
