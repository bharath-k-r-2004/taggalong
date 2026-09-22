import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { MapPin, Calendar, Users, Clock } from 'lucide-react'
import { formatCost } from '../lib/costSplitting'

export function MyTripsPage() {
  const { user } = useAuth()
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming')

  useEffect(() => {
    const fetchTrips = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('rides')
          .select('*')
          .eq('creator_id', user.id)
          .order('date', { ascending: false })

        if (error) throw error
        setTrips(data || [])
      } catch (err) {
        console.error('Fetch trips error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTrips()
  }, [user])

  const getFilteredTrips = () => {
    const today = new Date().toISOString().split('T')[0]
    
    return trips.filter(trip => {
      if (tab === 'upcoming') return trip.date >= today && trip.status !== 'cancelled'
      if (tab === 'past') return trip.date < today
      if (tab === 'cancelled') return trip.status === 'cancelled'
      return true
    })
  }

  const filteredTrips = getFilteredTrips()

  return (
    <div className="md:ml-64 p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <h1 className="text-3xl font-bold text-secondary-900 mb-8">My Trips</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-secondary-200">
        {['upcoming', 'past', 'cancelled'].map(tabName => (
          <button
            key={tabName}
            onClick={() => setTab(tabName as any)}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              tab === tabName
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-secondary-600 hover:text-secondary-900'
            }`}
          >
            {tabName.charAt(0).toUpperCase() + tabName.slice(1)} (
            {trips.filter(t => {
              const today = new Date().toISOString().split('T')[0]
              if (tabName === 'upcoming') return t.date >= today && t.status !== 'cancelled'
              if (tabName === 'past') return t.date < today
              if (tabName === 'cancelled') return t.status === 'cancelled'
              return true
            }).length}
            )
          </button>
        ))}
      </div>

      {/* Trips List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin mx-auto w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-secondary-600">No trips found</p>
          </div>
        ) : (
          filteredTrips.map(trip => (
            <div
              key={trip.id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 md:p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold text-secondary-900">{trip.departure_time}</p>
                  <p className="text-sm text-secondary-600">
                    {new Date(trip.date).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    trip.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : trip.status === 'cancelled'
                      ? 'bg-red-100 text-red-700'
                      : trip.status === 'ongoing'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                </span>
              </div>

              <p className="text-lg font-semibold text-secondary-900 mb-4">
                {trip.origin} → {trip.destination}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div className="flex items-center gap-2 text-secondary-700">
                  <MapPin size={16} />
                  <span>{trip.max_seats} max seats</span>
                </div>
                <div className="flex items-center gap-2 text-secondary-700">
                  <Clock size={16} />
                  <span>{trip.departure_time}</span>
                </div>
                <div className="flex items-center gap-2 text-secondary-700">
                  <Users size={16} />
                  <span>Shared ride</span>
                </div>
                <div className="text-primary-600 font-semibold">
                  {formatCost(trip.total_cost)}
                </div>
              </div>

              {trip.driver_name && (
                <div className="bg-secondary-50 rounded p-3 mb-4 text-sm">
                  <p className="text-secondary-700">
                    <strong>Driver:</strong> {trip.driver_name}
                  </p>
                  <p className="text-secondary-600">
                    {trip.vehicle_type} • {trip.vehicle_number}
                  </p>
                </div>
              )}

              <button className="w-full bg-primary-50 text-primary-600 hover:bg-primary-100 py-2 rounded-lg font-medium transition-colors">
                View Details
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
