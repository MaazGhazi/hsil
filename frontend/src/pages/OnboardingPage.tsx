import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../api/client'

const YEAR_LEVELS = [
  { value: 'ms1', label: 'MS-1 (1st year)' },
  { value: 'ms2', label: 'MS-2 (2nd year)' },
  { value: 'ms3', label: 'MS-3 (3rd year)' },
  { value: 'ms4', label: 'MS-4 (4th year)' },
  { value: 'resident_pgy1', label: 'Resident — PGY-1' },
  { value: 'resident_pgy2', label: 'Resident — PGY-2' },
  { value: 'resident_pgy3', label: 'Resident — PGY-3' },
  { value: 'resident_pgy4', label: 'Resident — PGY-4' },
  { value: 'resident_pgy5', label: 'Resident — PGY-5' },
  { value: 'fellow', label: 'Fellow' },
  { value: 'attending', label: 'Attending Physician' },
]

const SPECIALTIES = [
  'Orthopedic Surgery',
  'Radiology',
  'Neurosurgery',
  'Interventional Radiology',
  'Pain Medicine',
  'Emergency Medicine',
  'General Surgery',
  'Internal Medicine',
  'Undecided',
  'Other',
]

const FLUORO_EXPERIENCE = [
  { value: 'none', label: 'None — never seen a live case' },
  { value: 'observed', label: 'Observed — watched procedures' },
  { value: 'assisted', label: 'Assisted — scrubbed in and helped' },
  { value: 'performed', label: 'Performed — operated the C-arm' },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const { invalidate } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [yearLevel, setYearLevel] = useState('')
  const [institution, setInstitution] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [anatomyCourses, setAnatomyCourses] = useState(0)
  const [fluoroExp, setFluoroExp] = useState('none')

  const handleSubmit = async () => {
    if (!yearLevel || !institution) {
      setError('Please fill in all required fields')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/onboarding', {
        year_level: yearLevel,
        institution: institution,
        specialty: specialty || null,
        prior_anatomy_courses: anatomyCourses,
        fluoroscopy_experience: fluoroExp,
      })
      await invalidate()
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    // Step 0: Training level
    <div key={0} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">What's your training level?</h3>
      <p className="text-sm text-gray-500">This helps us calibrate annotation weighting and tailor your experience.</p>
      <div className="grid grid-cols-1 gap-2">
        {YEAR_LEVELS.map(yl => (
          <button
            key={yl.value}
            onClick={() => setYearLevel(yl.value)}
            className={`text-left px-4 py-3 rounded-lg border text-sm transition-all ${
              yearLevel === yl.value
                ? 'border-cyan-500 bg-cyan-50 text-cyan-900 font-medium'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            {yl.label}
          </button>
        ))}
      </div>
    </div>,

    // Step 1: Institution + Specialty
    <div key={1} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Where are you training?</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Institution *</label>
        <input
          type="text"
          value={institution}
          onChange={e => setInstitution(e.target.value)}
          placeholder="e.g., Johns Hopkins School of Medicine"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Specialty interest</label>
        <div className="grid grid-cols-2 gap-2">
          {SPECIALTIES.map(s => (
            <button
              key={s}
              onClick={() => setSpecialty(s)}
              className={`text-left px-3 py-2 rounded-lg border text-sm ${
                specialty === s
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-900 font-medium'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Step 2: Experience
    <div key={2} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Your anatomy & fluoroscopy experience</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Anatomy courses completed</label>
        <div className="flex items-center gap-3">
          {[0, 1, 2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setAnatomyCourses(n)}
              className={`w-10 h-10 rounded-lg border text-sm font-medium ${
                anatomyCourses === n
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-900'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {n === 4 ? '4+' : n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Fluoroscopy experience</label>
        <div className="space-y-2">
          {FLUORO_EXPERIENCE.map(fe => (
            <button
              key={fe.value}
              onClick={() => setFluoroExp(fe.value)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm ${
                fluoroExp === fe.value
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-900 font-medium'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              {fe.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
  ]

  const canAdvance = step === 0 ? !!yearLevel : step === 1 ? !!institution : true
  const isLast = step === steps.length - 1

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-cyan-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="text-xs text-gray-400 mb-2">Step {step + 1} of {steps.length}</div>

        {/* Current step */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {steps[step]}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex justify-between mt-6">
            {step > 0 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Back
              </button>
            ) : <div />}

            <button
              onClick={isLast ? handleSubmit : () => setStep(s => s + 1)}
              disabled={!canAdvance || loading}
              className="px-6 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-40"
            >
              {loading ? 'Saving...' : isLast ? 'Start Labeling' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
