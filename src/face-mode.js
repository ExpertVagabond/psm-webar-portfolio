/**
 * Face Filter Mode — toggleable front-camera face tracking with filters.
 * Overlays the portfolio view with webcam + MediaPipe face mesh + accessories.
 */

import * as THREE from 'three'
import { FaceTracker } from './face-tracker.js'

const FACE_POINT_COUNT = 468

const LANDMARKS = {
  noseTip: 1,
  noseBottom: 2,
  leftEye: 33,
  rightEye: 263,
  leftEyeOuter: 130,
  rightEyeOuter: 359,
  leftEyebrow: 107,
  rightEyebrow: 336,
  foreheadCenter: 10,
  upperLip: 0,
  lowerLip: 17,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
}

let renderer, scene, camera, tracker
let faceMeshPoints, faceMeshLines
let activeFilter = 'mesh'
let isActive = false

const filterObjects = {
  glasses: null,
  crown: null,
  mustache: null,
  hearts: null,
}

// Face mesh edge definitions
const FACE_MESH_EDGES = (() => {
  const edges = []
  const jaw = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
  for (let i = 0; i < jaw.length - 1; i++) edges.push([jaw[i], jaw[i + 1]])
  const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33]
  for (let i = 0; i < leftEye.length - 1; i++) edges.push([leftEye[i], leftEye[i + 1]])
  const rightEye = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263]
  for (let i = 0; i < rightEye.length - 1; i++) edges.push([rightEye[i], rightEye[i + 1]])
  const lipsOuter = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61]
  for (let i = 0; i < lipsOuter.length - 1; i++) edges.push([lipsOuter[i], lipsOuter[i + 1]])
  const nose = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2]
  for (let i = 0; i < nose.length - 1; i++) edges.push([nose[i], nose[i + 1]])
  const leftBrow = [46, 53, 52, 65, 55, 107, 66, 105, 63, 70]
  for (let i = 0; i < leftBrow.length - 1; i++) edges.push([leftBrow[i], leftBrow[i + 1]])
  const rightBrow = [276, 283, 282, 295, 285, 336, 296, 334, 293, 300]
  for (let i = 0; i < rightBrow.length - 1; i++) edges.push([rightBrow[i], rightBrow[i + 1]])
  return edges
})()

// Emotion detection
const EMOTION_RULES = [
  { name: 'Happy', emoji: '😄', color: '#00edaf', test: (bs) => (bs.mouthSmileLeft + bs.mouthSmileRight) / 2 > 0.4 },
  { name: 'Surprised', emoji: '😮', color: '#ffc828', test: (bs) => (bs.eyeWideLeft + bs.eyeWideRight) / 2 > 0.3 && bs.jawOpen > 0.3 },
  { name: 'Wink', emoji: '😉', color: '#9b30ff', test: (bs) => (bs.eyeBlinkLeft > 0.6 && bs.eyeBlinkRight < 0.3) || (bs.eyeBlinkRight > 0.6 && bs.eyeBlinkLeft < 0.3) },
  { name: 'Kiss', emoji: '😘', color: '#ff69b4', test: (bs) => bs.mouthPucker > 0.5 },
]

function detectEmotion(blendshapes) {
  const bs = {
    mouthSmileLeft: 0, mouthSmileRight: 0, eyeWideLeft: 0, eyeWideRight: 0,
    jawOpen: 0, browDownLeft: 0, browDownRight: 0, mouthFrownLeft: 0, mouthFrownRight: 0,
    eyeBlinkLeft: 0, eyeBlinkRight: 0, mouthPucker: 0,
    ...blendshapes,
  }
  for (const rule of EMOTION_RULES) {
    if (rule.test(bs)) return rule
  }
  return { name: 'Neutral', emoji: '😐', color: '#7b7390' }
}

let currentEmotion = { name: 'Neutral', emoji: '😐', color: '#7b7390' }
let emotionTimer = 0
let animFrameId = null

