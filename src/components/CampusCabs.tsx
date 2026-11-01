import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bus, CheckCircle2, UserCircle, Users } from 'lucide-react'
import { RideWhen } from './RideWhen'
import { CabSchedule, CabSlot, bookCampusCab, fetchCabRides, fetchSchedules, upcomingSlots } from '../lib/campusCabs'
import { formatRupees, myParticipation, shortPlace } from '../lib/rides'
import { friendlyError } from '../lib/errors'

// Schedules + the next few days of departures, and booking
export function useCampusCabs(days = 3) {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<CabSchedule[]>([])
  const [slots, setSlots] = useState<CabSlot[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSchedules(), fetchCabRides()])
      .then(([s, r]) => {
        setSchedules(s)
        setSlots(upcomingSlots(s, r, days))
      })
      .catch(err => {
        setError(friendlyError(err))
        setSlots([])
      })
  }, [days])

  const book = useCallback(
    async (slot: CabSlot) => {
      try {
        setBusy(slotKey(slot))
        setError(null)
        const rideId = await bookCampusCab(slot.schedule.id, slot.date, slot.time)
        navigate(`/ride/${rideId}`, { state: { justPosted: 'cab' } })
      } catch (err) {
        setError(friendlyError(err))
        setBusy(null)
      }
    },
    [navigate]
  )

  return { schedules, slots, busy, error, book }
}

export const slotKey = (s: CabSlot) => `${s.schedule.id}${s.date}${s.time}`

interface CabSlotRowProps {
  slot: CabSlot
  userId?: string
  busy: string | null
  onBook: (slot: CabSlot) => void
}

// One departure: when, route, seats, price, driver, and Book / Booked / Full
export function CabSlotRow({ slot, userId, busy, onBook }: CabSlotRowProps) {
  const navigate = useNavigate()
  const { schedule: s, ride } = slot
  const onBoard = ride ? Math.max(1, ride.current_participants ?? 1) : 0
  const left = s.seats - onBoard
  const mine = ride && (ride.creator_id === userId || myParticipation(ride, userId)?.status === 'accepted')
  const key = slotKey(slot)

  return (
    <div className="rounded-2xl border border-secondary-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <RideWhen ride={{ date: slot.date, departure_time: slot.time }} />
        {mine ? (
          <button
            type="button"
            onClick={() => navigate(`/ride/${ride!.id}`)}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700"
          >
            <CheckCircle2 size={16} /> Booked
          </button>
        ) : left > 0 ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onBook(slot)}
            className="shrink-0 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {busy === key ? 'Booking...' : 'Book seat'}
          </button>
        ) : (
          <span className="shrink-0 rounded-xl bg-secondary-100 px-3 py-2 text-sm font-semibold text-secondary-500">Full</span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-secondary-900">
        {shortPlace(s.origin)} → {shortPlace(s.destination)}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-secondary-600">
        <span>{s.vehicle_type}</span>
        <span className="flex items-center gap-1">
          <Users size={12} /> {left > 0 ? `${left} of ${s.seats} seats left` : 'Full'}
        </span>
        <span>{formatRupees(Number(s.total_fare) / s.seats)} each when full</span>
        <span className="flex items-center gap-1">
          <UserCircle size={12} /> {ride?.driver_name || 'Driver to be confirmed'}
        </span>
      </p>
    </div>
  )
}

// Home: the next few campus cab departures, with a link to the full Campus cabs page
export function CampusCabs({ userId }: { userId?: string }) {
  const { slots, busy, error, book } = useCampusCabs(2)
  if (!slots || slots.length === 0) return null

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-secondary-500">
          <Bus size={18} className="text-primary-700" /> Campus cabs
        </h3>
        <Link to="/campus-cabs" className="text-sm font-semibold text-primary-600 hover:underline">
          All departures
        </Link>
      </div>
      <p className="mb-3 text-sm text-secondary-600">TagAlong cabs leaving campus at set times. Book a seat, no approval needed.</p>
      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="space-y-2">
        {slots.slice(0, 3).map(slot => (
          <CabSlotRow key={slotKey(slot)} slot={slot} userId={userId} busy={busy} onBook={s => void book(s)} />
        ))}
      </div>
      <Link
        to="/campus-cabs"
        className="mt-2 flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50"
      >
        See all departures and routes <ArrowRight size={16} />
      </Link>
    </section>
  )
}
