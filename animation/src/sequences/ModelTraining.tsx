import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'

export const ModelTraining: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const numOp = interpolate(frame, [0, 30], [0, 0.04], { extrapolateRight: 'clamp' })

  // ---- Vortex: data particles swirl into a center point ----
  const vortexParticles = Array.from({ length: 40 }, (_, i) => {
    const seed = i * 97.3
    const angle0 = (seed % 360) * (Math.PI / 180)
    const radius0 = 300 + (i % 6) * 60

    const collapseT = interpolate(frame, [40, 180], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
    // Spiral inward: radius shrinks, angle increases
    const radius = radius0 * (1 - collapseT * 0.85)
    const angle = angle0 + collapseT * 4 + frame * 0.015
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius * 0.6 // oval
    const op = 0.3 + 0.4 * collapseT
    const size = 2 + collapseT * 2
    const color = i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#22c55e' : '#8b5cf6'
    return { x, y, op, size, color }
  })

  // Central orb — grows as data converges
  const orbScale = spring({
    frame: frame - 100,
    fps,
    config: { damping: 20, mass: 1.5 },
  })
  const orbS = Math.max(0, orbScale)
  const orbPulse = 1 + 0.05 * Math.sin(frame * 0.15)
  const orbGlow = interpolate(frame, [100, 200], [0, 1], { extrapolateRight: 'clamp' })

  // ---- Loss curve — draws dramatically across bottom third ----
  const chartW = 1400
  const chartH = 200
  const epochs = 60
  const curveT = interpolate(frame, [100, 230], [0, epochs], { extrapolateRight: 'clamp' })
  const numPts = Math.min(Math.floor(curveT), epochs)
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i <= numPts; i++) {
    const x = (i / epochs) * chartW
    const loss = 0.9 * Math.exp(-i * 0.055) + 0.06 + Math.sin(i * 0.8) * 0.025 * Math.exp(-i * 0.03)
    pts.push({ x, y: chartH - loss * chartH })
  }
  const curvePath =
    pts.length > 1 ? `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') : ''
  const areaPath =
    pts.length > 1
      ? curvePath + ` L ${pts[pts.length - 1].x} ${chartH} L ${pts[0].x} ${chartH} Z`
      : ''

  // Accuracy reveal
  const acc = Math.round(interpolate(frame, [210, 255], [0, 87], { extrapolateRight: 'clamp' }))
  const accOp = interpolate(frame, [205, 225], [0, 1], { extrapolateRight: 'clamp' })
  const accScale = interpolate(frame, [205, 240], [0.6, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill>
      {/* Giant "03" */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: numOp,
          fontSize: 600,
          fontWeight: 900,
          fontFamily: 'system-ui, sans-serif',
          color: '#8b5cf6',
          lineHeight: 1,
        }}
      >
        03
      </div>

      {/* Title — centered top */}
      <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center' }}>
        {'TRAIN'.split('').map((ch, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: '#8b5cf6',
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: 8,
              opacity: interpolate(frame, [3 + i * 3, 13 + i * 3], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              transform: `translateY(${interpolate(frame, [3 + i * 3, 13 + i * 3], [15, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px)`,
            }}
          >
            {ch}
          </span>
        ))}
        <div style={{ overflow: 'hidden', marginTop: 10 }}>
          <h1
            style={{
              color: '#f1f5f9',
              fontSize: 60,
              fontWeight: 800,
              fontFamily: 'system-ui, sans-serif',
              margin: 0,
              opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(frame, [10, 40], [50, 0], { extrapolateRight: 'clamp' })}px)`,
            }}
          >
            Data becomes <span style={{ color: '#8b5cf6' }}>intelligence</span>
          </h1>
        </div>
      </div>

      {/* Center: vortex visualization */}
      <svg
        width={1920}
        height={1080}
        viewBox="-960 -540 1920 1080"
        style={{ position: 'absolute' }}
      >
        <defs>
          <filter id="orbGlow">
            <feGaussianBlur stdDeviation="12" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="orbGrad">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#4c1d95" />
          </radialGradient>
          <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Swirling particles */}
        {vortexParticles.map((p, i) => (
          <g key={i}>
            {/* Trail line toward center */}
            <line
              x1={p.x * 0.8}
              y1={p.y * 0.8}
              x2={p.x}
              y2={p.y}
              stroke={p.color}
              strokeWidth={1}
              opacity={p.op * 0.3}
            />
            <circle cx={p.x} cy={p.y} r={p.size} fill={p.color} opacity={p.op} />
          </g>
        ))}

        {/* Central orb */}
        <circle
          r={60 * orbS * orbPulse}
          fill="url(#orbGrad)"
          opacity={0.3 * orbGlow}
          filter="url(#orbGlow)"
        />
        <circle
          r={30 * orbS * orbPulse}
          fill="#8b5cf6"
          opacity={0.6 * orbGlow}
        />
        <circle
          r={12 * orbS}
          fill="#e9d5ff"
          opacity={orbGlow}
        />
      </svg>

      {/* Loss curve — spanning full width near bottom */}
      <div style={{ position: 'absolute', bottom: 120, left: 260, right: 260 }}>
        <svg width={chartW} height={chartH + 20} viewBox={`0 -10 ${chartW} ${chartH + 20}`}>
          {/* Faint grid */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1={0} y1={chartH * t} x2={chartW} y2={chartH * t} stroke="#1e293b" strokeWidth={0.5} />
          ))}
          {/* Area fill */}
          {areaPath && <path d={areaPath} fill="url(#curveGrad)" opacity={0.5} />}
          {/* Curve */}
          {curvePath && (
            <path d={curvePath} fill="none" stroke="#8b5cf6" strokeWidth={3} strokeLinecap="round" />
          )}
          {/* Dot at tip */}
          {pts.length > 1 && (
            <>
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={5} fill="#c4b5fd" />
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={12} fill="#8b5cf6" opacity={0.2} />
            </>
          )}
        </svg>
      </div>

      {/* Accuracy — large centered pop */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: accOp,
          transform: `scale(${accScale})`,
        }}
      >
        <span
          style={{
            color: '#c4b5fd',
            fontSize: 44,
            fontWeight: 800,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {acc}% accuracy
        </span>
        <span
          style={{
            color: '#475569',
            fontSize: 20,
            fontFamily: 'ui-monospace, monospace',
            marginLeft: 16,
          }}
        >
          PCK@10px
        </span>
      </div>
    </AbsoluteFill>
  )
}
