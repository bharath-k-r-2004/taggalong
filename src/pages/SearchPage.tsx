import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpDown, CalendarDays, Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { LocationInput } from '../components/LocationInput'
import { RideCard } from '../components/RideCard'
import { Place } from '../lib/places'
import { Ride, fetchUpcomingRides, matchRides, todayString } from '../lib/rides'

interface SearchState {
  from?: Place | null
  to?: Place | null
  date?: string
}

export function SearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const initial = (useLocation().state as SearchState | null) || {}

  const [from, setFrom] = useState<Place | null>(initial.from || null)
  const [to, setTo] = useState<Place | null>(initial.to || null)
  const [date, setDate] = useState(initial.date || '')
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchUpcomingRides()
      .then(setRides)
      .catch(err => setError(err.message || 'Could not load rides'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtering = Boolean(from?.name || to?.name || date)
  const results = useMemo(() => matchRides(rides, from, to, date), [rides, from, to, date])
  const matches = results.filter(r => r.isMatch)
  const others = filtering ? results.filter(r => !r.isMatch) : []

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const clearAll = () => {
    setFrom(null)
    setTo(null)
    setDate('')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Find a ride</h1>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-secondary-600 hover:bg-secondary-100"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Where from / where to */}
      <div className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
        <div className="relative space-y-3">
          <LocationInput
            label="From"
            placeholder="Pickup: campus, station, city..."
            value={from}
            onChange={setFrom}
            kind="from"
            allowCurrentLocation
          />
          <LocationInput
            label="To"
            placeholder="Where to?"
            value={to}
            onChange={setTo}
            kind="to"
            near={from}
          />
          <button
            type="button"
            onClick={swap}
            className="absolute right-12 top-[3.35rem] z-10 rounded-full border border-secondary-200 bg-white p-1.5 text-secondary-600 shadow-sm hover:bg-secondary-50"
            title="Swap pickup and drop"
            aria-label="Swap pickup and drop"
          >
            <ArrowUpDown size={16} />
          </button>
        </div>

        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary-500">
              <CalendarDays size={12} className="mr-1 inline" />
              Date (optional)
            </label>
            <input
              type="date"
              value={date}
              min={todayString()}
              onChange={e => setDate(e.target.value)}
              className="!rounded-xl"
            />
          </div>
          {filtering && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl px-3 py-2 text-sm font-medium text-secondary-600 hover:bg-secondary-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mt-6">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold text-secondary-600">
              {filtering
                ? `${matches.length} ride${matches.length === 1 ? '' : 's'} match your search`
                : `${matches.length} upcoming ride${matches.length === 1 ? '' : 's'}`}
            </p>

            {matches.length === 0 && (
              <div className="rounded-2xl border border-dashed border-secondary-300 bg-white px-4 py-8 text-center">
                <p className="font-medium text-secondary-800">
                  {filtering ? 'No rides on this route yet.' : 'No rides posted yet.'}
                </p>
                <p className="mt-1 text-sm text-secondary-500">
                  Post it yourself and other students can join you.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/create-ride', { state: { from, to, date } })}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 font-semibold text-white hover:bg-primary-700"
                >
                  <Plus size={18} />
                  Post this ride
                </button>
              </div>
            )}

            <div className="space-y-3">
              {matches.map(m => (
                <RideCard key={m.ride.id} ride={m.ride} userId={user?.id} pickupKm={m.pickupKm} dropKm={m.dropKm} />
              ))}
            </div>

            {others.length > 0 && (
              <>
                <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-secondary-500">
                  Other upcoming rides
                </h2>
                <div className="space-y-3">
                  {others.map(m => (
                    <RideCard key={m.ride.id} ride={m.ride} userId={user?.id} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
