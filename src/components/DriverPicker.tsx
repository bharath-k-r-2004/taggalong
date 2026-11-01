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
import { Place, distanceKm } from '../lib/places'

interface DriverPickerProps {
  from?: Place | null
  to?: Place | null
  userId?: string
  selectedId: string | null
  onSelect: (item: RankedDriver | null) => void
  preselectId?: string | null // e.g. coming from a driver's profile
  date?: string // the ride's date/time, to flag drivers already booked then
  time?: string
  // Auto-assign: report the best available driver for this route whenever it changes
  onAutoBest?: (item: RankedDriver | null) => void
  selectedTag?: string // label on the selected card, e.g. "Auto-assigned"
}

// How far a recorded trip's ends are from the ride being posted (km; unknown counts as far)
function quoteOffsetKm(q: DriverQuote, from: Place, to: Place): number {
  const a = distanceKm({ lat: q.origin_lat, lng: q.origin_lng }, from)
  const b = distanceKm({ lat: q.destination_lat, lng: q.destination_lng }, to)
  return (a ?? 50) + (b ?? 50)
}

// The driver to assign automatically: has a recorded price for this route (so the fare
// is known) and isn't booked through TagAlong close to this time. Among those, the most
// trusted (students travelled + vouches); if equally trusted, the one whose recorded
// trip is closest to this one (e.g. a T1 price beats a T3 price for a T1 ride).
export function bestAvailableDriver(
  ranked: RankedDriver[],
  bookings: DriverBooking[],
  from?: Place | null,
  to?: Place | null,
  date?: string,
  time?: string
): RankedDriver | null {
  if (!from?.name || !to?.name) return null
  const free = ranked.filter(r => r.routeQuote && driverAvailability(bookings, r.driver.id, date, time)?.level !== 'clash')
  const trust = (r: RankedDriver) => r.driver.unique_students + r.driver.vouch_count
  return (
    free.sort(
      (a, b) => trust(b) - trust(a) || quoteOffsetKm(a.routeQuote!, from, to) - quoteOffsetKm(b.routeQuote!, from, to)
    )[0] || null
  )
}

// "Select your driver": drivers IIM Rohtak students have used, best fit for the route first
export function DriverPicker({
  from,
  to,
  userId,
  selectedId,
  onSelect,
  preselectId,
  date,
  time,
  onAutoBest,
  selectedTag
}: DriverPickerProps) {
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

  const best = useMemo(() => bestAvailableDriver(ranked, bookings, from, to, date, time), [ranked, bookings, from, to, date, time])
  useEffect(() => {
    if (!loading && onAutoBest) onAutoBest(best)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, best?.driver.id, best?.routeQuote?.id])

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
  // the chosen driver always shows first, then drivers you added, then everyone else
  const ordered = [...mine, ...others].sort((a, b) => Number(b.driver.id === selectedId) - Number(a.driver.id === selectedId))
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
          tag={item.driver.id === selectedId ? selectedTag : undefined}
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
