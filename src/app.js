/**
 * PSM WebAR Portfolio — interactive 3D showcase.
 * Click on project nodes to visit real URLs. Hover for glow. Animated entry.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

let renderer, scene, camera, controls, labelRenderer, clock, raycaster, mouse
let hoveredMesh = null
const projectMeshes = []

const portfolioItems = [
  { name: 'WebAR Archive', description: '17 8th Wall projects', color: 0x7611b7, url: 'https://8thwall-archive.pages.dev', pos: [-2.5, 0.8, 0] },
  { name: 'Coldstar', description: 'Air-gapped Solana wallet', color: 0x00b5ad, url: 'https://coldstar.dev', pos: [0, 0.8, -2.5] },
  { name: 'NorthCatch', description: 'Fishing app (iOS)', color: 0x00edaf, url: 'https://github.com/ExpertVagabond', pos: [2.5, 0.8, 0] },
  { name: 'MCP Servers', description: 'cPanel, Ordinals, Solmail', color: 0xffc828, url: 'https://github.com/ExpertVagabond/cpanel-mcp', pos: [0, 0.8, 2.5] },
  { name: 'AI / ML', description: 'Ollama, TTS, R1 models', color: 0xff4466, url: 'https://github.com/ExpertVagabond', pos: [0, 2.5, 0] },
]

function init() {
  const container = document.getElementById('viewer')
  clock = new THREE.Clock()
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

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
  scene.fog = new THREE.FogExp2(0x08080f, 0.06)

  // Camera
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(5, 3.5, 5)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.3
  controls.target.set(0, 0.8, 0)
  controls.maxPolarAngle = Math.PI / 2 + 0.2
  controls.minDistance = 2
  controls.maxDistance = 12

  // Lights
  scene.add(new THREE.AmbientLight(0x8888cc, 0.3))
  const sun = new THREE.DirectionalLight(0xffffff, 1)
  sun.position.set(5, 8, 3)
  scene.add(sun)

  const purpleLight = new THREE.PointLight(0x7611b7, 3, 12)
  purpleLight.position.set(0, 4, 0)
  scene.add(purpleLight)

  const cyanLight = new THREE.PointLight(0x00b5ad, 2, 8)
  cyanLight.position.set(-3, 1, 3)
  scene.add(cyanLight)

  // Ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.95, metalness: 0 })
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // Grid
  const grid = new THREE.GridHelper(16, 32, 0x222244, 0x111128)
  grid.material.opacity = 0.15
  grid.material.transparent = true
  grid.position.y = 0.001
  scene.add(grid)

  // Center pedestal with glow ring
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.9, roughness: 0.1 })
  )
  pedestal.position.y = 0.06
  scene.add(pedestal)

  // Glow ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.015, 16, 64),
    new THREE.MeshBasicMaterial({ color: 0x7611b7, transparent: true, opacity: 0.6 })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.12
  scene.add(ring)

  // PSM logo label
  const logoEl = document.createElement('div')
  logoEl.className = 'psm-logo'
  logoEl.innerHTML = '<span class="logo-text">PSM</span><span class="logo-sub">Purple Squirrel Media</span>'
  const logoLabel = new CSS2DObject(logoEl)
  logoLabel.position.set(0, 0.6, 0)
  scene.add(logoLabel)

  // Portfolio items with staggered entry
  const geoTypes = [
    new THREE.IcosahedronGeometry(0.35, 0),
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.DodecahedronGeometry(0.3, 0),
    new THREE.TetrahedronGeometry(0.35, 0),
    new THREE.TorusKnotGeometry(0.18, 0.06, 64, 8),
  ]

  portfolioItems.forEach((item, i) => {
    const mesh = new THREE.Mesh(
      geoTypes[i % geoTypes.length],
      new THREE.MeshStandardMaterial({
        color: item.color,
        emissive: item.color,
        emissiveIntensity: 0.15,
        metalness: 0.7,
        roughness: 0.2,
      })
    )
    // Start off-screen for animated entry
    mesh.position.set(item.pos[0], item.pos[1] + 5, item.pos[2])
    mesh.scale.setScalar(0.01)
    mesh.userData = { baseY: item.pos[1], index: i, url: item.url, targetPos: new THREE.Vector3(...item.pos), entered: false, enterDelay: i * 0.2 }
    scene.add(mesh)
    projectMeshes.push(mesh)

    // Connection line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(...item.pos),
    ])
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineDashedMaterial({ color: item.color, transparent: true, opacity: 0.15, dashSize: 0.1, gapSize: 0.05 })
    )
    line.computeLineDistances()
    scene.add(line)

    // Label
    const labelEl = document.createElement('div')
    labelEl.className = 'item-label'
    labelEl.innerHTML = `<span class="item-name">${item.name}</span><span class="item-desc">${item.description}</span>`
    const label = new CSS2DObject(labelEl)
    label.position.set(item.pos[0], item.pos[1] + 0.55, item.pos[2])
    scene.add(label)
  })

  // Particle field
  const particleCount = 800
  const particleGeo = new THREE.BufferGeometry()
  const particlePositions = new Float32Array(particleCount * 3)
  const particleColors = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 14
    particlePositions[i * 3 + 1] = Math.random() * 6
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 14
    const c = new THREE.Color().setHSL(0.75 + Math.random() * 0.15, 0.5, 0.5)
    particleColors[i * 3] = c.r
    particleColors[i * 3 + 1] = c.g
    particleColors[i * 3 + 2] = c.b
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ size: 0.02, transparent: true, opacity: 0.4, vertexColors: true })
  )
  scene.add(particles)

  // Interaction: hover + click
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('click', onClick)
  renderer.domElement.style.cursor = 'grab'

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
  })

  animate()
}

function onPointerMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
}

function onClick() {
  if (hoveredMesh && hoveredMesh.userData.url) {
    window.open(hoveredMesh.userData.url, '_blank')
  }
}

function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()
  controls.update()

  // Animated entry (staggered drop-in)
  projectMeshes.forEach((mesh) => {
    if (!mesh.userData.entered && t > mesh.userData.enterDelay + 0.5) {
      mesh.userData.entered = true
    }
    if (mesh.userData.entered) {
      const target = mesh.userData.targetPos
      mesh.position.x += (target.x - mesh.position.x) * 0.05
      mesh.position.y += (mesh.userData.baseY + Math.sin(t * 0.8 + mesh.userData.index) * 0.15 - mesh.position.y) * 0.05
      mesh.position.z += (target.z - mesh.position.z) * 0.05
      mesh.scale.x += (1 - mesh.scale.x) * 0.04
      mesh.scale.y = mesh.scale.z = mesh.scale.x
    }

    mesh.rotation.x = t * 0.3 + mesh.userData.index
    mesh.rotation.y = t * 0.5 + mesh.userData.index * 2
  })

  // Hover raycasting
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(projectMeshes)

  if (intersects.length > 0) {
    const mesh = intersects[0].object
    if (hoveredMesh !== mesh) {
      if (hoveredMesh) unhoverMesh(hoveredMesh)
      hoveredMesh = mesh
      hoverMesh(mesh)
      renderer.domElement.style.cursor = 'pointer'
    }
  } else {
    if (hoveredMesh) {
      unhoverMesh(hoveredMesh)
      hoveredMesh = null
      renderer.domElement.style.cursor = 'grab'
    }
  }

  // Glow ring rotation
  scene.children.forEach((obj) => {
    if (obj.geometry?.type === 'TorusGeometry') {
      obj.material.opacity = 0.4 + Math.sin(t * 2) * 0.2
    }
  })

  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

function hoverMesh(mesh) {
  mesh.material.emissiveIntensity = 0.6
  mesh.scale.multiplyScalar(1.2)
}

function unhoverMesh(mesh) {
  mesh.material.emissiveIntensity = 0.15
  // Scale will normalize via animation loop
}

document.addEventListener('DOMContentLoaded', init)
