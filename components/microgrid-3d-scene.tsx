'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import {
  BatteryChemistry,
  Mode,
  StepTelemetry,
  Weather
} from '@/lib/microgrid-types'
import { Compass, Eye, Info, Maximize2, Minimize2, Moon, Sun } from 'lucide-react'

interface Microgrid3DSceneProps {
  currentStep: StepTelemetry
  weather: Weather
  batteryChemistry: BatteryChemistry
  pvRatedKw: number
  dieselRatedKw: number
  batteryCapacityKwh: number
  loadProfile: string
  mode: Mode
  onSelectSubsystem?: (subsystem: 'pv' | 'bess' | 'dg' | 'bus' | 'load') => void
}

type AssetId = 'pv' | 'bess' | 'dg' | 'bus' | 'load'
type CameraView = 'isometric' | 'solar' | 'battery' | 'diesel' | 'substation' | 'load' | 'ground'
type V3 = [number, number, number]

const CAMERA_VIEWS: Record<CameraView, { pos: V3; target: V3 }> = {
  isometric: { pos: [45, 38, 50], target: [0, 2, 0] },
  solar: { pos: [-18, 12, -18], target: [-20, 2, -10] },
  battery: { pos: [-12, 10, 24], target: [-16, 2, 12] },
  diesel: { pos: [26, 12, -16], target: [18, 3, -12] },
  substation: { pos: [6, 14, 12], target: [0, 2, 0] },
  load: { pos: [24, 14, 30], target: [18, 3, 16] },
  ground: { pos: [-3, 1.75, 44], target: [0, 3, 6] }
}

const VIEW_FOR_ASSET: Record<AssetId, CameraView> = {
  pv: 'solar',
  bess: 'battery',
  dg: 'diesel',
  bus: 'substation',
  load: 'load'
}

const ASSET_NAMES: Record<AssetId, string> = {
  pv: 'Solar PV Park',
  bess: 'Battery Energy Storage',
  dg: 'Diesel Generator House',
  bus: 'AC Substation and Bus',
  load: 'Consumer Demand Site'
}

const sstep = THREE.MathUtils.smoothstep
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// ---------------------------------------------------------------------------
// Procedural helpers (deterministic random, canvas textures, geometry builders)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: [number, number]; srgb?: boolean } = {}
) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1])
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function gravelTexture(rep: [number, number]) {
  const r = mulberry32(7)
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#474d54'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 14000; i++) {
      const v = Math.floor(55 + r() * 105)
      g.fillStyle = `rgb(${v},${v},${v + 4})`
      const s = 0.8 + r() * 2.4
      g.fillRect(r() * w, r() * h, s, s)
    }
  }, { repeat: rep })
}

function grassTexture(rep: [number, number]) {
  const r = mulberry32(21)
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#5b7a3c'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${90 + r() * 60},${100 + r() * 40},${40 + r() * 30},0.10)`
      g.beginPath()
      g.arc(r() * w, r() * h, 30 + r() * 80, 0, Math.PI * 2)
      g.fill()
    }
    const greens = ['#3f6a2c', '#4d7d33', '#6a8f3a', '#7c9a45', '#8a8a45', '#6c5d3a']
    for (let i = 0; i < 9000; i++) {
      g.strokeStyle = greens[Math.floor(r() * greens.length)]
      g.lineWidth = 1
      const x = r() * w
      const y = r() * h
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6)
      g.stroke()
    }
  }, { repeat: rep })
}

function asphaltTexture() {
  const r = mulberry32(33)
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#2b2f35'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 9000; i++) {
      const v = Math.floor(30 + r() * 60)
      g.fillStyle = `rgb(${v},${v},${v + 3})`
      g.fillRect(r() * w, r() * h, 1 + r() * 1.6, 1 + r() * 1.6)
    }
    g.fillStyle = 'rgba(230,230,230,0.7)'
    g.fillRect(0, 10, w, 5)
    g.fillRect(0, h - 15, w, 5)
    g.fillStyle = 'rgba(235,190,40,0.85)'
    for (let x = 0; x < w; x += 128) g.fillRect(x, h / 2 - 3, 64, 6)
  })
}

