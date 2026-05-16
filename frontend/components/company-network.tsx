'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Company, Signal } from '@/lib/types'
import { getFaviconUrl } from '@/lib/utils'

interface Node { id: string; name: string; x: number; y: number; vx: number; vy: number; favicon: string; radius: number; isDragging: boolean }

type EdgeKind = 'COMPETITIVE' | 'TALENT_FLOW' | 'MARKET_PRESSURE' | 'SIGNAL_MENTION' | 'INDUSTRY_PEER'

interface Edge {
  source: string; target: string
  strength: number
  kind: EdgeKind
  reason: string        // short label shown on edge
  detail: string        // longer explanation shown in panel
  color: string
}

interface InfoPanel { type: 'node' | 'edge'; title: string; subtitle: string; detail: string }

const EDGE_COLORS: Record<EdgeKind, string> = {
  COMPETITIVE:     'rgba(248,113,113,0.7)',
  TALENT_FLOW:     'rgba(251,191,36,0.7)',
  MARKET_PRESSURE: 'rgba(74,222,128,0.65)',
  SIGNAL_MENTION:  'rgba(255,255,255,0.75)',
  INDUSTRY_PEER:   'rgba(255,255,255,0.35)',
}

const EDGE_LABELS: Record<EdgeKind, string> = {
  COMPETITIVE:     'Direct rivals',
  TALENT_FLOW:     'Talent flow',
  MARKET_PRESSURE: 'Market pressure',
  SIGNAL_MENTION:  'News cross-ref',
  INDUSTRY_PEER:   'Same sector',
}

// ── Industry detection ─────────────────────────────────────────────────────
const INDUSTRIES: Record<string, string[]> = {
  fintech:   ['stripe', 'brex', 'plaid', 'mercury', 'ramp', 'affirm', 'payment', 'finance', 'fintech'],
  devtools:  ['vercel', 'linear', 'github', 'gitlab', 'render', 'railway', 'supabase', 'developer', 'deploy'],
  ai:        ['anthropic', 'openai', 'cohere', 'mistral', 'perplexity', 'claude', 'gpt', 'llm', 'artificial'],
  saas:      ['notion', 'figma', 'canva', 'airtable', 'monday', 'asana', 'productiv'],
  hr:        ['rippling', 'gusto', 'deel', 'remote', 'lattice', 'workday', 'payroll', 'hr tech'],
}

function detectIndustry(company: Company): string {
  const text = (company.name + ' ' + (company.website ?? '') + ' ' + (company.github_org ?? '')).toLowerCase()
  for (const [industry, keywords] of Object.entries(INDUSTRIES)) {
    if (keywords.some(k => text.includes(k))) return industry
  }
  return 'other'
}

// ── Competitive pairs (hardcoded known rivalries) ─────────────────────────
const RIVALRIES: [string, string][] = [
  ['Stripe', 'Brex'], ['Stripe', 'Square'], ['Stripe', 'PayPal'],
  ['Anthropic', 'OpenAI'], ['Anthropic', 'Cohere'],
  ['Vercel', 'Netlify'], ['Vercel', 'Cloudflare'],
  ['Linear', 'Jira'], ['Linear', 'Notion'], ['Notion', 'Confluence'],
  ['Figma', 'Sketch'], ['Figma', 'Adobe'],
  ['Rippling', 'Gusto'], ['Rippling', 'Workday'],
  ['Brex', 'Ramp'],
]

function areRivals(a: Company, b: Company): boolean {
  return RIVALRIES.some(([x, y]) =>
    (a.name.toLowerCase().includes(x.toLowerCase()) && b.name.toLowerCase().includes(y.toLowerCase())) ||
    (a.name.toLowerCase().includes(y.toLowerCase()) && b.name.toLowerCase().includes(x.toLowerCase()))
  )
}

// ── Cross-mention detection ────────────────────────────────────────────────
function signalsMentionEachOther(sigsA: Signal[], companyB: Company, sigsB: Signal[], companyA: Company): string | null {
  for (const s of sigsA) {
    const text = (s.title + ' ' + (s.summary ?? '')).toLowerCase()
    if (text.includes(companyB.name.toLowerCase())) return `"${s.title.slice(0, 70)}"`
  }
  for (const s of sigsB) {
    const text = (s.title + ' ' + (s.summary ?? '')).toLowerCase()
    if (text.includes(companyA.name.toLowerCase())) return `"${s.title.slice(0, 70)}"`
  }
  return null
}

