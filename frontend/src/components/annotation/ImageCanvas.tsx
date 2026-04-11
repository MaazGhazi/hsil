import { useRef, useState, useEffect, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group, Line } from 'react-konva'
import type { LandmarkDefinition } from '../../api/images'

interface PlacedLandmark {
  landmarkDefId: string
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  zoom: number
  brightness: number
  contrast: number
  placedLandmarks: PlacedLandmark[]
  landmarks: LandmarkDefinition[]
  selectedLandmarkId: string | null
  onBoxDraw: (x: number, y: number, w: number, h: number) => void
  onLandmarkDrag: (landmarkDefId: string, x: number, y: number) => void
  onLandmarkResize: (landmarkDefId: string, w: number, h: number) => void
}

const COLORS = [
  '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

const MIN_BOX = 10

export function ImageCanvas({
  imageUrl, imageWidth, imageHeight,
  zoom, brightness, contrast,
  placedLandmarks, landmarks, selectedLandmarkId,
  onBoxDraw, onLandmarkDrag, onLandmarkResize,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  // Bounding box drawing state
  const [drawing, setDrawing] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // --- Image loading (authenticated) ---
  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('access_token')
    fetch(imageUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.blob() })
      .then(blob => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        const img = new window.Image()
        img.src = url
        img.onload = () => {
          if (cancelled) return
          if (brightness !== 100 || contrast !== 100) {
            const c = document.createElement('canvas')
            c.width = img.width; c.height = img.height
            const ctx = c.getContext('2d')!
            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`
            ctx.drawImage(img, 0, 0)
            const f = new window.Image()
            f.src = c.toDataURL()
            f.onload = () => { if (!cancelled) setImage(f); URL.revokeObjectURL(url) }
          } else { setImage(img) }
        }
      })
      .catch(e => console.error('Image load error:', e))
    return () => { cancelled = true }
  }, [imageUrl, brightness, contrast])

  // --- Container resize ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const baseScale = Math.min(containerSize.width / imageWidth, containerSize.height / imageHeight)
  const scale = baseScale * zoom
  const offsetX = (containerSize.width - imageWidth * scale) / 2
  const offsetY = (containerSize.height - imageHeight * scale) / 2

  const stageToImage = useCallback((sx: number, sy: number) => {
    return {
      x: Math.round(((sx - position.x - offsetX) / scale) * 10) / 10,
      y: Math.round(((sy - position.y - offsetY) / scale) * 10) / 10,
    }
  }, [position, offsetX, offsetY, scale])

  // --- Mouse handlers for bounding box drawing ---
  const handleMouseDown = useCallback((e: any) => {
    if (!selectedLandmarkId) return
    const target = e.target
    if (target !== e.currentTarget && target.name?.() !== 'background') return
    const pointer = target.getStage().getPointerPosition()
    if (!pointer) return
    const pt = stageToImage(pointer.x, pointer.y)
    if (pt.x < 0 || pt.x > imageWidth || pt.y < 0 || pt.y > imageHeight) return
    setDrawing({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y })
  }, [selectedLandmarkId, stageToImage, imageWidth, imageHeight])

  const handleMouseMove = useCallback((e: any) => {
    const pointer = e.target.getStage().getPointerPosition()
    if (!pointer) return
    const pt = stageToImage(pointer.x, pointer.y)
    setMousePos(pt)
    if (drawing) {
      setDrawing(prev => prev ? { ...prev, x2: pt.x, y2: pt.y } : null)
    }
  }, [stageToImage, drawing])

  const handleMouseUp = useCallback(() => {
    if (drawing && selectedLandmarkId) {
      const x = Math.min(drawing.x1, drawing.x2)
      const y = Math.min(drawing.y1, drawing.y2)
      const w = Math.abs(drawing.x2 - drawing.x1)
      const h = Math.abs(drawing.y2 - drawing.y1)
      if (w >= MIN_BOX && h >= MIN_BOX) {
        onBoxDraw(x, y, w, h)
      }
    }
    setDrawing(null)
  }, [drawing, selectedLandmarkId, onBoxDraw])

  const landmarkIndexMap = new Map(landmarks.map((l, i) => [l.id, i]))

  // Live draw box coordinates (normalized so x,y is always top-left)
  const drawBox = drawing ? {
    x: Math.min(drawing.x1, drawing.x2),
    y: Math.min(drawing.y1, drawing.y2),
    w: Math.abs(drawing.x2 - drawing.x1),
    h: Math.abs(drawing.y2 - drawing.y1),
  } : null

  const selectedColor = selectedLandmarkId
    ? COLORS[(landmarkIndexMap.get(selectedLandmarkId) ?? 0) % COLORS.length]
    : '#22d3ee'

  return (
    <div ref={containerRef} className="w-full h-full" style={{ cursor: selectedLandmarkId ? 'crosshair' : 'default' }}>
      <Stage
        width={containerSize.width}
        height={containerSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setMousePos(null); setDrawing(null) }}
        draggable={!selectedLandmarkId && !drawing}
        onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
      >
        <Layer x={position.x + offsetX} y={position.y + offsetY} scaleX={scale} scaleY={scale}>
          {/* Image */}
          {image && <KonvaImage image={image} width={imageWidth} height={imageHeight} name="background" />}

          {/* Placed bounding boxes */}
          {placedLandmarks.map((pl) => {
            const idx = landmarkIndexMap.get(pl.landmarkDefId) ?? 0
            const color = COLORS[idx % COLORS.length]
            const landmark = landmarks.find(l => l.id === pl.landmarkDefId)
            const isSelected = pl.landmarkDefId === selectedLandmarkId

            return (
              <Group key={pl.landmarkDefId}>
                {/* Box fill */}
                <Rect
                  x={pl.x} y={pl.y} width={pl.w} height={pl.h}
                  fill={color}
                  opacity={isSelected ? 0.25 : 0.15}
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  cornerRadius={2}
                  draggable
                  onDragEnd={(e) => onLandmarkDrag(pl.landmarkDefId, e.target.x(), e.target.y())}
                  onMouseEnter={(e) => {
                    const s = e.target.getStage()
                    if (s) s.container().style.cursor = 'move'
                  }}
                  onMouseLeave={(e) => {
                    const s = e.target.getStage()
                    if (s) s.container().style.cursor = selectedLandmarkId ? 'crosshair' : 'default'
                  }}
                />

                {/* Resize handle — bottom-right corner */}
                {isSelected && (
                  <Rect
                    x={pl.x + pl.w - 4} y={pl.y + pl.h - 4}
                    width={8} height={8}
                    fill="#fff" stroke={color} strokeWidth={1.5}
                    cornerRadius={1}
                    draggable
                    onDragMove={(e) => {
                      const newW = Math.max(MIN_BOX, e.target.x() - pl.x + 4)
                      const newH = Math.max(MIN_BOX, e.target.y() - pl.y + 4)
                      onLandmarkResize(pl.landmarkDefId, newW, newH)
                    }}
                    onDragEnd={(e) => {
                      e.target.x(pl.x + pl.w - 4)
                      e.target.y(pl.y + pl.h - 4)
                    }}
                    onMouseEnter={(e) => {
                      const s = e.target.getStage()
                      if (s) s.container().style.cursor = 'nwse-resize'
                    }}
                    onMouseLeave={(e) => {
                      const s = e.target.getStage()
                      if (s) s.container().style.cursor = selectedLandmarkId ? 'crosshair' : 'default'
                    }}
                  />
                )}

                {/* Label tag — top-left of box */}
                <Rect
                  x={pl.x} y={pl.y - 20}
                  width={(landmark?.display_name?.length ?? 4) * 6.5 + 12}
                  height={18}
                  fill={color} opacity={0.9}
                  cornerRadius={[3, 3, 0, 0]}
                  listening={false}
                />
                <Text
                  x={pl.x + 6} y={pl.y - 17}
                  text={landmark?.display_name ?? ''}
                  fontSize={11} fill="#fff"
                  fontFamily="system-ui, sans-serif" fontStyle="600"
                  listening={false}
                />
              </Group>
            )
          })}

          {/* Live drawing preview — dashed rectangle as user drags */}
          {drawBox && drawBox.w > 2 && drawBox.h > 2 && (
            <Group listening={false}>
              <Rect
                x={drawBox.x} y={drawBox.y}
                width={drawBox.w} height={drawBox.h}
                fill={selectedColor} opacity={0.2}
                stroke={selectedColor} strokeWidth={2}
                dash={[8, 4]}
                cornerRadius={2}
              />
              {/* Size label */}
              <Text
                x={drawBox.x} y={drawBox.y + drawBox.h + 4}
                text={`${Math.round(drawBox.w)} x ${Math.round(drawBox.h)}`}
                fontSize={10} fill="#fff"
                fontFamily="ui-monospace, monospace"
                opacity={0.7}
              />
            </Group>
          )}

          {/* Crosshair cursor */}
          {!drawing && selectedLandmarkId && mousePos &&
            mousePos.x >= 0 && mousePos.x <= imageWidth && mousePos.y >= 0 && mousePos.y <= imageHeight && (
            <Group listening={false} opacity={0.3}>
              {/* Full-width horizontal line */}
              <Line points={[0, mousePos.y, imageWidth, mousePos.y]}
                stroke={selectedColor} strokeWidth={0.8 / scale} dash={[6 / scale, 4 / scale]} />
              {/* Full-height vertical line */}
              <Line points={[mousePos.x, 0, mousePos.x, imageHeight]}
                stroke={selectedColor} strokeWidth={0.8 / scale} dash={[6 / scale, 4 / scale]} />
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  )
}