function concreteTexture() {
  const r = mulberry32(5)
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#8d9299'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 7000; i++) {
      const v = Math.floor(120 + r() * 50)
      g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(60,55,50,${0.03 + r() * 0.05})`
      g.beginPath()
      g.arc(r() * w, r() * h, 20 + r() * 60, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(50,55,60,0.7)'
    g.lineWidth = 2
    for (let p = 0; p <= w; p += 256) {
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke()
      g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke()
    }
  }, { repeat: [5, 5] })
}

function pvTexture() {
  const r = mulberry32(99)
  return canvasTexture(768, 512, (g) => {
    g.fillStyle = '#0a1c3a'
    g.fillRect(0, 0, 768, 512)
    for (let mi = 0; mi < 3; mi++) {
      for (let mj = 0; mj < 2; mj++) {
        const mx = mi * 256
        const my = mj * 256
        g.fillStyle = '#0d2750'
        g.fillRect(mx + 4, my + 4, 248, 248)
        for (let c = 0; c < 6; c++) {
          for (let row = 0; row < 10; row++) {
            const s = r() * 26
            g.fillStyle = `rgb(${Math.floor(12 + s * 0.3)},${Math.floor(36 + s * 0.7)},${Math.floor(84 + s * 1.3)})`
            g.fillRect(mx + 8 + c * 40, my + 8 + row * 24, 38, 22)
          }
        }
        g.fillStyle = 'rgba(205,218,240,0.35)'
        for (let c = 0; c < 6; c++) {
          for (let k = 1; k <= 2; k++) g.fillRect(mx + 8 + c * 40 + k * 12.5, my + 8, 0.9, 240)
        }
        g.strokeStyle = '#c9d0da'
        g.lineWidth = 5
        g.strokeRect(mx + 2, my + 2, 252, 252)
      }
    }
  })
}

function corrugationTexture() {
  return canvasTexture(256, 64, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const v = Math.floor(128 + 100 * Math.sin((x / w) * Math.PI * 2 * 16))
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(x, 0, 1, h)
    }
  }, { srgb: false, repeat: [2.5, 1] })
}

function louverTextures() {
  const draw = (emissive: boolean) =>
    canvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = emissive ? '#000' : '#2a323d'
      g.fillRect(0, 0, w, h)
      for (let y = 0; y < h; y += 14) {
        if (emissive) {
          g.fillStyle = '#ff7a1f'
          g.fillRect(0, y + 9, w, 3)
        } else {
          const grad = g.createLinearGradient(0, y, 0, y + 14)
          grad.addColorStop(0, '#48525f')
          grad.addColorStop(1, '#1b2129')
          g.fillStyle = grad
          g.fillRect(0, y, w, 14)
        }
      }
    })
  return { map: draw(false), emissive: draw(true) }
}

function fenceTexture(len: number) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.strokeStyle = '#a8b2bd'
    g.lineWidth = 2.5
    for (let i = -h; i <= w + h; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke()
      g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke()
    }
  }, { repeat: [len / 1.4, 1.6] })
}

function facadeTextures(seed: number) {
  const rA = mulberry32(seed)
  const rB = mulberry32(seed)
  const base = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#b9bec6'
    g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(60,70,80,0.18)'
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 2)
    for (let row = 0; row < 3; row++) {
      for (let c = 0; c < 6; c++) {
        const x = 26 + c * 80
        const y = 90 + row * 130
        rA()
        const grad = g.createLinearGradient(x, y, x + 52, y + 74)
        grad.addColorStop(0, '#3b5f86')
        grad.addColorStop(1, '#122338')
        g.fillStyle = grad
        g.fillRect(x, y, 52, 74)
        g.strokeStyle = '#7d8590'
        g.lineWidth = 3
        g.strokeRect(x, y, 52, 74)
      }
    }
  })
  const glow = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, w, h)
    for (let row = 0; row < 3; row++) {
      for (let c = 0; c < 6; c++) {
        const lit = rB() > 0.32
        if (lit) {
          g.fillStyle = rB() > 0.5 ? '#ffd9a0' : '#ffeccc'
          g.fillRect(26 + c * 80 + 3, 90 + row * 130 + 3, 46, 68)
        }
      }
    }
  })
  return { base, glow }
}

function puffTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.4)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
}

function cloudTexture() {
  const r = mulberry32(3)
  return canvasTexture(512, 256, (g, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x = w * 0.2 + r() * w * 0.6
      const y = h * 0.4 + (r() - 0.5) * h * 0.3
      const rad = 30 + r() * 60
      const grad = g.createRadialGradient(x, y, 2, x, y, rad)
      grad.addColorStop(0, 'rgba(255,255,255,0.55)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
  })
}

function shadowBlobTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(0,0,0,0.75)')
    grad.addColorStop(0.7, 'rgba(0,0,0,0.3)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
}

function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function makeSign(cw: number, ch: number) {
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  const g = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  let last = ''
  const set = (lines: string[], bg: string, fg: string) => {
    const key = lines.join('|') + bg + fg
    if (key === last) return
    last = key
    g.fillStyle = bg
    g.fillRect(0, 0, cw, ch)
    g.strokeStyle = fg
    g.lineWidth = 6
    g.strokeRect(8, 8, cw - 16, ch - 16)
    g.fillStyle = fg
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const fs = Math.min(ch / (lines.length + 0.6), cw / 9)
    g.font = `700 ${fs}px Arial, Helvetica, sans-serif`
    lines.forEach((l, i) => g.fillText(l, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * fs * 1.1))
    tex.needsUpdate = true
  }
  return { tex, set }
}

function makeLabel() {
  const cw = 512
  const ch = 160
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  const g = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(9, 2.8, 1)
  const draw = (title: string, sub: string, color: string) => {
    g.clearRect(0, 0, cw, ch)
    g.fillStyle = 'rgba(6,13,21,0.82)'
    roundedRect(g, 6, 6, cw - 12, ch - 12, 26)
    g.fill()
    g.strokeStyle = color
    g.lineWidth = 4
    roundedRect(g, 6, 6, cw - 12, ch - 12, 26)
    g.stroke()
    g.fillStyle = color
    g.beginPath()
    g.arc(40, 60, 11, 0, Math.PI * 2)
    g.fill()
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    g.fillStyle = '#eaf6ff'
    g.font = '700 42px Arial, Helvetica, sans-serif'
    g.fillText(title, 66, 58)
    g.fillStyle = '#9fb6c6'
    g.font = '500 32px Arial, Helvetica, sans-serif'
    g.fillText(sub, 30, 112)
    tex.needsUpdate = true
  }
  return { sprite, draw }
}

function insulatorGeometry(h: number, r: number, discs: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(r * 0.5, 0)]
  const step = h / discs
  for (let i = 0; i < discs; i++) {
    const y0 = i * step
    pts.push(new THREE.Vector2(r * 0.6, y0 + step * 0.1))
    pts.push(new THREE.Vector2(r, y0 + step * 0.35))
    pts.push(new THREE.Vector2(r, y0 + step * 0.55))
    pts.push(new THREE.Vector2(r * 0.6, y0 + step * 0.8))
  }
  pts.push(new THREE.Vector2(r * 0.5, h))
  return new THREE.LatheGeometry(pts, 14)
}

function frondGeometry(len: number, width: number) {
  const seg = 9
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const z = t * len
    const y = t * 0.5 * len * 0.25 - t * t * len * 0.42
    const w = width * Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.5 + 0.02
    pos.push(-w, y, z, w, y, z)
    if (i < seg) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function wireBetween(a: THREE.Vector3, b: THREE.Vector3, sag: number, radius: number, mat: THREE.Material) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const p = a.clone().lerp(b, t)
    p.y -= sag * 4 * t * (1 - t)
    pts.push(p)
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 5, false), mat)
  m.castShadow = true
  return m
}

function weatherFlags(w: unknown) {
  const s = String(w).toLowerCase()
  const rain = /rain|storm|thunder|shower/.test(s)
  const haze = /dust|harmattan|haze|fog|mist/.test(s)
  const cloud = rain ? 0.9 : /overcast/.test(s) ? 0.8 : /cloud/.test(s) ? 0.55 : haze ? 0.35 : 0.1
  return { rain, haze: haze ? 1 : 0, cloud }
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    const list = Array.isArray(mat) ? mat : mat ? [mat] : []
    list.forEach((x) => {
      const rec = x as unknown as Record<string, unknown>
      Object.keys(rec).forEach((k) => {
        const v = rec[k] as THREE.Texture | undefined
        if (v && (v as THREE.Texture).isTexture) v.dispose()
      })
      x.dispose()
    })
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Microgrid3DScene({
  currentStep,
  weather,
  batteryChemistry,
  pvRatedKw,
  dieselRatedKw,
  batteryCapacityKwh,
  loadProfile,
  mode,
  onSelectSubsystem
}: Microgrid3DSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const tweenRef = useRef<{
    t: number
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
  } | null>(null)

  // Live values read by the render loop (avoids stale closures)
  const stepRef = useRef(currentStep)
  stepRef.current = currentStep
  const propsRef = useRef({ weather, batteryChemistry, pvRatedKw, dieselRatedKw, batteryCapacityKwh, loadProfile })
  propsRef.current = { weather, batteryChemistry, pvRatedKw, dieselRatedKw, batteryCapacityKwh, loadProfile }

  const [activeView, setActiveView] = useState<CameraView>('isometric')
  const [lightingMode, setLightingMode] = useState<'daylight' | 'diurnal'>('daylight')
  const [hoveredAsset, setHoveredAsset] = useState<AssetId | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetId | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [webGlSupported, setWebGlSupported] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [autoOrbit, setAutoOrbit] = useState(false)

  const lightingRef = useRef(lightingMode)
  lightingRef.current = lightingMode
  const hoveredRef = useRef<AssetId | null>(null)
  const selectedRef = useRef<AssetId | null>(null)
  selectedRef.current = selectedAsset
  const labelsRef = useRef(showLabels)
  labelsRef.current = showLabels
  const orbitRef = useRef(autoOrbit)
  orbitRef.current = autoOrbit

  const setCameraView = useCallback((view: CameraView) => {
    setActiveView(view)
    setAutoOrbit(false)
    const cam = cameraRef.current
    const ctrl = controlsRef.current
    if (!cam || !ctrl) return
    const cfg = CAMERA_VIEWS[view]
    tweenRef.current = {
      t: 0,
      fromPos: cam.position.clone(),
      toPos: new THREE.Vector3(...cfg.pos),
      fromTarget: ctrl.target.clone(),
      toTarget: new THREE.Vector3(...cfg.target)
    }
  }, [])

  const handleSelect = (sub: AssetId) => {
    setSelectedAsset(sub)
    if (onSelectSubsystem) onSelectSubsystem(sub)
    setCameraView(VIEW_FOR_ASSET[sub])
  }
  const selectRef = useRef(handleSelect)
  selectRef.current = handleSelect

  // -------------------------------------------------------------------------
  // Scene construction and render loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    try {
      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2') || probe.getContext('webgl')
      if (!gl) {
        setWebGlSupported(false)
        return
      }
    } catch {
      setWebGlSupported(false)
      return
    }

    const width = container.clientWidth || 800
    const height = container.clientHeight || 480
    const pixelRatio = Math.min(window.devicePixelRatio, 2)

    // Renderer with filmic tone mapping and HDR post processing
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.76

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x1a2636, 0.0009)

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 6000)
    camera.position.set(95, 62, 110)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.maxPolarAngle = Math.PI / 2 - 0.02
    controls.minDistance = 3
    controls.maxDistance = 150
    controls.autoRotateSpeed = 0.6
    controls.target.set(0, 2, 0)
    controlsRef.current = controls
    tweenRef.current = {
      t: 0,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...CAMERA_VIEWS.isometric.pos),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...CAMERA_VIEWS.isometric.target)
    }

    const rt = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
      type: THREE.HalfFloatType,
      samples: 4
    })
    const composer = new EffectComposer(renderer, rt)
    composer.setPixelRatio(pixelRatio)
    composer.setSize(width, height)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.10, 0.35, 1.12)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    // ---------------------------------------------------------------------
    // Sky, sun, moon, stars, clouds, environment reflections
    // ---------------------------------------------------------------------
    const sky = new Sky()
    sky.scale.setScalar(3000)
    scene.add(sky)
    const skyU = sky.material.uniforms

    const envScene = new THREE.Scene()
    const envSky = new Sky()
    envSky.scale.setScalar(1000)
    envScene.add(envSky)
    const envGround = new THREE.Mesh(
      new THREE.CircleGeometry(900, 24),
      new THREE.MeshBasicMaterial({ color: 0x4a4a44 })
    )
    envGround.rotation.x = -Math.PI / 2
    envGround.position.y = -2
    envScene.add(envGround)
    const pmrem = new THREE.PMREMGenerator(renderer)
    let envRT: THREE.WebGLRenderTarget | null = null
    let envKey = ''

    const ambient = new THREE.AmbientLight(0x7f95c8, 0.1)
    scene.add(ambient)
    const hemi = new THREE.HemisphereLight(0x9ec5ff, 0x4a4234, 0.4)
    scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xfff2dc, 1.8)
    sun.castShadow = true
    const shadowRes = renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048
    sun.shadow.mapSize.set(shadowRes, shadowRes)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 320
    const sd = 66
    sun.shadow.camera.left = -sd
    sun.shadow.camera.right = sd
    sun.shadow.camera.top = sd
    sun.shadow.camera.bottom = -sd
    sun.shadow.bias = -0.0003
    sun.shadow.normalBias = 0.05
    sun.target.position.set(-2, 0, 0)
    scene.add(sun)
    scene.add(sun.target)

    const moonLight = new THREE.DirectionalLight(0x9db4ff, 0)
    scene.add(moonLight)
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(60, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8eefc, fog: false })
    )
    scene.add(moonMesh)

    const starCount = 1800
    const starPos = new Float32Array(starCount * 3)
    const starRand = mulberry32(77)
    for (let i = 0; i < starCount; i++) {
      const u = starRand() * 2 - 1
      const th = starRand() * Math.PI * 2
      const rr = Math.sqrt(1 - u * u)
      const y = Math.abs(u)
      starPos[i * 3] = Math.cos(th) * rr * 2500
      starPos[i * 3 + 1] = y * 2500
      starPos[i * 3 + 2] = Math.sin(th) * rr * 2500
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })
    )
    scene.add(stars)

    const cloudTex = cloudTexture()
    const clouds: THREE.Sprite[] = []
    const cloudRand = mulberry32(13)
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.4, depthWrite: false, fog: false })
      )
      const ang = cloudRand() * Math.PI * 2
      const rad = 350 + cloudRand() * 800
      s.position.set(Math.cos(ang) * rad, 160 + cloudRand() * 180, Math.sin(ang) * rad)
      const sc = 260 + cloudRand() * 320
      s.scale.set(sc, sc * 0.45, 1)
      scene.add(s)
      clouds.push(s)
    }

    // ---------------------------------------------------------------------
    // Materials
    // ---------------------------------------------------------------------
    const std = (color: number, rough = 0.6, metal = 0.1, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra })

    const concreteTex = concreteTexture()
    const concreteMat = std(0x626c77, 0.92, 0.03, { map: concreteTex })
    const paintWhite = std(0x8e98a5, 0.65, 0.15)
    const steel = std(0x8b95a1, 0.45, 0.85)
    const darkSteel = std(0x2b323b, 0.5, 0.7)
    const rubber = std(0x14171b, 0.9, 0)
    const safetyYellow = std(0xe6b800, 0.5, 0.1)
    const redPaint = std(0xb3261e, 0.45, 0.2)
    const cableMat = std(0x1d2530, 0.55, 0.2)
    const wireMat = std(0x2b2f36, 0.5, 0.6)

    const lampMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0xa8c5e2, emissiveIntensity: 0.1, roughness: 0.5 })
    const warmGlow = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc98a, emissiveIntensity: 0.08 })

    const pickRoots: THREE.Object3D[] = []
    const assetGroups: Partial<Record<AssetId, THREE.Group>> = {}
    const registerAsset = (id: AssetId, g: THREE.Group) => {
      g.userData.asset = id
      scene.add(g)
      pickRoots.push(g)
      assetGroups[id] = g
    }

    const box = (
      parent: THREE.Object3D,
      w: number, h: number, d: number,
      mat: THREE.Material | THREE.Material[],
      x: number, y: number, z: number,
      opts: { cast?: boolean; receive?: boolean } = {}
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.castShadow = opts.cast ?? true
      m.receiveShadow = opts.receive ?? true
      parent.add(m)
      return m
    }
    const cyl = (
      parent: THREE.Object3D,
      rt2: number, rb: number, h: number,
      mat: THREE.Material,
      x: number, y: number, z: number,
      seg = 16
    ) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt2, rb, h, seg), mat)
      m.position.set(x, y, z)
      m.castShadow = true
      m.receiveShadow = true
      parent.add(m)
      return m
    }

    const blobTex = shadowBlobTexture()
    const contactShadow = (parent: THREE.Object3D, x: number, z: number, w: number, d: number, y = 0.16) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.55, depthWrite: false })
      )
      m.rotation.x = -Math.PI / 2
      m.position.set(x, y, z)
      parent.add(m)
    }

    // Fans that spin (roof condensers, radiator, inverter cooling)
    const fans: { spinner: THREE.Object3D; kind: 'bess' | 'dg' | 'inv' }[] = []
    const fanBladeMat = std(0x9aa4b0, 0.4, 0.6)
    const makeFan = (radius: number, blades: number) => {
      const spinner = new THREE.Group()
      for (let i = 0; i < blades; i++) {
        const pivot = new THREE.Group()
        pivot.rotation.z = (i / blades) * Math.PI * 2
        const b = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.9, radius * 0.24, 0.02), fanBladeMat)
        b.position.x = radius * 0.5
        b.rotation.x = 0.4
        pivot.add(b)
        spinner.add(pivot)
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.14, radius * 0.14, 0.08, 12), darkSteel)
      hub.rotation.x = Math.PI / 2
      spinner.add(hub)
      const wrapper = new THREE.Group()
      wrapper.add(spinner)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.05, 6, 28), darkSteel)
      wrapper.add(ring)
      return { wrapper, spinner }
    }

    // ---------------------------------------------------------------------
    // Terrain, compound ground, roads
    // ---------------------------------------------------------------------
    const heightAt = (x: number, z: number) => {
      const r = Math.hypot(x, z)
      const k = sstep(r, 110, 330)
      const n =
        Math.sin(x * 0.021) * Math.cos(z * 0.017) * 6 +
        Math.sin(x * 0.047 + 1.3) * Math.sin(z * 0.039) * 2.5 +
        Math.sin(x * 0.011 + z * 0.013) * 10 + 8
      return k * Math.max(0, n) * 1.4
    }

    const terrainGeo = new THREE.PlaneGeometry(1500, 1500, 230, 230)
    terrainGeo.rotateX(-Math.PI / 2)
    {
      const p = terrainGeo.attributes.position as THREE.BufferAttribute
      const cols = new Float32Array(p.count * 3)
      const cA = new THREE.Color(0x9fbf78)
      const cB = new THREE.Color(0xc8b98a)
      const tmp = new THREE.Color()
      for (let i = 0; i < p.count; i++) {
        const h = heightAt(p.getX(i), p.getZ(i))
        p.setY(i, h)
        tmp.copy(cA).lerp(cB, clamp01(h / 22))
        cols[i * 3] = tmp.r
        cols[i * 3 + 1] = tmp.g
        cols[i * 3 + 2] = tmp.b
      }
      terrainGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
      terrainGeo.computeVertexNormals()
    }
    const terrain = new THREE.Mesh(
      terrainGeo,
      std(0xffffff, 0.95, 0, { map: grassTexture([260, 260]), vertexColors: true })
    )
    terrain.receiveShadow = true
    scene.add(terrain)

    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(84, 74),
      std(0xffffff, 0.95, 0.02, { map: gravelTexture([21, 18.5]) })
    )
    yard.rotation.x = -Math.PI / 2
    yard.position.set(-2, 0.02, 0)
    yard.receiveShadow = true
    scene.add(yard)

    const asphalt = asphaltTexture()
    const roadMat = std(0xffffff, 0.85, 0.05, { map: asphalt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    let roadY = 0.04
    const roadStrip = (x1: number, z1: number, x2: number, z2: number, w: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1)
      const g = new THREE.PlaneGeometry(len, w)
      g.rotateX(-Math.PI / 2)
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * len) / 8)
      const m = new THREE.Mesh(g, roadMat)
      m.position.set((x1 + x2) / 2, roadY, (z1 + z2) / 2)
      roadY += 0.0008
      m.rotation.y = -Math.atan2(z2 - z1, x2 - x1)
      m.receiveShadow = true
      scene.add(m)
    }
    roadStrip(-37, 29, 33.5, 29, 4)
    roadStrip(-37, -33, 33.5, -33, 4)
    roadStrip(-37, -33, -37, 29, 4)
    roadStrip(33.5, -33, 33.5, 29, 4)
    roadStrip(-3, 29, -3, 108, 6)

    // Concrete working pads
    const createPad = (x: number, z: number, w: number, d: number) => {
      const p = box(scene, w, 0.15, d, concreteMat, x, 0.075, z, { cast: false })
      const edge = box(scene, w + 0.3, 0.1, d + 0.3, std(0x646a72, 0.9, 0.05), x, 0.05, z, { cast: false })
      edge.position.y = 0.045
      return p
    }
    createPad(-20, -10, 26, 22)
    createPad(-16, 12, 16, 14)
    createPad(18, -12, 16, 14)
    createPad(0, 0, 12, 12)
    createPad(18, 16, 18, 18)

    // Highlight frames shown on hover and selection
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a2a2a, emissive: 0x45d4d1, emissiveIntensity: 2 })
    const frames: Partial<Record<AssetId, THREE.Group>> = {}
    const makeFrame = (id: AssetId, x: number, z: number, w: number, d: number) => {
      const g = new THREE.Group()
      const t = 0.22
      box(g, w + 0.8, 0.12, t, frameMat, 0, 0.2, d / 2 + 0.4, { cast: false, receive: false })
      box(g, w + 0.8, 0.12, t, frameMat, 0, 0.2, -d / 2 - 0.4, { cast: false, receive: false })
      box(g, t, 0.12, d + 0.8, frameMat, w / 2 + 0.4, 0.2, 0, { cast: false, receive: false })
      box(g, t, 0.12, d + 0.8, frameMat, -w / 2 - 0.4, 0.2, 0, { cast: false, receive: false })
      g.position.set(x, 0, z)
      g.visible = false
      scene.add(g)
      frames[id] = g
    }
    makeFrame('pv', -20, -10, 26, 22)
    makeFrame('bess', -16, 12, 16, 14)
    makeFrame('dg', 18, -12, 16, 14)
    makeFrame('bus', 0, 0, 12, 12)
    makeFrame('load', 18, 16, 18, 18)

    // ---------------------------------------------------------------------
    // Perimeter fence, gate, bollards
    // ---------------------------------------------------------------------
    const fenceMat = new THREE.MeshStandardMaterial({
      map: fenceTexture(20), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.8
    })
    const fenceRun = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.3), fenceMat.clone())
      ;(m.material as THREE.MeshStandardMaterial).map = fenceTexture(len)
      m.position.set((x1 + x2) / 2, 1.2, (z1 + z2) / 2)
      m.rotation.y = -Math.atan2(z2 - z1, x2 - x1)
      scene.add(m)
      const wire = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), steel)
      wire.position.set((x1 + x2) / 2, 2.35, (z1 + z2) / 2)
      wire.rotation.y = m.rotation.y
      scene.add(wire)
    }
    fenceRun(-42, -36, 38, -36)
    fenceRun(38, -36, 38, 36)
    fenceRun(-42, 36, -42, -36)
    fenceRun(-42, 36, -5.5, 36)
    fenceRun(-0.5, 36, 38, 36)

    const postPositions: THREE.Vector3[] = []
    const addPosts = (x1: number, z1: number, x2: number, z2: number, step: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1)
      const n = Math.max(1, Math.round(len / step))
      for (let i = 0; i <= n; i++) postPositions.push(new THREE.Vector3(x1 + ((x2 - x1) * i) / n, 1.2, z1 + ((z2 - z1) * i) / n))
    }
    addPosts(-42, -36, 38, -36, 4)
    addPosts(38, -36, 38, 36, 4)
    addPosts(-42, 36, -42, -36, 4)
    addPosts(-42, 36, -5.5, 36, 4)
    addPosts(-0.5, 36, 38, 36, 4)
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8), steel, postPositions.length)
    const dummy = new THREE.Object3D()
    postPositions.forEach((p, i) => {
      dummy.position.copy(p)
      dummy.updateMatrix()
      posts.setMatrixAt(i, dummy.matrix)
    })
    posts.castShadow = true
    scene.add(posts)

    // Gate posts and sign
    cyl(scene, 0.14, 0.14, 3, steel, -5.5, 1.5, 36)
    cyl(scene, 0.14, 0.14, 3, steel, -0.5, 1.5, 36)
    const gateSign = makeSign(512, 256)
    gateSign.set(['AUTHORIZED', 'PERSONNEL ONLY'], '#e6b800', '#111111')
    const gateSignMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshStandardMaterial({ map: gateSign.tex, roughness: 0.5 }))
    gateSignMesh.position.set(-5.5, 2.2, 36.16)
    scene.add(gateSignMesh)
    const gateSignBack = gateSignMesh.clone()
    gateSignBack.position.z = 35.84
    gateSignBack.rotation.y = Math.PI
    scene.add(gateSignBack)
    // Sliding gate leaf, slightly open
    box(scene, 3.4, 2.0, 0.06, new THREE.MeshStandardMaterial({ map: fenceTexture(3.4), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.5 }), -8.2, 1.1, 36.3, { cast: false })
    box(scene, 3.4, 0.08, 0.08, steel, -8.2, 2.1, 36.3)
    box(scene, 3.4, 0.08, 0.08, steel, -8.2, 0.15, 36.3)

    // Yellow bollards at pad corners
    const bollardGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10)
    const bollardPos: [number, number][] = [
      [-33.5, -21.5], [-6.5, -21.5], [-33.5, 1.5], [-6.5, 1.5],
      [-24.5, 4.5], [-7.5, 4.5], [-24.5, 19.5], [-7.5, 19.5],
      [9.5, -19.5], [26.5, -19.5], [9.5, -4.5], [26.5, -4.5],
      [8.5, 6.5], [27.5, 6.5], [8.5, 25.5], [27.5, 25.5]
    ]
    const bollards = new THREE.InstancedMesh(bollardGeo, safetyYellow, bollardPos.length)
    bollardPos.forEach(([x, z], i) => {
      dummy.position.set(x, 0.45, z)
      dummy.updateMatrix()
      bollards.setMatrixAt(i, dummy.matrix)
    })
    bollards.castShadow = true
    scene.add(bollards)

    // ---------------------------------------------------------------------
    // Site lighting masts
    // ---------------------------------------------------------------------
    const spotLights: THREE.SpotLight[] = []
    const poleMat = std(0x56606c, 0.5, 0.8)
    const lampSpots: [number, number, number][] = [
      [-33.5, 8, -3], [-9.5, 8, -20], [-7.5, 8, 18], [-24.5, 8, 6],
      [26.5, 8, -6], [10, 8, -19], [9.5, 8, 24], [26, 8, 8], [6.5, 9, 6.5]
    ]
    lampSpots.forEach(([x, h, z]) => {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      cyl(g, 0.07, 0.12, h, poleMat, 0, h / 2, 0, 10)
      const toward = new THREE.Vector3(-x, 0, -z).setY(0).normalize().multiplyScalar(0.9)
      box(g, 0.08, 0.08, 1.0, poleMat, toward.x * 0.5, h, toward.z * 0.5).lookAt(new THREE.Vector3(toward.x * 3, h, toward.z * 3).add(g.position))
      const head = box(g, 0.9, 0.14, 0.4, darkSteel, toward.x, h, toward.z)
      head.lookAt(new THREE.Vector3(x + toward.x * 3, h, z + toward.z * 3))
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), lampMat)
      panel.rotation.x = Math.PI / 2
      panel.position.set(0, -0.08, 0)
      head.add(panel)
      scene.add(g)

      const spot = new THREE.SpotLight(0xcfe8ff, 0, 42, 1.0, 0.7, 2)
      spot.position.set(x + toward.x, h - 0.1, z + toward.z)
      spot.target.position.set(x + toward.x * 6, 0, z + toward.z * 6)
      scene.add(spot)
      scene.add(spot.target)
      spotLights.push(spot)
    })

    // ---------------------------------------------------------------------
    // 1. SOLAR PV PARK
    // ---------------------------------------------------------------------
    const pvGroup = new THREE.Group()
    pvGroup.position.set(-20, 0, -10)
    {
      const tilt = THREE.MathUtils.degToRad(24)
      const cols = 5
      const rows = 4
      const n = cols * rows
      const frameGeo = new THREE.BoxGeometry(3.5, 0.07, 2.0)
      const glassGeo = new THREE.PlaneGeometry(3.4, 1.9)
      glassGeo.rotateX(-Math.PI / 2)
      const glassMat = new THREE.MeshPhysicalMaterial({
        map: pvTexture(), metalness: 0.35, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5
      })
      const tableFrames = new THREE.InstancedMesh(frameGeo, std(0xb9c0c9, 0.4, 0.85), n)
      const glass = new THREE.InstancedMesh(glassGeo, glassMat, n)
      const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6)
      const frontLegs = new THREE.InstancedMesh(legGeo, steel, n * 2)
      const backLegs = new THREE.InstancedMesh(legGeo, steel, n * 2)
      const footGeo = new THREE.BoxGeometry(0.34, 0.14, 0.34)
      const feet = new THREE.InstancedMesh(footGeo, concreteMat, n * 4)
      const normal = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt))
      let ti = 0
      let li = 0
      let fi = 0
      for (let ri = 0; ri < rows; ri++) {
        for (let ci = 0; ci < cols; ci++) {
          const cx = (ci - 2) * 3.8
          const cz = (ri - 1.5) * 4.2
          dummy.rotation.set(tilt, 0, 0)
          dummy.scale.set(1, 1, 1)
          dummy.position.set(cx, 1.15, cz)
          dummy.updateMatrix()
          tableFrames.setMatrixAt(ti, dummy.matrix)
          dummy.position.set(cx, 1.15 + normal.y * 0.042, cz + normal.z * 0.042)
          dummy.updateMatrix()
          glass.setMatrixAt(ti, dummy.matrix)
          ti++
          dummy.rotation.set(0, 0, 0)
          for (const sx of [-1.2, 1.2]) {
            dummy.scale.set(1, 0.74, 1)
            dummy.position.set(cx + sx, 0.37, cz + 0.91)
            dummy.updateMatrix()
            frontLegs.setMatrixAt(li, dummy.matrix)
            dummy.scale.set(1, 1.56, 1)
            dummy.position.set(cx + sx, 0.78, cz - 0.91)
            dummy.updateMatrix()
            backLegs.setMatrixAt(li, dummy.matrix)
            li++
            dummy.scale.set(1, 1, 1)
            dummy.position.set(cx + sx, 0.07, cz + 0.91)
            dummy.updateMatrix()
            feet.setMatrixAt(fi++, dummy.matrix)
            dummy.position.set(cx + sx, 0.07, cz - 0.91)
            dummy.updateMatrix()
            feet.setMatrixAt(fi++, dummy.matrix)
          }
        }
      }
      ;[tableFrames, glass, frontLegs, backLegs, feet].forEach((m) => {
        m.castShadow = true
        m.receiveShadow = true
        pvGroup.add(m)
      })

      // DC cable tray running between rows
      for (let ri = 0; ri < rows; ri++) box(pvGroup, 19.5, 0.08, 0.14, darkSteel, 0, 0.22, (ri - 1.5) * 4.2 + 1.35)
      // Combiner boxes at the end of each row
      for (let ri = 0; ri < rows; ri++) box(pvGroup, 0.5, 0.7, 0.3, paintWhite, 9.9, 0.45, (ri - 1.5) * 4.2)

      // Inverter and MV skid
      box(pvGroup, 3.0, 0.22, 5.6, concreteMat, 11.3, 0.26, 0)
      const louvers = louverTextures()
      const invMat = std(0xe6eaef, 0.35, 0.3)
      const invFront = new THREE.MeshStandardMaterial({ map: louvers.map, roughness: 0.5, metalness: 0.4 })
      for (const zz of [-1.8, 0]) {
        box(pvGroup, 2.0, 2.3, 1.2, [invMat, invMat, invMat, invMat, invFront, invMat], 11.3, 1.55, zz)
        const f = makeFan(0.32, 5)
        f.wrapper.rotation.x = -Math.PI / 2
        f.wrapper.position.set(11.3, 2.72, zz)
        pvGroup.add(f.wrapper)
        fans.push({ spinner: f.spinner, kind: 'inv' })
      }
      box(pvGroup, 1.7, 1.7, 1.3, std(0x4d5966, 0.5, 0.6), 11.3, 1.2, 1.95)
      for (let k = 0; k < 6; k++) box(pvGroup, 0.05, 1.3, 1.0, darkSteel, 12.2 + k * 0.001, 1.2, 1.95 + (k - 2.5) * 0.14)
      // Inverter status beacon
      const invBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x22ff88, emissiveIntensity: 0.2 }))
      invBeacon.position.set(11.3, 2.95, 1.9)
      pvGroup.add(invBeacon)
      pvGroup.userData.invBeacon = invBeacon

      // Weather station with pyranometer and spinning anemometer
      cyl(pvGroup, 0.05, 0.07, 3.2, steel, -11.5, 1.6, 7.5, 8)
      const pyr = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xdfe6ee, 0.1, 0.1))
      pyr.position.set(-11.5, 3.2, 7.5)
      pvGroup.add(pyr)
      const anemo = new THREE.Group()
      anemo.position.set(-11.5, 3.55, 7.5)
      for (let i = 0; i < 3; i++) {
        const arm = new THREE.Group()
        arm.rotation.y = (i / 3) * Math.PI * 2
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 5), steel)
        rod.rotation.z = Math.PI / 2
        rod.position.x = 0.2
        const cup = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI), std(0xf1f5f9, 0.4, 0.2))
        cup.position.x = 0.4
        arm.add(rod, cup)
        anemo.add(arm)
      }
      pvGroup.add(anemo)
      pvGroup.userData.anemo = anemo
      box(pvGroup, 0.6, 0.45, 0.25, paintWhite, -11.5, 1.6, 7.7)
      const stationPanel = box(pvGroup, 0.5, 0.03, 0.4, new THREE.MeshStandardMaterial({ map: pvTexture(), metalness: 0.4, roughness: 0.2 }), -11.5, 2.5, 7.9)
      stationPanel.rotation.x = -0.6
      contactShadow(pvGroup, 11.3, 0, 4, 6.8)
    }
    registerAsset('pv', pvGroup)

    // ---------------------------------------------------------------------
    // 2. BATTERY ENERGY STORAGE SYSTEM
    // ---------------------------------------------------------------------
    const bessGroup = new THREE.Group()
    bessGroup.position.set(-16, 0, 12)
    const socCells: THREE.MeshStandardMaterial[] = []
    const bessSpecSign = makeSign(512, 128)
    const bessBeaconMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x45d4d1, emissiveIntensity: 1 })
    {
      const corr = corrugationTexture()
      const sideMat = std(0xf3f6f9, 0.35, 0.3, { bumpMap: corr, bumpScale: 1.4 })
      const plainMat = std(0xf3f6f9, 0.35, 0.3)
      const containerMats = [plainMat, plainMat, plainMat, plainMat, sideMat, sideMat]
      for (const zz of [-2, 2]) {
        box(bessGroup, 6.6, 0.25, 2.5, concreteMat, 0, 0.27, zz)
        box(bessGroup, 6.5, 2.6, 2.4, containerMats, 0, 1.55, zz)
        // roof frame and corner castings
        box(bessGroup, 6.6, 0.1, 0.12, darkSteel, 0, 2.87, zz + 1.2)
        box(bessGroup, 6.6, 0.1, 0.12, darkSteel, 0, 2.87, zz - 1.2)
        box(bessGroup, 0.12, 0.1, 2.4, darkSteel, 3.25, 2.87, zz)
        box(bessGroup, 0.12, 0.1, 2.4, darkSteel, -3.25, 2.87, zz)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(bessGroup, 0.16, 2.7, 0.16, darkSteel, sx * 3.25, 1.55, zz + sz * 1.2)
        // roof HVAC condensers with spinning fans
        for (const hx of [-1.9, 1.9]) {
          box(bessGroup, 1.5, 0.55, 1.3, std(0x3a4552, 0.5, 0.6), hx, 3.15, zz)
          const f = makeFan(0.48, 6)
          f.wrapper.rotation.x = -Math.PI / 2
          f.wrapper.position.set(hx, 3.45, zz)
          bessGroup.add(f.wrapper)
          fans.push({ spinner: f.spinner, kind: 'bess' })
        }
        // roof cable duct
        box(bessGroup, 1.6, 0.16, 0.3, darkSteel, 0, 2.98, zz)
      }
      // Double doors on the front of container 2 and the rear of container 1
      for (const [zz, dir] of [[3.2, 1], [-3.2, -1]] as [number, number][]) {
        for (const dx of [-2.3, 2.3]) {
          box(bessGroup, 1.45, 2.15, 0.05, std(0xdbe1e8, 0.4, 0.4), dx, 1.5, zz + dir * 0.02)
          box(bessGroup, 0.03, 2.15, 0.06, darkSteel, dx, 1.5, zz + dir * 0.05)
          box(bessGroup, 0.05, 0.4, 0.06, darkSteel, dx - 0.55, 1.4, zz + dir * 0.06)
          box(bessGroup, 0.05, 0.4, 0.06, darkSteel, dx + 0.55, 1.4, zz + dir * 0.06)
        }
      }
      // State of charge LED bar: ten segments
      for (let i = 0; i < 10; i++) {
        const m = new THREE.MeshStandardMaterial({ color: 0x0b1418, emissive: 0x45d4d1, emissiveIntensity: 0.05 })
        socCells.push(m)
        box(bessGroup, 0.42, 0.22, 0.05, m, -2.16 + i * 0.48, 2.4, 3.24, { cast: false })
      }
      box(bessGroup, 4.9, 0.36, 0.04, std(0x0b1418, 0.5, 0.3), 0, 2.4, 3.215, { cast: false })
      // Specification sign
      const spec = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.58), new THREE.MeshStandardMaterial({ map: bessSpecSign.tex, roughness: 0.6 }))
      spec.position.set(0, 1.0, 3.235)
      bessGroup.add(spec)
      // Fire suppression cylinders and PCS skid
      for (const zz of [-2, 2]) {
        cyl(bessGroup, 0.28, 0.28, 1.6, redPaint, -4.7, 1.05, zz, 14)
        cyl(bessGroup, 0.1, 0.1, 0.25, steel, -4.7, 2.0, zz, 8)
        box(bessGroup, 1.3, 2.3, 0.95, paintWhite, 5.0, 1.4, zz)
        box(bessGroup, 1.2, 0.1, 0.9, darkSteel, 5.0, 2.6, zz)
        box(bessGroup, 0.02, 2.0, 0.85, std(0x9aa5b2, 0.4, 0.5), 4.34, 1.4, zz)
      }
      const dangerSign = makeSign(256, 256)
      dangerSign.set(['DANGER', 'HIGH', 'VOLTAGE'], '#e6b800', '#111111')
      const dsMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshStandardMaterial({ map: dangerSign.tex, roughness: 0.6 }))
      dsMesh.position.set(5.0, 1.7, 2.49)
      bessGroup.add(dsMesh)
      // Beacon mast
      cyl(bessGroup, 0.03, 0.03, 0.8, steel, -3.0, 3.45, -2.9, 6)
      const bc = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), bessBeaconMat)
      bc.position.set(-3.0, 3.9, -2.9)
      bessGroup.add(bc)
      contactShadow(bessGroup, 0, 0, 8.4, 7.4)
    }
    registerAsset('bess', bessGroup)

    // ---------------------------------------------------------------------
    // 3. DIESEL GENERATOR HOUSE
    // ---------------------------------------------------------------------
    const dgGroup = new THREE.Group()
    dgGroup.position.set(18, 0, -12)
    const dgInner = new THREE.Group()
    dgGroup.add(dgInner)
    const louvers2 = louverTextures()
    const louverMat = new THREE.MeshStandardMaterial({
      map: louvers2.map, emissiveMap: louvers2.emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5, metalness: 0.5
    })
    const dgBeaconMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff7a1f, emissiveIntensity: 0.1 })
    {
      const shell = std(0x3a4654, 0.55, 0.55)
      box(dgInner, 6.6, 0.25, 4.2, concreteMat, 0, 0.27, 0)
      box(dgInner, 6.2, 3.2, 3.8, shell, 0, 1.9, 0)
      box(dgInner, 6.4, 0.12, 4.0, std(0x56626f, 0.5, 0.5), 0, 3.56, 0)
      for (let i = -3; i <= 3; i++) box(dgInner, 0.08, 0.1, 3.9, darkSteel, i * 0.9, 3.67, 0)
      // Louver panels and personnel door on the front
      const louverPanel = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.7), louverMat)
      louverPanel.position.set(-0.9, 1.9, 1.92)
      dgInner.add(louverPanel)
      const louverPanel2 = louverPanel.clone()
      louverPanel2.position.set(-0.9, 1.9, -1.92)
      louverPanel2.rotation.y = Math.PI
      dgInner.add(louverPanel2)
      box(dgInner, 1.0, 2.2, 0.06, std(0xcfd6de, 0.45, 0.4), 2.1, 1.5, 1.92)
      box(dgInner, 0.05, 0.35, 0.08, darkSteel, 1.7, 1.5, 1.97)
      // Radiator on the substation side with spinning fan
      box(dgInner, 0.5, 2.4, 3.0, std(0x2b323b, 0.6, 0.5), 3.4, 1.65, 0)
      const rf = makeFan(0.95, 7)
      rf.wrapper.rotation.y = Math.PI / 2
      rf.wrapper.position.set(3.7, 1.65, 0)
      dgInner.add(rf.wrapper)
      fans.push({ spinner: rf.spinner, kind: 'dg' })
      // Exhaust: silencer, stack, rain cap
      cyl(dgInner, 0.22, 0.22, 2.8, std(0x1e242c, 0.3, 0.85), 2.0, 4.2, 1.0, 12)
      const sil = cyl(dgInner, 0.42, 0.42, 1.3, std(0x2a3038, 0.4, 0.8), 2.0, 3.95, 1.0, 16)
      sil.castShadow = true
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 12), darkSteel)
      cap.position.set(2.0, 5.72, 1.0)
      dgInner.add(cap)
      cyl(dgInner, 0.24, 0.24, 0.14, std(0x6a7480, 0.4, 0.6), 2.0, 4.85, 1.0)
      // Fuel tank on saddles inside a concrete bund
      const tank = cyl(dgInner, 1.15, 1.15, 4.0, std(0x9aa5b3, 0.35, 0.75), -5.2, 1.6, 0, 20)
      tank.rotation.z = Math.PI / 2
      for (const sx of [-6.4, -4.0]) box(dgInner, 0.35, 0.5, 2.0, std(0x4d5661, 0.7, 0.4), sx, 0.42, 0)
      const bundMat = std(0x7c828a, 0.9, 0.05, { map: concreteTex })
      box(dgInner, 5.4, 0.55, 0.22, bundMat, -5.2, 0.4, 2.0)
      box(dgInner, 5.4, 0.55, 0.22, bundMat, -5.2, 0.4, -2.0)
      box(dgInner, 0.22, 0.55, 4.2, bundMat, -7.9, 0.4, 0)
      cyl(dgInner, 0.05, 0.05, 1.4, steel, -4.4, 3.2, 0.3, 8)
      cyl(dgInner, 0.09, 0.09, 0.2, redPaint, -6.0, 2.85, -0.4, 10)
      box(dgInner, 0.5, 0.2, 0.06, std(0xf1f5f9, 0.5, 0.1), -5.2, 2.05, 1.12)
      // Access ladder to tank
      for (const lz of [1.5, 1.8]) box(dgInner, 0.04, 2.6, 0.04, steel, -4.5, 1.5, lz)
      for (let r = 0; r < 6; r++) box(dgInner, 0.04, 0.04, 0.34, steel, -4.5, 0.4 + r * 0.42, 1.65)
      // Control panel and E stop
      box(dgInner, 0.9, 1.5, 0.5, paintWhite, 0.2, 1.0, 2.35)
      box(dgInner, 0.14, 0.14, 0.05, redPaint, 0.5, 1.4, 2.62)
      // Roof beacon
      cyl(dgInner, 0.03, 0.03, 0.6, steel, -2.6, 3.95, 1.4, 6)
      const bc = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), dgBeaconMat)
      bc.position.set(-2.6, 4.32, 1.4)
      dgInner.add(bc)
      const dgSign = makeSign(384, 128)
      dgSign.set(['GENSET'], '#1a222b', '#e6b800')
      const sMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.4), new THREE.MeshStandardMaterial({ map: dgSign.tex, roughness: 0.6 }))
      sMesh.position.set(1.0, 3.25, 1.925)
      dgInner.add(sMesh)
      contactShadow(dgGroup, -1, 0, 16, 7.5)
    }
    registerAsset('dg', dgGroup)

    // Smoke plume from the stack (soft billboard puffs)
    const puff = puffTexture()
    const smoke: { s: THREE.Sprite; age: number; life: number; vx: number; vz: number }[] = []
    for (let i = 0; i < 50; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0x9a9da3, transparent: true, opacity: 0, depthWrite: false }))
      s.visible = false
      scene.add(s)
      smoke.push({ s, age: 99, life: 4, vx: 0, vz: 0 })
    }
    let smokeAcc = 0

    // ---------------------------------------------------------------------
    // 4. AC SUBSTATION AND BUS
    // ---------------------------------------------------------------------
    const subGroup = new THREE.Group()
    const bushingGeo = insulatorGeometry(1.3, 0.16, 6)
    const porcelain = std(0x8a4b2a, 0.25, 0.1)
    const grayPorcelain = std(0xb9c0c8, 0.3, 0.1)
    const statusLights: THREE.MeshStandardMaterial[] = []
    {
      box(subGroup, 11, 0.08, 11, std(0x3f454c, 1, 0), 0, 0.18, 0, { cast: false })
      // Transformer
      box(subGroup, 3.2, 0.35, 2.6, concreteMat, 0, 0.3, 0)
      box(subGroup, 3.2, 2.0, 2.4, std(0x5b6673, 0.45, 0.65), 0, 1.5, 0)
      box(subGroup, 3.3, 0.14, 2.5, darkSteel, 0, 2.55, 0)
      const radMat = std(0x6f7b89, 0.5, 0.6)
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) box(subGroup, 0.08, 1.6, 1.4, radMat, side * (1.8 + i * 0.16), 1.5, 0)
      for (const side of [-1, 1]) {
        box(subGroup, 0.9, 0.08, 1.5, darkSteel, side * 2.4, 2.35, 0)
        const ff = makeFan(0.32, 5)
        ff.wrapper.rotation.x = -Math.PI / 2
        ff.wrapper.position.set(side * 2.45, 2.42, 0)
        subGroup.add(ff.wrapper)
        fans.push({ spinner: ff.spinner, kind: 'inv' })
      }
      // Conservator tank
      const cons = cyl(subGroup, 0.38, 0.38, 2.4, std(0x76818f, 0.4, 0.7), 0, 3.1, 0.3, 16)
      cons.rotation.z = Math.PI / 2
      box(subGroup, 0.1, 0.55, 0.1, darkSteel, -0.9, 2.85, 0.3)
      box(subGroup, 0.1, 0.55, 0.1, darkSteel, 0.9, 2.85, 0.3)
      // HV and LV bushings
      for (let i = -1; i <= 1; i++) {
        const b = new THREE.Mesh(bushingGeo, porcelain)
        b.position.set(i * 0.9, 2.62, -0.55)
        b.castShadow = true
        subGroup.add(b)
        cyl(subGroup, 0.09, 0.09, 0.12, steel, i * 0.9, 3.98, -0.55, 8)
        const lv = new THREE.Mesh(insulatorGeometry(0.6, 0.11, 3), grayPorcelain)
        lv.position.set(i * 0.6, 2.62, 0.75)
        lv.castShadow = true
        subGroup.add(lv)
      }
      // Oil temperature gauge
      const gauge = cyl(subGroup, 0.16, 0.16, 0.08, std(0xf1f5f9, 0.4, 0.2), 1.62, 1.9, 1.05, 16)
      gauge.rotation.x = Math.PI / 2
      // Gantry with hanging insulator strings
      for (const gx of [-3.4, 3.4]) {
        cyl(subGroup, 0.09, 0.14, 6.6, std(0x99a3af, 0.5, 0.8), gx, 3.3, -1.6, 8)
        box(subGroup, 0.05, 6.0, 0.05, steel, gx + 0.25, 3.2, -1.6)
      }
      box(subGroup, 7.2, 0.14, 0.14, std(0x99a3af, 0.5, 0.8), 0, 6.4, -1.6)
      const stringGeo = insulatorGeometry(1.0, 0.13, 6)
      for (const gx of [-1.2, 0, 1.2]) {
        const s = new THREE.Mesh(stringGeo, grayPorcelain)
        s.position.set(gx, 5.35, -1.6)
        s.castShadow = true
        subGroup.add(s)
        subGroup.add(wireBetween(new THREE.Vector3(gx, 5.35, -1.6), new THREE.Vector3(gx * 0.75, 3.98, -0.55), 0.15, 0.035, wireMat))
      }
      // Lightning mast
      cyl(subGroup, 0.05, 0.1, 9, std(0x99a3af, 0.5, 0.8), -5.0, 4.5, -4.8, 8)
      // Switchgear line ups on both sides
      for (const sx of [-4.3, 4.3]) {
        for (let i = 0; i < 4; i++) {
          const cab = box(subGroup, 0.85, 2.0, 0.85, std(0xc9d0d8, 0.4, 0.4), sx, 1.3, -1.6 + i * 1.05)
          cab.castShadow = true
          const lm = new THREE.MeshStandardMaterial({ color: 0x0b0f12, emissive: i % 2 ? 0x22ff88 : 0xff4d3a, emissiveIntensity: 0.6 })
          statusLights.push(lm)
          box(subGroup, 0.06, 0.06, 0.06, lm, sx + (sx < 0 ? 0.44 : -0.44), 1.9, -1.6 + i * 1.05, { cast: false })
        }
      }
      // Control house
      const chMats = std(0xd7dbe0, 0.55, 0.15)
      box(subGroup, 4.0, 2.6, 2.2, chMats, 0, 1.4, -4.4)
      box(subGroup, 4.2, 0.12, 2.4, darkSteel, 0, 2.74, -4.4)
      box(subGroup, 0.9, 1.9, 0.06, std(0x56626f, 0.5, 0.5), 1.2, 1.1, -3.28)
      box(subGroup, 1.1, 0.7, 0.05, warmGlow, -0.9, 1.6, -3.29, { cast: false })
      const ac = box(subGroup, 0.9, 0.7, 0.5, paintWhite, -1.5, 1.0, -5.7)
      ac.castShadow = true
      // Fence around the yard with open gate side
      const subFence = new THREE.MeshStandardMaterial({ map: fenceTexture(11), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.5 })
      const sf = (w: number, x: number, z: number, ry: number) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.0), subFence)
        m.position.set(x, 1.15, z)
        m.rotation.y = ry
        subGroup.add(m)
      }
      sf(11, 0, -5.7, 0)
      sf(11, 0, 5.7, 0)
      sf(11, -5.7, 0, Math.PI / 2)
      sf(11, 5.7, 0, Math.PI / 2)
      for (const [px, pz] of [[-5.7, -5.7], [5.7, -5.7], [-5.7, 5.7], [5.7, 5.7], [0, 5.7], [0, -5.7], [-5.7, 0], [5.7, 0]]) cyl(subGroup, 0.06, 0.06, 2.3, steel, px, 1.15, pz, 8)
      contactShadow(subGroup, 0, 0, 5.5, 4.4)
    }
    registerAsset('bus', subGroup)

    // Overhead line to utility poles along the access road
    {
      const woodMat = std(0x5b4331, 0.9, 0)
      const poleZ = [46, 78, 108]
      let prev: THREE.Vector3[] = [-1.2, 0, 1.2].map((gx) => new THREE.Vector3(gx, 5.35, -1.6))
      poleZ.forEach((z) => {
        const g = new THREE.Group()
        g.position.set(-8, 0, z)
        cyl(g, 0.16, 0.22, 10, woodMat, 0, 5, 0, 10)
        box(g, 3.4, 0.14, 0.14, woodMat, 0, 9.4, 0)
        const cur: THREE.Vector3[] = []
        for (const ox of [-1.2, 0, 1.2]) {
          cyl(g, 0.06, 0.06, 0.3, grayPorcelain, ox, 9.65, 0, 8)
          cur.push(new THREE.Vector3(-8 + ox, 9.75, z))
        }
        scene.add(g)
        cur.forEach((c, i) => scene.add(wireBetween(prev[i], c, z === 46 ? 2.2 : 1.4, 0.03, wireMat)))
        prev = cur
      })
    }

    // ---------------------------------------------------------------------
    // 5. CONSUMER DEMAND SITE
    // ---------------------------------------------------------------------
    const loadGroup = new THREE.Group()
    loadGroup.position.set(18, 0, 16)
    const facade = facadeTextures(101)
    const winMat = new THREE.MeshStandardMaterial({
      map: facade.base, emissiveMap: facade.glow, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.55, metalness: 0.1
    })
    const roofMat = std(0x5e6670, 0.8, 0.2)
    const loadSign = makeSign(512, 128)
    {
      box(loadGroup, 5.4, 3.8, 5.0, [winMat, winMat, roofMat, roofMat, winMat, winMat], 0, 1.95, 0)
      // Parapet and rooftop plant
      box(loadGroup, 5.6, 0.35, 0.18, paintWhite, 0, 4.0, 2.5)
      box(loadGroup, 5.6, 0.35, 0.18, paintWhite, 0, 4.0, -2.5)
      box(loadGroup, 0.18, 0.35, 5.0, paintWhite, 2.7, 4.0, 0)
      box(loadGroup, 0.18, 0.35, 5.0, paintWhite, -2.7, 4.0, 0)
      for (const [rx, rz] of [[-1.4, -0.8], [1.2, -1.2], [0.2, 1.0]] as [number, number][]) {
        box(loadGroup, 1.2, 0.7, 1.0, std(0xaab3bd, 0.5, 0.4), rx, 4.35, rz)
        const f = makeFan(0.36, 5)
        f.wrapper.rotation.x = -Math.PI / 2
        f.wrapper.position.set(rx, 4.72, rz)
        loadGroup.add(f.wrapper)
        fans.push({ spinner: f.spinner, kind: 'inv' })
      }
      // Entrance canopy, glass door and sign
      box(loadGroup, 2.6, 0.14, 1.5, paintWhite, 0, 2.7, 3.25)
      for (const px of [-1.2, 1.2]) box(loadGroup, 0.1, 2.7, 0.1, steel, px, 1.35, 3.9)
      box(loadGroup, 1.5, 2.2, 0.06, warmGlow, 0, 1.25, 2.53, { cast: false })
      const sMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.62), new THREE.MeshStandardMaterial({ map: loadSign.tex, roughness: 0.5 }))
      sMesh.position.set(0, 3.15, 2.53)
      loadGroup.add(sMesh)
      const cross = new THREE.MeshStandardMaterial({ color: 0x0b2b1f, emissive: 0x10b981, emissiveIntensity: 1.6 })
      box(loadGroup, 0.7, 0.2, 0.2, cross, 0, 4.9, 2.4, { cast: false })
      box(loadGroup, 0.2, 0.7, 0.2, cross, 0, 4.9, 2.4, { cast: false })
      // Annex building
      box(loadGroup, 3.2, 2.6, 3.6, [winMat, winMat, roofMat, roofMat, winMat, winMat], -5.5, 1.35, -3.5)
      // Water tower
      for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) cyl(loadGroup, 0.05, 0.05, 3.6, steel, 5.4 + lx, 1.8, -4.5 + lz, 6)
      cyl(loadGroup, 1.0, 1.0, 1.6, std(0xd6dde5, 0.4, 0.5), 5.4, 4.4, -4.5, 20)
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd6dde5, 0.4, 0.5))
      dome.position.set(5.4, 5.2, -4.5)
      dome.castShadow = true
      loadGroup.add(dome)
      // Parking bays with cars
      const bays = canvasTexture(512, 128, (g, w, h) => {
        g.fillStyle = '#2b2f35'
        g.fillRect(0, 0, w, h)
        g.fillStyle = 'rgba(255,255,255,0.85)'
        for (let x = 0; x <= w; x += 64) g.fillRect(x, 0, 4, h)
      })
      const lot = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.2), std(0x757f8a, 0.9, 0.05, { map: bays }))
      lot.rotation.x = -Math.PI / 2
      lot.position.set(0, 0.17, 7)
      lot.receiveShadow = true
      loadGroup.add(lot)
      const carCols = [0xb3261e, 0xdfe5ea, 0x1f3a5f, 0x2b2f36, 0xc9a227]
      const carRand = mulberry32(8)
      for (let i = 0; i < 6; i++) {
        if (carRand() < 0.25) continue
        const cx = -5.1 + i * 2.05
        const col = carCols[Math.floor(carRand() * carCols.length)]
        const body = box(loadGroup, 1.9, 0.5, 0.95, std(col, 0.25, 0.6), cx, 0.5, 7)
        body.rotation.y = Math.PI / 2
        const cab = box(loadGroup, 1.0, 0.42, 0.85, std(0x18202a, 0.1, 0.8), cx, 0.95, 7)
        cab.rotation.y = Math.PI / 2
        for (const wx of [-0.55, 0.55]) for (const wz of [-0.45, 0.45]) {
          const wh = cyl(loadGroup, 0.2, 0.2, 0.12, rubber, cx + wz * 0.0 + (wz * 1.0), 0.32, 7 + wx, 12)
          wh.rotation.x = Math.PI / 2
          wh.rotation.z = Math.PI / 2
        }
      }
      contactShadow(loadGroup, 0, 0, 7.4, 6.8)
      contactShadow(loadGroup, -5.5, -3.5, 4.6, 5)
    }
    registerAsset('load', loadGroup)

    // ---------------------------------------------------------------------
    // Cable trenches and animated power pulses
    // ---------------------------------------------------------------------
    interface Conduit {
      curve: THREE.CatmullRomCurve3
      mesh: THREE.InstancedMesh
      mat: THREE.MeshStandardMaterial
      count: number
      phase: number
    }
    const pulseGeo = new THREE.SphereGeometry(0.17, 10, 8)
    const makeConduit = (pts: V3[], color: number, count = 30): Conduit => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.03)
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.13, 8, false), cableMat)
      tube.castShadow = true
      tube.receiveShadow = true
      scene.add(tube)
      const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 3, roughness: 0.4 })
      const mesh = new THREE.InstancedMesh(pulseGeo, mat, count)
      mesh.frustumCulled = false
      scene.add(mesh)
      return { curve, mesh, mat, count, phase: Math.random() }
    }
    const conduits = {
      pv: makeConduit([[-8.7, 0.45, -10], [-6.8, 0.45, -10], [-6.8, 0.45, -0.7], [-3.6, 0.45, -0.7]], 0xffb020),
      bess: makeConduit([[-11, 0.45, 12], [-6.5, 0.45, 12], [-6.5, 0.45, 0.7], [-3.6, 0.45, 0.7]], 0x45d4d1),
      diesel: makeConduit([[16.5, 0.45, -12], [16.5, 0.45, -7], [7, 0.45, -7], [7, 0.45, -0.7], [3.6, 0.45, -0.7]], 0xf97316),
      load: makeConduit([[3.6, 0.45, 0.7], [10.5, 0.45, 0.7], [10.5, 0.45, 16], [15.3, 0.45, 16]], 0x38bdf8)
    }
    const loadMaxRef = { v: 1 }

    // ---------------------------------------------------------------------
    // Vegetation, rocks, palms
    // ---------------------------------------------------------------------
    const vr = mulberry32(2024)
    const outsidePoint = (rMin: number, rMax: number) => {
      for (let tries = 0; tries < 40; tries++) {
        const a = vr() * Math.PI * 2
        const rad = rMin + vr() * (rMax - rMin)
        const x = Math.cos(a) * rad
        const z = Math.sin(a) * rad
        const inFence = x > -48 && x < 44 && z > -42 && z < 42
        const onRoad = x > -9 && x < 3 && z > 30
        const underWire = x > -12 && x < -4 && z > 36
        if (!inFence && !onRoad && !underWire) return new THREE.Vector3(x, heightAt(x, z), z)
      }
      return new THREE.Vector3(200, 0, 200)
    }

    const treeCount = 110
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1, 6), std(0x5a4432, 0.9, 0), treeCount)
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), std(0x2d5a27, 0.85, 0), treeCount * 2)
    for (let i = 0; i < treeCount; i++) {
      const p = outsidePoint(52, 190)
      const h = 3 + vr() * 4
      dummy.rotation.set(0, vr() * 6, 0)
      dummy.scale.set(1, h, 1)
      dummy.position.set(p.x, p.y + h / 2, p.z)
      dummy.updateMatrix()
      trunks.setMatrixAt(i, dummy.matrix)
      for (let k = 0; k < 2; k++) {
        const s = 1.6 + vr() * 1.8
        dummy.scale.set(s, s * 0.85, s)
        dummy.position.set(p.x + (vr() - 0.5) * 1.2, p.y + h + k * 0.9, p.z + (vr() - 0.5) * 1.2)
        dummy.updateMatrix()
        crowns.setMatrixAt(i * 2 + k, dummy.matrix)
        crowns.setColorAt(i * 2 + k, new THREE.Color().setHSL(0.24 + vr() * 0.06, 0.45, 0.22 + vr() * 0.1))
      }
    }
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true
    trunks.castShadow = true
    crowns.castShadow = true
    crowns.receiveShadow = true
    scene.add(trunks, crowns)

    const tuftCount = 3200
    const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.6, 3), std(0x355e2b, 0.9, 0), tuftCount)
    for (let i = 0; i < tuftCount; i++) {
      const p = outsidePoint(45, 130)
      const s = 0.6 + vr() * 1.2
      dummy.rotation.set((vr() - 0.5) * 0.3, vr() * 6, (vr() - 0.5) * 0.3)
      dummy.scale.set(s, s, s)
      dummy.position.set(p.x, p.y + 0.25 * s, p.z)
      dummy.updateMatrix()
      tufts.setMatrixAt(i, dummy.matrix)
      tufts.setColorAt(i, new THREE.Color().setHSL(0.2 + vr() * 0.1, 0.5, 0.28 + vr() * 0.16))
    }
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true
    scene.add(tufts)

    const rockCount = 70
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std(0x7d7b76, 0.95, 0), rockCount)
    for (let i = 0; i < rockCount; i++) {
      const p = outsidePoint(44, 120)
      const s = 0.3 + vr() * 1.0
      dummy.rotation.set(vr() * 3, vr() * 3, vr() * 3)
      dummy.scale.set(s * 1.3, s * 0.7, s)
      dummy.position.set(p.x, p.y + s * 0.25, p.z)
      dummy.updateMatrix()
      rocks.setMatrixAt(i, dummy.matrix)
    }
    rocks.castShadow = true
    rocks.receiveShadow = true
    scene.add(rocks)

    // Palms with swaying crowns
    const palms: { crown: THREE.Group; phase: number }[] = []
    {
      const trunkMat = std(0x7a6247, 0.9, 0)
      const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 0.7, side: THREE.DoubleSide })
      const fGeo = frondGeometry(3.2, 0.7)
      const palmSpots: [number, number][] = [
        [-46, 40], [-46, 20], [-46, -10], [-46, -38], [42, 40], [42, 10], [42, -20], [42, -40],
        [-12, 42], [4, 42], [-12, 60], [4, 62], [-12, 84], [4, 88], [-20, -42], [10, -42], [26, -42]
      ]
      palmSpots.forEach(([x, z], i) => {
        const g = new THREE.Group()
        g.position.set(x, 0, z)
        const h = 7 + (i % 4) * 0.9
        const segs = 7
        let ox = 0
        for (let s = 0; s < segs; s++) {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - s * 0.008, 0.2 - s * 0.008, h / segs + 0.05, 8), trunkMat)
          ox += 0.05 * Math.sin(i + s)
          seg.position.set(ox, (s + 0.5) * (h / segs), 0)
          seg.castShadow = true
          g.add(seg)
        }
        const crown = new THREE.Group()
        crown.position.set(ox, h, 0)
        for (let f = 0; f < 10; f++) {
          const fr = new THREE.Mesh(fGeo, frondMat)
          const pivot = new THREE.Group()
          pivot.rotation.y = (f / 10) * Math.PI * 2 + i
          fr.rotation.x = -0.25 - (f % 3) * 0.12
          fr.castShadow = true
          pivot.add(fr)
          crown.add(pivot)
        }
        g.add(crown)
        scene.add(g)
        palms.push({ crown, phase: i * 1.3 })
      })
    }

    // Floating dust motes and rain streaks
    const dustCount = 420
    const dustPos = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (vr() - 0.5) * 130
      dustPos[i * 3 + 1] = 0.5 + vr() * 16
      dustPos[i * 3 + 2] = (vr() - 0.5) * 130
    }
    const dustGeo = new THREE.BufferGeometry()
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff1d0, size: 0.09, transparent: true, opacity: 0.35, depthWrite: false }))
    scene.add(dust)

    const dropCount = 2600
    const dropPos = new Float32Array(dropCount * 6)
    const dropX = new Float32Array(dropCount)
    const dropZ = new Float32Array(dropCount)
    const dropY = new Float32Array(dropCount)
    for (let i = 0; i < dropCount; i++) {
      dropX[i] = (vr() - 0.5) * 170
      dropZ[i] = (vr() - 0.5) * 170
      dropY[i] = vr() * 55
    }
    const dropGeo = new THREE.BufferGeometry()
    dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3))
    const rain = new THREE.LineSegments(dropGeo, new THREE.LineBasicMaterial({ color: 0xaec6e8, transparent: true, opacity: 0.35, depthWrite: false }))
    rain.frustumCulled = false
    rain.visible = false
    scene.add(rain)

    // ---------------------------------------------------------------------
    // Floating labels
    // ---------------------------------------------------------------------
    const labels: Record<AssetId, ReturnType<typeof makeLabel>> = {
      pv: makeLabel(), bess: makeLabel(), dg: makeLabel(), bus: makeLabel(), load: makeLabel()
    }
    const labelPos: Record<AssetId, V3> = {
      pv: [-20, 6.5, -10], bess: [-16, 7, 12], dg: [18, 9.2, -12], bus: [0, 9.2, 0], load: [18, 8.2, 16]
    }
    ;(Object.keys(labels) as AssetId[]).forEach((id) => {
      labels[id].sprite.position.set(...labelPos[id])
      scene.add(labels[id].sprite)
    })
    let labelKey = ''

    // ---------------------------------------------------------------------
    // Environment update from telemetry: sun, sky, fog, lights
    // ---------------------------------------------------------------------
    const fogDay = new THREE.Color(0x243547)
    const fogGold = new THREE.Color(0x4a3a30)
    const fogNight = new THREE.Color(0x060b14)
    const fogTmp = new THREE.Color()
    const sunWarm = new THREE.Color(0xff9a52)
    const sunWhite = new THREE.Color(0xfff4e2)
    const skyDay = new THREE.Color(0x9ec5ff)
    const skyNight = new THREE.Color(0x141f38)
    const gndDay = new THREE.Color(0x4a4234)
    const gndNight = new THREE.Color(0x0b0f16)
    const sunDir = new THREE.Vector3()
    let nightFactor = 0
    let dayFactor = 1
    let cloudAmount = 0.1
    let rainingNow = false

    const applyEnvironment = () => {
      const step = stepRef.current
      const wx = weatherFlags(propsRef.current.weather)
      cloudAmount = wx.cloud
      rainingNow = wx.rain
      if (lightingRef.current === 'daylight') {
        sunDir.set(0.42, 0.78, 0.48).normalize()
      } else {
        const a = ((step.time - 6) / 12) * Math.PI
        sunDir.set(Math.cos(a) * 0.95, Math.sin(a) * 0.86, 0.42).normalize()
      }
      const elev = sunDir.y
      dayFactor = sstep(elev, -0.06, 0.22)
      nightFactor = 1 - sstep(elev, -0.12, 0.12)
      const golden = (1 - sstep(elev, 0.05, 0.4)) * dayFactor

      sun.position.copy(sunDir).multiplyScalar(140).add(sun.target.position)
      sun.color.copy(sunWarm).lerp(sunWhite, sstep(elev, 0.02, 0.5))
      sun.intensity = 1.8 * dayFactor * (1 - 0.65 * wx.cloud)
      sun.castShadow = dayFactor > 0.05

      moonLight.position.set(-sunDir.x * 120, Math.max(0.4, -sunDir.y) * 120, -sunDir.z * 120)
      moonLight.intensity = 0.6 * nightFactor * (1 - 0.5 * wx.cloud)
      moonMesh.position.set(-sunDir.x * 2400, Math.max(0.25, -sunDir.y) * 2400, -sunDir.z * 2400)
      moonMesh.visible = nightFactor > 0.2 && wx.cloud < 0.85

      hemi.color.copy(skyNight).lerp(skyDay, dayFactor)
      hemi.groundColor.copy(gndNight).lerp(gndDay, dayFactor)
      hemi.intensity = 0.12 + 0.28 * dayFactor
      ambient.intensity = 0.05 + 0.25 * nightFactor
      renderer.toneMappingExposure = 0.74 + 0.12 * nightFactor

      skyU['turbidity'].value = 2 + wx.cloud * 14
      skyU['rayleigh'].value = 1 + 2 * golden - 0.5 * wx.cloud
      skyU['mieCoefficient'].value = 0.004 + 0.02 * wx.cloud
      skyU['mieDirectionalG'].value = 0.82
      skyU['sunPosition'].value.copy(sunDir)

      fogTmp.copy(fogDay).lerp(fogGold, golden * 0.7)
      fogTmp.lerp(fogNight, nightFactor)
      const fog = scene.fog as THREE.FogExp2
      fog.color.copy(fogTmp)
      fog.density = 0.0008 + wx.cloud * 0.0006 + wx.haze * 0.0015

      ;(stars.material as THREE.PointsMaterial).opacity = nightFactor * (1 - wx.cloud * 0.9)
      cloudTintNight.setScalar(0.12)
      clouds.forEach((c) => {
        const m = c.material as THREE.SpriteMaterial
        m.opacity = 0.2 + wx.cloud * 0.6
        m.color.setRGB(1, 1, 1).lerp(sunWarm, golden * 0.5).lerp(cloudTintNight, nightFactor)
      })

      const flood = 25 * nightFactor
      spotLights.forEach((s) => (s.intensity = flood))
      lampMat.emissiveIntensity = 0.1 + 0.8 * nightFactor
      warmGlow.emissiveIntensity = 0.08 + 0.5 * nightFactor

      const key = `${Math.round(elev * 24)}|${wx.cloud > 0.5 ? 'c' : 'f'}|${lightingRef.current}`
      if (key !== envKey) {
        envKey = key
        const eu = envSky.material.uniforms
        eu['turbidity'].value = skyU['turbidity'].value
        eu['rayleigh'].value = skyU['rayleigh'].value
        eu['mieCoefficient'].value = skyU['mieCoefficient'].value
        eu['mieDirectionalG'].value = skyU['mieDirectionalG'].value
        eu['sunPosition'].value.copy(sunDir)
        const next = pmrem.fromScene(envScene, 0, 1, 3000)
        envRT?.dispose()
        envRT = next
        scene.environment = next.texture
      }
      ;(scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.12 + 0.95 * dayFactor * (1 - 0.3 * wx.cloud)
    }
    const cloudTintNight = new THREE.Color()

    // ---------------------------------------------------------------------
    // Picking
    // ---------------------------------------------------------------------
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let pointerDown: { x: number; y: number } | null = null
    let pendingMove: { x: number; y: number } | null = null

    const assetAt = (clientX: number, clientY: number): AssetId | null => {
      const rect = canvas.getBoundingClientRect()
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(pickRoots, true)
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object
        while (o) {
          if (o.userData && o.userData.asset) return o.userData.asset as AssetId
          o = o.parent
        }
      }
      return null
    }
    const onPointerMove = (e: PointerEvent) => {
      pendingMove = { x: e.clientX, y: e.clientY }
      const tip = tooltipRef.current
      if (tip) {
        const rect = container.getBoundingClientRect()
        tip.style.transform = `translate(${e.clientX - rect.left + 14}px, ${e.clientY - rect.top + 14}px)`
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      pointerDown = { x: e.clientX, y: e.clientY }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown) return
      const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y)
      pointerDown = null
      if (moved < 5) {
        const id = assetAt(e.clientX, e.clientY)
        if (id) selectRef.current(id)
      }
    }
    const onPointerLeave = () => {
      pendingMove = null
      if (hoveredRef.current) {
        hoveredRef.current = null
        setHoveredAsset(null)
      }
    }
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)

    // ---------------------------------------------------------------------
    // Render loop
    // ---------------------------------------------------------------------
    let raf = 0
    let last = performance.now()
    let time = 0
    let pickCooldown = 0

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      time += dt
      const step = stepRef.current
      const p = propsRef.current

      // Camera tween
      const tw = tweenRef.current
      if (tw) {
        tw.t += dt / 1.6
        const e = THREE.MathUtils.smootherstep(Math.min(tw.t, 1), 0, 1)
        camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
        controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
        if (tw.t >= 1) tweenRef.current = null
      }
      controls.autoRotate = orbitRef.current && !tweenRef.current
      controls.update()

      applyEnvironment()

      // Hover picking, throttled
      pickCooldown -= dt
      if (pendingMove && pickCooldown <= 0) {
        pickCooldown = 0.06
        const id = assetAt(pendingMove.x, pendingMove.y)
        pendingMove = null
        if (id !== hoveredRef.current) {
          hoveredRef.current = id
          setHoveredAsset(id)
          canvas.style.cursor = id ? 'pointer' : 'grab'
        }
      }
      ;(Object.keys(frames) as AssetId[]).forEach((id) => {
        const f = frames[id]
        if (!f) return
        const on = hoveredRef.current === id || selectedRef.current === id
        f.visible = on
        if (on) frameMat.emissiveIntensity = 1.6 + 0.9 * Math.sin(time * 3)
      })

      // Power flow pulses
      const loadMax = Math.max(loadMaxRef.v, step.load)
      loadMaxRef.v = loadMax
      const flow = (c: Conduit, frac: number, dirSign: number) => {
        const f = clamp01(frac)
        const active = f > 0.01
        c.phase = (c.phase + dt * (0.04 + 0.2 * f) * dirSign + 1) % 1
        for (let i = 0; i < c.count; i++) {
          const t = (c.phase + i / c.count) % 1
          const pt = c.curve.getPointAt(t)
          dummy.position.set(pt.x, pt.y + 0.04, pt.z)
          dummy.rotation.set(0, 0, 0)
          dummy.scale.setScalar(active ? 0.55 + 0.6 * f : 0.001)
          dummy.updateMatrix()
          c.mesh.setMatrixAt(i, dummy.matrix)
        }
        c.mesh.instanceMatrix.needsUpdate = true
        c.mat.emissiveIntensity = active ? 2.5 + 2 * f : 0
      }
      flow(conduits.pv, p.pvRatedKw > 0 ? step.pv / p.pvRatedKw : 0, 1)
      const bessFrac = Math.abs(step.battery) / Math.max(1, p.batteryCapacityKwh * 0.5)
      conduits.bess.mat.emissive.setHex(step.battery >= 0 ? 0x45d4d1 : 0x22d47a)
      flow(conduits.bess, Math.abs(step.battery) > 0.5 ? bessFrac : 0, step.battery >= 0 ? 1 : -1)
      flow(conduits.diesel, p.dieselRatedKw > 0 && step.diesel > 0.5 ? step.diesel / p.dieselRatedKw : 0, 1)
      flow(conduits.load, step.load > 0.5 ? step.load / loadMax : 0, 1)

      // Fans
      fans.forEach((f) => {
        let w = 0
        if (f.kind === 'bess') w = Math.abs(step.battery) > 0.5 ? 10 + Math.min(14, Math.abs(step.battery) / 15) : 1.2
        else if (f.kind === 'dg') w = step.dgRunning ? 24 : 0
        else w = step.pv > 0.5 || step.load > 0.5 ? 14 : 2
        f.spinner.rotation.z += w * dt
      })

      // Beacons and status lights
      dgBeaconMat.emissiveIntensity = step.dgRunning ? 0.6 + 3.4 * (0.5 + 0.5 * Math.sin(time * 6)) : 0.08
      louverMat.emissiveIntensity = THREE.MathUtils.lerp(louverMat.emissiveIntensity, step.dgRunning ? 1.6 : 0, 0.08)
      dgInner.position.set(step.dgRunning ? (Math.random() - 0.5) * 0.008 : 0, 0, step.dgRunning ? (Math.random() - 0.5) * 0.008 : 0)
      const bessCharging = step.battery < -0.5
      const bessDischarging = step.battery > 0.5
      bessBeaconMat.emissive.setHex(step.soc < 0.25 ? 0xef4444 : bessCharging ? 0x22d47a : bessDischarging ? 0x45d4d1 : 0xf59e0b)
      bessBeaconMat.emissiveIntensity = 0.6 + 2.6 * (0.5 + 0.5 * Math.sin(time * (bessCharging || bessDischarging ? 4 : 1.5)))
      const invB = pvGroup.userData.invBeacon as THREE.Mesh
      ;(invB.material as THREE.MeshStandardMaterial).emissiveIntensity = step.pv > 0.5 ? 0.8 + 1.4 * (0.5 + 0.5 * Math.sin(time * 3)) : 0.08
      statusLights.forEach((m, i) => (m.emissiveIntensity = 0.5 + 0.5 * Math.sin(time * 2 + i)))

      // SOC LED bar
      const socColor = step.soc < 0.25 ? 0xef4444 : step.soc < 0.45 ? 0xf59e0b : 0x45d4d1
      socCells.forEach((m, i) => {
        const lit = (i + 0.5) / 10 <= step.soc + 0.02
        m.emissive.setHex(socColor)
        m.emissiveIntensity = lit ? 2.6 : 0.03
      })

      // Windows glow with demand, brighter at night
      const loadFrac = clamp01(step.load / loadMax)
      winMat.emissiveIntensity = (0.1 + 0.9 * loadFrac) * (0.35 + 1.65 * nightFactor)

      // Labels
      ;(Object.keys(labels) as AssetId[]).forEach((id) => (labels[id].sprite.visible = labelsRef.current))
      const state = bessCharging ? 'CHG' : bessDischarging ? 'DIS' : 'IDLE'
      const busGen = step.pv + step.diesel + Math.max(0, step.battery)
      const nextKey = [
        Math.round(step.pv), Math.round(step.soc * 100), Math.round(Math.abs(step.battery)), state,
        Math.round(step.diesel), step.dgRunning, Math.round(busGen), Math.round(step.unmet), Math.round(step.load),
        p.pvRatedKw, p.dieselRatedKw, p.batteryCapacityKwh, String(p.batteryChemistry), p.loadProfile
      ].join('|')
      if (nextKey !== labelKey) {
        labelKey = nextKey
        labels.pv.draw('SOLAR PV', `${step.pv.toFixed(0)} kW of ${p.pvRatedKw} kWp`, '#f5b544')
        labels.bess.draw(`BATTERY ${String(p.batteryChemistry)}`, `${Math.round(step.soc * 100)}% SOC, ${Math.abs(step.battery).toFixed(0)} kW ${state}`, '#45d4d1')
        labels.dg.draw('DIESEL GENSET', step.dgRunning ? `${step.diesel.toFixed(0)} kW running` : `Standby, ${p.dieselRatedKw} kW`, '#ef8354')
        labels.bus.draw('AC SUBSTATION', step.unmet > 0.1 ? `Deficit ${step.unmet.toFixed(1)} kW` : `${busGen.toFixed(0)} kW balanced`, '#38bdf8')
        labels.load.draw('DEMAND SITE', `${step.load.toFixed(0)} kW, ${p.loadProfile}`, '#10b981')
        bessSpecSign.set([`BESS ${p.batteryCapacityKwh} kWh`, String(p.batteryChemistry)], '#0f1b24', '#45d4d1')
        loadSign.set([String(p.loadProfile).toUpperCase()], '#0f1b24', '#10b981')
      }

      // Smoke plume
      if (step.dgRunning) smokeAcc += dt * (9 + step.dgLoadingRatio * 12)
      while (smokeAcc >= 1) {
        const free = smoke.find((q) => q.age >= q.life)
        if (!free) {
          smokeAcc = 0
          break
        }
        free.age = 0
        free.life = 3.5 + Math.random() * 2.5
        free.vx = 0.7 + Math.random() * 0.5
        free.vz = (Math.random() - 0.5) * 0.4
        free.s.position.set(20 + (Math.random() - 0.5) * 0.2, 5.85, -11 + (Math.random() - 0.5) * 0.2)
        smokeAcc -= 1
      }
      const smokeGrey = 0.25 + 0.5 * dayFactor
      smoke.forEach((q) => {
        if (q.age >= q.life) {
          q.s.visible = false
          return
        }
        q.age += dt
        const k = q.age / q.life
        q.s.position.x += q.vx * dt * (1 + k)
        q.s.position.y += (1.7 - 0.9 * k) * dt
        q.s.position.z += q.vz * dt
        q.s.scale.setScalar(0.6 + k * 4.8)
        const m = q.s.material as THREE.SpriteMaterial
        m.opacity = (1 - k) * Math.min(1, q.age * 2.5) * (0.35 + 0.35 * step.dgLoadingRatio)
        m.color.setRGB(smokeGrey, smokeGrey, smokeGrey * 1.03)
        q.s.visible = true
      })

      // Anemometer, palms, clouds, dust, rain
      const anemo = pvGroup.userData.anemo as THREE.Group
      anemo.rotation.y += dt * (rainingNow ? 9 : 3 + cloudAmount * 4)
      palms.forEach((pm) => {
        pm.crown.rotation.z = Math.sin(time * 0.9 + pm.phase) * 0.035
        pm.crown.rotation.x = Math.cos(time * 0.7 + pm.phase) * 0.025
      })
      clouds.forEach((c) => {
        c.position.x += dt * 2.2
        if (c.position.x > 1100) c.position.x = -1100
      })
      dust.visible = !rainingNow
      const dp = dustGeo.attributes.position as THREE.BufferAttribute
      const da = dp.array as Float32Array
      for (let i = 0; i < dustCount; i++) {
        da[i * 3] += dt * 0.5
        da[i * 3 + 1] += Math.sin(time * 0.6 + i) * dt * 0.06
        if (da[i * 3] > 65) da[i * 3] = -65
      }
      dp.needsUpdate = true
      rain.visible = rainingNow
      if (rainingNow) {
        for (let i = 0; i < dropCount; i++) {
          dropY[i] -= dt * 38
          dropX[i] += dt * 4
          if (dropY[i] < 0) {
            dropY[i] += 55
            dropX[i] = (Math.random() - 0.5) * 170
            dropZ[i] = (Math.random() - 0.5) * 170
          }
          const o = i * 6
          dropPos[o] = dropX[i]
          dropPos[o + 1] = dropY[i]
          dropPos[o + 2] = dropZ[i]
          dropPos[o + 3] = dropX[i] - 0.1
          dropPos[o + 4] = dropY[i] - 1.1
          dropPos[o + 5] = dropZ[i]
        }
        ;(dropGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
      }

      composer.render()
    }
    animate()

    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
      composer.setSize(w, h)
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      controls.dispose()
      disposeTree(scene)
      disposeTree(envScene)
      envRT?.dispose()
      pmrem.dispose()
      composer.dispose()
      renderer.dispose()
      cameraRef.current = null
      controlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!webGlSupported) {
    return (
      <div className="webgl-fallback-card">
        <Info size={24} style={{ color: 'var(--amber)' }} />
        <h3>WebGL 3D Accelerated Graphics Required</h3>
        <p>Your browser environment does not support WebGL2 hardware acceleration for the 3D twin.</p>
        <button onClick={() => window.location.reload()} className="ghost">Retry</button>
      </div>
    )
  }

  const views: { id: CameraView; label: string; title: string }[] = [
    { id: 'isometric', label: 'Aerial', title: 'Overview aerial view' },
    { id: 'ground', label: 'Ground', title: 'Walk up to the site gate at eye level' },
    { id: 'solar', label: 'Solar', title: 'Focus on the solar PV park' },
    { id: 'battery', label: 'BESS', title: 'Focus on the battery enclosures' },
    { id: 'diesel', label: 'Genset', title: 'Focus on the diesel powerhouse' },
    { id: 'substation', label: 'AC Bus', title: 'Focus on the central substation yard' },
    { id: 'load', label: 'Load', title: 'Focus on the consumer demand site' }
  ]

  return (
    <div
      ref={containerRef}
      className={`scene-3d-wrapper ${isFullscreen ? 'fullscreen' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : '440px',
        background: '#060d15',
        borderRadius: isFullscreen ? '0' : '8px',
        overflow: 'hidden',
        border: '1px solid #1a2a38'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none', cursor: 'grab', touchAction: 'none' }}
      />

      {/* Soft vignette for depth */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(2,6,12,0.45) 100%)'
        }}
      />

      {/* Hover tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'none',
          opacity: hoveredAsset ? 1 : 0,
          transition: 'opacity 0.12s ease',
          background: 'rgba(6, 13, 21, 0.92)',
          border: '1px solid rgba(69, 212, 209, 0.5)',
          borderRadius: '6px',
          padding: '5px 9px',
          fontSize: '11px',
          color: '#e0f2fe',
          whiteSpace: 'nowrap'
        }}
      >
        {hoveredAsset ? `${ASSET_NAMES[hoveredAsset]}. Click to focus.` : ''}
      </div>

      {/* TOP HUD */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '8px',
          flexWrap: 'wrap',
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            background: 'rgba(6, 13, 21, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(69, 212, 209, 0.3)',
            borderRadius: '6px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            pointerEvents: 'auto'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: '#e0f2fe' }}>
            3D DIGITAL TWIN · {mode}
          </span>
          <span style={{ fontSize: '10px', color: '#889da7', borderLeft: '1px solid #233847', paddingLeft: '8px' }}>
            T+{currentStep.time.toFixed(2)}h · {currentStep.solarIrradiance} W/m²
          </span>
        </div>

        <div
          style={{
            background: 'rgba(6, 13, 21, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #1e3344',
            borderRadius: '6px',
            padding: '4px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            pointerEvents: 'auto'
          }}
        >
          <button
            className={`pov-pill ${lightingMode === 'daylight' ? 'active' : ''}`}
            onClick={() => setLightingMode(lightingMode === 'daylight' ? 'diurnal' : 'daylight')}
            title={lightingMode === 'daylight' ? 'Fixed daylight for clear inspection. Click for the diurnal sun cycle.' : 'Sun, moon, sky and site lights follow the 24h simulation clock. Click for fixed daylight.'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRight: '1px solid #233847', paddingRight: '8px', marginRight: '2px' }}
          >
            {lightingMode === 'daylight' ? <Sun size={12} style={{ color: '#f59e0b' }} /> : <Moon size={12} style={{ color: '#38bdf8' }} />}
            <span>{lightingMode === 'daylight' ? 'Daylight' : 'Diurnal'}</span>
          </button>

          {views.map((v) => (
            <button
              key={v.id}
              className={`pov-pill ${activeView === v.id ? 'active' : ''}`}
              onClick={() => setCameraView(v.id)}
              title={v.title}
            >
              {v.label}
            </button>
          ))}

          <button
            className={`pov-pill icon-only ${autoOrbit ? 'active' : ''}`}
            onClick={() => setAutoOrbit(!autoOrbit)}
            title={autoOrbit ? 'Stop the slow orbit' : 'Slow cinematic orbit around the site'}
          >
            <Compass size={13} />
          </button>
          <button
            className={`pov-pill icon-only ${showLabels ? 'active' : ''}`}
            onClick={() => setShowLabels(!showLabels)}
            title={showLabels ? 'Hide live asset labels' : 'Show live asset labels'}
          >
            <Eye size={13} />
          </button>
          <button
            className="pov-pill icon-only"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen 3D View'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Clickable telemetry chips */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          pointerEvents: 'auto',
          paddingBottom: '2px'
        }}
      >
        <button className={`hud-chip ${selectedAsset === 'pv' ? 'active' : ''}`} onClick={() => handleSelect('pv')}>
          <span className="dot solar" />
          <div className="chip-text">
            <strong>PV Array: {currentStep.pv.toFixed(1)} kW</strong>
            <small>{currentStep.solarIrradiance} W/m² · {currentStep.panelTemp}°C</small>
          </div>
        </button>

        <button className={`hud-chip ${selectedAsset === 'bess' ? 'active' : ''}`} onClick={() => handleSelect('bess')}>
          <span className="dot bess" />
          <div className="chip-text">
            <strong>BESS: {Math.abs(currentStep.battery).toFixed(1)} kW {currentStep.battery < -0.5 ? '[CHG]' : currentStep.battery > 0.5 ? '[DIS]' : '[IDLE]'}</strong>
            <small>SOC: {Math.round(currentStep.soc * 100)}% · SOH: {(currentStep.soh * 100).toFixed(2)}%</small>
          </div>
        </button>

        <button className={`hud-chip ${selectedAsset === 'dg' ? 'active' : ''}`} onClick={() => handleSelect('dg')}>
          <span className="dot diesel" />
          <div className="chip-text">
            <strong>DG: {currentStep.diesel.toFixed(1)} kW</strong>
            <small>{currentStep.dgRunning ? `${Math.round(currentStep.dgLoadingRatio * 100)}% Load · ${currentStep.fuelHourlyRate.toFixed(1)} L/h` : 'Standby'}</small>
          </div>
        </button>

        <button className={`hud-chip ${selectedAsset === 'bus' ? 'active' : ''}`} onClick={() => handleSelect('bus')}>
          <span className="dot bus" />
          <div className="chip-text">
            <strong>AC Bus: {(currentStep.pv + currentStep.diesel + Math.max(0, currentStep.battery)).toFixed(0)} kW</strong>
            <small>{currentStep.unmet > 0.1 ? `Deficit: ${currentStep.unmet.toFixed(1)} kW` : 'Balanced (50 Hz)'}</small>
          </div>
        </button>

        <button className={`hud-chip ${selectedAsset === 'load' ? 'active' : ''}`} onClick={() => handleSelect('load')}>
          <span className="dot load" />
          <div className="chip-text">
            <strong>Demand: {currentStep.load.toFixed(1)} kW</strong>
            <small>{loadProfile}</small>
          </div>
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '48px',
          right: '12px',
          fontSize: '9px',
          color: '#6f8797',
          background: 'rgba(6, 13, 21, 0.65)',
          padding: '3px 8px',
          borderRadius: '4px',
          pointerEvents: 'none'
        }}
      >
        Left-Click: Orbit · Right-Click: Pan · Scroll: Zoom · Click an asset to focus
      </div>

      <style jsx>{`
        .pov-pill {
          background: transparent;
          border: 1px solid transparent;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pov-pill:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.08);
        }
        .pov-pill.active {
          background: rgba(69, 212, 209, 0.2);
          border-color: rgba(69, 212, 209, 0.6);
          color: var(--cyan);
        }
        .pov-pill.icon-only {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 6px;
        }
        .hud-chip {
          background: rgba(10, 20, 30, 0.88);
          backdrop-filter: blur(6px);
          border: 1px solid #1a2d3d;
          border-radius: 6px;
          padding: 6px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f1f5f9;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
          flex: 1;
          min-width: 130px;
        }
        .hud-chip:hover {
          border-color: var(--cyan);
          background: rgba(15, 30, 45, 0.95);
        }
        .hud-chip.active {
          border-color: var(--cyan);
          box-shadow: 0 0 10px rgba(69, 212, 209, 0.25);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot.solar { background: #e7ad55; box-shadow: 0 0 6px #e7ad55; }
        .dot.bess { background: #45d4d1; box-shadow: 0 0 6px #45d4d1; }
        .dot.diesel { background: #ef8354; box-shadow: 0 0 6px #ef8354; }
        .dot.bus { background: #38bdf8; box-shadow: 0 0 6px #38bdf8; }
        .dot.load { background: #10b981; box-shadow: 0 0 6px #10b981; }
        .chip-text {
          display: flex;
          flex-direction: column;
          text-align: left;
        }
        .chip-text strong {
          font-size: 11px;
          font-weight: 600;
          color: #f8fafc;
        }
        .chip-text small {
          font-size: 9px;
          color: #94a3b8;
        }
        .fullscreen {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 99999 !important;
          border-radius: 0 !important;
        }
      `}</style>
    </div>
  )
}