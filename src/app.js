/**
 * PSM WebAR Portfolio — branded 3D showcase.
 * MVP: Interactive 3D scene with PSM branding, orbit controls, and portfolio items.
 * Phase 2: MindAR image target detection (scan business card to launch).
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

let renderer, scene, camera, controls, labelRenderer, clock
const portfolioItems = [
  { name: 'WebAR', description: '17 archived projects', color: 0x7611b7, pos: [-2, 0.5, 0] },
  { name: 'Coldstar', description: 'Air-gapped Solana wallet', color: 0x00b5ad, pos: [0, 0.5, -2] },
  { name: 'NorthCatch', description: 'Fishing app (iOS)', color: 0x00edaf, pos: [2, 0.5, 0] },
  { name: 'MCP Servers', description: 'cPanel, Ordinals, Solmail', color: 0xffc828, pos: [0, 0.5, 2] },
  { name: 'AI/ML', description: 'Ollama, TTS, R1 models', color: 0xff4466, pos: [0, 2, 0] },
]

function init() {
  const container = document.getElementById('viewer')
  clock = new THREE.Clock()

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.5
  container.appendChild(renderer.domElement)

  // Label renderer
  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  container.appendChild(labelRenderer.domElement)

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x08080f)
  scene.fog = new THREE.FogExp2(0x08080f, 0.08)

  // Camera
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(4, 3, 4)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.5
  controls.target.set(0, 0.8, 0)
  controls.maxPolarAngle = Math.PI / 2 + 0.2
  controls.minDistance = 2
  controls.maxDistance = 12

  // Lights
  scene.add(new THREE.AmbientLight(0x8888cc, 0.4))
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(5, 8, 3)
  scene.add(sun)

  const pointLight = new THREE.PointLight(0x7611b7, 2, 10)
  pointLight.position.set(0, 3, 0)
  scene.add(pointLight)

  // Ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 64),
    new THREE.MeshStandardMaterial({ color: 0x111119, roughness: 0.95, metalness: 0 })
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // Grid
  const grid = new THREE.GridHelper(12, 24, 0x222244, 0x151528)
  grid.material.opacity = 0.2
  grid.material.transparent = true
  grid.position.y = 0.001
  scene.add(grid)

  // Center pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 0.1, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.8, roughness: 0.2 })
  )
  pedestal.position.y = 0.05
  scene.add(pedestal)

  // PSM logo text (floating)
  const logoEl = document.createElement('div')
  logoEl.className = 'psm-logo'
  logoEl.innerHTML = '<span class="logo-text">PSM</span><span class="logo-sub">Purple Squirrel Media</span>'
  const logoLabel = new CSS2DObject(logoEl)
  logoLabel.position.set(0, 0.6, 0)
  scene.add(logoLabel)

  // Portfolio items — floating geometric shapes
  portfolioItems.forEach((item, i) => {
    const geos = [
      new THREE.IcosahedronGeometry(0.3, 0),
      new THREE.OctahedronGeometry(0.3, 0),
      new THREE.DodecahedronGeometry(0.25, 0),
      new THREE.TetrahedronGeometry(0.3, 0),
      new THREE.TorusKnotGeometry(0.15, 0.05, 64, 8),
    ]

    const mesh = new THREE.Mesh(
      geos[i % geos.length],
      new THREE.MeshStandardMaterial({
        color: item.color,
        emissive: item.color,
        emissiveIntensity: 0.2,
        metalness: 0.6,
        roughness: 0.3,
      })
    )
    mesh.position.set(...item.pos)
    mesh.userData = { baseY: item.pos[1], index: i }
    scene.add(mesh)

    // Connection line from center
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(...item.pos),
    ])
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: item.color, transparent: true, opacity: 0.2 })
    )
    scene.add(line)

    // Floating label
    const labelEl = document.createElement('div')
    labelEl.className = 'item-label'
    labelEl.innerHTML = `<span class="item-name">${item.name}</span><span class="item-desc">${item.description}</span>`
    const label = new CSS2DObject(labelEl)
    label.position.set(item.pos[0], item.pos[1] + 0.5, item.pos[2])
    scene.add(label)
  })

  // Particle field
  const particleGeo = new THREE.BufferGeometry()
  const particleCount = 500
  const particlePositions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 10
    particlePositions[i * 3 + 1] = Math.random() * 5
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: 0x7611b7, size: 0.02, transparent: true, opacity: 0.5 })
  )
  scene.add(particles)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
  })

  animate()
}

function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()
  controls.update()

  // Animate portfolio shapes
  scene.traverse((obj) => {
    if (obj.userData?.baseY !== undefined) {
      obj.position.y = obj.userData.baseY + Math.sin(t * 0.8 + obj.userData.index) * 0.15
      obj.rotation.x = t * 0.3 + obj.userData.index
      obj.rotation.y = t * 0.5 + obj.userData.index * 2
    }
  })

  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

document.addEventListener('DOMContentLoaded', init)
