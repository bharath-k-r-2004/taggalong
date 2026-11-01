import { BadgeCheck, CalendarClock, Car, ChevronRight, HeartHandshake, IndianRupee, Phone, Plus, UserCircle, Users } from 'lucide-react'
import { Availability, DriverQuote, RankedDriver, introducedBy } from '../lib/drivers'
import { formatRupees, shortPlace } from '../lib/rides'

const HOW_KNOWN: Record<string, string> = {
  travelled: 'Travelled with them',
  know: 'Knows them personally',
  recommended: 'Recommended by a student',
  other: 'Added by a student'
}

const place = (p: string) => (/^IIM Rohtak/i.test(p) ? 'IIM Rohtak' : shortPlace(p))

const maskPhone = (p?: string | null) => (p && p.length === 10 ? `+91 ${p.slice(0, 2)}••• ••${p.slice(-3)}` : null)

// Latest price for each route this driver has been quoted for (quotes arrive newest first)
function fares(quotes: DriverQuote[], limit = 3): DriverQuote[] {
  const seen = new Set<string>()
  const out: DriverQuote[] = []
  for (const q of quotes) {
    const key = `${shortPlace(q.origin)}→${shortPlace(q.destination)}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(q)
    if (out.length === limit) break
  }
  return out
}

interface Props {
  item: RankedDriver
  quotes: DriverQuote[] // this driver's quotes, newest first
  mine?: boolean
  availability?: Availability | null
  onOpen: () => void
  onAddFare: () => void
}

// A driver in the community directory: who they are, how students know them, and what they charge
export function DirectoryDriverCard({ item, quotes, mine, availability, onOpen, onAddFare }: Props) {
  const { driver, routeQuote } = item
  const list = fares(routeQuote ? [routeQuote, ...quotes.filter(q => q.id !== routeQuote.id)] : quotes)
  const phone = maskPhone(driver.phone)

  return (
    <article className="overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-sm transition hover:border-primary-300 hover:shadow-md">
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <UserCircle size={28} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words text-lg font-semibold text-secondary-900">{driver.name}</span>
            {mine && <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold text-secondary-600">Added by you</span>}
            {availability && (
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  availability.level === 'clash' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                }`}
              >
                <CalendarClock size={11} /> {availability.badge}
              </span>
            )}
          </span>

          {/* Credentials */}
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary-700">
            <span className="flex items-center gap-1">
              <Car size={14} className="text-secondary-400" />
              {driver.vehicle_type || 'Vehicle not added'}
              {driver.vehicle_number && <span className="font-mono text-xs text-secondary-500">{driver.vehicle_number}</span>}
            </span>
            {driver.seats ? (
              <span className="flex items-center gap-1">
                <Users size={14} className="text-secondary-400" /> {driver.seats} seats
              </span>
            ) : null}
            {phone && (
              <span className="flex items-center gap-1">
                <Phone size={14} className="text-secondary-400" /> {phone}
              </span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary-500">
            <span className="flex items-center gap-1">
              <BadgeCheck size={12} className="text-primary-600" /> {HOW_KNOWN[driver.relationship || 'other'] || HOW_KNOWN.other} · {introducedBy(driver)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} /> {driver.unique_students} student{driver.unique_students === 1 ? '' : 's'} travelled
            </span>
            <span className="flex items-center gap-1">
              <HeartHandshake size={12} /> {driver.vouch_count} vouched
            </span>
          </span>
          {availability && (
            <span className={`mt-1 block text-xs ${availability.level === 'clash' ? 'text-red-700' : 'text-amber-800'}`}>{availability.detail}</span>
          )}
        </span>
        <ChevronRight size={20} className="mt-3 shrink-0 text-secondary-400" />
      </button>

      {/* What it costs */}
      <div className="border-t border-secondary-100 bg-secondary-50/60 px-4 py-3">
        <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-secondary-500">
          <IndianRupee size={12} /> What it costs
        </p>
        {list.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-secondary-500">No fares shared yet.</span>
            <button type="button" onClick={onAddFare} className="flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
              <Plus size={14} /> Add what you paid
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {list.map(q => {
              const price = Number(q.quoted_price)
              const each = driver.seats && driver.seats > 1 ? Math.ceil(price / driver.seats) : null
              return (
                <li key={q.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="min-w-0 text-secondary-700">
                    {place(q.origin)} → {place(q.destination)}
                    {routeQuote?.id === q.id && <span className="ml-1.5 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">Your route</span>}
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="font-bold text-secondary-900">{formatRupees(price)}</span>
                    {each && <span className="text-xs text-secondary-500"> · {formatRupees(each)} each if {driver.seats} share</span>}
                    {q.toll_included === true && <span className="text-xs text-secondary-500"> · toll incl.</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </article>
  )
}
