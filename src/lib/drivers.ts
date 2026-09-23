// Community driver network: directory, quotes, vouches.
import { supabase } from './supabase'
import { Place, distanceKm } from './places'

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
