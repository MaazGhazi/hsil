import api from './client'

export interface User {
  id: string
  email: string
  full_name: string
  role: 'student' | 'expert' | 'surgeon' | 'admin'
  accuracy_score: number | null
  is_active: boolean
  year_level: string | null
  institution: string | null
  specialty: string | null
  onboarding_complete: boolean
  xp_points: number
  level: number
  streak_days: number
  best_streak: number
  total_images_labeled: number
  badges: string | null
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export async function register(email: string, password: string, full_name: string, role: string): Promise<User> {
  const { data } = await api.post('/auth/register', { email, password, full_name, role })
  return data
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post('/auth/login', { email, password })
  localStorage.setItem('access_token', data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await api.get('/auth/me')
  return data
}

export function logout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  window.location.href = '/login'
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('access_token')
}
