import { CalendarClock, CheckCircle2, ChevronRight, UserCircle, Users, HeartHandshake } from 'lucide-react'
import { Availability, RankedDriver } from '../lib/drivers'
import { formatRupees, shortPlace } from '../lib/rides'

interface DriverCardProps {
  item: RankedDriver
  onClick: () => void
  selected?: boolean
  mine?: boolean
  availability?: Availability | null // already booked through TagAlong
}

export function DriverCard({ item, onClick, selected, mine, availability }: DriverCardProps) {
  const { driver, routeQuote, latestQuote } = item
  const quote = routeQuote || latestQuote

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${
        selected ? 'border-primary-500 ring-2 ring-primary-100' : 'border-secondary-200 hover:border-primary-300'
      }`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <UserCircle size={28} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold text-secondary-900">{driver.name}</span>
          {availability && (
            <span
              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                availability.level === 'clash' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
              }`}
            >
              <CalendarClock size={11} /> {availability.badge}
            </span>
          )}
          {mine && (
            <span className="shrink-0 rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold text-secondary-600">
              Added by you
            </span>
          )}
        </span>
        <span className="block truncate text-sm text-secondary-600">
          {driver.vehicle_type || 'Vehicle not added'}
          {driver.seats ? ` · ${driver.seats} seats` : ''}
        </span>
        {quote && (
          <span className="block truncate text-sm font-medium text-secondary-800">
            {formatRupees(Number(quote.quoted_price))}{' '}
            <span className="font-normal text-secondary-500">
              ({shortPlace(quote.origin)} → {shortPlace(quote.destination)})
              {routeQuote ? ' · your route' : ''}
            </span>
          </span>
        )}
        {availability && (
          <span className={`mt-0.5 block text-xs ${availability.level === 'clash' ? 'text-red-700' : 'text-amber-800'}`}>
            {availability.detail}
          </span>
        )}
        <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-secondary-500">
          <span className="flex items-center gap-1">
            <Users size={12} /> {driver.unique_students} student{driver.unique_students === 1 ? '' : 's'} travelled
          </span>
          <span className="flex items-center gap-1">
            <HeartHandshake size={12} /> {driver.vouch_count} vouched
          </span>
        </span>
      </span>

      {selected ? (
        <CheckCircle2 size={22} className="shrink-0 text-primary-600" />
      ) : (
        <ChevronRight size={20} className="shrink-0 text-secondary-400" />
      )}
    </button>
  )
}
