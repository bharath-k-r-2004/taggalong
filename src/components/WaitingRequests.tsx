import { useNavigate } from 'react-router-dom'
import { BellRing, ChevronRight } from 'lucide-react'
import { Ride, clockTime, formatDateLabel, formatDuration, formatTime, shortPlace, waitingForReply } from '../lib/rides'

// Reminder for posters: students are waiting for an answer, and requests close 30 minutes before departure
export function WaitingRequests({ rides, userId }: { rides: Ride[]; userId?: string }) {
  const navigate = useNavigate()
  const waiting = waitingForReply(rides, userId)
  if (waiting.length === 0) return null
  const total = waiting.reduce((n, w) => n + w.requests.length, 0)
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <h2 className="flex items-center gap-2 font-bold text-amber-900">
        <BellRing size={18} /> {total} {total === 1 ? 'student is' : 'students are'} waiting for your reply
      </h2>
      <ul className="mt-2 divide-y divide-amber-200">
        {waiting.map(({ ride, requests, closesAt }) => {
          const mins = Math.max(0, Math.round((closesAt.getTime() - Date.now()) / 60000))
          return (
            <li key={ride.id}>
              <button type="button" onClick={() => navigate(`/ride/${ride.id}`)} className="flex w-full items-center gap-2 py-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-secondary-900">
                    {shortPlace(ride.origin)} → {shortPlace(ride.destination)}
                  </span>
                  <span className="block text-xs text-secondary-700">
                    {formatDateLabel(ride.date)}, {formatTime(ride.departure_time)} · {requests.length} request{requests.length > 1 ? 's' : ''}
                  </span>
                  <span className={`block text-xs font-medium ${mins <= 60 ? 'text-red-700' : 'text-amber-800'}`}>
                    Reply by {clockTime(closesAt)} ({mins <= 0 ? 'closing now' : `in ${formatDuration(mins)}`})
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-amber-700" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
