import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Car, Search, UserCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { RideCard } from '../components/RideCard'
import { Ride, fetchUpcomingRides, isJoinable, myParticipation, seatsLeft } from '../lib/rides'
import { friendlyError } from '../lib/errors'

export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUpcomingRides()
      .then(setRides)
      .catch(err => setError(friendlyError(err)))
      .finally(() => setLoading(false))
  }, [])

  const name = user?.user_metadata?.name
  const course = user?.user_metadata?.course
  const batch = user?.user_metadata?.batch

  // My next trip: a ride I posted, or one I asked to join
  const myNext = rides.find(r => {
    if (r.creator_id === user?.id) return true
    const p = myParticipation(r, user?.id)
    return p?.status === 'accepted' || p?.status === 'requested'
  })

  // Rides from others that still have seats
  const leavingSoon = rides
    .filter(r => r.creator_id !== user?.id && seatsLeft(r) > 0 && r.id !== myNext?.id && isJoinable(r))
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-3xl">
      {/* Greeting */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-5 pb-16 pt-8 text-white md:rounded-b-3xl">
        <p className="text-primary-100">Hey {name || 'there'} 👋</p>
        <h1 className="mt-1 text-3xl font-bold">Where are you headed?</h1>
        {course && (
          <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-sm">
            {course}
            {batch && ` · Batch ${batch}`}
          </span>
        )}
      </div>

      {/* The two main choices */}
      <div className="-mt-10 grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="group rounded-2xl border border-secondary-200 bg-white p-5 text-left shadow-md transition hover:border-primary-400 hover:shadow-lg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Search size={26} />
          </span>
          <h2 className="mt-3 text-lg font-bold text-secondary-900">Find a ride</h2>
          <p className="mt-1 text-sm text-secondary-600">
            See every ride students have posted and join one going your way.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
            Browse rides <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/create-ride')}
          className="group rounded-2xl border border-secondary-200 bg-white p-5 text-left shadow-md transition hover:border-primary-400 hover:shadow-lg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-900 text-white">
            <Car size={26} />
          </span>
          <h2 className="mt-3 text-lg font-bold text-secondary-900">I have a driver</h2>
          <p className="mt-1 text-sm text-secondary-600">
            Booked a cab or driving yourself? Post your ride and split the fare.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
            Post a ride <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>

      {/* Community drivers */}
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => navigate('/drivers')}
          className="flex w-full items-center gap-3 rounded-2xl border border-secondary-200 bg-white p-4 text-left shadow-sm transition hover:border-primary-400"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <UserCheck size={22} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-secondary-900">Find a driver</span>
            <span className="block text-sm text-secondary-600">Drivers IIM Rohtak students have travelled with, with recent route prices.</span>
          </span>
          <ArrowRight size={18} className="text-primary-600" />
        </button>
      </div>

      <div className="space-y-6 px-4 py-6">
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {myNext && (
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-secondary-500">Your next trip</h3>
            <RideCard ride={myNext} userId={user?.id} />
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary-500">Leaving soon</h3>
            <Link to="/search" className="text-sm font-semibold text-primary-600 hover:underline">
              See all
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
          ) : leavingSoon.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-secondary-300 bg-white px-4 py-8 text-center">
              <p className="text-secondary-600">No open rides yet.</p>
              <button
                type="button"
                onClick={() => navigate('/create-ride')}
                className="mt-2 text-sm font-semibold text-primary-600 hover:underline"
              >
                Be the first to post one
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {leavingSoon.map(ride => (
                <RideCard key={ride.id} ride={ride} userId={user?.id} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
