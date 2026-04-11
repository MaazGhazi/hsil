import { useRef, useState, useEffect, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group } from 'react-konva'
import type { LandmarkPrediction } from '../../api/inference'

interface Props {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  predictions: LandmarkPrediction[]
  onBack: () => void
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return '#22c55e'  // green
  if (confidence >= 0.7) return '#eab308'  // yellow
  return '#ef4444'  // red
}

export function OverlayView({ imageUrl, imageWidth, imageHeight, predictions, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [hiddenLandmarks, setHiddenLandmarks] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    img.onload = () => setImage(img)
  }, [imageUrl])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const baseScale = Math.min(containerSize.width / imageWidth, containerSize.height / imageHeight)
  const scale = baseScale * zoom
  const offsetX = (containerSize.width - imageWidth * scale) / 2
  const offsetY = (containerSize.height - imageHeight * scale) / 2

  const toggleLandmark = (name: string) => {
    setHiddenLandmarks(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleExport = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const dataURL = stage.toDataURL({ pixelRatio: 2 })
    const link = document.createElement('a')
    link.download = 'landmark-overlay.png'
    link.href = dataURL
    link.click()
  }, [])

  const visiblePredictions = predictions.filter(p => !hiddenLandmarks.has(p.landmark_name))

  return (
    <div className="flex h-full">
      {/* Canvas */}
      <div ref={containerRef} className="flex-1 bg-gray-900">
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          draggable
        >
          <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
            {image && <KonvaImage image={image} width={imageWidth} height={imageHeight} />}

            {visiblePredictions.map((pred) => {
              const color = getConfidenceColor(pred.confidence)
              const r = 7 / scale

              return (
                <Group key={pred.landmark_name}>
                  {/* Glow */}
                  <Circle x={pred.x} y={pred.y} radius={r * 2} fill={color} opacity={0.15} />
                  {/* Point */}
                  <Circle x={pred.x} y={pred.y} radius={r} fill={color} stroke="#fff" strokeWidth={1.5 / scale} />
                  {/* Label */}
                  <Text
                    x={pred.x + r * 2}
                    y={pred.y - r}
                    text={`${pred.display_name} (${Math.round(pred.confidence * 100)}%)`}
                    fontSize={11 / scale}
                    fill="#fff"
                    shadowColor="#000"
                    shadowBlur={3 / scale}
                    shadowOpacity={0.9}
                  />
                </Group>
              )
            })}
          </Layer>
        </Stage>
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Detected Landmarks</h3>
          <p className="text-xs text-gray-500 mt-1">{predictions.length} landmarks detected</p>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 border-b border-gray-100 flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> &gt;90%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" /> 70-90%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> &lt;70%
          </span>
        </div>

        {/* Landmark list */}
        <div className="flex-1 overflow-y-auto">
          {predictions
            .sort((a, b) => b.confidence - a.confidence)
            .map((pred) => {
              const color = getConfidenceColor(pred.confidence)
              const hidden = hiddenLandmarks.has(pred.landmark_name)

              return (
                <button
                  key={pred.landmark_name}
                  onClick={() => toggleLandmark(pred.landmark_name)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${
                    hidden ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-900">{pred.display_name}</span>
                    </div>
                    <span className="text-sm font-mono font-semibold" style={{ color }}>
                      {Math.round(pred.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 ml-4 mt-0.5">
                    ({Math.round(pred.x)}, {Math.round(pred.y)})
                  </div>
                </button>
              )
            })}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="flex-1 py-1.5 border border-gray-300 text-sm rounded-md hover:bg-gray-50"
            >
              Zoom -
            </button>
            <button
              onClick={() => setZoom(z => Math.min(4, z + 0.25))}
              className="flex-1 py-1.5 border border-gray-300 text-sm rounded-md hover:bg-gray-50"
            >
              Zoom +
            </button>
          </div>
          <button
            onClick={handleExport}
            className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
          >
            Download Annotated Image
          </button>
          <button
            onClick={onBack}
            className="w-full py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50"
          >
            Upload New Image
          </button>
        </div>
      </div>
    </div>
  )
}
