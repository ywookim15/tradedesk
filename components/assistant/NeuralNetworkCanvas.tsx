'use client'

/**
 * NeuralNetworkCanvas — animated neural network visualization.
 *
 * - Nodes drift slowly at idle; speed scales with audioAmplitude when active.
 * - Synaptic pulses travel along edges; spawn rate and glow increase with amplitude.
 * - Uses Web Audio API AnalyserNode (passed in as a ref) for real amplitude data.
 * - requestAnimationFrame loop, no layout thrashing — purely canvas.
 */

import { useEffect, useRef } from 'react'
import type { AssistantStatus } from '@/types'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  r: number          // radius
  phase: number      // for breathing effect
}

interface Pulse {
  fromIdx: number
  toIdx: number
  t: number          // 0 → 1 progress
  speed: number
  alpha: number
  color: string
}

interface Props {
  /** Pass the AnalyserNode so the canvas reads amplitude every frame */
  analyserRef: React.RefObject<AnalyserNode | null>
  status: AssistantStatus
  className?: string
}

const NODE_COUNT = 30
const MAX_CONNECT_DIST = 170
const IDLE_SPEED = 0.18
const ACTIVE_SPEED = 1.4

// Colors keyed by status (RGB string for rgba())
const STATUS_COLORS: Record<AssistantStatus, string> = {
  idle:      '47,128,237',
  listening: '0,200,150',
  thinking:  '139,92,246',
  speaking:  '79,163,255',
}

function getAmplitude(analyser: AnalyserNode | null): number {
  if (!analyser) return 0
  const buf = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(buf)
  const sum = buf.reduce((a, b) => a + b, 0)
  return Math.min(1, sum / (buf.length * 140)) // normalise 0→1
}

export default function NeuralNetworkCanvas({ analyserRef, status, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef({ status })
  const rafRef    = useRef<number>(0)

  useEffect(() => { stateRef.current.status = status }, [status])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ── Node pool ────────────────────────────────────────────────────────────
    let nodes: Node[] = []
    let pulses: Pulse[] = []
    let w = 0
    let h = 0

    function initNodes() {
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x:     Math.random() * w,
        y:     Math.random() * h,
        vx:    (Math.random() - 0.5) * 0.5,
        vy:    (Math.random() - 0.5) * 0.5,
        r:     Math.random() * 2.5 + 1.5,
        phase: Math.random() * Math.PI * 2,
      }))
      pulses = []
    }

    // ── Resize ───────────────────────────────────────────────────────────────
    function resize() {
      const dpr  = window.devicePixelRatio || 1
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width  = w * dpr
      canvas!.height = h * dpr
      ctx!.scale(dpr, dpr)
      initNodes()
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let lastTime = performance.now()

    // ── Animation loop ───────────────────────────────────────────────────────
    function frame(now: number) {
      rafRef.current = requestAnimationFrame(frame)

      const dt  = Math.min(now - lastTime, 50)
      lastTime  = now

      const { status: st } = stateRef.current
      const amp  = getAmplitude(analyserRef.current)
      const col  = STATUS_COLORS[st]
      const isActive = st !== 'idle'
      const speed = isActive ? ACTIVE_SPEED + amp * 3 : IDLE_SPEED

      ctx!.clearRect(0, 0, w, h)

      // Update nodes
      const dtF = dt * 0.06
      for (const n of nodes) {
        n.phase += 0.008 * speed
        n.x += n.vx * speed * dtF
        n.y += n.vy * speed * dtF
        if (n.x < 0 || n.x > w) { n.vx *= -1; n.x = Math.max(0, Math.min(w, n.x)) }
        if (n.y < 0 || n.y > h) { n.vy *= -1; n.y = Math.max(0, Math.min(h, n.y)) }
      }

      // Spawn pulses
      const spawnRate = isActive ? 0.06 + amp * 0.25 : 0.012
      if (Math.random() < spawnRate * dtF) {
        const fi = Math.floor(Math.random() * nodes.length)
        let   ti = -1, bestD = Infinity
        for (let j = 0; j < nodes.length; j++) {
          if (j === fi) continue
          const dx = nodes[fi].x - nodes[j].x
          const dy = nodes[fi].y - nodes[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < MAX_CONNECT_DIST && d < bestD) { bestD = d; ti = j }
        }
        if (ti >= 0) {
          pulses.push({
            fromIdx: fi,
            toIdx:   ti,
            t:       0,
            speed:   0.004 + Math.random() * 0.005,
            alpha:   0.7 + amp * 0.3,
            color:   col,
          })
        }
      }

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d > MAX_CONNECT_DIST) continue
          const edgeA = (1 - d / MAX_CONNECT_DIST) * (isActive ? 0.22 + amp * 0.18 : 0.08)
          ctx!.beginPath()
          ctx!.moveTo(nodes[i].x, nodes[i].y)
          ctx!.lineTo(nodes[j].x, nodes[j].y)
          ctx!.strokeStyle = `rgba(${col},${edgeA.toFixed(3)})`
          ctx!.lineWidth   = 0.5
          ctx!.stroke()
        }
      }

      // Update & draw pulses
      pulses = pulses.filter(p => p.t <= 1)
      for (const p of pulses) {
        p.t += p.speed * speed * dtF
        const fx = nodes[p.fromIdx].x, fy = nodes[p.fromIdx].y
        const tx = nodes[p.toIdx].x,   ty = nodes[p.toIdx].y
        const px = fx + (tx - fx) * p.t
        const py = fy + (ty - fy) * p.t

        // Glow halo
        const grd = ctx!.createRadialGradient(px, py, 0, px, py, 6)
        grd.addColorStop(0, `rgba(${p.color},${p.alpha.toFixed(2)})`)
        grd.addColorStop(1, `rgba(${p.color},0)`)
        ctx!.beginPath()
        ctx!.arc(px, py, 6, 0, Math.PI * 2)
        ctx!.fillStyle = grd
        ctx!.fill()

        // Core dot
        ctx!.beginPath()
        ctx!.arc(px, py, 2, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${p.color},${Math.min(1, p.alpha * 1.4).toFixed(2)})`
        ctx!.fill()
      }

      // Draw nodes
      for (const n of nodes) {
        const breathe  = 0.5 + Math.sin(n.phase) * 0.3
        const glow     = isActive ? (breathe * (0.4 + amp * 0.6)) : (breathe * 0.25)
        const coreAlph = isActive ? Math.min(1, glow * 2) : 0.35

        // Outer glow gradient
        const grd = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5)
        grd.addColorStop(0, `rgba(${col},${(glow * 0.7).toFixed(3)})`)
        grd.addColorStop(1, `rgba(${col},0)`)
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2)
        ctx!.fillStyle = grd
        ctx!.fill()

        // Core node
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${col},${coreAlph.toFixed(3)})`
        ctx!.fill()
      }
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [analyserRef])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
