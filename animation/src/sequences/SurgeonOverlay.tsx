import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'

export const SurgeonOverlay: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const numOp = interpolate(frame, [0, 30], [0, 0.04], { extrapolateRight: 'clamp' })

  // ---- Scanning beam sweeps across the image ----
  const scanX = interpolate(frame, [50, 180], [-100, 1100], { extrapolateRight: 'clamp' })
  const scanOp = frame > 50 && frame < 190 ? 0.6 : 0

  // ---- Landmarks appear when the scan beam passes them ----
  const landmarks = [
    { cx: 420, cy: 320, label: 'Pedicle', conf: 94 },
    { cx: 370, cy: 230, label: 'SAP', conf: 91 },
    { cx: 280, cy: 340, label: 'L. Transverse', conf: 76 },
    { cx: 560, cy: 340, label: 'R. Transverse', conf: 88 },
    { cx: 420, cy: 430, label: 'Inferior Body', conf: 92 },
    { cx: 350, cy: 280, label: 'L. Lamina', conf: 85 },
    { cx: 490, cy: 280, label: 'R. Lamina', conf: 80 },
  ]

  const confColor = (c: number) =>
    c >= 90 ? '#22c55e' : c >= 80 ? '#eab308' : '#f97316'

  // ---- Fake x-ray texture: overlapping ellipses ----
  const xrayShapes = [
    { cx: 420, cy: 340, rx: 90, ry: 130 },
    { cx: 380, cy: 300, rx: 40, ry: 50 },
    { cx: 460, cy: 300, rx: 40, ry: 50 },
    { cx: 300, cy: 340, rx: 70, ry: 30 },
    { cx: 540, cy: 340, rx: 70, ry: 30 },
    { cx: 420, cy: 200, rx: 25, ry: 60 },
  ]

  // Zoom-in effect through the scene
  const zoom = interpolate(frame, [0, 270], [1, 1.08], { extrapolateRight: 'clamp' })

  // Count-up for detected landmarks
  const detected = Math.min(
    Math.floor(interpolate(frame, [80, 200], [0, 7], { extrapolateRight: 'clamp' })),
    7
  )

  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
      {/* Giant "04" */}
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
          color: '#f59e0b',
          lineHeight: 1,
        }}
      >
        04
      </div>

      {/* Title — bottom left, since the image is center-right */}
      <div style={{ position: 'absolute', bottom: 140, left: 100 }}>
        {'DEPLOY'.split('').map((ch, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: '#f59e0b',
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: 6,
              opacity: interpolate(frame, [3 + i * 3, 13 + i * 3], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              transform: `translateY(${interpolate(frame, [3 + i * 3, 13 + i * 3], [12, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px)`,
            }}
          >
            {ch}
          </span>
        ))}
        <div style={{ overflow: 'hidden', marginTop: 8 }}>
          <h1
            style={{
              color: '#f1f5f9',
              fontSize: 56,
              fontWeight: 800,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.15,
              margin: 0,
              opacity: interpolate(frame, [10, 38], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(frame, [10, 38], [50, 0], { extrapolateRight: 'clamp' })}px)`,
            }}
          >
            AI guides the
          </h1>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              color: '#f59e0b',
              fontSize: 56,
              fontWeight: 800,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.15,
              margin: 0,
              opacity: interpolate(frame, [18, 48], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(frame, [18, 48], [50, 0], { extrapolateRight: 'clamp' })}px)`,
            }}
          >
            surgeon in real time
          </h1>
        </div>
      </div>

      {/* Central "x-ray" image area */}
      <svg
        width={840}
        height={600}
        viewBox="100 100 700 500"
        style={{
          position: 'absolute',
          right: 80,
          top: '50%',
          transform: 'translateY(-55%)',
        }}
      >
        <defs>
          <filter id="xrayBlur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id="scanGlow">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="scanBeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
            <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background frame */}
        <rect x={160} y={140} width={580} height={400} rx={16} fill="#060d1b" stroke="#1e293b" strokeWidth={1} />

        {/* Faux x-ray anatomy shapes */}
        {xrayShapes.map((s, i) => {
          const shapeOp = interpolate(frame, [20 + i * 5, 50 + i * 5], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          return (
            <ellipse
              key={i}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx}
              ry={s.ry}
              fill="#0f1d32"
              stroke="#1a2744"
              strokeWidth={1}
              opacity={shapeOp * 0.7}
              filter="url(#xrayBlur)"
            />
          )
        })}

        {/* Scan line */}
        <rect
          x={scanX - 60}
          y={140}
          width={120}
          height={400}
          fill="url(#scanBeam)"
          opacity={scanOp}
        />

        {/* Landmarks — appear when scan passes */}
        {landmarks.map((lm, i) => {
          const revealFrame = 50 + ((lm.cx - 160) / 580) * 130
          const s = spring({
            frame: frame - revealFrame,
            fps,
            config: { damping: 10, mass: 0.4 },
          })
          const vis = Math.max(0, s)
          const color = confColor(lm.conf)
          const pulse = 1 + 0.08 * Math.sin((frame - revealFrame) * 0.15)

          return (
            <g key={i} transform={`translate(${lm.cx}, ${lm.cy})`} opacity={vis}>
              {/* Outer confidence ring — pulses */}
              <circle
                r={22 * vis * pulse}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                opacity={0.3}
              />
              {/* Ring */}
              <circle
                r={13 * vis}
                fill="none"
                stroke={color}
                strokeWidth={2}
                opacity={0.7}
                filter="url(#scanGlow)"
              />
              {/* Fill */}
              <circle r={5 * vis} fill={color} opacity={0.9} />
              <circle r={2.5 * vis} fill="#fff" />

              {/* Confidence badge — tiny pill shape */}
              <rect
                x={-16}
                y={-32}
                width={32}
                height={16}
                rx={8}
                fill={color}
                opacity={0.15 * vis}
              />
              <text
                x={0}
                y={-21}
                textAnchor="middle"
                fill={color}
                fontSize={10}
                fontFamily="ui-monospace, monospace"
                fontWeight={700}
                opacity={vis}
              >
                {lm.conf}%
              </text>

              {/* Label line + text */}
              <line
                x1={14}
                y1={0}
                x2={35}
                y2={0}
                stroke={color}
                strokeWidth={0.5}
                opacity={0.4 * vis}
              />
              <text
                x={40}
                y={4}
                fill="#94a3b8"
                fontSize={12}
                fontFamily="system-ui, sans-serif"
                fontWeight={500}
                opacity={0.8 * vis}
              >
                {lm.label}
              </text>
            </g>
          )
        })}

        {/* Corner HUD elements */}
        <g opacity={interpolate(frame, [40, 65], [0, 0.6], { extrapolateRight: 'clamp' })}>
          {/* Top-left crosshair */}
          <line x1={175} y1={155} x2={200} y2={155} stroke="#f59e0b" strokeWidth={1} />
          <line x1={175} y1={155} x2={175} y2={180} stroke="#f59e0b" strokeWidth={1} />
          {/* Top-right */}
          <line x1={725} y1={155} x2={700} y2={155} stroke="#f59e0b" strokeWidth={1} />
          <line x1={725} y1={155} x2={725} y2={180} stroke="#f59e0b" strokeWidth={1} />
          {/* Bottom-left */}
          <line x1={175} y1={525} x2={200} y2={525} stroke="#f59e0b" strokeWidth={1} />
          <line x1={175} y1={525} x2={175} y2={500} stroke="#f59e0b" strokeWidth={1} />
          {/* Bottom-right */}
          <line x1={725} y1={525} x2={700} y2={525} stroke="#f59e0b" strokeWidth={1} />
          <line x1={725} y1={525} x2={725} y2={500} stroke="#f59e0b" strokeWidth={1} />
        </g>

        {/* Region label */}
        <text
          x={180}
          y={170}
          fill="#f59e0b"
          fontSize={11}
          fontFamily="ui-monospace, monospace"
          opacity={interpolate(frame, [40, 60], [0, 0.5], { extrapolateRight: 'clamp' })}
        >
          OBLIQUE LUMBAR — LIVE
        </text>
      </svg>

      {/* Detected count — top right */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          right: 120,
          opacity: interpolate(frame, [100, 125], [0, 1], { extrapolateRight: 'clamp' }),
          textAlign: 'right',
        }}
      >
        <div
          style={{
            color: '#f59e0b',
            fontSize: 80,
            fontWeight: 900,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1,
          }}
        >
          {detected}/7
        </div>
        <div
          style={{
            color: '#475569',
            fontSize: 18,
            fontFamily: 'system-ui, sans-serif',
            marginTop: 4,
          }}
        >
          landmarks detected
        </div>
        <div
          style={{
            color: '#334155',
            fontSize: 14,
            fontFamily: 'ui-monospace, monospace',
            marginTop: 2,
          }}
        >
          inference &lt; 2s
        </div>
      </div>

      {/* Final tagline */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [220, 250], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `translateY(${interpolate(frame, [220, 250], [20, 0], { extrapolateRight: 'clamp' })}px)`,
        }}
      >
        <span
          style={{
            color: '#64748b',
            fontSize: 22,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Every label makes the next prediction better.
        </span>
      </div>
    </AbsoluteFill>
  )
}
