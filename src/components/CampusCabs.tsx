import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, CheckCircle2, Users } from 'lucide-react'
import { RideWhen } from './RideWhen'
import { CabSlot, bookCampusCab, fetchCabRides, fetchSchedules, upcomingSlots } from '../lib/campusCabs'
import { formatRupees, myParticipation, shortPlace } from '../lib/rides'
import { friendlyError } from '../lib/errors'

// "Campus cabs": TagAlong cabs leaving campus at set times. Students book a seat directly.
export function CampusCabs({ userId }: { userId?: string }) {
  const navigate = useNavigate()
  const [slots, setSlots] = useState<CabSlot[] | null>(null)
  const [dest, setDest] = useState<string>('all')
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSchedules(), fetchCabRides()])
      .then(([s, r]) => setSlots(upcomingSlots(s, r)))
      .catch(() => setSlots([]))
  }, [])

  const destinations = useMemo(() => [...new Set((slots || []).map(s => s.schedule.destination))], [slots])
  if (!slots || slots.length === 0) return null

  const filtered = dest === 'all' ? slots : slots.filter(s => s.schedule.destination === dest)
  const visible = showAll ? filtered.slice(0, 24) : filtered.slice(0, 4)

  const book = async (slot: CabSlot) => {
    const key = `${slot.schedule.id}${slot.date}${slot.time}`
    try {
      setBusy(key)
      setError(null)
      const rideId = await bookCampusCab(slot.schedule.id, slot.date, slot.time)
      navigate(`/ride/${rideId}`, { state: { justPosted: 'cab' } })
    } catch (err) {
      setError(friendlyError(err))
      setBusy(null)
    }
  }

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <Bus size={18} className="text-primary-700" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary-500">Campus cabs</h3>
      </div>
      <p className="mb-3 text-sm text-secondary-600">TagAlong cabs leaving campus at set times. Book a seat, no approval needed.</p>

      {destinations.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {['all', ...destinations].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDest(d)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                dest === d ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-200 bg-white text-secondary-700'
              }`}
            >
              {d === 'all' ? 'All' : shortPlace(d)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {visible.map(slot => {
          const { schedule: s, ride } = slot
          const key = `${s.id}${slot.date}${slot.time}`
          const onBoard = ride ? Math.max(1, ride.current_participants ?? 1) : 0
          const left = s.seats - onBoard
          const mine = ride && (ride.creator_id === userId || myParticipation(ride, userId)?.status === 'accepted')
          return (
            <div key={key} className="rounded-2xl border border-secondary-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
              <RideWhen ride={{ date: slot.date, departure_time: slot.time }} />
              {mine ? (
                <button
                  type="button"
                  onClick={() => navigate(`/ride/${ride!.id}`)}
                  className="flex items-center gap-1 rounded-xl bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700"
                >
                  <CheckCircle2 size={16} /> Booked
                </button>
              ) : left > 0 ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void book(slot)}
                  className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {busy === key ? 'Booking...' : 'Book seat'}
                </button>
              ) : (
                <span className="rounded-xl bg-secondary-100 px-3 py-2 text-sm font-semibold text-secondary-500">Full</span>
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
              </p>
            </div>
          )
        })}
      </div>

      {filtered.length > visible.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 w-full rounded-xl py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50"
        >
          Show more departures
        </button>
      )}
    </section>
  )
}
