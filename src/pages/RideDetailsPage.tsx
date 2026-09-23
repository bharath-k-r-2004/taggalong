import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Car,
  Check,
  ChevronLeft,
  Clock,
  MessageCircle,
  Phone,
  Share2,
  StickyNote,
  UserCircle,
  Users,
  X
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  Participant,
  Ride,
  fetchRide,
  fetchRideContact,
  formatDateLabel,
  formatRupees,
  formatTime,
  isUpcoming,
  myParticipation,
  peopleOnBoard,
  seatsLeft,
  shareIfYouJoin,
  shareWhenFull
} from '../lib/rides'

function personLabel(p?: { name: string | null; course: string | null; batch: string | null } | null) {
  if (!p) return 'Student'
  const tag = p.course ? ` · ${p.course}${p.batch ? ` ${p.batch}` : ''}` : ''
  return `${p.name || 'Student'}${tag}`
}

export function RideDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ride, setRide] = useState<Ride | null>(null)
  const [contact, setContact] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const data = await fetchRide(id)
      setRide(data)
      setError(null)
      // The database only returns the number to the poster and accepted riders
      if (data) setContact(await fetchRideContact(id).catch(() => null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this ride')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    try {
      setBusy(true)
      setError(null)
      const { error: actionError } = await action()
      if (actionError) throw new Error(actionError.message)
      setNotice(success)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!ride) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-secondary-700">{error || 'This ride does not exist or was removed.'}</p>
        <button type="button" onClick={() => navigate('/search')} className="mt-4 font-semibold text-primary-600 hover:underline">
          Browse other rides
        </button>
      </div>
    )
  }

  const isCreator = ride.creator_id === user?.id
  const mine = myParticipation(ride, user?.id)
  const upcoming = isUpcoming(ride)
  const left = seatsLeft(ride)
  const onBoard = peopleOnBoard(ride)
  const accepted = (ride.ride_participants || []).filter(p => p.status === 'accepted')
  const requests = (ride.ride_participants || []).filter(p => p.status === 'requested')
  const canSeeContact = Boolean(contact) && (isCreator || mine?.status === 'accepted')

  const requestToJoin = () =>
    run(
      () =>
        supabase.from('ride_participants').insert({
          ride_id: ride.id,
          user_id: user!.id,
          status: 'requested',
          contribution_amount: Math.ceil(shareIfYouJoin(ride))
        }),
      'Request sent! You will see the contact details once the poster accepts.'
    )

  const withdraw = (p: Participant, leaving: boolean) => {
    if (!window.confirm(leaving ? 'Leave this ride?' : 'Withdraw your request?')) return
    void run(() => supabase.from('ride_participants').delete().eq('id', p.id), leaving ? 'You left the ride.' : 'Request withdrawn.')
  }

  const respond = (p: Participant, status: 'accepted' | 'declined') =>
    run(
      () => supabase.from('ride_participants').update({ status }).eq('id', p.id),
      status === 'accepted' ? `${p.user?.name || 'Student'} is in!` : 'Request declined.'
    )

  const cancelRide = () => {
    if (!window.confirm('Cancel this ride for everyone? This cannot be undone.')) return
    void run(() => supabase.from('rides').update({ status: 'cancelled' }).eq('id', ride.id), 'Ride cancelled.')
  }

  const share = async () => {
    const url = window.location.href
    const text = `Ride on TagAlong: ${ride.origin} → ${ride.destination}, ${formatDateLabel(ride.date)} at ${formatTime(ride.departure_time)}`
    try {
      if (navigator.share) await navigator.share({ title: 'TagAlong ride', text, url })
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setNotice('Link copied. Paste it in your batch group!')
      }
    } catch {
      // user closed the share sheet
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/search'))}
          className="flex items-center gap-1 rounded-full py-1.5 pr-3 text-secondary-700 hover:bg-secondary-100"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <button
          type="button"
          onClick={share}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-secondary-700 hover:bg-secondary-100"
        >
          <Share2 size={16} />
          Share
        </button>
      </div>

      {notice && <div className="mb-3 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">{notice}</div>}
      {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {ride.status === 'cancelled' && (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">This ride was cancelled.</div>
      )}
      {ride.status !== 'cancelled' && !upcoming && (
        <div className="mb-3 rounded-xl bg-secondary-100 px-4 py-3 text-sm text-secondary-700">This ride has already left.</div>
      )}

      {/* Trip summary */}
      <section className="rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-3xl font-bold text-secondary-900">{formatTime(ride.departure_time)}</p>
            <p className="flex items-center gap-1 text-secondary-600">
              <Clock size={14} />
              {formatDateLabel(ride.date)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              left > 0 ? 'bg-primary-100 text-primary-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {left > 0 ? `${left} seat${left > 1 ? 's' : ''} left` : 'Full'}
          </span>
        </div>

        <div className="mt-5 flex gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <span className="h-3 w-3 rounded-full bg-primary-600" />
            <span className="my-1 w-px flex-1 bg-secondary-300" />
            <span className="h-3 w-3 bg-secondary-900" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-secondary-500">Pickup</p>
              <p className="font-semibold text-secondary-900">{ride.origin}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-secondary-500">Drop</p>
              <p className="font-semibold text-secondary-900">{ride.destination}</p>
            </div>
          </div>
        </div>

        {ride.notes && (
          <p className="mt-4 flex gap-2 rounded-xl bg-secondary-50 px-3 py-2 text-sm text-secondary-700">
            <StickyNote size={16} className="mt-0.5 shrink-0 text-secondary-400" />
            {ride.notes}
          </p>
        )}
      </section>

      {/* Fare */}
      <section className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-secondary-900">Fare split</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-secondary-600">Total fare</span>
            <span className="font-semibold">{formatRupees(Number(ride.total_cost))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary-600">People on board now</span>
            <span className="font-semibold">
              {onBoard} of {ride.max_seats}
            </span>
          </div>
          {!isCreator && !mine && left > 0 && (
            <div className="flex justify-between">
              <span className="text-secondary-600">Your share if you join now</span>
              <span className="font-semibold">{formatRupees(shareIfYouJoin(ride))}</span>
            </div>
          )}
          <div className="flex justify-between rounded-xl bg-primary-50 px-3 py-2">
            <span className="font-medium text-primary-800">Each pays when full</span>
            <span className="font-bold text-primary-800">{formatRupees(shareWhenFull(ride))}</span>
          </div>
          <p className="text-xs text-secondary-500">The fare is split equally; your share drops as more people join. Pay the poster directly.</p>
        </div>
      </section>

      {/* People & vehicle */}
      <section className="mt-3 space-y-4 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <UserCircle size={20} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-secondary-500">Posted by</p>
            <p className="font-semibold text-secondary-900">{isCreator ? 'You' : personLabel(ride.creator)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
            <Car size={20} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-secondary-500">Vehicle</p>
            <p className="font-semibold text-secondary-900">
              {ride.vehicle_type || 'Vehicle'}
              {ride.vehicle_number && <span className="ml-2 font-mono text-sm text-secondary-600">{ride.vehicle_number}</span>}
            </p>
            {ride.driver_name && <p className="text-sm text-secondary-600">Driver: {ride.driver_name}</p>}
          </div>
        </div>

        {accepted.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
              <Users size={20} />
            </span>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-secondary-500">Co-travellers</p>
              {accepted.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <span className="text-secondary-900">{p.user_id === user?.id ? 'You' : personLabel(p.user)}</span>
                  {isCreator && upcoming && ride.status !== 'cancelled' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Remove ${p.user?.name || 'this student'} from the ride?`)) void respond(p, 'declined')
                      }}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {canSeeContact && (
          <div className="flex gap-2 pt-1">
            <a
              href={`tel:+91${contact}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-secondary-300 py-2.5 font-semibold text-secondary-800 hover:bg-secondary-50"
            >
              <Phone size={18} />
              Call
            </a>
            <a
              href={`https://wa.me/91${contact}?text=${encodeURIComponent(`Hi! About the TagAlong ride ${ride.origin} → ${ride.destination} on ${formatDateLabel(ride.date)}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 font-semibold text-white hover:opacity-90"
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>
          </div>
        )}
      </section>

      {/* Requests (poster only) */}
      {isCreator && requests.length > 0 && ride.status !== 'cancelled' && (
        <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-2 font-semibold text-amber-900">
            {requests.length} request{requests.length > 1 ? 's' : ''} to join
          </h2>
          {requests.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 border-t border-amber-200 py-2 first:border-0">
              <span className="text-secondary-900">{personLabel(p.user)}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || left === 0 || !upcoming}
                  onClick={() => void respond(p, 'accepted')}
                  className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <Check size={16} /> Accept
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond(p, 'declined')}
                  className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-secondary-700 hover:bg-secondary-100 disabled:opacity-50"
                >
                  <X size={16} /> Decline
                </button>
              </div>
            </div>
          ))}
          {left === 0 && <p className="mt-2 text-xs text-amber-800">The ride is full. Remove someone to accept more.</p>}
        </section>
      )}

      {/* Main action */}
      <div className="sticky bottom-20 mt-4 md:bottom-4">
        {isCreator ? (
          upcoming &&
          ride.status !== 'cancelled' && (
            <button
              type="button"
              disabled={busy}
              onClick={cancelRide}
              className="w-full rounded-xl border border-red-200 bg-white py-3 font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
            >
              Cancel ride
            </button>
          )
        ) : mine?.status === 'accepted' ? (
          <div className="rounded-xl bg-primary-600 p-4 text-white shadow-md">
            <p className="font-semibold">You're in! 🎉</p>
            <p className="text-sm text-primary-100">Contact the poster above to coordinate the pickup.</p>
            {upcoming && (
              <button type="button" disabled={busy} onClick={() => withdraw(mine, true)} className="mt-2 text-sm underline">
                Leave ride
              </button>
            )}
          </div>
        ) : mine?.status === 'requested' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="font-semibold text-amber-900">Request sent</p>
            <p className="text-sm text-amber-800">
              Waiting for {ride.creator?.name || 'the poster'} to accept. Their contact appears here once they do.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => withdraw(mine, false)}
              className="mt-2 text-sm font-medium text-amber-900 underline"
            >
              Withdraw request
            </button>
          </div>
        ) : mine?.status === 'declined' ? (
          <div className="rounded-xl bg-secondary-100 p-4 text-sm text-secondary-700">
            The poster couldn't take you on this ride. Try another one.
          </div>
        ) : (
          upcoming &&
          ride.status !== 'cancelled' && (
            <button
              type="button"
              disabled={busy || left === 0}
              onClick={() => void requestToJoin()}
              className="w-full rounded-xl bg-primary-600 py-3.5 text-lg font-semibold text-white shadow-md hover:bg-primary-700 disabled:opacity-50"
            >
              {left === 0 ? 'Ride is full' : busy ? 'Sending...' : `Request to join · ${formatRupees(shareIfYouJoin(ride))}`}
            </button>
          )
        )}
      </div>
    </div>
  )
}