export async function startFaceMode() {
  if (isActive) return
  isActive = true

  const container = document.getElementById('face-overlay')
  const video = document.getElementById('face-webcam')

  container.style.display = 'block'
  video.style.display = 'block'

  // Create renderer
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10)
  camera.position.z = 1

  // Face mesh points
  const pointGeo = new THREE.BufferGeometry()
  pointGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FACE_POINT_COUNT * 3), 3))
  faceMeshPoints = new THREE.Points(pointGeo, new THREE.PointsMaterial({ color: 0x00edaf, size: 2.5, sizeAttenuation: false }))
  scene.add(faceMeshPoints)

  // Face mesh wireframe lines
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FACE_MESH_EDGES.length * 2 * 3), 3))
  faceMeshLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.4 }))
  scene.add(faceMeshLines)

  createFilters()

  // Init tracker
  const statusEl = document.getElementById('face-status')
  statusEl.textContent = 'Loading face model...'
  statusEl.style.opacity = '1'

  tracker = new FaceTracker()
  await tracker.init()

  statusEl.textContent = 'Starting camera...'
  await tracker.startCamera(video)
  statusEl.textContent = 'Face tracking active'
  setTimeout(() => { statusEl.style.opacity = '0' }, 2000)

  tracker.on('face', ({ landmarks, blendshapes }) => {
    updateMeshPoints(landmarks)
    updateMeshLines(landmarks)
    updateFilters(landmarks, blendshapes)

    const detected = detectEmotion(blendshapes)
    if (detected.name !== currentEmotion.name) {
      emotionTimer++
      if (emotionTimer > 5) {
        currentEmotion = detected
        emotionTimer = 0
      }
    } else {
      emotionTimer = 0
    }
    updateEmotionDisplay()
  })

  tracker.on('lost', () => {
    faceMeshPoints.visible = false
    faceMeshLines.visible = false
    hideAllFilters()
    updateEmotionDisplay({ name: '--', emoji: '👤', color: '#333' })
  })

  // Show face filter UI
  document.getElementById('face-ui').style.display = 'flex'
  document.getElementById('face-emotion').style.display = 'flex'

  // Filter button handlers
  document.querySelectorAll('.face-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.face-filter-btn').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      activeFilter = btn.dataset.filter
      hideAllFilters()
    })
  })

  animate()
}

export function stopFaceMode() {
  if (!isActive) return
  isActive = false

  if (tracker) tracker.stop()
  if (animFrameId) cancelAnimationFrame(animFrameId)

  const container = document.getElementById('face-overlay')
  const video = document.getElementById('face-webcam')

  // Clean up renderer
  if (renderer) {
    container.removeChild(renderer.domElement)
    renderer.dispose()
    renderer = null
  }

  container.style.display = 'none'
  video.style.display = 'none'
  document.getElementById('face-ui').style.display = 'none'
  document.getElementById('face-emotion').style.display = 'none'

  tracker = null
  scene = null
  camera = null
  faceMeshPoints = null
  faceMeshLines = null
  Object.keys(filterObjects).forEach((k) => { filterObjects[k] = null })
  activeFilter = 'mesh'
}

export function isFaceModeActive() {
  return isActive
}

// ── Filter 3D objects ──

