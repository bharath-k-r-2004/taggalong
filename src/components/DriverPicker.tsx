import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { DriverCard } from './DriverCard'
import {
  Driver,
  DriverBooking,
  DriverQuote,
  QUOTE_DISCLAIMER,
  RankedDriver,
  driverAvailability,
  fetchDriverBookings,
  fetchDrivers,
  fetchQuotes,
  rankDrivers
} from '../lib/drivers'
import { Place } from '../lib/places'

interface DriverPickerProps {
  from?: Place | null
  to?: Place | null
  userId?: string
  selectedId: string | null
  onSelect: (item: RankedDriver | null) => void
  preselectId?: string | null // e.g. coming from a driver's profile
  date?: string // the ride's date/time, to flag drivers already booked then
  time?: string
}

// "Select your driver": drivers IIM Rohtak students have used, best fit for the route first
export function DriverPicker({ from, to, userId, selectedId, onSelect, preselectId, date, time }: DriverPickerProps) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [quotes, setQuotes] = useState<DriverQuote[]>([])
  const [bookings, setBookings] = useState<DriverBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    Promise.all([fetchDrivers(), fetchQuotes(), fetchDriverBookings().catch(() => [])])
      .then(([d, q, b]) => {
        setDrivers(d)
        setQuotes(q)
        setBookings(b)
      })
      .catch(() => setError('Could not load community drivers.'))
      .finally(() => setLoading(false))
  }, [])

  const ranked = useMemo(() => rankDrivers(drivers, quotes, from, to), [drivers, quotes, from, to])

  // Pre-select a driver chosen elsewhere (only once the list has loaded)
  useEffect(() => {
    if (preselectId && !selectedId) {
      const item = ranked.find(r => r.driver.id === preselectId)
      if (item) onSelect(item)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId, ranked.length])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? ranked.filter(r =>
        [r.driver.name, r.driver.vehicle_type, r.driver.vehicle_number].some(v => (v || '').toLowerCase().includes(q))
      )
    : ranked
  const mine = filtered.filter(r => r.driver.added_by_user_id === userId)
  const others = filtered.filter(r => r.driver.added_by_user_id !== userId)
  const ordered = [...mine, ...others]
  const visible = showAll || q ? ordered : ordered.slice(0, 4)

  if (loading) return <p className="py-4 text-center text-sm text-secondary-500">Loading community drivers...</p>
  if (error) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  if (drivers.length === 0) {
    return (
      <p className="rounded-xl bg-secondary-50 px-3 py-3 text-sm text-secondary-600">
        No drivers in the community directory yet. Add yours below and it will help the next student.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {drivers.length > 4 && (
        <div className="flex items-center gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-3 py-2">
          <Search size={16} className="text-secondary-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by driver name or vehicle type"
            className="!border-0 !bg-transparent !p-0 !ring-0 focus:!ring-0"
          />
        </div>
      )}

      {visible.map(item => (
        <DriverCard
          key={item.driver.id}
          item={item}
          mine={item.driver.added_by_user_id === userId}
          selected={item.driver.id === selectedId}
          availability={driverAvailability(bookings, item.driver.id, date, time)}
          onClick={() => onSelect(item.driver.id === selectedId ? null : item)}
        />
      ))}

      {!showAll && !q && ordered.length > visible.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-xl py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50"
        >
          Show all {ordered.length} drivers
        </button>
      )}

      <p className="text-xs text-secondary-500">
        {QUOTE_DISCLAIMER}{' '}
        <Link to="/drivers" className="font-medium text-primary-600 hover:underline">
          Open the driver directory
        </Link>
      </p>
    </div>
  )
}
