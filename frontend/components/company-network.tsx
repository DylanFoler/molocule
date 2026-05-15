'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Company, Signal, SignalType } from '@/lib/types'
import { SIGNAL_LABELS } from '@/lib/types'
import { getFaviconUrl } from '@/lib/utils'

interface Node {
  id: string; name: string
  x: number; y: number; vx: number; vy: number
  favicon: string; signalTypes: Set<string>
  radius: number; isDragging: boolean
}

interface Edge {
  source: string; target: string
  strength: number; reason: string; color: string
}

interface Tooltip { x: number; y: number; text: string }

const TYPE_COLORS: Record<string, string> = {
  FUNDING: 'rgba(74,222,128,0.7)',
  KEY_HIRE: 'rgba(255,255,255,0.6)',
  LAYOFF: 'rgba(248,113,113,0.7)',
  PRODUCT_LAUNCH: 'rgba(251,191,36,0.7)',
  GENERAL: 'rgba(255,255,255,0.4)',
}

function computeEdges(companies: Company[], signals: Signal[]): Edge[] {
  const edges: Edge[] = []
  const signalsByCompany = new Map<string, Set<string>>()
  for (const s of signals) {
    if (!signalsByCompany.has(s.company_id)) signalsByCompany.set(s.company_id, new Set())
    signalsByCompany.get(s.company_id)!.add(s.type)
  }

  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = companies[i]; const b = companies[j]
      const typesA = signalsByCompany.get(a.id) ?? new Set<string>()
      const typesB = signalsByCompany.get(b.id) ?? new Set<string>()
      const shared = Array.from(typesA).filter(t => typesB.has(t)) as SignalType[]

      if (shared.length > 0) {
        const primary = shared[0]
        edges.push({
          source: a.id, target: b.id,
          strength: Math.min(shared.length / 3, 1),
          reason: `Both: ${shared.map(t => SIGNAL_LABELS[t as SignalType]).join(', ')}`,
          color: TYPE_COLORS[primary] ?? 'rgba(255,255,255,0.4)',
        })
      }
    }
  }
  return edges
}