// ── Talent flow detection ──────────────────────────────────────────────────
function detectTalentFlow(sigsA: Signal[], nameB: string, sigsB: Signal[], nameA: string): string | null {
  const hireRegex = /\b(hired|joins|appoints?|named|from)\b/i
  for (const s of [...sigsA, ...sigsB]) {
    if (s.type !== 'KEY_HIRE') continue
    const text = s.title + ' ' + (s.summary ?? '')
    if (hireRegex.test(text) && (text.toLowerCase().includes(nameB.toLowerCase()) || text.toLowerCase().includes(nameA.toLowerCase()))) {
      return s.title.slice(0, 80)
    }
  }
  return null
}

// ── Market pressure ────────────────────────────────────────────────────────
function detectMarketPressure(sigsA: Signal[], companyA: Company, sigsB: Signal[], companyB: Company): string | null {
  const fundingA = sigsA.find(s => s.type === 'FUNDING')
  const fundingB = sigsB.find(s => s.type === 'FUNDING')
  const layoffA  = sigsA.find(s => s.type === 'LAYOFF')
  const layoffB  = sigsB.find(s => s.type === 'LAYOFF')
  const launchA  = sigsA.find(s => s.type === 'PRODUCT_LAUNCH')
  const launchB  = sigsB.find(s => s.type === 'PRODUCT_LAUNCH')

  if (fundingA && layoffB) return `${companyA.name} raised capital while ${companyB.name} cut headcount — competitive pressure signal`
  if (fundingB && layoffA) return `${companyB.name} raised capital while ${companyA.name} cut headcount — competitive pressure signal`
  if (launchA && launchB) return `Both launched products in the same period — direct feature race`
  if (fundingA && fundingB) return `Both raised funding in the same cycle — competing for same investor attention`
  return null
}

// ── Main edge computation ──────────────────────────────────────────────────
function computeEdges(companies: Company[], signals: Signal[]): Edge[] {
  const edges: Edge[] = []
  const sigsByCompany = new Map<string, Signal[]>()
  for (const s of signals) {
    if (!sigsByCompany.has(s.company_id)) sigsByCompany.set(s.company_id, [])
    sigsByCompany.get(s.company_id)!.push(s)
  }

  const industryMap = new Map(companies.map(c => [c.id, detectIndustry(c)]))

  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = companies[i]; const b = companies[j]
      const sigsA = sigsByCompany.get(a.id) ?? []
      const sigsB = sigsByCompany.get(b.id) ?? []
      const industryA = industryMap.get(a.id); const industryB = industryMap.get(b.id)

      // 1. Direct rivalry (strongest signal)
      if (areRivals(a, b)) {
        const pressureReason = detectMarketPressure(sigsA, a, sigsB, b)
        edges.push({
          source: a.id, target: b.id, strength: 0.9,
          kind: pressureReason ? 'MARKET_PRESSURE' : 'COMPETITIVE',
          reason: pressureReason ? 'Market pressure' : 'Direct rivals',
          detail: pressureReason ?? `${a.name} and ${b.name} compete in the same market. Activity from either directly affects the other's positioning.`,
          color: pressureReason ? EDGE_COLORS.MARKET_PRESSURE : EDGE_COLORS.COMPETITIVE,
        })
        continue
      }

      // 2. Cross-mention in signals
      const mention = signalsMentionEachOther(sigsA, b, sigsB, a)
      if (mention) {
        edges.push({
          source: a.id, target: b.id, strength: 0.85,
          kind: 'SIGNAL_MENTION',
          reason: 'News cross-ref',
          detail: `A recent signal directly references both companies: ${mention}`,
          color: EDGE_COLORS.SIGNAL_MENTION,
        })
        continue
      }

      // 3. Talent flow between companies
      const talent = detectTalentFlow(sigsA, b.name, sigsB, a.name)
      if (talent) {
        edges.push({
          source: a.id, target: b.id, strength: 0.75,
          kind: 'TALENT_FLOW',
          reason: 'Talent flow',
          detail: `Hire signal referencing both companies: ${talent}`,
          color: EDGE_COLORS.TALENT_FLOW,
        })
        continue
      }

      // 4. Market pressure (same industry, different event types)
      if (industryA === industryB && industryA !== 'other') {
        const pressure = detectMarketPressure(sigsA, a, sigsB, b)
        if (pressure) {
          edges.push({
            source: a.id, target: b.id, strength: 0.7,
            kind: 'MARKET_PRESSURE',
            reason: 'Market pressure',
            detail: pressure,
            color: EDGE_COLORS.MARKET_PRESSURE,
          })
          continue
        }

        // 5. Same industry peer (weak connection, only show if they have signals)
        if (sigsA.length > 0 && sigsB.length > 0) {
          edges.push({
            source: a.id, target: b.id, strength: 0.3,
            kind: 'INDUSTRY_PEER',
            reason: `${industryA} sector`,
            detail: `Both ${a.name} and ${b.name} operate in the ${industryA} space. Monitor for competitive moves, shared customers, or market shifts affecting both.`,
            color: EDGE_COLORS.INDUSTRY_PEER,
          })
        }
      }
    }
  }

  return edges
}

