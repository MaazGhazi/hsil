import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from './components/layout/Header'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { LabelingDashboard } from './pages/labeling/LabelingDashboard'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { ImageUploadPage } from './pages/admin/ImageUpload'
import { AnnotationWorkspace } from './pages/labeling/AnnotationWorkspace'
import { AccuracyFeedback } from './pages/labeling/AccuracyFeedback'
import { StudentAccuracy } from './pages/admin/StudentAccuracy'
import { HeatmapView } from './pages/admin/HeatmapView'
import { SurgeonDashboard } from './pages/surgeon/SurgeonDashboard'
import { OnboardingPage } from './pages/OnboardingPage'
import { useAuth } from './hooks/useAuth'

const queryClient = new QueryClient()

function HomePage() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh] text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  // Force onboarding for students who haven't completed it
  if ((user.role === 'student' || user.role === 'expert') && !user.onboarding_complete) {
    return <Navigate to="/onboarding" replace />
  }

  // Redirect based on role
  switch (user.role) {
    case 'student':
    case 'expert':
      return <Navigate to="/labeling" replace />
    case 'surgeon':
      return <Navigate to="/overlay" replace />
    case 'admin':
      return <Navigate to="/admin" replace />
    default:
      return <Navigate to="/login" replace />
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="*" element={
            <div className="min-h-screen bg-gray-50">
              <Header />
              <main className="p-6">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/labeling" element={
                    <ProtectedRoute roles={['student', 'expert', 'admin']}>
                      <LabelingDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/labeling/annotate" element={
                    <ProtectedRoute roles={['student', 'expert', 'admin']}>
                      <AnnotationWorkspace />
                    </ProtectedRoute>
                  } />
                  <Route path="/labeling/feedback/:imageId" element={
                    <ProtectedRoute roles={['student', 'expert', 'admin']}>
                      <AccuracyFeedback />
                    </ProtectedRoute>
                  } />
                  <Route path="/overlay" element={
                    <ProtectedRoute roles={['surgeon', 'admin']}>
                      <SurgeonDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <ProtectedRoute roles={['admin', 'expert']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/upload" element={
                    <ProtectedRoute roles={['admin', 'expert']}>
                      <ImageUploadPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/heatmap/:imageId" element={
                    <ProtectedRoute roles={['admin', 'expert']}>
                      <HeatmapView />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/accuracy" element={
                    <ProtectedRoute roles={['admin', 'expert']}>
                      <StudentAccuracy />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