export function CompanyNetwork({ companies, signals }: { companies: Company[]; signals: Signal[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef  = useRef<Node[]>([])
  const edgesRef  = useRef<Edge[]>([])
  const rafRef    = useRef<number>(0)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.offsetWidth; const H = canvas.offsetHeight
    canvas.width = W; canvas.height = H

    // Init nodes in a circle so they fan out nicely
    nodesRef.current = companies.map((c, i) => {
      const angle = (i / companies.length) * Math.PI * 2
      const r = Math.min(W, H) * 0.32
      return {
        id: c.id, name: c.name,
        x: W / 2 + r * Math.cos(angle),
        y: H / 2 + r * Math.sin(angle),
        vx: 0, vy: 0,
        favicon: getFaviconUrl(c.website),
        signalTypes: new Set<string>(),
        radius: 22,
        isDragging: false,
      }
    })

    edgesRef.current = computeEdges(companies, signals)

    // Pre-load favicons
    for (const node of nodesRef.current) {
      if (imagesRef.current.has(node.favicon)) continue
      const img = new Image(); img.src = node.favicon
      img.onload = () => imagesRef.current.set(node.favicon, img)
    }
  }, [companies, signals])

  const simulate = useCallback(() => {
    const nodes = nodesRef.current; const edges = edgesRef.current
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.width; const H = canvas.height

    const REPULSION = 6000; const SPRING_K = 0.018
    const REST_LEN = Math.min(W, H) * 0.28; const DAMP = 0.82

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]; const b = nodes[j]
        const dx = b.x - a.x; const dy = b.y - a.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const f = REPULSION / (d * d)
        const fx = f * dx / d; const fy = f * dy / d
        if (!a.isDragging) { a.vx -= fx; a.vy -= fy }
        if (!b.isDragging) { b.vx += fx; b.vy += fy }
      }
    }

    // Springs
    for (const e of edges) {
      const a = nodes.find(n => n.id === e.source)
      const b = nodes.find(n => n.id === e.target)
      if (!a || !b) continue
      const dx = b.x - a.x; const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (d - REST_LEN) * SPRING_K * e.strength
      const fx = f * dx / d; const fy = f * dy / d
      if (!a.isDragging) { a.vx += fx; a.vy += fy }
      if (!b.isDragging) { b.vx -= fx; b.vy -= fy }
    }

    // Integrate
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.0008
      n.vy += (H / 2 - n.y) * 0.0008
      if (!n.isDragging) {
        n.vx *= DAMP; n.vy *= DAMP
        n.x += n.vx; n.y += n.vy
      }
      n.x = Math.max(n.radius + 4, Math.min(W - n.radius - 4, n.x))
      n.y = Math.max(n.radius + 4, Math.min(H - n.radius - 4, n.y))
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const nodes = nodesRef.current; const edges = edgesRef.current
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw edges
    for (const e of edges) {
      const a = nodes.find(n => n.id === e.source)
      const b = nodes.find(n => n.id === e.target)
      if (!a || !b) continue
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
      const op = 0.12 + e.strength * 0.25
      grad.addColorStop(0, e.color.replace(/[\d.]+\)$/, `${op})`))
      grad.addColorStop(0.5, e.color.replace(/[\d.]+\)$/, `${op + 0.1})`))
      grad.addColorStop(1, e.color.replace(/[\d.]+\)$/, `${op})`))
      ctx.strokeStyle = grad
      ctx.lineWidth = 0.8 + e.strength * 1.2
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }

    // Draw nodes
    for (const n of nodes) {
      const r = n.radius
      ctx.save()

      // Glow
      ctx.shadowColor = 'rgba(255,255,255,0.35)'
      ctx.shadowBlur = 12

      // Circle fill
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke()

      ctx.shadowBlur = 0

      // Favicon
      const img = imagesRef.current.get(n.favicon)
      if (img) {
        ctx.save(); ctx.beginPath(); ctx.arc(n.x, n.y, r - 4, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(img, n.x - (r - 4), n.y - (r - 4), (r - 4) * 2, (r - 4) * 2)
        ctx.restore()
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = `bold ${Math.round(r * 0.65)}px system-ui`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(n.name[0], n.x, n.y)
      }

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(n.name, n.x, n.y + r + 5)

      ctx.restore()
    }
  }, [])

  useEffect(() => {
    function loop() {
      simulate(); draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [simulate, draw])

  // Mouse interaction
  function getNodeAt(x: number, y: number) {
    return nodesRef.current.find(n => Math.hypot(n.x - x, n.y - y) <= n.radius + 4)
  }

  function canvasPos(e: React.MouseEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onMouseMove(e: React.MouseEvent) {
    const { x, y } = canvasPos(e)
    if (dragRef.current) {
      const node = nodesRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) { node.x = x - dragRef.current.offsetX; node.y = y - dragRef.current.offsetY }
      return
    }
    const node = getNodeAt(x, y)
    if (node) {
      const edge = edgesRef.current.find(e => e.source === node.id || e.target === node.id)
      setTooltip({ x, y, text: edge ? `${node.name}: ${edge.reason}` : node.name })
      canvasRef.current!.style.cursor = 'grab'
    } else {
      setTooltip(null)
      canvasRef.current!.style.cursor = 'default'
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    const { x, y } = canvasPos(e)
    const node = getNodeAt(x, y)
    if (node) {
      node.isDragging = true
      dragRef.current = { nodeId: node.id, offsetX: x - node.x, offsetY: y - node.y }
      canvasRef.current!.style.cursor = 'grabbing'
    }
  }

  function onMouseUp() {
    if (dragRef.current) {
      const node = nodesRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) { node.isDragging = false; node.vx = 0; node.vy = 0 }
      dragRef.current = null
    }
    canvasRef.current!.style.cursor = 'default'
  }

  if (companies.length === 0) return null

  return (
    <div className="relative w-full" style={{ height: '500px' }}>
      <canvas ref={canvasRef} className="w-full h-full"
        onMouseMove={onMouseMove} onMouseDown={onMouseDown}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {SIGNAL_LABELS[type as SignalType]}
            </span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute pointer-events-none px-2.5 py-1.5 rounded-lg text-[11px] max-w-[200px]"
          style={{
            left: tooltip.x + 12, top: tooltip.y - 12,
            background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)',
          }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
