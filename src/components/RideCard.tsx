import { useNavigate } from 'react-router-dom'
import { Car, Users } from 'lucide-react'
import {
  Ride,
  formatDateLabel,
  formatRupees,
  formatTime,
  myParticipation,
  pendingRequests,
  seatsLeft,
  shareWhenFull
} from '../lib/rides'

interface RideCardProps {
  ride: Ride
  userId?: string
  pickupKm?: number | null
  dropKm?: number | null
}

export function RideCard({ ride, userId, pickupKm, dropKm }: RideCardProps) {
  const navigate = useNavigate()
  const left = seatsLeft(ride)
  const isMine = ride.creator_id === userId
  const mine = myParticipation(ride, userId)
  const pending = isMine ? pendingRequests(ride).length : 0

  let badge: { text: string; className: string } | null = null
  if (ride.status === 'cancelled') badge = { text: 'Cancelled', className: 'bg-red-100 text-red-700' }
  else if (isMine) badge = { text: 'Your ride', className: 'bg-primary-100 text-primary-700' }
  else if (mine?.status === 'accepted') badge = { text: "You're in", className: 'bg-primary-100 text-primary-700' }
  else if (mine?.status === 'requested') badge = { text: 'Requested', className: 'bg-amber-100 text-amber-800' }
  else if (mine?.status === 'declined') badge = { text: 'Declined', className: 'bg-secondary-100 text-secondary-600' }

  const hints: string[] = []
  if (pickupKm != null) hints.push(pickupKm < 1 ? 'Pickup right near you' : `Pickup ${pickupKm.toFixed(1)} km away`)
  if (dropKm != null) hints.push(dropKm < 1 ? 'Drops at your destination' : `Drop ${dropKm.toFixed(1)} km from yours`)

  return (
    <button
      type="button"
      onClick={() => navigate(`/ride/${ride.id}`)}
      className="w-full rounded-2xl border border-secondary-200 bg-white p-4 text-left shadow-sm transition hover:border-primary-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-secondary-900">{formatTime(ride.departure_time)}</p>
          <p className="text-sm text-secondary-500">{formatDateLabel(ride.date)}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-secondary-900">{formatRupees(shareWhenFull(ride))}</p>
          <p className="text-xs text-secondary-500">per person when full</p>
        </div>
      </div>

      {/* Route */}
      <div className="mt-3 flex gap-3">
        <div className="flex flex-col items-center pt-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />
          <span className="my-1 w-px flex-1 bg-secondary-300" />
          <span className="h-2.5 w-2.5 bg-secondary-900" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-sm font-medium text-secondary-900">{ride.origin}</p>
          <p className="truncate text-sm font-medium text-secondary-900">{ride.destination}</p>
        </div>
      </div>

      {hints.length > 0 && <p className="mt-2 text-xs text-primary-700">{hints.join(' · ')}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {badge && <span className={`rounded-full px-2.5 py-1 font-semibold ${badge.className}`}>{badge.text}</span>}
        {pending > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
            {pending} request{pending > 1 ? 's' : ''} waiting
          </span>
        )}
        {ride.status !== 'cancelled' && (
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
              left > 0 ? 'bg-secondary-100 text-secondary-700' : 'bg-red-50 text-red-700'
            }`}
          >
            <Users size={12} />
            {left > 0 ? `${left} seat${left > 1 ? 's' : ''} left` : 'Full'}
          </span>
        )}
        {ride.vehicle_type && (
          <span className="flex items-center gap-1 rounded-full bg-secondary-100 px-2.5 py-1 font-medium text-secondary-700">
            <Car size={12} />
            {ride.vehicle_type}
          </span>
        )}
        {ride.creator?.name && !isMine && (
          <span className="ml-auto text-secondary-500">
            by {ride.creator.name}
            {ride.creator.course && ` · ${ride.creator.course}${ride.creator.batch ? ` ${ride.creator.batch}` : ''}`}
          </span>
        )}
      </div>
    </button>
  )
}
