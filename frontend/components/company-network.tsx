'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Company, Signal, SignalType } from '@/lib/types'
import { SIGNAL_LABELS } from '@/lib/types'
import { getFaviconUrl } from '@/lib/utils'

interface Node {
  id: string; name: string
  x: number; y: number; vx: number; vy: number
  favicon: string; radius: number; isDragging: boolean
}

interface Edge {
  source: string; target: string
  strength: number; reason: string; color: string
}

interface InfoPanel {
  type: 'node' | 'edge'
  title: string
  subtitle: string
  detail: string
}

const TYPE_COLORS: Record<string, string> = {
  FUNDING: 'rgba(74,222,128,0.7)',
  KEY_HIRE: 'rgba(255,255,255,0.55)',
  LAYOFF: 'rgba(248,113,113,0.7)',
  PRODUCT_LAUNCH: 'rgba(251,191,36,0.7)',
  GENERAL: 'rgba(255,255,255,0.35)',
}

function computeEdges(companies: Company[], signals: Signal[]): Edge[] {
  const edges: Edge[] = []
  const byCompany = new Map<string, Set<string>>()
  for (const s of signals) {
    if (!byCompany.has(s.company_id)) byCompany.set(s.company_id, new Set())
    byCompany.get(s.company_id)!.add(s.type)
  }
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = companies[i]; const b = companies[j]
      const tA = byCompany.get(a.id) ?? new Set<string>()
      const tB = byCompany.get(b.id) ?? new Set<string>()
      const shared = Array.from(tA).filter(t => tB.has(t)) as SignalType[]
      if (shared.length > 0) {
        edges.push({
          source: a.id, target: b.id,
          strength: Math.min(shared.length / 3, 1),
          reason: `Both had: ${shared.map(t => SIGNAL_LABELS[t]).join(', ')}`,
          color: TYPE_COLORS[shared[0]] ?? 'rgba(255,255,255,0.4)',
        })
      }
    }
  }
  return edges
}

