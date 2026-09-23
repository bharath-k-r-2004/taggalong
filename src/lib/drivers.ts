// Community driver network: directory, quotes, vouches.
import { supabase } from './supabase'
import { Place, distanceKm } from './places'
import { formatDateLabel, formatTime, rideDateTime, shortPlace, todayString } from './rides'

export interface Driver {
  id: string
  name: string
  phone: string
  vehicle_type: string | null
  vehicle_number: string | null
  seats: number | null
  relationship: string | null
  about: string | null
  added_by_user_id: string
  created_at: string
  introducer_name: string | null
  introducer_course: string | null
  introducer_batch: string | null
  unique_students: number
  recorded_trips: number
  vouch_count: number
  i_vouched: boolean
}

export interface DriverQuote {
  id: string
  driver_id: string
  origin: string
  destination: string
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  quoted_price: number
  toll_included: boolean | null
  notes: string | null
  created_at: string
}

export interface DriverTraveller {
  first_name: string
  course: string | null
  batch: string | null
  trips: number
  last_trip: string | null
  same_batch: boolean
}

export const RELATIONSHIPS = [
  { value: 'travelled', label: 'I have personally travelled with this driver' },
  { value: 'know', label: 'I personally know this driver' },
  { value: 'recommended', label: 'Recommended by another IIM Rohtak student' },
  { value: 'other', label: 'Other' }
]

export const VEHICLE_SUGGESTIONS = [
  'Maruti Suzuki Dzire',
  'Maruti Suzuki Ertiga',
  'Toyota Innova',
  'Toyota Innova Crysta',
  'Hyundai Aura',
  'Honda Amaze',
  'Mahindra Scorpio',
  'Tata Tigor'
]

export const QUOTE_DISCLAIMER =
  'Driver prices are quotes recorded by students. They may change with the date, time, route, tolls, waiting time and other conditions.'

export function cleanPhone(input: string): string {
  return input.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
}

export function isValidPhone(input: string): boolean {
  return /^[6-9]\d{9}$/.test(cleanPhone(input))
}

export async function fetchDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase.rpc('get_driver_directory')
  if (error) throw error
  return (data || []) as Driver[]
}

export async function fetchQuotes(driverId?: string): Promise<DriverQuote[]> {
  let query = supabase.from('driver_quotes').select('*').order('created_at', { ascending: false })
  if (driverId) query = query.eq('driver_id', driverId)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as DriverQuote[]
}

export async function fetchTravellers(driverId: string): Promise<DriverTraveller[]> {
  const { data, error } = await supabase.rpc('get_driver_travellers', { p_driver: driverId })
  if (error) throw error
  return (data || []) as DriverTraveller[]
}

export interface NewDriverInput {
  userId: string
  name: string
  phone: string
  vehicleType?: string
  vehicleNumber?: string
  seats?: number
  relationship?: string
  about?: string
}

// Adds a driver to the community directory. If the number is already listed,
// returns the existing driver instead of creating a duplicate.
export async function addDriver(input: NewDriverInput): Promise<{ id: string; existed: boolean }> {
  const phone = cleanPhone(input.phone)
  const { data: existing } = await supabase.from('drivers').select('id').eq('phone', phone).maybeSingle()
  if (existing) return { id: existing.id, existed: true }

  const { data, error } = await supabase
    .from('drivers')
    .insert({
      added_by_user_id: input.userId,
      name: input.name.trim(),
      phone,
      vehicle_type: input.vehicleType?.trim() || null,
      vehicle_number: input.vehicleNumber?.trim().toUpperCase() || null,
      seats: input.seats || null,
      relationship: input.relationship || null,
      about: input.about?.trim() || null
    })
    .select('id')
    .single()
  if (error) throw error

  // Knowing or having travelled with the driver counts as a vouch
  if (input.relationship === 'travelled' || input.relationship === 'know') {
    await supabase.from('driver_vouches').insert({
      driver_id: data.id,
      user_id: input.userId,
      vouch_type: input.relationship
    })
  }
  return { id: data.id, existed: false }
}

export async function recordQuote(input: {
  driverId: string
  userId: string
  from: Place
  to: Place
  price: number
  tollIncluded?: boolean | null
  notes?: string
  rideId?: string
}) {
  const { error } = await supabase.from('driver_quotes').insert({
    driver_id: input.driverId,
    recorded_by: input.userId,
    origin: input.from.name,
    destination: input.to.name,
    origin_lat: input.from.lat ?? null,
    origin_lng: input.from.lng ?? null,
    destination_lat: input.to.lat ?? null,
    destination_lng: input.to.lng ?? null,
    quoted_price: input.price,
    toll_included: input.tollIncluded ?? null,
    notes: input.notes?.trim() || null,
    ride_id: input.rideId || null
  })
  if (error) throw error
}

// ---------- matching drivers to a route ----------

const ROUTE_RADIUS_KM = 25

function endNear(quoteName: string, lat: number | null, lng: number | null, place?: Place | null): boolean {
  if (!place?.name) return true
  const km = distanceKm({ lat, lng }, place)
  if (km !== null) return km <= ROUTE_RADIUS_KM
  const word = place.name.split(',')[0].toLowerCase().split(/[\s()]+/).find(w => w.length > 2)
  return word ? quoteName.toLowerCase().includes(word) : true
}

