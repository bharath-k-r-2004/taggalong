import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRides } from '../hooks/useRides'
import { matchRides, MatchScore } from '../lib/matchingAlgorithm'
import { formatCost } from '../lib/costSplitting'
import { Star, MapPin, Clock, Users, Edit2, ChevronRight } from 'lucide-react'

export function SearchPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { rides } = useRides()
  const [matches, setMatches] = useState<MatchScore[]>([])
  const [filterType, setFilterType] = useState('all')

  const searchParams = location.state || {
    origin: 'IIM Rohtak',
    destination: 'Delhi',
    date: '',
    time: '',
    timeFlexibility: 'flexible'
  }

  useEffect(() => {
    if (rides.length > 0) {
      const allMatches = matchRides(
        rides as any,
        searchParams.origin,
        searchParams.destination,
        searchParams.date,
        searchParams.time,
        searchParams.timeFlexibility
      )
      setMatches(allMatches)
    }
  }, [rides, searchParams])

  const getFilteredMatches = () => {
    return matches.filter(match => {
      if (filterType === 'driver') return match.ride.status === 'confirmed' || match.ride.status === 'open'
      if (filterType === 'no-driver') return match.ride.status === 'looking-for-driver'
      return true
    })
  }

  const filteredMatches = getFilteredMatches()

  const getAvailableSeats = (ride: any) => {
    return ride.max_seats - (ride.current_participants || 0)
  }

  const getCurrentParticipants = (ride: any) => {
    return ride.current_participants || 0
  }

  return (
    <div className="md:ml-64">
      {/* Header */}
      <div className="bg-white border-b border-secondary-200 p-4 md:p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-secondary-900">Matching Rides</h1>
          <button
            onClick={() => navigate('/')}
            className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <Edit2 size={18} />
            Edit Search
          </button>
        </div>

        {/* Search Summary */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600">
                <MapPin className="inline mr-1" size={14} />
                {searchParams.origin} → {searchParams.destination}
              </p>
              <p className="text-sm text-secondary-600">
                <Calendar className="inline mr-1" size={14} />
                {searchParams.date && new Date(searchParams.date).toLocaleDateString('en-IN')} • Around{' '}
                {searchParams.time || 'any time'}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { value: 'all', label: `All (${matches.length})` },
            { value: 'driver', label: `With Driver (${matches.filter(m => m.ride.status !== 'looking-for-driver').length})` },
            { value: 'no-driver', label: `Looking for Driver (${matches.filter(m => m.ride.status === 'looking-for-driver').length})` }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setFilterType(filter.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filterType === filter.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="p-4 md:p-6 space-y-4 max-w-4xl">
        {filteredMatches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary-600 mb-4">No matching rides found</p>
            <button
              onClick={() => navigate('/')}
              className="text-primary-600 hover:underline"
            >
              Try different search parameters
            </button>
          </div>
        ) : (
          filteredMatches.map((match, index) => {
            const ride = match.ride
            const isBestMatch = index === 0 && match.score > 50

            return (
              <div
                key={ride.id}
                className={`bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                  isBestMatch ? 'border-primary-400 shadow-md' : 'border-secondary-200'
                }`}
                onClick={() => navigate(`/ride/${ride.id}`)}
              >
                {/* Best Match Badge */}
                {isBestMatch && (
                  <div className="bg-primary-50 border-b border-primary-200 px-4 py-2 flex items-center gap-2">
                    <Star className="text-primary-600" size={16} fill="currentColor" />
                    <span className="text-sm font-medium text-primary-700">Best Match</span>
                  </div>
                )}

                <div className="p-4">
                  {/* Time and Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-2xl font-bold text-secondary-900">
                        {ride.departure_time}
                      </p>
                      <p className="text-sm text-secondary-600">
                        {new Date(ride.date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>

                    {/* Cost */}
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary-600">
                        {formatCost(ride.total_cost)}
                      </p>
                      <p className="text-xs text-secondary-600">
                        {formatCost(Math.round(ride.total_cost / ride.max_seats))} per person
                      </p>
                    </div>
                  </div>

                  {/* Route */}
                  <p className="text-sm text-secondary-700 mb-3 font-medium">
                    {ride.origin} → {ride.destination}
                  </p>

                  {/* Ride Info */}
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div className="flex items-center gap-2 text-secondary-700">
                      <Users size={16} />
                      <span>
                        {getCurrentParticipants(ride)}/{ride.max_seats} going
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary-700">
                      <MapPin size={16} />
                      <span>
                        {getAvailableSeats(ride)} seat{getAvailableSeats(ride) !== 1 ? 's' : ''} left
                      </span>
                    </div>
                    {ride.driver_name && (
                      <div className="text-secondary-700">
                        <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-medium">
                          Driver Available
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Driver Info */}
                  {ride.driver_name && (
                    <div className="bg-secondary-50 rounded p-3 mb-3 text-sm">
                      <p className="text-secondary-700">
                        <strong>Driver:</strong> {ride.driver_name}
                      </p>
                      <p className="text-secondary-600 text-xs">
                        {ride.vehicle_type} • {ride.vehicle_number}
                      </p>
                    </div>
                  )}

                  {/* CTA */}
                  <button className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2">
                    View Details
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
