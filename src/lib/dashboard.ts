// Admin dashboard: every metric is worked out here from the raw facts the database
// returns (admin_dashboard), for the period the admin picks. One definition per number.
import { supabase } from './supabase'
import { rideDateTime, shortPlace, todayString } from './rides'

export interface DRide {
  id: string
  created_at: string
  date: string
  departure_time: string
  origin: string
  destination: string
  status: string
  total_cost: number | null
  max_seats: number
  current_participants: number | null
  schedule_id: string | null
  driver_id: string | null
  creator_id: string
  vehicle_type: string | null
}
export interface DParticipant {
  ride_id: string
  user_id: string
  status: string
  joined_at: string | null
  cancelled_at: string | null
  trip_confirmed: boolean | null
}
export interface DUser {
  id: string
  created_at: string
  course: string | null
  batch: string | null
}
export interface DDriver {
  id: string
  name: string
  created_at: string
  placeholder: boolean
  vehicle_type: string | null
  quotes: number
}
export interface DRating {
  ride_id: string
  user_id: string
  rating: number
  created_at: string
}
export interface DashboardData {
  generated_at: string
  rides: DRide[]
  participants: DParticipant[]
  users: DUser[]
  drivers: DDriver[]
  ratings: DRating[]
  messages: { day: string; n: number }[]
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('admin_dashboard')
  if (error) throw error
  return data as DashboardData
}

// ---------- periods ----------

export type RangeKey = '7d' | '30d' | '90d' | 'all'
export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null }
]

export interface Period {
  start: number // ms
  end: number // ms (now)
  prevStart: number | null // the same length just before, for "vs previous period"
}

export function periodFor(range: RangeKey, data: DashboardData, now = Date.now()): Period {
  const days = RANGES.find(r => r.key === range)?.days ?? null
  if (days === null) {
    const first = Math.min(
      now,
      ...data.users.map(u => new Date(u.created_at).getTime()),
      ...data.rides.map(r => new Date(r.created_at).getTime())
    )
    return { start: first, end: now, prevStart: null }
  }
  const len = days * 86400000
  return { start: now - len, end: now, prevStart: now - 2 * len }
}

const within = (t: number, a: number, b: number) => t >= a && t < b

// ---------- per-ride facts ----------

// Most trips start at campus, so keep its name short in charts
const placeName = (p: string) => (/^IIM Rohtak/i.test(p) ? 'Campus' : shortPlace(p))

export type Outcome = 'completed' | 'booked' | 'open' | 'cancelled' | 'expired'
export const OUTCOME_LABELS: Record<Outcome, string> = {
  completed: 'Completed',
  booked: 'Booked (on its way or upcoming)',
  open: 'Waiting for riders',
  cancelled: 'Cancelled',
  expired: 'Expired, nobody joined'
}

export interface RideFact {
  ride: DRide
  when: number // departure, ms
  accepted: number // students who joined (besides the poster)
  riders: number // everyone on board
  booked: boolean // at least one other student joined, or a campus cab seat was booked
  outcome: Outcome
  fare: number // total fare of the cab, ₹ (0 if not set)
  route: string
  hour: number
  campusCab: boolean
  rating: number | null // average of the ratings for this trip
}

export function rideFacts(data: DashboardData): RideFact[] {
  const acc = new Map<string, number>()
  for (const p of data.participants) if (p.status === 'accepted') acc.set(p.ride_id, (acc.get(p.ride_id) || 0) + 1)
  const ratings = new Map<string, number[]>()
  for (const r of data.ratings) ratings.set(r.ride_id, [...(ratings.get(r.ride_id) || []), r.rating])

  return data.rides.map(ride => {
    const accepted = acc.get(ride.id) || 0
    const campusCab = Boolean(ride.schedule_id)
    const booked = ride.status === 'completed' || accepted > 0 || (campusCab && ride.status !== 'cancelled' && ride.status !== 'expired')
    const outcome: Outcome =
      ride.status === 'completed'
        ? 'completed'
        : ride.status === 'cancelled'
        ? 'cancelled'
        : ride.status === 'expired'
        ? 'expired'
        : booked
        ? 'booked'
        : 'open'
    const rs = ratings.get(ride.id)
    return {
      ride,
      when: rideDateTime(ride).getTime(),
      accepted,
      riders: Math.max(1, ride.current_participants ?? 1),
      booked,
      outcome,
      fare: Number(ride.total_cost) || 0,
      route: `${placeName(ride.origin)} → ${placeName(ride.destination)}`,
      hour: Number(ride.departure_time.slice(0, 2)),
      campusCab,
      rating: rs ? rs.reduce((a, b) => a + b, 0) / rs.length : null
    }
  })
}

