import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LogOut, User, Mail, Badge } from 'lucide-react'

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="md:ml-64 p-4 md:p-8 max-w-2xl">
      {/* Header */}
      <h1 className="text-3xl font-bold text-secondary-900 mb-8">My Profile</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center">
            <User className="text-white" size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-secondary-900">
              {user?.user_metadata?.name || 'Student'}
            </h2>
            <p className="text-secondary-600">IIM Rohtak Member</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div className="pb-6 border-b border-secondary-200 md:border-0">
            <div className="flex items-center gap-3 mb-2">
              <User className="text-primary-600" size={20} />
              <span className="text-sm font-medium text-secondary-600">Full Name</span>
            </div>
            <p className="text-lg text-secondary-900 font-medium">
              {user?.user_metadata?.name || 'N/A'}
            </p>
          </div>

          {/* Email */}
          <div className="pb-6 border-b border-secondary-200 md:border-0">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="text-primary-600" size={20} />
              <span className="text-sm font-medium text-secondary-600">Email</span>
            </div>
            <p className="text-lg text-secondary-900 font-medium break-all">
              {user?.email}
            </p>
          </div>

          {/* Batch */}
          <div className="pb-6 border-b border-secondary-200 md:border-0">
            <div className="flex items-center gap-3 mb-2">
              <Badge className="text-primary-600" size={20} />
              <span className="text-sm font-medium text-secondary-600">Batch</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg text-secondary-900 font-medium">
                {user?.user_metadata?.full_batch || 'N/A'}
              </span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Verified
              </span>
            </div>
          </div>

          {/* Course */}
          <div className="pb-6 border-b border-secondary-200 md:border-0">
            <div className="flex items-center gap-3 mb-2">
              <Badge className="text-primary-600" size={20} />
              <span className="text-sm font-medium text-secondary-600">Programme</span>
            </div>
            <p className="text-lg text-secondary-900 font-medium">
              {user?.user_metadata?.course || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">Account Settings</h3>
        
        <div className="space-y-3">
          <button className="w-full text-left px-4 py-3 hover:bg-secondary-50 rounded-lg transition-colors">
            <span className="text-secondary-700">Privacy Settings</span>
          </button>
          <button className="w-full text-left px-4 py-3 hover:bg-secondary-50 rounded-lg transition-colors">
            <span className="text-secondary-700">Notification Preferences</span>
          </button>
          <button className="w-full text-left px-4 py-3 hover:bg-secondary-50 rounded-lg transition-colors">
            <span className="text-secondary-700">Help & Support</span>
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        <LogOut size={20} />
        Sign Out
      </button>
    </div>
  )
}