function createFilters() {
  // Sunglasses
  const glassesGroup = new THREE.Group()
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 })
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x222222 })
  const leftLens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), lensMat)
  const rightLens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), lensMat)
  const leftFrame = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.031, 16), frameMat)
  const rightFrame = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.031, 16), frameMat)
  const bridge = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.004), frameMat)
  glassesGroup.add(leftLens, rightLens, leftFrame, rightFrame, bridge)
  glassesGroup.visible = false
  scene.add(glassesGroup)
  filterObjects.glasses = glassesGroup

  // Crown (PSM branded — purple & gold)
  const crownGroup = new THREE.Group()
  const crownMat = new THREE.MeshBasicMaterial({ color: 0xffc828, side: THREE.DoubleSide })
  const crownBase = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.015), crownMat)
  crownGroup.add(crownBase)
  for (let i = 0; i < 5; i++) {
    const x = -0.048 + i * 0.024
    const peakGeo = new THREE.BufferGeometry()
    peakGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      x - 0.01, 0, 0, x + 0.01, 0, 0, x, -0.02, 0,
    ]), 3))
    peakGeo.setIndex([0, 1, 2])
    crownGroup.add(new THREE.Mesh(peakGeo, crownMat))
  }
  const jewelMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6 })
  for (let i = 0; i < 3; i++) {
    const jewel = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), jewelMat)
    jewel.position.set(-0.024 + i * 0.024, -0.008, 0.001)
    crownGroup.add(jewel)
  }
  crownGroup.visible = false
  scene.add(crownGroup)
  filterObjects.crown = crownGroup

  // Mustache
  const mustacheGroup = new THREE.Group()
  const createSide = (dir) => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.quadraticCurveTo(0.015 * dir, 0.005, 0.03 * dir, 0.003)
    shape.quadraticCurveTo(0.04 * dir, 0.001, 0.04 * dir, -0.003)
    shape.quadraticCurveTo(0.035 * dir, -0.006, 0.02 * dir, -0.004)
    shape.quadraticCurveTo(0.01 * dir, -0.002, 0, -0.001)
    return new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x3d2b1f, side: THREE.DoubleSide }))
  }
  mustacheGroup.add(createSide(-1), createSide(1))
  mustacheGroup.visible = false
  scene.add(mustacheGroup)
  filterObjects.mustache = mustacheGroup

  // Hearts
  const heartsGroup = new THREE.Group()
  const heartColors = [0xff4466, 0xff69b4, 0xff1493, 0xdc143c, 0xff6b6b]
  for (let i = 0; i < 8; i++) {
    const s = 0.008
    const shape = new THREE.Shape()
    shape.moveTo(0, s * -0.5)
    shape.bezierCurveTo(s * 0.5, s * -1.5, s * 1.5, s * -0.5, 0, s * 0.5)
    shape.moveTo(0, s * -0.5)
    shape.bezierCurveTo(s * -0.5, s * -1.5, s * -1.5, s * -0.5, 0, s * 0.5)
    const heart = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: heartColors[i % heartColors.length], side: THREE.DoubleSide }))
    heart.userData.angle = (i / 8) * Math.PI * 2
    heart.userData.radius = 0.08 + Math.random() * 0.04
    heart.userData.speed = 0.5 + Math.random() * 0.5
    heart.userData.phase = Math.random() * Math.PI * 2
    heartsGroup.add(heart)
  }
  heartsGroup.visible = false
  scene.add(heartsGroup)
  filterObjects.hearts = heartsGroup
}

function updateMeshPoints(landmarks) {
  if (activeFilter !== 'mesh') { faceMeshPoints.visible = false; return }
  const pos = faceMeshPoints.geometry.attributes.position
  for (let i = 0; i < Math.min(landmarks.length, FACE_POINT_COUNT); i++) {
    pos.array[i * 3] = landmarks[i].x - 0.5
    pos.array[i * 3 + 1] = -(landmarks[i].y - 0.5)
    pos.array[i * 3 + 2] = -landmarks[i].z
  }
  pos.needsUpdate = true
  faceMeshPoints.visible = true
}

function updateMeshLines(landmarks) {
  if (activeFilter !== 'mesh') { faceMeshLines.visible = false; return }
  const pos = faceMeshLines.geometry.attributes.position
  let idx = 0
  for (const [a, b] of FACE_MESH_EDGES) {
    if (a < landmarks.length && b < landmarks.length) {
      pos.array[idx++] = landmarks[a].x - 0.5
      pos.array[idx++] = -(landmarks[a].y - 0.5)
      pos.array[idx++] = -landmarks[a].z
      pos.array[idx++] = landmarks[b].x - 0.5
      pos.array[idx++] = -(landmarks[b].y - 0.5)
      pos.array[idx++] = -landmarks[b].z
    }
  }
  pos.needsUpdate = true
  faceMeshLines.visible = true
}

