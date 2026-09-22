import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { MapPin, Clock, Users, DollarSign, Car } from 'lucide-react'

export function CreateRidePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    origin: 'IIM Rohtak',
    destination: '',
    date: '',
    departureTime: '',
    totalCost: '',
    maxSeats: '4',
    driverName: '',
    driverPhone: '',
    vehicleType: 'Car',
    vehicleNumber: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !formData.destination ||
      !formData.date ||
      !formData.departureTime ||
      !formData.totalCost ||
      !formData.driverName ||
      !formData.driverPhone ||
      !formData.vehicleNumber
    ) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { error: insertError } = await supabase.from('rides').insert({
        creator_id: user?.id,
        origin: formData.origin,
        destination: formData.destination,
        date: formData.date,
        departure_time: formData.departureTime,
        total_cost: parseInt(formData.totalCost),
        max_seats: parseInt(formData.maxSeats),
        driver_name: formData.driverName,
        driver_phone: formData.driverPhone,
        vehicle_type: formData.vehicleType,
        vehicle_number: formData.vehicleNumber,
        status: 'open',
        current_participants: 1
      })

      if (insertError) throw insertError

      alert('Ride created successfully!')
      navigate('/trips')
    } catch (err) {
      console.error('Create ride error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create ride')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="md:ml-64 p-4 md:p-8 max-w-2xl">
      {/* Header */}
      <h1 className="text-3xl font-bold text-secondary-900 mb-2">Post a Trip</h1>
      <p className="text-secondary-600 mb-8">Share your ride and find co-travellers</p>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Origin */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            <MapPin className="inline mr-2" size={16} />
            From
          </label>
          <input
            type="text"
            name="origin"
            value={formData.origin}
            disabled
            className="w-full px-4 py-2 border border-secondary-300 rounded-lg bg-secondary-50"
          />
        </div>

        {/* Destination */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            <MapPin className="inline mr-2" size={16} />
            To *
          </label>
          <input
            type="text"
            name="destination"
            placeholder="Enter destination"
            value={formData.destination}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <Clock className="inline mr-2" size={16} />
              Departure Time *
            </label>
            <input
              type="time"
              name="departureTime"
              value={formData.departureTime}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
        </div>

        {/* Cost and Seats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <DollarSign className="inline mr-2" size={16} />
              Total Cost (₹) *
            </label>
            <input
              type="number"
              name="totalCost"
              placeholder="1200"
              value={formData.totalCost}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <Users className="inline mr-2" size={16} />
              Max Seats *
            </label>
            <select
              name="maxSeats"
              value={formData.maxSeats}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {[2, 3, 4, 5, 6, 7].map(num => (
                <option key={num} value={num}>
                  {num} seats
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Driver Info Section */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <h3 className="font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <Car size={20} className="text-primary-600" />
            Driver Information
          </h3>

          <div className="space-y-4">
            {/* Driver Name */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Driver Name *
              </label>
              <input
                type="text"
                name="driverName"
                placeholder="Your name"
                value={formData.driverName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            {/* Driver Phone */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Driver Phone *
              </label>
              <input
                type="tel"
                name="driverPhone"
                placeholder="10-digit mobile number"
                value={formData.driverPhone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Vehicle Type
              </label>
              <select
                name="vehicleType"
                value={formData.vehicleType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option>Car</option>
                <option>SUV</option>
                <option>Van</option>
                <option>Sedan</option>
              </select>
            </div>

            {/* Vehicle Number */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Vehicle Number (Registration) *
              </label>
              <input
                type="text"
                name="vehicleNumber"
                placeholder="DL01AB1234"
                value={formData.vehicleNumber}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating Ride...' : 'Post Trip'}
        </button>
      </form>
    </div>
  )
}
