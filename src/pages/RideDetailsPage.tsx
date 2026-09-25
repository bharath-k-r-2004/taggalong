import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Car,
  Check,
  Pencil,
  ChevronLeft,
  Clock,
  HeartHandshake,
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
import { RideChat } from '../components/RideChat'
import { LiveTripPanel } from '../components/LiveTripPanel'
import { Driver, fetchDrivers } from '../lib/drivers'
import { friendlyError } from '../lib/errors'
import {
  CANCEL_REASONS,
  Participant,
  Ride,
  StudentStats,
  ConfirmedRide,
  fetchMyConfirmedRides,
  fetchRide,
  fetchRideContact,
  fetchStudentStats,
  flexibilityLabel,
  formatDateLabel,
  formatRupees,
  formatTime,
  hasFare,
  isLastMinute,
  isTravelGroup,
  myParticipation,
  peopleOnBoard,
  clockTime,
  estimatedArrival,
  needsPosterConfirmation,
  needsRiderConfirmation,
  placeFromRide,
  rideDateTime,
  ridePhase,
  ridesClash,
  seatsLeft,
  shareIfYouJoin,
  shareWhenFull,
  timeAgo
} from '../lib/rides'

function personLabel(p?: { name: string | null; course: string | null; batch: string | null } | null) {
  if (!p) return 'Student'
  const tag = p.course ? ` · ${p.course}${p.batch ? ` ${p.batch}` : ''}` : ''
  return `${p.name || 'Student'}${tag}`
}

const POSTED_MESSAGES: Record<string, string> = {
  ride: 'Ride posted! It is now visible to IIM Rohtak students travelling your way.',
  group: 'Travel request posted! Students going your way can now join your group.',
  converted: 'Driver added. Your group is now a ride and the fare will be split automatically.',
  edited: 'Changes saved. Everyone on the ride can see the new details.'
}