export function CompanyNetwork({ companies, signals }: { companies: Company[]; signals: Signal[] }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const nodesRef    = useRef<Node[]>([])
  const edgesRef    = useRef<Edge[]>([])
  const imagesRef   = useRef<Map<string, HTMLImageElement>>(new Map())
  const rafRef      = useRef<number>(0)
  const dragRef     = useRef<{ nodeId: string; ox: number; oy: number } | null>(null)
  const panRef      = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)

  // View state
  const scaleRef  = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const focusRef  = useRef<string | null>(null)

  const [infoPanel, setInfoPanel] = useState<InfoPanel | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.offsetWidth; const H = canvas.offsetHeight
    canvas.width = W; canvas.height = H
    scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 }; focusRef.current = null

    nodesRef.current = companies.map((c, i) => {
      const angle = (i / companies.length) * Math.PI * 2
      const r = Math.min(W, H) * 0.3
      return {
        id: c.id, name: c.name,
        x: W / 2 + r * Math.cos(angle),
        y: H / 2 + r * Math.sin(angle),
        vx: 0, vy: 0,
        favicon: getFaviconUrl(c.website),
        radius: 22, isDragging: false,
      }
    })
    edgesRef.current = computeEdges(companies, signals)

    for (const n of nodesRef.current) {
      if (imagesRef.current.has(n.favicon)) continue
      const img = new Image(); img.src = n.favicon
      img.onload = () => imagesRef.current.set(n.favicon, img)
    }
  }, [companies, signals])

  const toWorld = useCallback((cx: number, cy: number) => {
    const s = scaleRef.current; const o = offsetRef.current
    return { x: (cx - o.x) / s, y: (cy - o.y) / s }
  }, [])

  const canvasPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [])

  const getNodeAt = useCallback((wx: number, wy: number) =>
    nodesRef.current.find(n => Math.hypot(n.x - wx, n.y - wy) <= n.radius + 6)
  , [])

  const getEdgeAt = useCallback((wx: number, wy: number) => {
    const nodes = nodesRef.current
    for (const e of edgesRef.current) {
      const a = nodes.find(n => n.id === e.source)
      const b = nodes.find(n => n.id === e.target)
      if (!a || !b) continue
      const dx = b.x - a.x; const dy = b.y - a.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const t = Math.max(0, Math.min(1, ((wx - a.x) * dx + (wy - a.y) * dy) / (len * len)))
      const px = a.x + t * dx - wx; const py = a.y + t * dy - wy
      if (Math.sqrt(px * px + py * py) < 10 / scaleRef.current) return e
    }
    return null
  }, [])

  const simulate = useCallback(() => {
    const nodes = nodesRef.current; const edges = edgesRef.current
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.width; const H = canvas.height
    const REPULSION = 5500; const SPRING = 0.016; const DAMP = 0.82
    const REST = Math.min(W, H) * 0.26

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
    for (const e of edges) {
      const a = nodes.find(n => n.id === e.source)
      const b = nodes.find(n => n.id === e.target)
      if (!a || !b) continue
      const dx = b.x - a.x; const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (d - REST) * SPRING * e.strength
      const fx = f * dx / d; const fy = f * dy / d
      if (!a.isDragging) { a.vx += fx; a.vy += fy }
      if (!b.isDragging) { b.vx -= fx; b.vy -= fy }
    }
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.0006
      n.vy += (H / 2 - n.y) * 0.0006
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
    const s = scaleRef.current; const o = offsetRef.current
    const focused = focusRef.current

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(o.x, o.y)
    ctx.scale(s, s)

    // Dim unfocused nodes when one is focused
    const dimmed = (id: string) => focused !== null && id !== focused &&
      !edges.some(e => (e.source === focused && e.target === id) || (e.target === focused && e.source === id))

    // Edges
    for (const e of edges) {
      const a = nodes.find(n => n.id === e.source)
      const b = nodes.find(n => n.id === e.target)
      if (!a || !b) continue
      const isDimmed = focused && dimmed(a.id) && dimmed(b.id)
      const isHighlighted = focused && (e.source === focused || e.target === focused)
      const op = isDimmed ? 0.03 : isHighlighted ? 0.5 + e.strength * 0.35 : 0.1 + e.strength * 0.2

      ctx.strokeStyle = e.color.replace(/[\d.]+\)$/, `${op})`)
      ctx.lineWidth = isHighlighted ? 1.5 + e.strength : 0.8 + e.strength * 0.8
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()

      // Edge label when focused and connected
      if (isHighlighted && s > 0.7) {
        const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2
        ctx.fillStyle = e.color.replace(/[\d.]+\)$/, '0.8)')
        ctx.beginPath(); ctx.arc(mx, my, 3 / s, 0, Math.PI * 2); ctx.fill()

        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.65)'
        ctx.font = `${11 / s}px system-ui`
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        ctx.fillText(e.reason, mx, my - 6 / s)
        ctx.restore()
      }
    }

    // Nodes
    for (const n of nodes) {
      const isDim = dimmed(n.id)
      const isFocused = n.id === focused
      const r = n.radius

      ctx.save()
      ctx.globalAlpha = isDim ? 0.2 : 1

      // Glow for focused/connected
      if (isFocused) {
        ctx.shadowColor = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 18 / s
      }

      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill()
      ctx.strokeStyle = isFocused ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'
      ctx.lineWidth = isFocused ? 1.5 : 0.8; ctx.stroke()
      ctx.shadowBlur = 0

      // Favicon or initial
      const img = imagesRef.current.get(n.favicon)
      if (img) {
        ctx.save(); ctx.beginPath(); ctx.arc(n.x, n.y, r - 4, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(img, n.x - (r - 4), n.y - (r - 4), (r - 4) * 2, (r - 4) * 2)
        ctx.restore()
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = `bold ${Math.round(r * 0.6) / s < 8 ? 8 : Math.round(r * 0.6)}px system-ui`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(n.name[0], n.x, n.y)
      }

      // Label
      ctx.fillStyle = isFocused ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)'
      ctx.font = `${isFocused ? 'bold ' : ''}${12 / s < 8 ? 8 : 12}px system-ui`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(n.name, n.x, n.y + r + 5)

      ctx.restore()
    }

    ctx.restore()
  }, [])

  useEffect(() => {
    function loop() { simulate(); draw(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [simulate, draw])

  // Mouse events
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const { x, y } = canvasPos(e)
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.max(0.3, Math.min(3, scaleRef.current * factor))
    offsetRef.current = {
      x: x - (x - offsetRef.current.x) * (newScale / scaleRef.current),
      y: y - (y - offsetRef.current.y) * (newScale / scaleRef.current),
    }
    scaleRef.current = newScale
  }

  function onMouseDown(e: React.MouseEvent) {
    const { x, y } = canvasPos(e)
    const world = toWorld(x, y)
    const node = getNodeAt(world.x, world.y)
    if (node) {
      node.isDragging = true
      dragRef.current = { nodeId: node.id, ox: world.x - node.x, oy: world.y - node.y }
    } else {
      panRef.current = { startX: x, startY: y, ox: offsetRef.current.x, oy: offsetRef.current.y }
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    const { x, y } = canvasPos(e)
    const world = toWorld(x, y)

    if (dragRef.current) {
      const node = nodesRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) { node.x = world.x - dragRef.current.ox; node.y = world.y - dragRef.current.oy }
      canvasRef.current!.style.cursor = 'grabbing'
      return
    }

    if (panRef.current) {
      offsetRef.current = { x: panRef.current.ox + x - panRef.current.startX, y: panRef.current.oy + y - panRef.current.startY }
      canvasRef.current!.style.cursor = 'grabbing'
      return
    }

    const node = getNodeAt(world.x, world.y)
    const edge = !node ? getEdgeAt(world.x, world.y) : null
    canvasRef.current!.style.cursor = node ? 'pointer' : edge ? 'pointer' : 'grab'
  }

  function onMouseUp(e: React.MouseEvent) {
    const wasDragging = !!dragRef.current
    const { x, y } = canvasPos(e)
    const world = toWorld(x, y)

    if (dragRef.current) {
      const node = nodesRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (node) { node.isDragging = false; node.vx = 0; node.vy = 0 }
      dragRef.current = null
    }
    panRef.current = null
    canvasRef.current!.style.cursor = 'grab'

    if (!wasDragging) {
      const node = getNodeAt(world.x, world.y)
      const edge = !node ? getEdgeAt(world.x, world.y) : null

      if (node) {
        const isSame = focusRef.current === node.id
        focusRef.current = isSame ? null : node.id
        const connectedEdges = edgesRef.current.filter(e => e.source === node.id || e.target === node.id)
        setInfoPanel(isSame ? null : {
          type: 'node',
          title: node.name,
          subtitle: `${connectedEdges.length} connection${connectedEdges.length !== 1 ? 's' : ''}`,
          detail: connectedEdges.length > 0
            ? connectedEdges.map(e => {
                const other = nodesRef.current.find(n => n.id === (e.source === node.id ? e.target : e.source))
                return `${other?.name ?? '?'}: ${e.reason}`
              }).join('\n')
            : 'No shared signals with other tracked companies yet.',
        })
      } else if (edge) {
        const a = nodesRef.current.find(n => n.id === edge.source)
        const b = nodesRef.current.find(n => n.id === edge.target)
        setInfoPanel({
          type: 'edge',
          title: `${a?.name} + ${b?.name}`,
          subtitle: edge.reason,
          detail: `Signal overlap strength: ${Math.round(edge.strength * 100)}%.\nBoth companies triggered the same signal type in the last 7 days.`,
        })
      } else {
        focusRef.current = null
        setInfoPanel(null)
      }
    }
  }

  if (companies.length === 0) return null

  return (
    <div className="relative w-full" style={{ height: 520 }}>
      <canvas ref={canvasRef} className="w-full h-full"
        style={{ cursor: 'grab', display: 'block' }}
        onWheel={onWheel} onMouseDown={onMouseDown}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3">
        <span className="text-[10px] px-2 py-1 rounded-md" style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
          Scroll to zoom · Drag to pan · Click node or edge
        </span>
      </div>

      {/* Signal type legend */}
      <div className="absolute bottom-4 right-4 flex flex-wrap gap-1.5 max-w-[200px] justify-end">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1 px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {SIGNAL_LABELS[type as SignalType]}
            </span>
          </div>
        ))}
      </div>

      {/* Info panel */}
      {infoPanel && (
        <div className="absolute top-4 right-4 w-60 rounded-xl p-4 animate-slide-up"
          style={{ background: 'rgba(8,8,12,0.92)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => { setInfoPanel(null); focusRef.current = null }}
            className="absolute top-3 right-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
          <p className="text-sm font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {infoPanel.title}
          </p>
          <p className="text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {infoPanel.subtitle}
          </p>
          <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans"
            style={{ color: 'rgba(255,255,255,0.55)' }}>
            {infoPanel.detail}
          </pre>
        </div>
      )}
    </div>
  )
}
