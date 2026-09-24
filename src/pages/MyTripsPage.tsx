import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { RideCard } from '../components/RideCard'
import { Ride, fetchMyRides, isUpcoming, myParticipation, rideDateTime } from '../lib/rides'

type Tab = 'upcoming' | 'completed' | 'cancelled'

export function MyTripsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('upcoming')

  useEffect(() => {
    if (!user) return
    fetchMyRides(user.id)
      .then(setRides)
      .catch(err => setError(err.message || 'Could not load your trips'))
      .finally(() => setLoading(false))
  }, [user])

  // Which tab a trip belongs to, from my point of view
  const bucket = (r: Ride): Tab | null => {
    const mineP = myParticipation(r, user?.id)
    const isPoster = r.creator_id === user?.id
    if (r.status === 'cancelled' || mineP?.status === 'cancelled') return 'cancelled'
    // requests that were declined, or closed because another ride accepted me, aren't trips
    if (mineP?.status === 'declined' || mineP?.status === 'withdrawn') return null
    if (isUpcoming(r)) return 'upcoming'
    // past trips count as completed only if I was actually on them (and a driver was arranged)
    if (r.status === 'looking') return null
    return isPoster || mineP?.status === 'accepted' ? 'completed' : null
  }
  const upcoming = rides.filter(r => bucket(r) === 'upcoming')
  const completed = rides
    .filter(r => bucket(r) === 'completed')
    .sort((a, b) => rideDateTime(b).getTime() - rideDateTime(a).getTime())
  const cancelled = rides
    .filter(r => bucket(r) === 'cancelled')
    .sort((a, b) => rideDateTime(b).getTime() - rideDateTime(a).getTime())
  const counts: Record<Tab, number> = { upcoming: upcoming.length, completed: completed.length, cancelled: cancelled.length }
  const list = tab === 'upcoming' ? upcoming : tab === 'completed' ? completed : cancelled

  const posted = list.filter(r => r.creator_id === user?.id)
  const joined = list.filter(r => r.creator_id !== user?.id && myParticipation(r, user?.id))

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-secondary-900">My trips</h1>

      <div className="mb-6 inline-flex rounded-xl bg-secondary-100 p-1">
        {(['upcoming', 'completed', 'cancelled'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-600'
            }`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-secondary-300 bg-white px-4 py-10 text-center">
          <p className="text-secondary-700">
            {tab === 'upcoming' ? 'No upcoming trips.' : tab === 'completed' ? 'No completed trips yet.' : 'No cancelled trips.'}
          </p>
          {tab === 'upcoming' && (
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="rounded-xl bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700"
              >
                Find a ride
              </button>
              <button
                type="button"
                onClick={() => navigate('/create-ride')}
                className="rounded-xl border border-secondary-300 px-4 py-2 font-semibold text-secondary-800 hover:bg-secondary-50"
              >
                Post a ride
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {posted.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary-500">Rides you posted</h2>
              <div className="space-y-3">
                {posted.map(r => (
                  <RideCard key={r.id} ride={r} userId={user?.id} />
                ))}
              </div>
            </section>
          )}
          {joined.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary-500">Rides you joined</h2>
              <div className="space-y-3">
                {joined.map(r => (
                  <RideCard key={r.id} ride={r} userId={user?.id} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
