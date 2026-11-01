import { Clock } from 'lucide-react'
import { useRouteEstimate } from '../lib/eta'
import { Ride, clockTime, formatDuration, isClosed, rideDateTime } from '../lib/rides'

// "About 2 hr 10 min by road · reaches around 12:15 PM", worked out from the pickup and drop-off the poster entered
export function TripTime({ ride }: { ride: Ride }) {
  const est = useRouteEstimate(
    { lat: ride.origin_lat, lng: ride.origin_lng },
    { lat: ride.destination_lat, lng: ride.destination_lng }
  )
  if (!est || isClosed(ride)) return null
  const arrives = new Date(rideDateTime(ride).getTime() + est.minutes * 60000)
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl bg-secondary-50 px-3 py-2 text-sm text-secondary-700">
      <Clock size={15} className="shrink-0 text-primary-600" />
      <span>
        About <span className="font-semibold text-secondary-900">{formatDuration(est.minutes)}</span> by road · {Math.round(est.km)} km
      </span>
      <span className="text-secondary-400">·</span>
      <span>
        reaches around <span className="font-semibold text-secondary-900">{clockTime(arrives)}</span>
        {!est.routed && <span className="text-secondary-400"> (rough estimate)</span>}
      </span>
    </p>
  )
}