export function quoteForRoute(quotes: DriverQuote[], from?: Place | null, to?: Place | null): DriverQuote | null {
  // quotes are newest first
  return (
    quotes.find(
      q =>
        endNear(q.origin, q.origin_lat, q.origin_lng, from) &&
        endNear(q.destination, q.destination_lat, q.destination_lng, to)
    ) || null
  )
}

export interface RankedDriver {
  driver: Driver
  routeQuote: DriverQuote | null
  latestQuote: DriverQuote | null
}

// Route experience first, then community trust. Never "cheapest first":
// students should weigh price, trust, vehicle and seats themselves.
export function rankDrivers(
  drivers: Driver[],
  quotes: DriverQuote[],
  from?: Place | null,
  to?: Place | null
): RankedDriver[] {
  const byDriver = new Map<string, DriverQuote[]>()
  for (const q of quotes) {
    const list = byDriver.get(q.driver_id) || []
    list.push(q)
    byDriver.set(q.driver_id, list)
  }
  const routeGiven = Boolean(from?.name || to?.name)
  return drivers
    .map(driver => {
      const list = byDriver.get(driver.id) || []
      return {
        driver,
        routeQuote: routeGiven ? quoteForRoute(list, from, to) : null,
        latestQuote: list[0] || null
      }
    })
    .sort((a, b) => {
      if (routeGiven && Boolean(a.routeQuote) !== Boolean(b.routeQuote)) return a.routeQuote ? -1 : 1
      const trustA = a.driver.unique_students + a.driver.vouch_count
      const trustB = b.driver.unique_students + b.driver.vouch_count
      if (trustA !== trustB) return trustB - trustA
      return a.driver.name.localeCompare(b.driver.name)
    })
}

export function introducedBy(d: Pick<Driver, 'introducer_name' | 'introducer_course' | 'introducer_batch'>): string {
  const first = (d.introducer_name || 'A student').split(' ')[0]
  return d.introducer_course ? `${first} · ${d.introducer_course}${d.introducer_batch ? ` ${d.introducer_batch}` : ''}` : first
}

// ---------- availability (TagAlong bookings only) ----------

export interface DriverBooking {
  id: string
  driver_id: string
  date: string
  departure_time: string
  origin: string
  destination: string
  status: string
}

// Upcoming rides that already have a driver attached
export async function fetchDriverBookings(): Promise<DriverBooking[]> {
  const { data, error } = await supabase
    .from('rides')
    .select('id, driver_id, date, departure_time, origin, destination, status')
    .not('driver_id', 'is', null)
    .gte('date', todayString())
    .not('status', 'in', '(cancelled,completed,looking)')
    .order('date', { ascending: true })
    .order('departure_time', { ascending: true })
  if (error) throw error
  // keep rides that haven't finished yet (assume a trip can take up to 3 hours)
  const cutoff = Date.now() - 3 * 60 * 60 * 1000
  return ((data || []) as DriverBooking[]).filter(b => rideDateTime(b).getTime() >= cutoff)
}

export interface Availability {
  level: 'booked' | 'clash' // clash = booked close to the time you want
  badge: string // short text beside the name
  detail: string // one line under the card
}

// Hours either side of a booking when the driver is probably not free
const CLASH_WINDOW_MIN = 180

export function driverAvailability(
  bookings: DriverBooking[],
  driverId: string,
  date?: string,
  time?: string
): Availability | null {
  const mine = bookings.filter(b => b.driver_id === driverId)
  if (mine.length === 0) return null
  const route = (b: DriverBooking) => `${shortPlace(b.origin)} → ${shortPlace(b.destination)}`

  if (date) {
    const sameDay = mine.filter(b => b.date === date)
    if (sameDay.length === 0) return null
    if (time) {
      const wanted = rideDateTime({ date, departure_time: time }).getTime()
      const close = sameDay.find(b => Math.abs(rideDateTime(b).getTime() - wanted) / 60000 < CLASH_WINDOW_MIN)
      if (close) {
        return {
          level: 'clash',
          badge: `Busy around ${formatTime(close.departure_time)}`,
          detail: `Already booked through TagAlong at ${formatTime(close.departure_time)} (${route(close)}) that day. Likely not free at your time.`
        }
      }
    }
    const times = sameDay.map(b => formatTime(b.departure_time)).join(', ')
    return {
      level: 'booked',
      badge: `Booked that day`,
      detail: `Has ${sameDay.length === 1 ? 'another ride' : `${sameDay.length} rides`} that day at ${times}. Check he's free before calling.`
    }
  }

  const next = mine[0]
  const when = formatDateLabel(next.date)
  const more = mine.length > 1 ? ` (+${mine.length - 1} more)` : ''
  const startedAgo = Date.now() - rideDateTime(next).getTime()
  if (startedAgo >= 0) {
    return {
      level: 'clash',
      badge: 'On a trip now',
      detail: `Left at ${formatTime(next.departure_time)} for ${route(next)}${more}.`
    }
  }
  return {
    level: when === 'Today' ? 'clash' : 'booked',
    badge: `Booked ${when === 'Today' || when === 'Tomorrow' ? when.toLowerCase() : when} · ${formatTime(next.departure_time)}`,
    detail: `Next TagAlong ride: ${when}, ${formatTime(next.departure_time)}, ${route(next)}${more}.`
  }
}
