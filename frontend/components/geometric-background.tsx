'use client'

import { useEffect, useRef } from 'react'

type Vec3 = [number, number, number]
const rx = (p: Vec3, a: number): Vec3 => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1]*c-p[2]*s, p[1]*s+p[2]*c] }
const ry = (p: Vec3, a: number): Vec3 => { const c = Math.cos(a), s = Math.sin(a); return [p[0]*c+p[2]*s, p[1], -p[0]*s+p[2]*c] }
const rz = (p: Vec3, a: number): Vec3 => { const c = Math.cos(a), s = Math.sin(a); return [p[0]*c-p[1]*s, p[0]*s+p[1]*c, p[2]] }
const project = (p: Vec3, cx: number, cy: number): [number, number] => {
  const fov = 540, z = p[2] + 400; const s = fov / z; return [p[0]*s+cx, p[1]*s+cy]
}

const PHI = (1 + Math.sqrt(5)) / 2
const norm = (v: Vec3): Vec3 => { const l = Math.sqrt(v[0]**2+v[1]**2+v[2]**2); return [v[0]/l,v[1]/l,v[2]/l] }

const GEOS: Record<string, { verts: Vec3[]; edges: [number,number][] }> = {
  cube: {
    verts: [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
    edges: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],
  },
  octahedron: {
    verts: [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]],
    edges: [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]],
  },
  tetrahedron: {
    verts: [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]],
    edges: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
  },
  diamond: {
    verts: [[0,2,0],[0,-2,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]],
    edges: [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]],
  },
  icosahedron: {
    verts: ([[-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],[0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],[PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1]] as Vec3[]).map(norm),
    edges: [[0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],[2,3],[2,4],[2,6],[2,10],[2,11],[3,4],[3,6],[3,8],[3,9],[4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],[7,8],[7,10],[8,9],[10,11]],
  },
  prism: {
    verts: ((): Vec3[] => { const p: Vec3[] = []; for (const y of [-1.2,1.2]) for (let i=0;i<6;i++){const a=i/6*Math.PI*2;p.push([Math.cos(a),y,Math.sin(a)])} return p })(),
    edges: ((): [number,number][] => { const e: [number,number][] = []; for(let i=0;i<6;i++) e.push([i,(i+1)%6],[i+6,(i+1)%6+6],[i,i+6]); return e })(),
  },
  star: {
    verts: [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1],[-1,-1,-1],[1,1,-1],[1,-1,1],[-1,1,1]],
    edges: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3],[4,5],[4,6],[4,7],[5,6],[5,7],[6,7],[0,5],[1,4],[2,7],[3,6]],
  },
}

const TYPES = Object.keys(GEOS)
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const randSign = () => Math.random() > 0.5 ? 1 : -1

interface Shape {
  x: number; y: number; vx: number; vy: number
  rotX: number; rotY: number; rotZ: number
  dRX: number; dRY: number; dRZ: number
  type: string; size: number; opacity: number
}

export function GeometricBackground({ count = 14 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return

    let raf: number, W = 0, H = 0
    const shapes: Shape[] = []

    function init() {
      W = canvas!.width  = canvas!.offsetWidth
      H = canvas!.height = canvas!.offsetHeight
      shapes.length = 0
      for (let i = 0; i < count; i++) {
        shapes.push({
          x: rand(60, W - 60), y: rand(60, H - 60),
          vx: rand(0.05, 0.15) * randSign(), vy: rand(0.04, 0.12) * randSign(),
          rotX: rand(0, Math.PI * 2), rotY: rand(0, Math.PI * 2), rotZ: rand(0, Math.PI * 2),
          dRX: rand(0.002, 0.007) * randSign(),
          dRY: rand(0.003, 0.009) * randSign(),
          dRZ: rand(0.001, 0.005) * randSign(),
          type: TYPES[Math.floor(Math.random() * TYPES.length)],
          size: rand(20, 52),
          opacity: rand(0.06, 0.18),
        })
      }
    }

    function drawShape(s: Shape) {
      const geo = GEOS[s.type]; if (!geo) return
      const pts = geo.verts.map(v => {
        let p: Vec3 = [v[0]*s.size, v[1]*s.size, v[2]*s.size]
        p = rx(p, s.rotX); p = ry(p, s.rotY); p = rz(p, s.rotZ)
        return project(p, s.x, s.y)
      })

      ctx!.strokeStyle = `rgba(255,255,255,${s.opacity})`
      ctx!.lineWidth = 0.7
      for (const [a, b] of geo.edges) {
        ctx!.beginPath(); ctx!.moveTo(pts[a][0], pts[a][1]); ctx!.lineTo(pts[b][0], pts[b][1]); ctx!.stroke()
      }
      ctx!.fillStyle = `rgba(255,255,255,${s.opacity * 0.8})`
      for (const [px, py] of pts) { ctx!.beginPath(); ctx!.arc(px, py, 1.0, 0, Math.PI*2); ctx!.fill() }
    }

    function drawConnections() {
      const DIST = 175
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const a = shapes[i], b = shapes[j]
          const d = Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2)
          if (d < DIST) {
            const t = 1 - d / DIST
            ctx!.strokeStyle = `rgba(255,255,255,${t * 0.06})`
            ctx!.lineWidth = t * 0.7
            ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y); ctx!.stroke()
            /* midpoint node */
            ctx!.fillStyle = `rgba(255,255,255,${t * 0.12})`
            ctx!.beginPath(); ctx!.arc((a.x+b.x)/2, (a.y+b.y)/2, t * 1.5, 0, Math.PI*2); ctx!.fill()
          }
        }
      }
    }

    function loop() {
      ctx!.clearRect(0, 0, W, H)
      drawConnections()
      for (const s of shapes) {
        const pad = s.size + 10
        s.x += s.vx; s.y += s.vy
        s.rotX += s.dRX; s.rotY += s.dRY; s.rotZ += s.dRZ
        if (s.x < pad || s.x > W - pad) { s.vx *= -1; s.x = Math.max(pad, Math.min(W-pad, s.x)) }
        if (s.y < pad || s.y > H - pad) { s.vy *= -1; s.y = Math.max(pad, Math.min(H-pad, s.y)) }
        drawShape(s)
      }
      raf = requestAnimationFrame(loop)
    }

    const ro = new ResizeObserver(() => init())
    ro.observe(canvas)
    init(); loop()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [count])

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none block" />
}