// ---------- the metrics ----------

export interface Metrics {
  // business
  posted: number
  booked: number
  completed: number
  matchRate: number | null // booked / posted
  occupancy: number | null // riders / seats on booked rides
  avgRiders: number | null
  cancelRate: number | null
  expiredRate: number | null
  campusCabBookings: number
  peerBookings: number
  drivers: number // real drivers (not samples)
  driversUsed: number
  // customer
  students: number
  newStudents: number
  activeStudents: number
  activation: number | null // ever posted or joined / all students
  repeatRiders: number
  avgRating: number | null
  ratingsCount: number
  messages: number
  // financial
  gmv: number // fares of completed trips
  commission: number
  bookedFares: number // completed + upcoming booked
  pipelineCommission: number // upcoming booked rides
  avgFare: number | null
  avgShare: number | null // what each rider paid on average
  savings: number // what riders saved vs each taking the cab alone
}

export function computeMetrics(data: DashboardData, facts: RideFact[], a: number, b: number, rate: number, now = Date.now()): Metrics {
  // Rides in the period: departing within it. A period that runs up to today also counts
  // rides already booked for the days ahead (they're part of the current pipeline).
  const reachesToday = b >= now - 60000
  const inP = facts.filter(f => within(f.when, a, b) || (reachesToday && f.when >= b))
  const posted = inP.length
  const bookedRides = inP.filter(f => f.booked)
  const completedRides = inP.filter(f => f.outcome === 'completed')
  // rides whose fate is settled: they've left, or were cancelled early (even if their date is still ahead)
  const resolved = inP.filter(f => f.when < now || f.outcome === 'cancelled')
  const seats = bookedRides.reduce((s, f) => s + f.ride.max_seats, 0)
  const riders = bookedRides.reduce((s, f) => s + f.riders, 0)

  const realDrivers = data.drivers.filter(d => !d.placeholder)
  const driversUsed = new Set(bookedRides.map(f => f.ride.driver_id).filter(Boolean)).size

  // people active in the period: posted a ride or joined one
  const active = new Set<string>()
  for (const f of inP) active.add(f.ride.creator_id)
  const rideIds = new Set(inP.map(f => f.ride.id))
  for (const p of data.participants) if (rideIds.has(p.ride_id) && p.status === 'accepted') active.add(p.user_id)
  const everActive = new Set<string>([...data.rides.map(r => r.creator_id), ...data.participants.filter(p => p.status === 'accepted').map(p => p.user_id)])
  const tripsPerUser = new Map<string, number>()
  for (const f of facts.filter(x => x.booked)) tripsPerUser.set(f.ride.creator_id, (tripsPerUser.get(f.ride.creator_id) || 0) + 1)
  for (const p of data.participants) if (p.status === 'accepted') tripsPerUser.set(p.user_id, (tripsPerUser.get(p.user_id) || 0) + 1)

  const ratings = data.ratings.filter(r => rideIds.has(r.ride_id))
  const gmv = completedRides.reduce((s, f) => s + f.fare, 0)
  const upcomingBooked = bookedRides.filter(f => f.when >= now && f.outcome === 'booked')
  const pipeline = upcomingBooked.reduce((s, f) => s + f.fare, 0)
  const priced = completedRides.filter(f => f.fare > 0)

  return {
    posted,
    booked: bookedRides.length,
    completed: completedRides.length,
    matchRate: posted ? bookedRides.length / posted : null,
    occupancy: seats ? riders / seats : null,
    avgRiders: bookedRides.length ? riders / bookedRides.length : null,
    cancelRate: resolved.length ? resolved.filter(f => f.outcome === 'cancelled').length / resolved.length : null,
    expiredRate: resolved.length ? resolved.filter(f => f.outcome === 'expired').length / resolved.length : null,
    campusCabBookings: bookedRides.filter(f => f.campusCab).length,
    peerBookings: bookedRides.filter(f => !f.campusCab).length,
    drivers: realDrivers.length,
    driversUsed,
    students: data.users.filter(u => new Date(u.created_at).getTime() < b).length,
    newStudents: data.users.filter(u => within(new Date(u.created_at).getTime(), a, b)).length,
    activeStudents: active.size,
    activation: data.users.length ? data.users.filter(u => everActive.has(u.id)).length / data.users.length : null,
    repeatRiders: [...tripsPerUser.values()].filter(n => n >= 2).length,
    avgRating: ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : null,
    ratingsCount: ratings.length,
    messages: data.messages.filter(m => within(new Date(m.day).getTime(), a, b)).reduce((s, m) => s + Number(m.n), 0),
    gmv,
    commission: gmv * rate,
    bookedFares: gmv + pipeline,
    pipelineCommission: pipeline * rate,
    avgFare: priced.length ? priced.reduce((s, f) => s + f.fare, 0) / priced.length : null,
    avgShare: priced.length ? priced.reduce((s, f) => s + f.fare / f.riders, 0) / priced.length : null,
    savings: priced.reduce((s, f) => s + f.fare * (f.riders - 1), 0)
  }
}

