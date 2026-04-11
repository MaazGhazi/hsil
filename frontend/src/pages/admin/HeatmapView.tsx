import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group } from 'react-konva'
import { getImage, getImageFileUrl } from '../../api/images'
import api from '../../api/client'

interface HeatmapPoint {
  x: number
  y: number
  reliability: number
  is_expert: boolean
  user_name: string
}

interface LandmarkHeatmap {
  landmark_id: string
  display_name: string
  num_annotations: number
  points: HeatmapPoint[]
  consensus: {
    x: number
    y: number
    sigma: number
    heatmap_radius: number
    agreement_score: number
    method: string
    is_training_ready: boolean
  } | null
}

interface HeatmapData {
  image_id: string
  image_width: number
  image_height: number
  total_annotators: number
  landmarks: LandmarkHeatmap[]
}

const COLORS = [
  '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

export function HeatmapView() {
  const { imageId } = useParams<{ imageId: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [selectedLandmark, setSelectedLandmark] = useState<string | null>(null)
  const [showPoints, setShowPoints] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(true)

  const { data: imageData } = useQuery({
    queryKey: ['image', imageId],
    queryFn: () => getImage(imageId!),
    enabled: !!imageId,
  })

  const { data: heatmap } = useQuery<HeatmapData>({
    queryKey: ['heatmap', imageId],
    queryFn: async () => {
      const { data } = await api.get(`/images/${imageId}/heatmap`)
      return data
    },
    enabled: !!imageId,
  })

  // Load image
  useEffect(() => {
    if (!imageId) return
    const token = localStorage.getItem('access_token')
    fetch(getImageFileUrl(imageId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const img = new window.Image()
        img.src = url
        img.onload = () => setImage(img)
      })
  }, [imageId])

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

  if (!imageData || !heatmap) {
    return <div className="flex items-center justify-center h-screen bg-[#0d0d1a] text-gray-400">Loading...</div>
  }

  const scale = Math.min(containerSize.width / heatmap.image_width, containerSize.height / heatmap.image_height)
  const offsetX = (containerSize.width - heatmap.image_width * scale) / 2
  const offsetY = (containerSize.height - heatmap.image_height * scale) / 2

  const visibleLandmarks = selectedLandmark
    ? heatmap.landmarks.filter(l => l.landmark_id === selectedLandmark)
    : heatmap.landmarks

  return (
    <div className="flex h-[calc(100vh-56px)] bg-[#0d0d1a] -m-6">
      {/* Canvas */}
      <div ref={containerRef} className="flex-1">
        <Stage width={containerSize.width} height={containerSize.height}>
          <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
            {image && <KonvaImage image={image} width={heatmap.image_width} height={heatmap.image_height} />}

            {visibleLandmarks.map((lm) => {
              const color = COLORS[heatmap.landmarks.indexOf(lm) % COLORS.length]

              return (
                <Group key={lm.landmark_id}>
                  {/* Heatmap: Gaussian probability ring */}
                  {showHeatmap && lm.consensus && (
                    <>
                      {/* Outer probability ring (2-sigma) */}
                      <Circle
                        x={lm.consensus.x}
                        y={lm.consensus.y}
                        radius={lm.consensus.heatmap_radius}
                        fill={color}
                        opacity={0.1}
                      />
                      {/* Inner probability ring (1-sigma) */}
                      <Circle
                        x={lm.consensus.x}
                        y={lm.consensus.y}
                        radius={Math.max(5, lm.consensus.sigma)}
                        fill={color}
                        opacity={0.2}
                      />
                      {/* Consensus center */}
                      <Circle
                        x={lm.consensus.x}
                        y={lm.consensus.y}
                        radius={6}
                        fill={color}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                      {/* Crosshair */}
                      {[[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy], j) => (
                        <Circle
                          key={j}
                          x={lm.consensus!.x + dx! * (lm.consensus!.heatmap_radius + 4)}
                          y={lm.consensus!.y + dy! * (lm.consensus!.heatmap_radius + 4)}
                          radius={2}
                          fill="#fff"
                          opacity={0.4}
                        />
                      ))}
                    </>
                  )}

                  {/* Individual annotation points */}
                  {showPoints && lm.points.map((pt, j) => (
                    <Group key={j}>
                      <Circle
                        x={pt.x}
                        y={pt.y}
                        radius={4 + pt.reliability * 4}
                        fill={pt.is_expert ? '#22c55e' : color}
                        opacity={0.15 + pt.reliability * 0.35}
                        stroke={pt.is_expert ? '#22c55e' : color}
                        strokeWidth={1}
                      />
                      <Circle
                        x={pt.x}
                        y={pt.y}
                        radius={2}
                        fill="#fff"
                        opacity={0.6 + pt.reliability * 0.4}
                      />
                    </Group>
                  ))}

                  {/* Label */}
                  {lm.consensus && (
                    <Text
                      x={lm.consensus.x + (lm.consensus.heatmap_radius || 15) + 8}
                      y={lm.consensus.y - 6}
                      text={`${lm.display_name} (${Math.round(lm.consensus.agreement_score * 100)}%)`}
                      fontSize={12}
                      fill="#fff"
                      shadowColor="#000"
                      shadowBlur={4}
                      shadowOpacity={0.9}
                      fontStyle="bold"
                    />
                  )}
                </Group>
              )
            })}
          </Layer>
        </Stage>
      </div>

      {/* Right panel */}
      <div className="w-72 bg-[#141424] border-l border-[#2a2a4a] flex flex-col">
        <div className="px-4 py-3 border-b border-[#2a2a4a]">
          <h3 className="text-sm font-semibold text-gray-200">Probability Heatmap</h3>
          <p className="text-[10px] text-gray-500 mt-1">{heatmap.total_annotators} annotators</p>
        </div>

        {/* Controls */}
        <div className="px-4 py-2 border-b border-[#2a2a4a] space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)}
              className="rounded border-gray-600 accent-cyan-500" />
            Show consensus heatmap
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)}
              className="rounded border-gray-600 accent-cyan-500" />
            Show individual annotations
          </label>
        </div>

        {/* Landmark list */}
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setSelectedLandmark(null)}
            className={`w-full text-left px-4 py-2 text-xs border-l-2 ${
              !selectedLandmark ? 'border-cyan-400 bg-[#1e1e36] text-gray-200' : 'border-transparent text-gray-500 hover:bg-[#1a1a30]'
            }`}
          >
            All landmarks
          </button>
          {heatmap.landmarks.map((lm, i) => {
            const color = COLORS[i % COLORS.length]
            const isSelected = selectedLandmark === lm.landmark_id
            const ready = lm.consensus?.is_training_ready

            return (
              <button
                key={lm.landmark_id}
                onClick={() => setSelectedLandmark(isSelected ? null : lm.landmark_id)}
                className={`w-full text-left px-4 py-2 border-l-2 ${
                  isSelected ? 'border-cyan-400 bg-[#1e1e36]' : 'border-transparent hover:bg-[#1a1a30]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-300 flex-1">{lm.display_name}</span>
                  {ready !== undefined && (
                    <span className={`text-[10px] ${ready ? 'text-green-400' : 'text-yellow-500'}`}>
                      {ready ? 'Ready' : 'Needs data'}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 ml-4 mt-0.5 text-[10px] text-gray-600">
                  <span>{lm.num_annotations} labels</span>
                  {lm.consensus && (
                    <>
                      <span>sigma: {lm.consensus.sigma.toFixed(1)}px</span>
                      <span>agree: {Math.round(lm.consensus.agreement_score * 100)}%</span>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-[#2a2a4a]">
          <div className="text-[10px] text-gray-600 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-400 opacity-20 border border-cyan-400" />
              <span>Probability region (2-sigma)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>Individual annotation (size = reliability)</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="w-full mt-3 py-1.5 text-xs border border-[#2a2a4a] rounded text-gray-400 hover:text-white hover:border-gray-500"
          >
            Back to Admin
          </button>
        </div>
      </div>
    </div>
  )
}