export function RideDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const justPosted = (location.state as { justPosted?: string } | null)?.justPosted

  const [ride, setRide] = useState<Ride | null>(null)
  const [contact, setContact] = useState<string | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [stats, setStats] = useState<Record<string, StudentStats | null>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(justPosted ? POSTED_MESSAGES[justPosted] || null : null)

  // small inline panels
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinMessage, setJoinMessage] = useState('')
  const [myConfirmed, setMyConfirmed] = useState<ConfirmedRide[]>([])
  const [cancelOpen, setCancelOpen] = useState<'leave' | 'ride' | null>(null)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0])

  const load = useCallback(async () => {
    if (!id) return
    try {
      const data = await fetchRide(id)
      setRide(data)
      setError(null)
      if (!data) return
      // The database only returns the number to the poster and accepted riders
      setContact(await fetchRideContact(id).catch(() => null))
      if (user) setMyConfirmed(await fetchMyConfirmedRides(user.id))
      if (data.driver_id) {
        const all = await fetchDrivers().catch(() => [])
        setDriver(all.find(d => d.id === data.driver_id) || null)
      } else {
        setDriver(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this ride')
    } finally {
      setLoading(false)
    }
  }, [id, user])

  useEffect(() => {
    void load()
  }, [load])

  // Poster sees each requester's track record (facts only)
  const isCreator = ride?.creator_id === user?.id
  const requestIds = (ride?.ride_participants || []).filter(p => p.status === 'requested').map(p => p.user_id)
  useEffect(() => {
    if (!isCreator) return
    const missing = requestIds.filter(uid => !(uid in stats))
    if (missing.length === 0) return
    void Promise.all(missing.map(uid => fetchStudentStats(uid).then(s => [uid, s] as const))).then(pairs =>
      setStats(prev => ({ ...prev, ...Object.fromEntries(pairs) }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, requestIds.join(',')])

  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    try {
      setBusy(true)
      setError(null)
      const { error: actionError } = await action()
      if (actionError) throw new Error(actionError.message)
      setNotice(success)
      await load()
    } catch (err) {
      const message = friendlyError(
        err,
        "This ride isn't taking requests any more. It may have just filled up, been cancelled or left. The page now shows the latest."
      )
      setNotice(null)
      await load() // show what changed (e.g. the ride is now full)
      setError(message) // after the refresh, so the refresh doesn't clear it
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

  const mine = myParticipation(ride, user?.id)
  const departed = rideDateTime(ride).getTime() <= Date.now()
  const active = !departed && ride.status !== 'cancelled' // requests, edits, leaving and cancelling
  const phase = ridePhase(ride)
  const group = isTravelGroup(ride)
  const left = seatsLeft(ride)
  const onBoard = peopleOnBoard(ride)
  const accepted = (ride.ride_participants || []).filter(p => p.status === 'accepted')
  const requests = (ride.ride_participants || []).filter(p => p.status === 'requested')
  const isMember = isCreator || mine?.status === 'accepted'
  const clash = isCreator ? undefined : myConfirmed.find(c => c.id !== ride.id && ridesClash(c, ride))
  const canSeeContact = Boolean(contact) && isMember

  const requestToJoin = () =>
    run(
      () =>
        supabase.from('ride_participants').insert({
          ride_id: ride.id,
          user_id: user!.id,
          status: 'requested',
          message: joinMessage.trim() || null,
          contribution_amount: hasFare(ride) ? Math.ceil(shareIfYouJoin(ride)) : null
        }),
      group
        ? 'Request sent! The group introducer will accept you shortly.'
        : "Request sent! You'll see the driver's number once the poster accepts."
    ).then(() => setJoinOpen(false))

  const withdrawRequest = (p: Participant) => {
    if (!window.confirm('Withdraw your request?')) return
    void run(() => supabase.from('ride_participants').delete().eq('id', p.id), 'Request withdrawn.')
  }

  const confirmCancel = () => {
    const now = new Date().toISOString()
    if (cancelOpen === 'leave' && mine) {
      void run(
        () =>
          supabase
            .from('ride_participants')
            .update({ status: 'cancelled', cancel_reason: cancelReason, cancelled_at: now })
            .eq('id', mine.id),
        'You left the ride.'
      ).then(() => setCancelOpen(null))
    } else if (cancelOpen === 'ride') {
      void run(
        () => supabase.from('rides').update({ status: 'cancelled', cancel_reason: cancelReason, cancelled_at: now }).eq('id', ride.id),
        'Ride cancelled.'
      ).then(() => setCancelOpen(null))
    }
  }

  const respond = (p: Participant, status: 'accepted' | 'declined') =>
    run(
      async () => {
        const res = await supabase.from('ride_participants').update({ status }).eq('id', p.id).select('id')
        if (!res.error && (res.data || []).length === 0) {
          // e.g. another poster accepted them a moment earlier, so this request closed itself
          return { error: { message: `${p.user?.name || 'This student'} is no longer waiting; they may have joined another ride.` } }
        }
        return res
      },
      status === 'accepted' ? `${p.user?.name || 'Student'} is in!` : 'Request declined.'
    )

  // Clear a request that closed automatically and ask again (e.g. after leaving the other ride)
  const requestAgain = (p: Participant) =>
    run(() => supabase.from('ride_participants').delete().eq('id', p.id), 'You can send a new request now.').then(() =>
      setJoinOpen(true)
    )

  const addDriverToGroup = () =>
    navigate('/create-ride', {
      state: {
        convertRideId: ride.id,
        from: placeFromRide(ride, 'origin'),
        to: placeFromRide(ride, 'destination'),
        date: ride.date,
        time: ride.departure_time.slice(0, 5),
        seats: ride.max_seats,
        onBoard,
        flex: ride.time_flexibility,
        notes: ride.notes
      }
    })

  const endRide = (happened: boolean) =>
    void run(
      () =>
        supabase
          .from('rides')
          .update(happened ? { status: 'completed' } : { status: 'cancelled', cancel_reason: 'Trip did not happen' })
          .eq('id', ride.id),
      happened ? 'Trip completed. Riders will be asked to confirm they travelled.' : "Marked as not happened. It won't count on anyone's record."
    )

  const confirmTrip = (travelled: boolean) =>
    void run(
      () =>
        supabase
          .from('ride_participants')
          .update(travelled ? { trip_confirmed: true, arrived_at: new Date().toISOString() } : { trip_confirmed: false })
          .eq('id', mine!.id),
      travelled ? 'Glad you made it! Trip confirmed.' : "Noted: you didn't travel on this trip."
    )

  const editRide = () =>
    navigate('/create-ride', {
      state: {
        editRideId: ride.id,
        mode: group ? 'group' : 'driver',
        from: placeFromRide(ride, 'origin'),
        to: placeFromRide(ride, 'destination'),
        date: ride.date,
        time: ride.departure_time.slice(0, 5),
        seats: ride.max_seats,
        onBoard,
        flex: ride.time_flexibility,
        notes: ride.notes,
        fare: ride.total_cost,
        toll: ride.toll_included,
        vehicleType: ride.vehicle_type,
        vehicleNumber: ride.vehicle_number,
        driverName: ride.driver_name,
        driverId: ride.driver_id,
        phone: contact
      }
    })

  const share = async () => {
    const url = window.location.href
    const text = `${group ? 'Travel group' : 'Ride'} on TagAlong: ${ride.origin} → ${ride.destination}, ${formatDateLabel(ride.date)} at ${formatTime(ride.departure_time)}`
    try {
      if (navigator.share) await navigator.share({ title: 'TagAlong', text, url })
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setNotice('Link copied. Paste it in your batch group!')
      }
    } catch {
      // user closed the share sheet
    }
  }

  const cancelPanel = (
    <div className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
      <p className="font-semibold text-secondary-900">
        {cancelOpen === 'ride' ? 'Cancel this ride for everyone?' : 'Leave this ride?'}
      </p>
      <label className="mt-2 block text-sm text-secondary-700">Why?</label>
      <select value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="!rounded-xl !py-2">
        {CANCEL_REASONS.map(r => (
          <option key={r}>{r}</option>
        ))}
      </select>
      {isLastMinute(ride) && (
        <p className="mt-2 text-xs text-amber-700">
          The ride leaves within 2 hours, so this will be recorded as a last-minute cancellation.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={confirmCancel}
          className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {cancelOpen === 'ride' ? 'Cancel ride' : 'Leave ride'}
        </button>
        <button type="button" onClick={() => setCancelOpen(null)} className="flex-1 rounded-xl border border-secondary-300 py-2.5 font-semibold">
          Keep it
        </button>
      </div>
    </div>
  )

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
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          This ride was cancelled{ride.cancel_reason ? ` (${ride.cancel_reason.toLowerCase()})` : ''}.
        </div>
      )}
      {phase === 'in_progress' && isMember && user ? (
        <LiveTripPanel
          ride={ride}
          userId={user.id}
          myName={user.user_metadata?.name || 'A rider'}
          isCreator={isCreator}
          contact={contact}
          busy={busy}
          onEnd={endRide}
          onConfirm={confirmTrip}
        />
      ) : phase === 'completed' ? (
        <div className="mb-3 rounded-xl bg-primary-50 px-4 py-3 text-sm font-medium text-primary-800">
          Trip completed{ride.ended_at ? ` on ${formatDateLabel(ride.ended_at.slice(0, 10))}` : ''}.
        </div>
      ) : (
        ride.status !== 'cancelled' &&
        departed && (
          <div className="mb-3 rounded-xl bg-secondary-100 px-4 py-3 text-sm text-secondary-700">
            This ride has already left (at {formatTime(ride.departure_time)}).
          </div>
        )
      )}

      {/* After the trip: poster who never ended it, or rider who hasn't answered */}
      {needsPosterConfirmation(ride, user?.id) && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            {estimatedArrival(ride)
              ? `This ride should have arrived by ${clockTime(estimatedArrival(ride) as Date)}.`
              : `This ride left at ${formatTime(ride.departure_time)}.`}{' '}
            Did it happen?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => endRide(true)}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Yes, it happened
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => endRide(false)}
              className="rounded-xl border border-secondary-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              No, it didn't
            </button>
          </div>
        </div>
      )}
      {needsRiderConfirmation(ride, user?.id) && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Did you complete this trip?</p>
          <p className="text-sm text-amber-800">It helps keep student records and driver history accurate.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => confirmTrip(true)}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Yes, I travelled
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => confirmTrip(false)}
              className="rounded-xl border border-secondary-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              No, I didn't
            </button>
          </div>
        </div>
      )}

      {/* Travel group banner */}
      {group && ride.status !== 'cancelled' && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-amber-900">
            <Car size={18} /> Looking for a driver
          </p>
          <p className="mt-1 text-sm text-amber-800">
            This group is looking for a reliable driver. Join the group to connect, discuss and finalise a driver together.
          </p>
        </div>
      )}

      {/* Trip summary */}
      <section className="rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-3xl font-bold text-secondary-900">{formatTime(ride.departure_time)}</p>
            <p className="flex items-center gap-1 text-secondary-600">
              <Clock size={14} />
              {formatDateLabel(ride.date)} · {flexibilityLabel(ride.time_flexibility)}
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

      {/* Fare (or group status for travel groups) */}
      {group ? (
        <section className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-secondary-900">Group status</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-secondary-50 p-3">
              <p className="text-xl font-bold text-secondary-900">{onBoard}</p>
              <p className="text-xs text-secondary-500">Students in group</p>
            </div>
            <div className="rounded-xl bg-secondary-50 p-3">
              <p className="font-semibold text-secondary-900">Driver</p>
              <p className="text-xs text-secondary-500">Not added yet</p>
            </div>
            <div className="rounded-xl bg-secondary-50 p-3">
              <p className="font-semibold text-secondary-900">Price</p>
              <p className="text-xs text-secondary-500">To be decided</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {isCreator && active && (
              <button
                type="button"
                onClick={addDriverToGroup}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 font-semibold text-white hover:bg-primary-700"
              >
                Add driver & fare
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                navigate('/drivers', { state: { from: placeFromRide(ride, 'origin'), to: placeFromRide(ride, 'destination') } })
              }
              className="flex-1 rounded-xl border border-secondary-300 px-4 py-2.5 font-semibold text-secondary-800 hover:bg-secondary-50"
            >
              Find a driver
            </button>
          </div>
        </section>
      ) : (
        <section className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-secondary-900">Fare split</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary-600">Total fare</span>
              <span className="font-semibold">
                {formatRupees(Number(ride.total_cost))}
                {ride.toll_included === true && <span className="font-normal text-secondary-500"> · toll included</span>}
                {ride.toll_included === false && <span className="font-normal text-secondary-500"> · toll extra</span>}
              </span>
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
      )}

      {/* People & vehicle */}
      <section className="mt-3 space-y-4 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <UserCircle size={20} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-secondary-500">{group ? 'Introduced by' : 'Posted by'}</p>
            <p className="font-semibold text-secondary-900">{isCreator ? 'You' : personLabel(ride.creator)}</p>
          </div>
        </div>

        {!group && (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
              <Car size={20} />
            </span>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-secondary-500">Vehicle</p>
              <p className="font-semibold text-secondary-900">
                {ride.vehicle_type || 'Vehicle'}
                {ride.vehicle_number && <span className="ml-2 font-mono text-sm text-secondary-600">{ride.vehicle_number}</span>}
              </p>
              {ride.driver_name && <p className="text-sm text-secondary-600">Driver: {ride.driver_name}</p>}
              {driver && (
                <div className="mt-2 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-900">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Users size={14} /> {driver.unique_students} IIM Rohtak student{driver.unique_students === 1 ? '' : 's'} travelled
                    </span>
                    <span className="flex items-center gap-1">
                      <HeartHandshake size={14} /> {driver.vouch_count} vouched
                    </span>
                  </p>
                  <Link to={`/drivers/${driver.id}`} className="mt-1 inline-block font-semibold text-primary-700 hover:underline">
                    View driver profile →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {accepted.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
              <Users size={20} />
            </span>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-secondary-500">
                {group ? 'Students in this group' : 'Co-travellers'}
              </p>
              {accepted.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <span className="text-secondary-900">{p.user_id === user?.id ? 'You' : personLabel(p.user)}</span>
                  {isCreator && active && (
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
          <>
            <p className="-mb-2 text-xs uppercase tracking-wide text-secondary-500">
              Driver{ride.driver_name ? ` · ${ride.driver_name}` : ''} · +91 {contact}
            </p>
            <div className="flex gap-2 pt-1">
              <a
                href={`tel:+91${contact}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-secondary-300 py-2.5 font-semibold text-secondary-800 hover:bg-secondary-50"
              >
                <Phone size={18} />
                Call driver
              </a>
              <a
                href={`https://wa.me/91${contact}?text=${encodeURIComponent(`Hi, I'm a passenger for the ride from ${ride.origin} to ${ride.destination} on ${formatDateLabel(ride.date)} at ${formatTime(ride.departure_time)}.`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 font-semibold text-white hover:opacity-90"
              >
                <MessageCircle size={18} />
                WhatsApp driver
              </a>
            </div>
          </>
        )}
      </section>

      {/* Requests (poster only) */}
      {isCreator && requests.length > 0 && ride.status !== 'cancelled' && (
        <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-2 font-semibold text-amber-900">
            {requests.length} request{requests.length > 1 ? 's' : ''} to join
          </h2>
          {requests.map(p => {
            const s = stats[p.user_id]
            return (
              <div key={p.id} className="border-t border-amber-200 py-3 first:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-secondary-900">{personLabel(p.user)}</p>
                    <p className="text-xs text-secondary-600">
                      Verified IIM Rohtak student · requested {timeAgo(p.joined_at)}
                    </p>
                    {s && (
                      <p className="text-xs text-secondary-600">
                        Completed trips: {s.completed_trips} · Last-minute cancellations: {s.last_minute_cancellations}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy || left === 0 || departed}
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
                {p.message && (
                  <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm italic text-secondary-700">"{p.message}"</p>
                )}
              </div>
            )
          })}
          {left === 0 && <p className="mt-2 text-xs text-amber-800">The ride is full. Remove someone to accept more.</p>}
        </section>
      )}

      {/* Group chat for the poster and confirmed travellers */}
      {isMember && user && ride.status !== 'cancelled' && <RideChat rideId={ride.id} userId={user.id} />}

      {/* Main action */}
      <div className="sticky bottom-20 mt-4 md:bottom-4">
        {cancelOpen ? (
          cancelPanel
        ) : isCreator ? (
          active && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={editRide}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-secondary-300 bg-white py-3 font-semibold text-secondary-800 shadow-sm hover:bg-secondary-50 disabled:opacity-50"
              >
                <Pencil size={16} /> Edit ride
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelOpen('ride')}
                className="flex-1 rounded-xl border border-red-200 bg-white py-3 font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
              >
                Cancel ride
              </button>
            </div>
          )
        ) : ride.status === 'cancelled' ? (
          mine && (
            <div className="rounded-xl bg-secondary-100 p-4 text-sm text-secondary-700">
              This ride was cancelled by the poster. Look for another ride going your way.
            </div>
          )
        ) : departed ? (
          mine?.status === 'accepted' ? (
            phase === 'in_progress' || needsRiderConfirmation(ride, user?.id) ? null : mine.trip_confirmed === false ? (
              <div className="rounded-xl bg-secondary-100 p-4 text-sm text-secondary-700">You marked that you didn't travel on this trip.</div>
            ) : (
              <div className="rounded-xl bg-primary-50 p-4 text-sm text-primary-800">Trip completed. Thanks for travelling together!</div>
            )
          ) : mine?.status === 'requested' ? (
            <div className="rounded-xl bg-secondary-100 p-4 text-sm text-secondary-700">
              The ride left before your request was accepted.
            </div>
          ) : null
        ) : mine?.status === 'accepted' ? (
          <div className="rounded-xl bg-primary-600 p-4 text-white shadow-md">
            <p className="font-semibold">You're in! 🎉</p>
            <p className="text-sm text-primary-100">
              {group
                ? 'Use the group chat above to agree on a driver together.'
                : 'Call or WhatsApp the driver above to confirm the pickup.'}
            </p>
            {active && (
              <button type="button" disabled={busy} onClick={() => setCancelOpen('leave')} className="mt-2 text-sm underline">
                Leave ride
              </button>
            )}
          </div>
        ) : mine?.status === 'requested' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="font-semibold text-amber-900">Request sent</p>
            <p className="text-sm text-amber-800">
              Waiting for {ride.creator?.name || 'the poster'} to accept.
              {!group && " The driver's number appears here once they do."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => withdrawRequest(mine)}
              className="mt-2 text-sm font-medium text-amber-900 underline"
            >
              Withdraw request
            </button>
          </div>
        ) : mine?.status === 'declined' ? (
          <div className="rounded-xl bg-secondary-100 p-4 text-sm text-secondary-700">
            The poster couldn't take you on this ride. Try another one.
          </div>
        ) : mine?.status === 'cancelled' ? (
          <div className="rounded-xl bg-secondary-100 p-4 text-sm text-secondary-700">You left this ride.</div>
        ) : mine?.status === 'withdrawn' ? (
          <div className="rounded-xl bg-secondary-100 p-4 text-sm text-secondary-700">
            <p className="font-semibold text-secondary-900">You joined another ride</p>
            <p>
              Another poster accepted you for a ride around this time, so this request was withdrawn automatically.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {mine.withdrawn_for && (
                <Link to={`/ride/${mine.withdrawn_for}`} className="font-semibold text-primary-700 hover:underline">
                  View your ride →
                </Link>
              )}
              {active && !clash && (
                <button type="button" disabled={busy} onClick={() => void requestAgain(mine)} className="font-semibold underline">
                  Request this ride again
                </button>
              )}
            </div>
          </div>
        ) : active && clash ? (
          <div className="rounded-xl border border-secondary-200 bg-white p-4 text-sm text-secondary-700 shadow-sm">
            <p className="font-semibold text-secondary-900">You're already confirmed on another ride around this time</p>
            <p>
              {formatDateLabel(clash.date)}, {formatTime(clash.departure_time)}: {clash.origin} → {clash.destination}. Leave that
              ride first if you'd rather take this one.
            </p>
            <Link to={`/ride/${clash.id}`} className="mt-2 inline-block font-semibold text-primary-700 hover:underline">
              View your ride →
            </Link>
          </div>
        ) : (
          active &&
          (joinOpen ? (
            <div className="rounded-xl border border-secondary-200 bg-white p-4 shadow-md">
              <label className="mb-1 block text-sm font-medium text-secondary-700">
                Message to {ride.creator?.name?.split(' ')[0] || 'the poster'} <span className="font-normal text-secondary-400">(optional)</span>
              </label>
              <textarea
                value={joinMessage}
                onChange={e => setJoinMessage(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Hi, I would like to join this ride."
                className="!rounded-xl"
              />
              <p className="mt-2 text-xs text-secondary-500">
                You join only after {ride.creator?.name?.split(' ')[0] || 'the poster'} accepts. You can request several rides; once
                one accepts you, your other requests around this time are withdrawn automatically.
              </p>
              {!group && hasFare(ride) && (
                <p className="mt-2 text-xs text-secondary-500">
                  Total fare {formatRupees(Number(ride.total_cost))} is split equally among everyone on board. Your share if accepted now:{' '}
                  {formatRupees(shareIfYouJoin(ride))}.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void requestToJoin()}
                  className="flex-1 rounded-xl bg-primary-600 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {busy ? 'Sending...' : 'Send request'}
                </button>
                <button type="button" onClick={() => setJoinOpen(false)} className="rounded-xl border border-secondary-300 px-4 font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                disabled={busy || left === 0}
                onClick={() => setJoinOpen(true)}
                className="w-full rounded-xl bg-primary-600 py-3.5 text-lg font-semibold text-white shadow-md hover:bg-primary-700 disabled:opacity-50"
              >
                {left === 0
                  ? 'Ride is full'
                  : group
                  ? 'Request to join group'
                  : `Request to join · ${formatRupees(shareIfYouJoin(ride))}`}
              </button>
              {left > 0 && (
                <p className="mt-1.5 text-center text-xs text-secondary-500">
                  Your request goes to {ride.creator?.name?.split(' ')[0] || 'the poster'}. You join only after they accept.
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