// ---------- series for the charts ----------

// Monday of the week, as YYYY-MM-DD
export function weekOf(t: number): string {
  const d = new Date(t)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return todayString(d)
}

export function weeksBetween(a: number, b: number): string[] {
  const out: string[] = []
  let w = new Date(weekOf(a) + 'T00:00:00').getTime()
  const last = new Date(weekOf(b) + 'T00:00:00').getTime()
  while (w <= last && out.length < 60) {
    out.push(todayString(new Date(w)))
    w += 7 * 86400000
  }
  return out.slice(-26)
}

export const weekLabel = (w: string) => new Date(w + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export interface WeekRow {
  week: string
  label: string
  posted: number
  booked: number
  completed: number
  gmv: number
  commission: number
  signups: number
  students: number // on the network by the end of that week
  active: number
}

export function weeklySeries(data: DashboardData, facts: RideFact[], a: number, b: number, rate: number): WeekRow[] {
  const weeks = weeksBetween(a, b)
  const rows = new Map<string, WeekRow>(
    weeks.map(w => [w, { week: w, label: weekLabel(w), posted: 0, booked: 0, completed: 0, gmv: 0, commission: 0, signups: 0, students: 0, active: 0 }])
  )
  const activeBy = new Map<string, Set<string>>()
  for (const f of facts) {
    const row = rows.get(weekOf(f.when))
    if (!row) continue
    row.posted++
    if (f.booked) row.booked++
    if (f.outcome === 'completed') {
      row.completed++
      row.gmv += f.fare
      row.commission += f.fare * rate
    }
    const s = activeBy.get(row.week) || new Set<string>()
    s.add(f.ride.creator_id)
    activeBy.set(row.week, s)
  }
  const rideWeek = new Map(facts.map(f => [f.ride.id, weekOf(f.when)]))
  for (const p of data.participants) {
    if (p.status !== 'accepted') continue
    const w = rideWeek.get(p.ride_id)
    if (!w || !rows.has(w)) continue
    const s = activeBy.get(w) || new Set<string>()
    s.add(p.user_id)
    activeBy.set(w, s)
  }
  for (const u of data.users) {
    const row = rows.get(weekOf(new Date(u.created_at).getTime()))
    if (row) row.signups++
  }
  for (const row of rows.values()) {
    const endOfWeek = new Date(row.week + 'T00:00:00').getTime() + 7 * 86400000
    row.students = data.users.filter(u => new Date(u.created_at).getTime() < endOfWeek).length
    row.active = activeBy.get(row.week)?.size || 0
  }
  return weeks.map(w => rows.get(w)!)
}

export function countBy<T>(items: T[], key: (x: T) => string, value: (x: T) => number = () => 1): { key: string; value: number }[] {
  const m = new Map<string, number>()
  for (const it of items) m.set(key(it), (m.get(key(it)) || 0) + value(it))
  return [...m.entries()].map(([k, v]) => ({ key: k, value: v })).sort((x, y) => y.value - x.value)
}

// ---------- formatting ----------

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
export const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`)
export function change(cur: number, prev: number | null): { text: string; up: boolean } | null {
  if (prev === null) return null
  if (prev === 0) return cur === 0 ? { text: 'no change', up: true } : { text: 'new', up: true }
  // from a tiny base a percentage is meaningless (1 -> 139 is "+13800%"): show the actual change
  if (Math.abs(prev) < 5) {
    const diff = Math.round(cur - prev)
    return { text: diff === 0 ? 'no change' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('en-IN')}`, up: diff >= 0 }
  }
  const d = (cur - prev) / prev
  return { text: `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`, up: d >= 0 }
}
