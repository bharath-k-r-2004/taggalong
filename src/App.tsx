import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { ProfilePage } from './pages/ProfilePage'
import { MyTripsPage } from './pages/MyTripsPage'
import { CreateRidePage } from './pages/CreateRidePage'
import { RideDetailsPage } from './pages/RideDetailsPage'

function AppContent() {
  const { user, loading } = useAuth()
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user: currentUser }
      } = await supabase.auth.getUser()
      setAuthLoading(false)
    }
    checkAuth()
  }, [])

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {!user ? (
        <>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </>
      ) : (
        <Route element={<Layout><div /></Layout>}>
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
      <AppContent />
    </Router>
  )
}
