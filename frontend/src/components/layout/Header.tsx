import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { logout } from '../../api/auth'

export function Header() {
  const { user } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => location.pathname.startsWith(path)

  const linkClass = (path: string) =>
    `${isActive(path) ? 'text-gray-900 font-medium' : 'text-gray-500'} hover:text-gray-900`

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-xl font-semibold text-gray-900">HSIL</Link>
        {user && (
          <nav className="flex items-center gap-4 text-sm">
            {(user.role === 'student' || user.role === 'expert' || user.role === 'admin') && (
              <Link to="/labeling" className={linkClass('/labeling')}>Labeling</Link>
            )}
            {(user.role === 'surgeon' || user.role === 'admin') && (
              <Link to="/overlay" className={linkClass('/overlay')}>Overlay</Link>
            )}
            {(user.role === 'admin' || user.role === 'expert') && (
              <Link to="/admin" className={linkClass('/admin')}>Admin</Link>
            )}
          </nav>
        )}
      </div>
      {user && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {user.full_name} <span className="text-gray-400">({user.role})</span>
          </span>
          {user.accuracy_score !== null && (
            <span className="text-gray-500">
              Accuracy: {Math.round(user.accuracy_score * 100)}%
            </span>
          )}
          <button onClick={logout} className="text-gray-500 hover:text-gray-700">
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
