import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { StudentStats, fetchStudentStats } from '../lib/rides'
import { LogOut, User, Mail, Badge, GraduationCap, Pencil } from 'lucide-react'

export function ProfilePage() {
  const { user, signOut, updateName } = useAuth()
  const navigate = useNavigate()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [stats, setStats] = useState<StudentStats | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (user) fetchStudentStats(user.id).then(setStats)
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(Boolean(data)))
  }, [user])

  const name = user?.user_metadata?.name
  const course = user?.user_metadata?.course
  const batch = user?.user_metadata?.batch

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const startEditing = () => {
    setNameInput(name || '')
    setNameError(null)
    setEditingName(true)
  }

  const handleSaveName = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      setSaving(true)
      setNameError(null)
      await updateName(nameInput)
      setEditingName(false)
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not save your name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
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
            <h2 className="text-2xl font-bold text-secondary-900">{name || 'Student'}</h2>
            <p className="text-secondary-600">IIM Rohtak Member</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name (typed by the student, editable) */}
          <div className="pb-6 border-b border-secondary-200 md:border-0">
            <div className="flex items-center gap-3 mb-2">
              <User className="text-primary-600" size={20} />
              <span className="text-sm font-medium text-secondary-600">Full Name</span>
            </div>

            {editingName ? (
              <form onSubmit={handleSaveName} className="space-y-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  required
                  minLength={2}
                  maxLength={60}
                  autoFocus
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                {nameError && <p className="text-sm text-red-600">{nameError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingName(false)}
                    className="px-4 py-1.5 text-secondary-600 text-sm hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-lg text-secondary-900 font-medium">{name || 'N/A'}</p>
                <button
                  type="button"
                  onClick={startEditing}
                  className="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm"
                >
                  <Pencil size={14} />
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="pb-6 border-b border-secondary-200 md:border-0">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="text-primary-600" size={20} />
              <span className="text-sm font-medium text-secondary-600">Email</span>
            </div>
            <p className="text-lg text-secondary-900 font-medium break-all">{user?.email}</p>
          </div>

          {/* Programme (from email) */}
          <div className="pb-6 border-b border-secondary-200 md:border-0">
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className="text-primary-600" size={20} />
              <span className="text-sm font-medium text-secondary-600">Programme</span>
            </div>
            <p className="text-lg text-secondary-900 font-medium">{course || 'N/A'}</p>
          </div>

          {/* Batch (from email) */}
          <div className="pb-6 border-b border-secondary-200 md:border-0">
            <div className="flex items-center gap-3 mb-2">
              <Badge className="text-primary-600" size={20} />
              <span className="text-sm font-medium text-secondary-600">Batch</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg text-secondary-900 font-medium">{batch || 'N/A'}</span>
              {batch && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Travel record (facts only, no ratings) */}
      <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-secondary-900">My travel record</h3>
        <div className="grid grid-cols-3 divide-x divide-secondary-200 text-center">
          <div>
            <p className="text-2xl font-bold text-secondary-900">{stats?.completed_trips ?? '–'}</p>
            <p className="text-xs text-secondary-500">Completed trips</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-secondary-900">{stats?.cancelled_trips ?? '–'}</p>
            <p className="text-xs text-secondary-500">Cancelled trips</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-secondary-900">{stats?.last_minute_cancellations ?? '–'}</p>
            <p className="text-xs text-secondary-500">Last-minute cancellations</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-secondary-500">
          Ride posters see these numbers when you ask to join, so leaving early rather than last-minute helps.
        </p>
      </div>

      {isAdmin && (
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="mb-8 w-full rounded-lg border border-primary-600 bg-primary-50 py-3 font-semibold text-primary-700 hover:bg-primary-100"
        >
          Open admin dashboard
        </button>
      )}

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
