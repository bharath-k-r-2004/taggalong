import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/AuthPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { NamePage } from './pages/NamePage'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { ProfilePage } from './pages/ProfilePage'
import { MyTripsPage } from './pages/MyTripsPage'
import { CreateRidePage } from './pages/CreateRidePage'
import { RideDetailsPage } from './pages/RideDetailsPage'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Google sends people back here after login */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {!user ? (
        <>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </>
      ) : !user.name ? (
        // First login: ask the student to type their name before anything else
        <Route path="*" element={<NamePage />} />
      ) : (
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/create-ride" element={<CreateRidePage />} />
          <Route path="/find-travellers" element={<SearchPage />} />
          <Route path="/ride/:id" element={<RideDetailsPage />} />
          <Route path="/trips" element={<MyTripsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}
