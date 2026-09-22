import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCost } from '../lib/costSplitting'
import { Star, MapPin, Clock, Users, Phone, Car, MessageSquare, ChevronLeft } from 'lucide-react'

export function RideDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ride, setRide] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const fetchRide = async () => {
      try {
        setLoading(true)
        const { data, error: fetchError } = await supabase
          .from('rides')
          .select('*')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError
        setRide(data)
      } catch (err) {
        console.error('Fetch ride error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load ride')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchRide()
  }, [id])

  const handleJoinRide = async () => {
    if (!user) return

    try {
      setJoining(true)
      setError(null)

      const costPerPerson = Math.round(ride.total_cost / ride.max_seats)

      const { error: joinError } = await supabase.from('ride_participants').insert({
        ride_id: ride.id,
        user_id: user.id,
        status: 'requested',
        contribution_amount: costPerPerson
      })

      if (joinError) throw joinError

      alert('Join request sent! Waiting for confirmation.')
      navigate('/trips')
    } catch (err) {
      console.error('Join ride error:', err)
      setError(err instanceof Error ? err.message : 'Failed to join ride')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="md:ml-64 flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
      </div>
    )
  }

  if (!ride) {
    return (
      <div className="md:ml-64 p-4 md:p-8">
        <p className="text-secondary-600">Ride not found</p>
      </div>
    )
  }

  const costPerPerson = Math.round(ride.total_cost / ride.max_seats)
  const availableSeats = ride.max_seats - (ride.current_participants || 0)
  const isFull = availableSeats <= 0

  return (
    <div className="md:ml-64">
      {/* Header */}
      <div className="bg-white border-b border-secondary-200 p-4 md:p-6 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <h1 className="text-3xl font-bold text-secondary-900">Ride Details</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 m-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="p-4 md:p-8 max-w-4xl space-y-6">
        {/* Ride Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Status Badge */}
          {isFull ? (
            <div className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
              Full
            </div>
          ) : (
            <div className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
              {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
            </div>
          )}

          {/* Time and Cost */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-4xl font-bold text-secondary-900 mb-1">
                {ride.departure_time}
              </p>
              <p className="text-secondary-600">
                {new Date(ride.date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            <div className="text-right">
              <p className="text-3xl font-bold text-primary-600 mb-1">
                {formatCost(ride.total_cost)}
              </p>
              <p className="text-sm text-secondary-600">
                {formatCost(costPerPerson)} per person
              </p>
            </div>
          </div>

          {/* Route */}
          <p className="text-lg font-semibold text-secondary-900 mb-6">
            <MapPin className="inline mr-2 text-primary-600" size={20} />
            {ride.origin} → {ride.destination}
          </p>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-secondary-50 rounded-lg p-4">
            <div>
              <p className="text-sm text-secondary-600 mb-1">Seats</p>
              <p className="text-lg font-semibold text-secondary-900">
                {ride.current_participants || 1}/{ride.max_seats}
              </p>
            </div>
            <div>
              <p className="text-sm text-secondary-600 mb-1">Cost per person</p>
              <p className="text-lg font-semibold text-secondary-900">
                {formatCost(costPerPerson)}
              </p>
            </div>
            <div>
              <p className="text-sm text-secondary-600 mb-1">Status</p>
              <p className="text-lg font-semibold text-secondary-900 capitalize">
                {ride.status}
              </p>
            </div>
          </div>
        </div>

        {/* Driver Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <Car className="text-primary-600" size={20} />
            Driver & Vehicle
          </h3>

          <div className="space-y-4">
            {/* Driver Name */}
            <div className="pb-4 border-b border-secondary-200">
              <p className="text-sm text-secondary-600 mb-1">Driver Name</p>
              <p className="text-lg font-semibold text-secondary-900">
                {ride.driver_name}
              </p>
            </div>

            {/* Vehicle Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-secondary-600 mb-1">Vehicle Type</p>
                <p className="text-lg font-semibold text-secondary-900">
                  {ride.vehicle_type}
                </p>
              </div>

              <div>
                <p className="text-sm text-secondary-600 mb-1">Vehicle Number</p>
                <p className="text-lg font-semibold text-secondary-900 font-mono">
                  {ride.vehicle_number}
                </p>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-secondary-600 mb-2 flex items-center gap-2">
                <Phone size={16} className="text-primary-600" />
                Driver Contact
              </p>
              <p className="text-lg font-mono text-secondary-900">
                {ride.driver_phone}
              </p>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">Cost Breakdown</h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between pb-2 border-b border-secondary-200">
              <span className="text-secondary-600">Total Ride Cost</span>
              <span className="font-semibold text-secondary-900">
                {formatCost(ride.total_cost)}
              </span>
            </div>

            <div className="flex justify-between pb-2 border-b border-secondary-200">
              <span className="text-secondary-600">Number of Passengers</span>
              <span className="font-semibold text-secondary-900">
                {ride.max_seats}
              </span>
            </div>

            <div className="flex justify-between bg-primary-50 p-3 rounded-lg">
              <span className="font-semibold text-secondary-900">Cost per Person</span>
              <span className="font-bold text-primary-600 text-lg">
                {formatCost(costPerPerson)}
              </span>
            </div>

            <p className="text-xs text-secondary-600 mt-4">
              💡 Split equally among all passengers
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">Additional Information</h3>

          <ul className="space-y-2 text-secondary-700 text-sm">
            <li>✓ Flexible drop-off within destination area</li>
            <li>✓ Luggage allowed</li>
            <li>✓ Non-smoking ride</li>
            <li>✓ Communication via WhatsApp group after joining</li>
          </ul>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleJoinRide}
            disabled={isFull || joining}
            className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Users size={20} />
            {joining ? 'Joining...' : 'Join Ride'}
          </button>

          <button
            onClick={() => navigate(`/chat/${ride.id}`)}
            className="flex-1 bg-white border-2 border-primary-600 text-primary-600 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare size={20} />
            Message Group
          </button>
        </div>
      </div>
    </div>
  )
}