export function CompanyNetwork({ companies, signals }: { companies: Company[]; signals: Signal[] }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const nodesRef   = useRef<Node[]>([])
  const edgesRef   = useRef<Edge[]>([])
  const imagesRef  = useRef<Map<string, HTMLImageElement>>(new Map())
  const rafRef     = useRef<number>(0)
  const dragRef    = useRef<{ nodeId: string; ox: number; oy: number } | null>(null)
  const panRef     = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const scaleRef   = useRef(1)
  const offsetRef  = useRef({ x: 0, y: 0 })
  const focusRef   = useRef<string | null>(null)
  const [infoPanel, setInfoPanel] = useState<InfoPanel | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.offsetWidth; const H = canvas.offsetHeight
    canvas.width = W; canvas.height = H
    scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 }; focusRef.current = null

    nodesRef.current = companies.map((c, i) => {
      const angle = (i / companies.length) * Math.PI * 2
      const r = Math.min(W, H) * 0.28
      return { id: c.id, name: c.name, x: W/2 + r*Math.cos(angle), y: H/2 + r*Math.sin(angle), vx: 0, vy: 0, favicon: getFaviconUrl(c.website), radius: 22, isDragging: false }
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

  const canvasXY = useCallback((e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [])

  const nodeAt = useCallback((wx: number, wy: number) =>
    nodesRef.current.find(n => Math.hypot(n.x - wx, n.y - wy) <= n.radius + 6), [])

  const edgeAt = useCallback((wx: number, wy: number) => {
    for (const e of edgesRef.current) {
      const a = nodesRef.current.find(n => n.id === e.source)
      const b = nodesRef.current.find(n => n.id === e.target)
      if (!a || !b) continue
      const dx = b.x-a.x; const dy = b.y-a.y; const len = Math.sqrt(dx*dx+dy*dy)||1
      const t = Math.max(0, Math.min(1, ((wx-a.x)*dx+(wy-a.y)*dy)/(len*len)))
      const px = a.x+t*dx-wx; const py = a.y+t*dy-wy
      if (Math.sqrt(px*px+py*py) < 12/scaleRef.current) return e
    }
    return null
  }, [])

  const simulate = useCallback(() => {
    const nodes = nodesRef.current; const edges = edgesRef.current
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.width; const H = canvas.height
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        const a=nodes[i]; const b=nodes[j]; const dx=b.x-a.x; const dy=b.y-a.y
        const d=Math.sqrt(dx*dx+dy*dy)||1; const f=5500/(d*d); const fx=f*dx/d; const fy=f*dy/d
        if(!a.isDragging){a.vx-=fx;a.vy-=fy} if(!b.isDragging){b.vx+=fx;b.vy+=fy}
      }
    }
    const REST = Math.min(W,H)*0.26
    for (const e of edges) {
      const a=nodes.find(n=>n.id===e.source); const b=nodes.find(n=>n.id===e.target)
      if(!a||!b) continue
      const dx=b.x-a.x; const dy=b.y-a.y; const d=Math.sqrt(dx*dx+dy*dy)||1
      const f=(d-REST)*0.016*e.strength; const fx=f*dx/d; const fy=f*dy/d
      if(!a.isDragging){a.vx+=fx;a.vy+=fy} if(!b.isDragging){b.vx-=fx;b.vy-=fy}
    }
    for (const n of nodes) {
      n.vx+=(W/2-n.x)*0.0005; n.vy+=(H/2-n.y)*0.0005
      if(!n.isDragging){n.vx*=0.82;n.vy*=0.82;n.x+=n.vx;n.y+=n.vy}
      n.x=Math.max(n.radius+4,Math.min(W-n.radius-4,n.x))
      n.y=Math.max(n.radius+4,Math.min(H-n.radius-4,n.y))
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const nodes = nodesRef.current; const edges = edgesRef.current
    const s = scaleRef.current; const o = offsetRef.current; const focused = focusRef.current
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.save(); ctx.translate(o.x,o.y); ctx.scale(s,s)

    const dim = (id: string) => focused !== null && id !== focused &&
      !edges.some(e=>(e.source===focused&&e.target===id)||(e.target===focused&&e.source===id))

    for (const e of edges) {
      const a=nodes.find(n=>n.id===e.source); const b=nodes.find(n=>n.id===e.target)
      if(!a||!b) continue
      const isDimmed=focused&&dim(a.id)&&dim(b.id)
      const isLit=focused&&(e.source===focused||e.target===focused)
      const op=isDimmed?0.03:isLit?0.6+e.strength*0.3:0.08+e.strength*0.18
      ctx.strokeStyle=e.color.replace(/[\d.]+\)$/,`${op})`); ctx.lineWidth=isLit?1.8+e.strength:0.8+e.strength*0.6
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke()
      if(isLit&&s>0.6){
        const mx=(a.x+b.x)/2; const my=(a.y+b.y)/2
        ctx.fillStyle=e.color.replace(/[\d.]+\)$/,'0.9)')
        ctx.beginPath(); ctx.arc(mx,my,2.5/s,0,Math.PI*2); ctx.fill()
        ctx.save(); ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font=`bold ${10/s}px system-ui`
        ctx.textAlign='center'; ctx.textBaseline='bottom'
        ctx.fillText(e.reason,mx,my-5/s); ctx.restore()
      }
    }
    for (const n of nodes) {
      const isDim=dim(n.id); const isFoc=n.id===focused; const r=n.radius
      ctx.save(); ctx.globalAlpha=isDim?0.15:1
      if(isFoc){ctx.shadowColor='rgba(255,255,255,0.35)';ctx.shadowBlur=16/s}
      ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2)
      ctx.fillStyle=isFoc?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.04)'; ctx.fill()
      ctx.strokeStyle=isFoc?'rgba(255,255,255,0.45)':'rgba(255,255,255,0.18)'
      ctx.lineWidth=isFoc?1.5:0.8; ctx.stroke(); ctx.shadowBlur=0
      const img=imagesRef.current.get(n.favicon)
      if(img){ctx.save();ctx.beginPath();ctx.arc(n.x,n.y,r-4,0,Math.PI*2);ctx.clip();ctx.drawImage(img,n.x-(r-4),n.y-(r-4),(r-4)*2,(r-4)*2);ctx.restore()}
      else{ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font=`bold ${r*0.55}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.name[0],n.x,n.y)}
      ctx.fillStyle=isFoc?'rgba(255,255,255,0.88)':'rgba(255,255,255,0.55)'
      ctx.font=`${isFoc?'600 ':''} ${Math.max(8,11/s)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='top'
      ctx.fillText(n.name,n.x,n.y+r+4); ctx.restore()
    }
    ctx.restore()
  }, [])

  useEffect(() => {
    function loop(){simulate();draw();rafRef.current=requestAnimationFrame(loop)}
    rafRef.current=requestAnimationFrame(loop)
    return ()=>cancelAnimationFrame(rafRef.current)
  },[simulate,draw])

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const {x,y}=canvasXY(e); const factor=e.deltaY<0?1.1:0.9
    const ns=Math.max(0.3,Math.min(3,scaleRef.current*factor))
    offsetRef.current={x:x-(x-offsetRef.current.x)*(ns/scaleRef.current),y:y-(y-offsetRef.current.y)*(ns/scaleRef.current)}
    scaleRef.current=ns
  }

  function onMouseDown(e: React.MouseEvent) {
    const {x,y}=canvasXY(e); const w=toWorld(x,y); const node=nodeAt(w.x,w.y)
    if(node){node.isDragging=true;dragRef.current={nodeId:node.id,ox:w.x-node.x,oy:w.y-node.y}}
    else panRef.current={sx:x,sy:y,ox:offsetRef.current.x,oy:offsetRef.current.y}
  }

  function onMouseMove(e: React.MouseEvent) {
    const {x,y}=canvasXY(e); const w=toWorld(x,y)
    if(dragRef.current){const n=nodesRef.current.find(n=>n.id===dragRef.current!.nodeId);if(n){n.x=w.x-dragRef.current.ox;n.y=w.y-dragRef.current.oy};canvasRef.current!.style.cursor='grabbing';return}
    if(panRef.current){offsetRef.current={x:panRef.current.ox+x-panRef.current.sx,y:panRef.current.oy+y-panRef.current.sy};canvasRef.current!.style.cursor='grabbing';return}
    const node=nodeAt(w.x,w.y); const edge=!node?edgeAt(w.x,w.y):null
    canvasRef.current!.style.cursor=node||edge?'pointer':'grab'
  }

  function onMouseUp(e: React.MouseEvent) {
    const wasDrag=!!dragRef.current; const {x,y}=canvasXY(e); const w=toWorld(x,y)
    if(dragRef.current){const n=nodesRef.current.find(n=>n.id===dragRef.current!.nodeId);if(n){n.isDragging=false;n.vx=0;n.vy=0};dragRef.current=null}
    panRef.current=null; canvasRef.current!.style.cursor='grab'
    if(!wasDrag){
      const node=nodeAt(w.x,w.y); const edge=!node?edgeAt(w.x,w.y):null
      if(node){
        const same=focusRef.current===node.id; focusRef.current=same?null:node.id
        const connected=edgesRef.current.filter(e=>e.source===node.id||e.target===node.id)
        setInfoPanel(same?null:{
          type:'node',title:node.name,subtitle:`${connected.length} connection${connected.length!==1?'s':''}`,
          detail:connected.length>0
            ?connected.map(e=>{const other=nodesRef.current.find(n=>n.id===(e.source===node.id?e.target:e.source));return `${EDGE_LABELS[e.kind].toUpperCase()} - ${other?.name}: ${e.detail}`}).join('\n\n')
            :'No connections yet. Add more companies in the same sector or with related signals.',
        })
      } else if(edge){
        const a=nodesRef.current.find(n=>n.id===edge.source); const b=nodesRef.current.find(n=>n.id===edge.target)
        setInfoPanel({type:'edge',title:`${a?.name} + ${b?.name}`,subtitle:EDGE_LABELS[edge.kind],detail:edge.detail})
      } else { focusRef.current=null; setInfoPanel(null) }
    }
  }

  if(companies.length===0) return null

  const edgeCounts = Object.fromEntries(Object.keys(EDGE_LABELS).map(k=>[k,edgesRef.current.filter(e=>e.kind===k).length]))

  return (
    <div className="relative w-full" style={{height:520}}>
      <canvas ref={canvasRef} className="w-full h-full" style={{cursor:'grab',display:'block'}}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />

      {/* Controls */}
      <div className="absolute bottom-4 left-4">
        <span className="text-[10px] px-2 py-1 rounded-md" style={{background:'rgba(0,0,0,0.7)',color:'rgba(255,255,255,0.3)',border:'1px solid rgba(255,255,255,0.07)'}}>
          Scroll to zoom · Drag to pan · Click node or edge for details
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 space-y-1">
        {(Object.entries(EDGE_LABELS) as [EdgeKind,string][]).filter(([k])=>edgeCounts[k]>0).map(([kind,label])=>(
          <div key={kind} className="flex items-center gap-1.5 px-2 py-0.5 rounded" style={{background:'rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.07)'}}>
            <div className="w-6 h-0.5 rounded" style={{background:EDGE_COLORS[kind]}} />
            <span className="text-[9px]" style={{color:'rgba(255,255,255,0.4)'}}>{label}</span>
          </div>
        ))}
      </div>

      {/* Info panel */}
      {infoPanel && (
        <div className="absolute top-4 right-4 w-64 rounded-xl p-4 animate-slide-up"
          style={{background:'rgba(6,6,10,0.95)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(12px)',maxHeight:'60%',overflow:'auto'}}>
          <button onClick={()=>{setInfoPanel(null);focusRef.current=null}} className="absolute top-3 right-3 text-xs" style={{color:'rgba(255,255,255,0.3)'}}>✕</button>
          <p className="text-sm font-bold mb-0.5 pr-4" style={{color:'rgba(255,255,255,0.92)'}}>{infoPanel.title}</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{color:'rgba(255,255,255,0.35)'}}>{infoPanel.subtitle}</p>
          <div className="h-px mb-3" style={{background:'rgba(255,255,255,0.07)'}} />
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans" style={{color:'rgba(255,255,255,0.6)'}}>{infoPanel.detail}</pre>
        </div>
      )}
    </div>
  )
}