function updateFilters(landmarks, blendshapes) {
  const lm = (idx) => ({
    x: landmarks[idx].x - 0.5,
    y: -(landmarks[idx].y - 0.5),
    z: -landmarks[idx].z,
  })

  if (activeFilter === 'glasses' && filterObjects.glasses) {
    const leftEye = lm(LANDMARKS.leftEye)
    const rightEye = lm(LANDMARKS.rightEye)
    const nose = lm(LANDMARKS.noseTip)
    const g = filterObjects.glasses
    g.children[0].position.set(leftEye.x, leftEye.y, leftEye.z + 0.01)
    g.children[1].position.set(rightEye.x, rightEye.y, rightEye.z + 0.01)
    g.children[2].position.set(leftEye.x, leftEye.y, leftEye.z + 0.01)
    g.children[3].position.set(rightEye.x, rightEye.y, rightEye.z + 0.01)
    g.children[4].position.set((leftEye.x + rightEye.x) / 2, (leftEye.y + rightEye.y) / 2, nose.z + 0.01)
    g.visible = true
  }

  if (activeFilter === 'crown' && filterObjects.crown) {
    const forehead = lm(LANDMARKS.foreheadCenter)
    const leftBrow = lm(LANDMARKS.leftEyebrow)
    const rightBrow = lm(LANDMARKS.rightEyebrow)
    const cx = (leftBrow.x + rightBrow.x) / 2
    const cy = forehead.y + 0.03
    filterObjects.crown.position.set(cx, cy, forehead.z + 0.01)
    filterObjects.crown.visible = true
  }

  if (activeFilter === 'mustache' && filterObjects.mustache) {
    const upperLip = lm(LANDMARKS.upperLip)
    const noseBottom = lm(LANDMARKS.noseBottom)
    const my = (upperLip.y + noseBottom.y) / 2
    filterObjects.mustache.position.set(upperLip.x, my, upperLip.z + 0.01)
    filterObjects.mustache.visible = true
  }

  if (activeFilter === 'hearts' && filterObjects.hearts) {
    const nose = lm(LANDMARKS.noseTip)
    const t = Date.now() * 0.001
    filterObjects.hearts.children.forEach((heart) => {
      const a = heart.userData.angle + t * heart.userData.speed
      const r = heart.userData.radius + Math.sin(t * 2 + heart.userData.phase) * 0.015
      heart.position.set(
        nose.x + Math.cos(a) * r,
        nose.y + Math.sin(a) * r * 0.8 + Math.sin(t * 3 + heart.userData.phase) * 0.01,
        nose.z + 0.02
      )
      heart.rotation.z = Math.sin(t + heart.userData.phase) * 0.3
      const scale = 0.8 + Math.sin(t * 2 + heart.userData.phase) * 0.3
      heart.scale.setScalar(scale)
    })
    filterObjects.hearts.visible = true
  }
}

function hideAllFilters() {
  if (faceMeshPoints) faceMeshPoints.visible = false
  if (faceMeshLines) faceMeshLines.visible = false
  Object.values(filterObjects).forEach((obj) => { if (obj) obj.visible = false })
}

function updateEmotionDisplay(override) {
  const emotion = override || currentEmotion
  const el = document.getElementById('face-emotion')
  if (el) {
    el.querySelector('.emotion-emoji').textContent = emotion.emoji
    const nameEl = el.querySelector('.emotion-name')
    nameEl.textContent = emotion.name
    nameEl.style.color = emotion.color
  }
}

function animate() {
  if (!isActive) return
  animFrameId = requestAnimationFrame(animate)
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}
