import { useMemo, useState } from 'react'
import { Bus, Clock, IndianRupee, Info, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { CabSlotRow, slotKey, useCampusCabs } from '../components/CampusCabs'
import { CabSchedule, scheduleSummary } from '../lib/campusCabs'
import { drivingMinutes, formatDateLabel, formatDuration, formatRupees, shortPlace, todayString } from '../lib/rides'

const DAYS = 3

const placeOf = (lat: number | null, lng: number | null) => ({ lat, lng })

// Campus cabs: TagAlong cabs leaving IIM Rohtak at set times, by route and day
export function CampusCabsPage() {
  const { user } = useAuth()
  const { schedules, slots, busy, error, book } = useCampusCabs(DAYS)
  const [route, setRoute] = useState<string>('all')
  const dates = useMemo(() => Array.from({ length: DAYS }, (_, i) => todayString(new Date(Date.now() + i * 86400000))), [])
  const [day, setDay] = useState(dates[0])

  const forRoute = (slots || []).filter(s => route === 'all' || s.schedule.id === route)
  const forDay = forRoute.filter(s => s.date === day)
  const countOn = (d: string) => forRoute.filter(s => s.date === d).length

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-secondary-900">
        <Bus size={26} className="text-primary-700" /> Campus cabs
      </h1>
      <p className="mb-5 text-secondary-600">
        TagAlong cabs leave IIM Rohtak at set times. Book a seat, no approval needed. The fare is split among everyone in the cab.
      </p>

      {slots === null ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : schedules.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-secondary-300 bg-white px-4 py-10 text-center text-secondary-500">
          No campus cabs are running right now.
        </p>
      ) : (
        <>
          {/* Routes */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {schedules.map(s => (
              <RouteCard key={s.id} s={s} selected={route === s.id} onClick={() => setRoute(route === s.id ? 'all' : s.id)} />
            ))}
          </div>

          {/* Days */}
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {dates.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${
                  day === d ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-200 bg-white text-secondary-700'
                }`}
              >
                {formatDateLabel(d)} <span className={day === d ? 'text-primary-100' : 'text-secondary-400'}>· {countOn(d)}</span>
              </button>
            ))}
          </div>

          {route !== 'all' && (
            <button type="button" onClick={() => setRoute('all')} className="mb-3 text-sm font-semibold text-primary-600 hover:underline">
              Show all routes
            </button>
          )}

          {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {forDay.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-secondary-300 bg-white px-4 py-8 text-center text-sm text-secondary-500">
              {day === dates[0] ? 'No more cabs today on this route. Check tomorrow.' : 'No cabs on this day.'}
            </p>
          ) : (
            <div className="space-y-2">
              {forDay.map(slot => (
                <CabSlotRow key={slotKey(slot)} slot={slot} userId={user?.id} busy={busy} onBook={s => void book(s)} />
              ))}
            </div>
          )}

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-secondary-100 px-3 py-2 text-xs text-secondary-600">
            <Info size={14} className="mt-0.5 shrink-0" />
            Bookings close 5 minutes before departure. The price shown is each person's share when the cab is full; with fewer
            people it's split among those on board. The driver's name and number appear on your ride page once TagAlong confirms them.
          </p>
        </>
      )}
    </div>
  )
}

function RouteCard({ s, selected, onClick }: { s: CabSchedule; selected: boolean; onClick: () => void }) {
  const minutes = drivingMinutes(placeOf(s.origin_lat, s.origin_lng), placeOf(s.destination_lat, s.destination_lng))
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
        selected ? 'border-primary-600 ring-2 ring-primary-100' : 'border-secondary-200 hover:border-primary-300'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-secondary-500">{shortPlace(s.origin)} to</p>
      <p className="font-bold leading-tight text-secondary-900">{shortPlace(s.destination)}</p>
      <div className="mt-2 space-y-0.5 text-xs text-secondary-600">
        <p className="flex items-center gap-1.5">
          <IndianRupee size={12} /> {formatRupees(Number(s.total_fare) / s.seats)} each when full
        </p>
        <p className="flex items-center gap-1.5">
          <Users size={12} /> {s.vehicle_type} · {s.seats} seats
        </p>
        {minutes !== null && (
          <p className="flex items-center gap-1.5">
            <Clock size={12} /> About {formatDuration(minutes)}
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-secondary-500">{scheduleSummary(s)}</p>
    </button>
  )
}
