import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Clock, Plus, Search, UserPlus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { friendlyError } from '../lib/errors'
import { LocationInput } from '../components/LocationInput'
import { DirectoryDriverCard } from '../components/DirectoryDriverCard'
import { Place } from '../lib/places'
import { todayString } from '../lib/rides'
import {
  Driver,
  DriverBooking,
  DriverQuote,
  QUOTE_DISCLAIMER,
  driverAvailability,
  fetchDriverBookings,
  fetchDrivers,
  fetchQuotes,
  rankDrivers
} from '../lib/drivers'

type Filter = 'all' | 'mine'

export function DriversPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const initial =
    (useLocation().state as { from?: Place | null; to?: Place | null; date?: string; time?: string } | null) || {}

  const [from, setFrom] = useState<Place | null>(initial.from || null)
  const [to, setTo] = useState<Place | null>(initial.to || null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [quotes, setQuotes] = useState<DriverQuote[]>([])
  const [bookings, setBookings] = useState<DriverBooking[]>([])
  const [date, setDate] = useState(initial.date || '')
  const [time, setTime] = useState(initial.time || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchDrivers(), fetchQuotes(), fetchDriverBookings().catch(() => [])])
      .then(([d, q, b]) => {
        setDrivers(d)
        setQuotes(q)
        setBookings(b)
      })
      .catch(err => setError(friendlyError(err)))
      .finally(() => setLoading(false))
  }, [])

  const ranked = useMemo(() => rankDrivers(drivers, quotes, from, to), [drivers, quotes, from, to])
  const q = query.trim().toLowerCase()
  const list = ranked.filter(r => {
    if (filter === 'mine' && r.driver.added_by_user_id !== user?.id) return false
    if (!q) return true
    return [r.driver.name, r.driver.vehicle_type, r.driver.vehicle_number].some(v => (v || '').toLowerCase().includes(q))
  })
  const routeGiven = Boolean(from?.name || to?.name)
  const onRoute = routeGiven ? list.filter(r => r.routeQuote) : list
  const others = routeGiven ? list.filter(r => !r.routeQuote) : []
  const mineCount = drivers.filter(d => d.added_by_user_id === user?.id).length
  const noDrivers = !loading && !error && drivers.length === 0
  const addDriver = () => navigate('/drivers/new')
  const card = (item: (typeof list)[number]) => (
    <DirectoryDriverCard
      key={item.driver.id}
      item={item}
      quotes={quotes.filter(x => x.driver_id === item.driver.id)}
      mine={item.driver.added_by_user_id === user?.id}
      availability={driverAvailability(bookings, item.driver.id, date || undefined, time || undefined)}
      onOpen={() => navigate(`/drivers/${item.driver.id}`)}
      onAddFare={() => navigate(`/drivers/${item.driver.id}`, { state: { addQuote: true } })}
    />
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-secondary-900">Community drivers</h1>
        {!noDrivers && (
          <button
            type="button"
            onClick={addDriver}
            className="hidden items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/30 ring-4 ring-primary-100 hover:bg-primary-700 md:flex"
          >
            <Plus size={16} /> Add a driver
          </button>
        )}
      </div>
      <p className="mb-4 text-secondary-600">Drivers IIM Rohtak students have travelled with and recommend.</p>

      {noDrivers ? (
        <section className="flex min-h-[calc(100vh-11rem)] flex-col items-center justify-center md:min-h-[calc(100vh-10rem)] rounded-3xl border-2 border-dashed border-primary-300 bg-gradient-to-b from-primary-50 to-white px-6 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-primary-700 ring-8 ring-primary-50">
            <UserPlus size={38} />
          </span>
          <h2 className="mt-5 text-2xl font-bold text-secondary-900">No drivers yet</h2>
          <p className="mt-2 max-w-md text-secondary-600">
            Know a cab or auto driver you trust? Add them with their number and what they charged, so other students can book them too.
          </p>
          <button
            type="button"
            onClick={addDriver}
            className="mt-6 flex items-center gap-2 rounded-2xl bg-primary-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-primary-600/30 ring-4 ring-primary-100 transition hover:scale-[1.02] hover:bg-primary-700"
          >
            <Plus size={22} /> Add a driver
          </button>
          <p className="mt-3 text-xs text-secondary-500">Takes a minute. Only IIM Rohtak students can see the directory.</p>
        </section>
      ) : (
      <>
      <div className="space-y-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
        <LocationInput label="From" placeholder="Pickup (optional)" value={from} onChange={setFrom} kind="from" allowCurrentLocation />
        <LocationInput label="To" placeholder="Destination (optional)" value={to} onChange={setTo} kind="to" near={from} />
        <div className="flex items-center gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-3 py-2">
          <Search size={16} className="text-secondary-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by driver name, vehicle type or number"
            className="!border-0 !bg-transparent !p-0 !ring-0 focus:!ring-0"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary-500">
              <CalendarDays size={12} className="mr-1 inline" />
              Travel date
            </label>
            <input type="date" value={date} min={todayString()} onChange={e => setDate(e.target.value)} className="!rounded-xl" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary-500">
              <Clock size={12} className="mr-1 inline" />
              Around
            </label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="!rounded-xl" />
          </div>
        </div>
        <p className="-mt-1 text-xs text-secondary-500">
          Add your date and time to see which drivers are already booked through TagAlong then.
        </p>
        <div className="flex gap-2">
          {(['all', 'mine'] as Filter[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                filter === f ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-200 text-secondary-700'
              }`}
            >
              {f === 'all' ? `All drivers (${drivers.length})` : `My drivers (${mineCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary-300 bg-primary-50/40 px-4 py-10 text-center">
            <p className="text-secondary-700">
              {filter === 'mine' ? "You haven't added any drivers yet." : 'No drivers match your search.'}
            </p>
            <button
              type="button"
              onClick={addDriver}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-2.5 font-semibold text-white shadow-md hover:bg-primary-700"
            >
              <Plus size={16} /> Add a driver
            </button>
          </div>
        ) : (
          <>
            {routeGiven && (
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary-500">
                {onRoute.length > 0 ? 'Have driven this route' : 'No recorded quotes for this route yet'}
              </h2>
            )}
            <div className="space-y-3">
              {onRoute.map(card)}
            </div>
            {others.length > 0 && (
              <>
                <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-secondary-500">Other drivers</h2>
                <div className="space-y-3">
                  {others.map(card)}
                </div>
              </>
            )}
            <p className="mt-6 text-xs text-secondary-500">{QUOTE_DISCLAIMER}</p>
          </>
        )}
      </div>
      </>
      )}

      {/* Always-visible shortcut to add a driver */}
      {!noDrivers && (
        <button
          type="button"
          onClick={addDriver}
          aria-label="Add a driver"
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3.5 font-semibold text-white shadow-xl shadow-primary-600/40 ring-4 ring-white transition hover:scale-105 hover:bg-primary-700 md:bottom-8 md:right-8"
        >
          <Plus size={20} /> Add a driver
        </button>
      )}
    </div>
  )
}
