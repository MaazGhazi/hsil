import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getImage, getImageFileUrl, listLandmarks } from '../../api/images'
import { getAnnotations } from '../../api/annotations'
import { Stage, Layer, Image as KonvaImage, Circle, Group, Line } from 'react-konva'
import { useRef, useState, useEffect } from 'react'

const STUDENT_COLOR = '#22d3ee'
const EXPERT_COLOR = '#22c55e'

export function AccuracyFeedback() {
  const { imageId } = useParams<{ imageId: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  const { data: imageData } = useQuery({
    queryKey: ['image', imageId],
    queryFn: () => getImage(imageId!),
    enabled: !!imageId,
  })

  const { data: annotations } = useQuery({
    queryKey: ['annotations', imageId],
    queryFn: () => getAnnotations(imageId!),
    enabled: !!imageId,
  })

  const { data: landmarks } = useQuery({
    queryKey: ['landmarks', imageData?.body_region],
    queryFn: () => listLandmarks(imageData?.body_region ?? undefined),
    enabled: !!imageData?.body_region,
  })

  useEffect(() => {
    if (!imageId) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = getImageFileUrl(imageId)
    img.onload = () => setImage(img)
  }, [imageId])

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

  if (!imageData || !annotations || !landmarks) {
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-500">Loading...</div>
  }

  const studentAnns = annotations.filter(a => !a.is_expert && a.annotation_type === 'keypoint')
  const expertAnns = annotations.filter(a => a.is_expert && a.annotation_type === 'keypoint')

  const landmarkMap = new Map(landmarks.map(l => [l.id, l]))

  const scale = Math.min(containerSize.width / imageData.width, containerSize.height / imageData.height)
  const offsetX = (containerSize.width - imageData.width * scale) / 2
  const offsetY = (containerSize.height - imageData.height * scale) / 2

  // Calculate distances
  const distances = studentAnns.map(sa => {
    const expert = expertAnns.find(ea => ea.landmark_def_id === sa.landmark_def_id)
    if (!expert) return null
    const dx = (sa.data as any).x - (expert.data as any).x
    const dy = (sa.data as any).y - (expert.data as any).y
    return {
      landmark: landmarkMap.get(sa.landmark_def_id!)?.display_name ?? 'Unknown',
      distance: Math.sqrt(dx * dx + dy * dy),
      correct: Math.sqrt(dx * dx + dy * dy) <= 15,
    }
  }).filter(Boolean) as { landmark: string; distance: number; correct: boolean }[]

  const accuracy = distances.length > 0
    ? distances.filter(d => d.correct).length / distances.length
    : 0

  return (
    <div className="flex h-[calc(100vh-80px)]">
      <div ref={containerRef} className="flex-1 bg-gray-900">
        <Stage width={containerSize.width} height={containerSize.height}>
          <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
            {image && <KonvaImage image={image} width={imageData.width} height={imageData.height} />}

            {/* Draw lines between student and expert points */}
            {studentAnns.map(sa => {
              const expert = expertAnns.find(ea => ea.landmark_def_id === sa.landmark_def_id)
              if (!expert) return null
              const sx = (sa.data as any).x, sy = (sa.data as any).y
              const ex = (expert.data as any).x, ey = (expert.data as any).y
              return (
                <Line
                  key={`line-${sa.id}`}
                  points={[sx, sy, ex, ey]}
                  stroke="#ffffff40"
                  strokeWidth={1 / scale}
                  dash={[4 / scale, 4 / scale]}
                />
              )
            })}

            {/* Expert points */}
            {expertAnns.map(a => (
              <Group key={`expert-${a.id}`}>
                <Circle
                  x={(a.data as any).x}
                  y={(a.data as any).y}
                  radius={6 / scale}
                  fill={EXPERT_COLOR}
                  stroke="#fff"
                  strokeWidth={1.5 / scale}
                />
              </Group>
            ))}

            {/* Student points */}
            {studentAnns.map(a => (
              <Group key={`student-${a.id}`}>
                <Circle
                  x={(a.data as any).x}
                  y={(a.data as any).y}
                  radius={6 / scale}
                  fill={STUDENT_COLOR}
                  stroke="#fff"
                  strokeWidth={1.5 / scale}
                />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Feedback sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Accuracy Feedback</h3>
          <div className="mt-2 text-3xl font-bold text-gray-900">{Math.round(accuracy * 100)}%</div>
          <div className="text-sm text-gray-500">{distances.filter(d => d.correct).length}/{distances.length} landmarks within threshold</div>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 border-b border-gray-100 flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STUDENT_COLOR }} /> Your labels
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EXPERT_COLOR }} /> Expert labels
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {distances.map((d, i) => (
            <div key={i} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-900">{d.landmark}</span>
              <div className="text-right">
                <span className={`text-sm font-mono ${d.correct ? 'text-green-600' : 'text-red-600'}`}>
                  {d.distance.toFixed(1)}px
                </span>
                <span className="ml-2 text-xs">{d.correct ? 'Pass' : 'Fail'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => navigate('/labeling')}
            className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
