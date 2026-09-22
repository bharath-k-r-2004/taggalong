import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { MapPin, Clock, Calendar, Car, Users } from 'lucide-react'

export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useState({
    origin: 'IIM Rohtak',
    destination: '',
    date: '',
    time: '',
    timeFlexibility: 'flexible'
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setSearchParams(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchParams.destination || !searchParams.date) {
      alert('Please fill in all required fields')
      return
    }
    navigate('/search', { state: searchParams })
  }

  return (
    <div className="md:ml-64">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Hey {user?.user_metadata?.name || 'there'},
        </h1>
        <p className="text-primary-100 text-lg">Where are you going?</p>
        
        {user?.user_metadata?.full_batch && (
          <div className="mt-4 inline-block bg-white/20 px-3 py-1 rounded-full text-sm">
            {user.user_metadata.full_batch}
          </div>
        )}
      </div>

      {/* Search Form */}
      <div className="p-4 md:p-8 max-w-4xl">
        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-6 space-y-4">
          {/* Origin */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <MapPin className="inline mr-2" size={16} />
              From
            </label>
            <input
              type="text"
              name="origin"
              value={searchParams.origin}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-secondary-50"
              disabled
            />
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <MapPin className="inline mr-2" size={16} />
              To
            </label>
            <input
              type="text"
              name="destination"
              placeholder="Enter destination"
              value={searchParams.destination}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                <Calendar className="inline mr-2" size={16} />
                Date
              </label>
              <input
                type="date"
                name="date"
                value={searchParams.date}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                <Clock className="inline mr-2" size={16} />
                Preferred time
              </label>
              <input
                type="time"
                name="time"
                value={searchParams.time}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Time Flexibility */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-3">
              <Clock className="inline mr-2" size={16} />
              Time flexibility (optional)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'exact', label: 'Exact' },
                { value: '30mins', label: '± 30 mins' },
                { value: '1hour', label: '± 1 hour' },
                { value: 'flexible', label: 'Flexible' }
              ].map(option => (
                <label
                  key={option.value}
                  className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    searchParams.timeFlexibility === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="timeFlexibility"
                    value={option.value}
                    checked={searchParams.timeFlexibility === option.value}
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors mt-6"
          >
            Find a Ride →
          </button>
        </form>
      </div>

      {/* Quick Actions */}
      <div className="px-4 md:px-8 pb-8">
        <p className="text-secondary-700 font-medium mb-4">OR</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {/* I have a driver */}
          <button
            onClick={() => navigate('/create-ride')}
            className="bg-white border-2 border-primary-300 rounded-lg p-6 hover:shadow-md transition-shadow text-left"
          >
            <Car className="text-primary-600 mb-3" size={32} />
            <h3 className="font-semibold text-secondary-900 mb-1">I have a driver</h3>
            <p className="text-sm text-secondary-600">
              Share your ride and find co-travellers
            </p>
          </button>

          {/* Find travellers */}
          <button
            onClick={() => navigate('/find-travellers')}
            className="bg-white border-2 border-primary-300 rounded-lg p-6 hover:shadow-md transition-shadow text-left"
          >
            <Users className="text-primary-600 mb-3" size={32} />
            <h3 className="font-semibold text-secondary-900 mb-1">Find Travellers</h3>
            <p className="text-sm text-secondary-600">
              See students going your way
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
