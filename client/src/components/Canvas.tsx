import { useRef, useEffect, useState, useCallback } from 'react'
import { socket } from '../socket'
import { v4 as uuidv4 } from 'uuid'
import type { Stroke as SharedStroke, Point } from '../../../shared/types'

interface CanvasProps {
  color?: string
  brushSize?: number
}

interface RemoteActiveStroke {
  points: Point[]
  color: string
  lineWidth: number
}

export default function Canvas({ color = '#000000', brushSize = 5 }: CanvasProps) {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const draftCanvasRef = useRef<HTMLCanvasElement>(null)
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStrokeId, setCurrentStrokeId] = useState<string | null>(null)
  const [strokes, setStrokes] = useState<SharedStroke[]>([])
  const [remoteActiveStrokes, setRemoteActiveStrokes] = useState<Record<string, RemoteActiveStroke>>({})
  
  // NEW: State for your own active drawing points for instant feedback
  const [localActivePoints, setLocalActivePoints] = useState<Point[]>([])
  
  const userIdRef = useRef<string>(`user-${Math.random().toString(36).substr(2, 9)}`)

  // --- UTILS ---
  const getNormalizedCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = mainCanvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    }
  }

  const resizeCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.parentElement?.getBoundingClientRect()
    if (!rect) return

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // --- DRAWING CORE ---
  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: SharedStroke | RemoteActiveStroke, width: number, height: number) => {
    if (stroke.points.length < 2) return

    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()

    ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * width, stroke.points[i].y * height)
    }
    ctx.stroke()
  }

  const redraw = useCallback(() => {
    const mainCanvas = mainCanvasRef.current
    const draftCanvas = draftCanvasRef.current
    if (!mainCanvas || !draftCanvas) return

    const mainCtx = mainCanvas.getContext('2d')
    const draftCtx = draftCanvas.getContext('2d')
    if (!mainCtx || !draftCtx) return

    const dpr = window.devicePixelRatio || 1
    const w = mainCanvas.width / dpr
    const h = mainCanvas.height / dpr

    // 1. Clear both layers
    mainCtx.clearRect(0, 0, w, h)
    draftCtx.clearRect(0, 0, w, h)

    // 2. Draw permanent history on Main Canvas
    strokes.forEach(s => drawStroke(mainCtx, s, w, h))

    // 3. Draw OTHERS' active strokes on Draft Canvas
    Object.values(remoteActiveStrokes).forEach(s => drawStroke(draftCtx, s, w, h))

    // 4. Draw YOUR current active stroke on Draft Canvas for instant feedback
    if (isDrawing && localActivePoints.length > 1) {
      drawStroke(draftCtx, {
        points: localActivePoints,
        color,
        lineWidth: brushSize
      }, w, h)
    }
  }, [strokes, remoteActiveStrokes, localActivePoints, isDrawing, color, brushSize])

  // --- LIFECYCLE ---
  useEffect(() => {
    const handleResize = () => {
      if (mainCanvasRef.current && draftCanvasRef.current) {
        resizeCanvas(mainCanvasRef.current)
        resizeCanvas(draftCanvasRef.current)
        redraw()
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [redraw])

  useEffect(() => {
    redraw()
  }, [redraw])

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    socket.on('stroke-start', ({ strokeId, userId, color, lineWidth, point }) => {
      if (userId === userIdRef.current) return
      setRemoteActiveStrokes(prev => ({
        ...prev,
        [strokeId]: { points: [point], color, lineWidth }
      }))
    })

    socket.on('stroke-update', ({ strokeId, point }) => {
      setRemoteActiveStrokes(prev => {
        if (!prev[strokeId]) return prev
        return {
          ...prev,
          [strokeId]: { ...prev[strokeId], points: [...prev[strokeId].points, point] }
        }
      })
    })

    socket.on('stroke-end', (strokeId) => {
      setRemoteActiveStrokes(prev => {
        const finished = prev[strokeId]
        if (finished) {
          const newStroke: SharedStroke = { 
            id: strokeId, 
            userId: 'remote', 
            points: finished.points,
            color: finished.color,
            lineWidth: finished.lineWidth
          }
          setStrokes(s => [...s, newStroke])
        }
        const newState = { ...prev }
        delete newState[strokeId]
        return newState
      })
    })

    socket.on('stroke-removed', (strokeId) => {
      setStrokes(prev => prev.filter(s => s.id !== strokeId))
    })

    return () => {
      socket.off('stroke-start')
      socket.off('stroke-update')
      socket.off('stroke-end')
      socket.off('stroke-removed')
    }
  }, [])

  // --- HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getNormalizedCoordinates(e)
    const id = uuidv4()
    
    setIsDrawing(true)
    setCurrentStrokeId(id)
    setLocalActivePoints([point]) // Start tracking local points

    socket.emit('stroke-start', { 
      strokeId: id, 
      userId: userIdRef.current, 
      color, 
      lineWidth: brushSize, 
      point 
    })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getNormalizedCoordinates(e)
    socket.emit('mouse-move', { userId: userIdRef.current, point, color })

    if (!isDrawing || !currentStrokeId) return

    // Add point to local state so redraw() can see it immediately
    setLocalActivePoints(prev => [...prev, point])
    socket.emit('stroke-update', { strokeId: currentStrokeId, point })
  }

  const handleMouseUp = () => {
    if (!isDrawing || !currentStrokeId) return

    // Commit the local active points to our permanent strokes array
    const newFinishedStroke: SharedStroke = {
      id: currentStrokeId,
      userId: userIdRef.current,
      points: localActivePoints,
      color,
      lineWidth: brushSize
    }

    setStrokes(prev => [...prev, newFinishedStroke])
    socket.emit('stroke-end', currentStrokeId)

    // Cleanup
    setIsDrawing(false)
    setCurrentStrokeId(null)
    setLocalActivePoints([]) 
  }

  const handleUndo = () => {
    const myLastStroke = [...strokes].reverse().find(s => s.userId === userIdRef.current)
    if (myLastStroke) {
      socket.emit('undo-stroke', myLastStroke.id)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas ref={mainCanvasRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
      <canvas 
        ref={draftCanvasRef} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, cursor: 'crosshair' }} 
      />
      
      <button 
        onClick={handleUndo} 
        style={{ 
          position: 'absolute', 
          bottom: 20, 
          right: 20, 
          zIndex: 10,
          padding: '8px 16px',
          cursor: 'pointer'
        }}
      >
        Undo My Last Stroke
      </button>
    </div>
  )
}