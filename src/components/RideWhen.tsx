import { Ride, formatTime, leavesIn, rideDateTime, todayString } from '../lib/rides'

interface RideWhenProps {
  ride: Pick<Ride, 'date' | 'departure_time'>
  size?: 'md' | 'lg'
  extra?: string // shown after "Leaves in ..." on the small line
}

// Date as a little calendar tile, with the departure time right beside it,
// so both can be read at a glance and stay on one line even on small phones.
export function RideWhen({ ride, size = 'md', extra }: RideWhenProps) {
  const when = rideDateTime(ride)
  const today = todayString()
  const tomorrow = todayString(new Date(Date.now() + 86400000))
  const isToday = ride.date === today
  const topLabel = isToday ? 'Today' : ride.date === tomorrow ? 'Tmrw' : when.toLocaleDateString('en-IN', { weekday: 'short' })
  const day = when.getDate()
  const month = when.toLocaleDateString('en-IN', { month: 'short' })
  const sub = [leavesIn(ride), extra].filter(Boolean) as string[]
  const lg = size === 'lg'

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={`flex shrink-0 flex-col items-center justify-center rounded-xl text-center ${
          lg ? 'h-16 w-14' : 'h-14 w-12'
        } ${isToday ? 'bg-primary-600 text-white' : 'border border-primary-200 bg-primary-50 text-primary-800'}`}
        aria-hidden="true"
      >
        <span className="text-[10px] font-semibold uppercase leading-none tracking-wide">{topLabel}</span>
        <span className={`font-bold leading-tight ${lg ? 'text-2xl' : 'text-xl'}`}>{day}</span>
        <span className="text-[10px] font-medium uppercase leading-none">{month}</span>
      </div>
      <div className="min-w-0">
        <p className={`whitespace-nowrap font-bold leading-tight text-secondary-900 ${lg ? 'text-3xl' : 'text-xl'}`}>
          {formatTime(ride.departure_time)}
        </p>
        {/* Screen readers get the full date in words */}
        <span className="sr-only">{when.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        {sub.length > 0 && (
          <p className={`mt-0.5 flex flex-wrap gap-x-1 font-medium text-secondary-500 ${lg ? 'text-sm' : 'text-xs'}`}>
            {sub.map((part, i) => (
              <span key={part} className="whitespace-nowrap">
                {part}
                {i < sub.length - 1 && ' ·'}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}
