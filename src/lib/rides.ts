// Shared ride types, database queries and formatting helpers.
import { supabase } from './supabase'
import { distanceKm, Place } from './places'

export interface Profile {
  name: string | null
  course: string | null
  batch: string | null
}

export type ParticipantStatus = 'requested' | 'accepted' | 'declined'

export interface Participant {
  id: string
  user_id: string
  status: ParticipantStatus
  user?: Profile | null
}

export interface Ride {
  id: string
  creator_id: string
  origin: string
  destination: string
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  date: string // YYYY-MM-DD
  departure_time: string // HH:MM:SS
  total_cost: number
  max_seats: number
  current_participants: number | null
  driver_name: string | null
  vehicle_type: string | null
  vehicle_number: string | null
  notes: string | null
  status: 'open' | 'full' | 'cancelled' | 'completed' | string
  created_at: string
  creator?: Profile | null
  ride_participants?: Participant[]
}

// What we load for every ride: the ride, who posted it, and who asked to join.
// The contact number is deliberately NOT here: see fetchRideContact below.
export const RIDE_SELECT =
  'id, creator_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, ' +
  'date, departure_time, total_cost, max_seats, current_participants, driver_name, vehicle_type, ' +
  'vehicle_number, notes, status, created_at, ' +
  'creator:users(name, course, batch), ride_participants(id, user_id, status, user:users(name, course, batch))'

// ---------- dates & times ----------

export function todayString(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function rideDateTime(ride: Pick<Ride, 'date' | 'departure_time'>): Date {
  const d = parseLocalDate(ride.date)
  const [h = 0, min = 0] = (ride.departure_time || '00:00').split(':').map(Number)
  d.setHours(h, min, 0, 0)
  return d
}

export function formatDateLabel(date: string): string {
  const d = parseLocalDate(date)
  const today = parseLocalDate(todayString())
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatTime(time: string): string {
  const [h = 0, m = 0] = (time || '00:00').split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
}

// Upcoming = not cancelled, and departure no more than 30 minutes ago
export function isUpcoming(ride: Ride): boolean {
  if (ride.status === 'cancelled' || ride.status === 'completed') return false
  return rideDateTime(ride).getTime() >= Date.now() - 30 * 60 * 1000
}

// ---------- seats & money ----------

export function peopleOnBoard(ride: Ride): number {
  return Math.max(1, ride.current_participants ?? 1)
}

export function seatsLeft(ride: Ride): number {
  return Math.max(0, ride.max_seats - peopleOnBoard(ride))
}

export function formatRupees(amount: number): string {
  return `₹${Math.ceil(amount).toLocaleString('en-IN')}`
}

// Each person's share once every seat is filled (the lowest possible share)
export function shareWhenFull(ride: Ride): number {
  return Number(ride.total_cost) / Math.max(1, ride.max_seats)
}

// Each person's share if one more person joins now
export function shareIfYouJoin(ride: Ride): number {
  return Number(ride.total_cost) / Math.min(ride.max_seats, peopleOnBoard(ride) + 1)
}

export function shortPlace(name: string): string {
  return name.split(',')[0].trim()
}

export function myParticipation(ride: Ride, userId?: string): Participant | undefined {
  if (!userId) return undefined
  return ride.ride_participants?.find(p => p.user_id === userId)
}

export function pendingRequests(ride: Ride): Participant[] {
  return (ride.ride_participants || []).filter(p => p.status === 'requested')
}

// ---------- queries ----------

export async function fetchUpcomingRides(): Promise<Ride[]> {
  const { data, error } = await supabase
    .from('rides')
    .select(RIDE_SELECT)
    .gte('date', todayString())
    .neq('status', 'cancelled')
    .order('date', { ascending: true })
    .order('departure_time', { ascending: true })

  if (error) throw error
  return ((data || []) as unknown as Ride[]).filter(isUpcoming)
}

export async function fetchRide(id: string): Promise<Ride | null> {
  const { data, error } = await supabase.from('rides').select(RIDE_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as Ride) || null
}

// The contact number is only returned to the ride's poster and accepted riders
// (checked by the database, not just hidden on screen)
export async function fetchRideContact(rideId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_ride_contact', { p_ride_id: rideId })
  if (error) throw error
  return (data as string | null) || null
}

// All rides the student posted or asked to join (past and future)
export async function fetchMyRides(userId: string): Promise<Ride[]> {
  const [posted, joined] = await Promise.all([
    supabase.from('rides').select(RIDE_SELECT).eq('creator_id', userId),
    supabase.from('ride_participants').select(`ride:rides(${RIDE_SELECT})`).eq('user_id', userId)
  ])
  if (posted.error) throw posted.error
  if (joined.error) throw joined.error

  const all = new Map<string, Ride>()
  for (const r of (posted.data || []) as unknown as Ride[]) all.set(r.id, r)
  for (const row of (joined.data || []) as unknown as { ride: Ride | null }[]) {
    if (row.ride) all.set(row.ride.id, row.ride)
  }
  return [...all.values()].sort((a, b) => rideDateTime(a).getTime() - rideDateTime(b).getTime())
}

// ---------- matching (used by Find a ride) ----------

export interface RideFilters {
  from?: Place | null
  to?: Place | null
  date?: string // YYYY-MM-DD
  time?: string // HH:MM the student wants to leave
  flexMinutes?: number | null // how far from that time is OK (null = any time)
}

export interface RideMatch {
  ride: Ride
  pickupKm: number | null
  dropKm: number | null
  minutesFromWanted: number | null // + leaves later than wanted, - leaves earlier
  isMatch: boolean
}

const MATCH_RADIUS_KM = 25

function textMatches(rideText: string, query?: Place | null): boolean {
  if (!query?.name) return true
  const words = shortPlace(query.name)
    .toLowerCase()
    .split(/[\s()]+/)
    .filter(w => w.length > 2)
  const target = rideText.toLowerCase()
  return words.length === 0 || words.some(w => target.includes(w))
}

function endMatches(
  rideText: string,
  ridePoint: { lat: number | null; lng: number | null },
  query?: Place | null
): { km: number | null; ok: boolean } {
  if (!query?.name) return { km: null, ok: true }
  const km = distanceKm(ridePoint, query)
  if (km !== null) return { km, ok: km <= MATCH_RADIUS_KM }
  return { km: null, ok: textMatches(rideText, query) }
}

// Minutes between the ride's departure and the time the student wants
function minutesApart(ride: Ride, date?: string, time?: string): number | null {
  if (!time) return null
  if (date) {
    const wanted = rideDateTime({ date, departure_time: time })
    return Math.round((rideDateTime(ride).getTime() - wanted.getTime()) / 60000)
  }
  // No date chosen: compare the time of day only (so 11:50 PM and 12:10 AM are 20 min apart)
  const toMin = (t: string) => {
    const [h = 0, m = 0] = t.split(':').map(Number)
    return h * 60 + m
  }
  let diff = toMin(ride.departure_time) - toMin(time)
  if (diff > 720) diff -= 1440
  if (diff < -720) diff += 1440
  return diff
}

export function formatTimeGap(minutes: number): string {
  const abs = Math.abs(minutes)
  if (abs < 5) return 'Leaves at your time'
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const gap = h === 0 ? `${m} min` : m === 0 ? `${h} hr` : `${h} hr ${m} min`
  return `Leaves ${gap} ${minutes > 0 ? 'later' : 'earlier'}`
}

export function matchRides(rides: Ride[], filters: RideFilters = {}): RideMatch[] {
  const { from, to, date, time, flexMinutes } = filters
  return rides
    .map(ride => {
      const pickup = endMatches(ride.origin, { lat: ride.origin_lat, lng: ride.origin_lng }, from)
      const drop = endMatches(ride.destination, { lat: ride.destination_lat, lng: ride.destination_lng }, to)
      const dateOk = !date || ride.date === date
      const gap = minutesApart(ride, date, time)
      const timeOk = gap === null || flexMinutes == null || Math.abs(gap) <= flexMinutes
      return {
        ride,
        pickupKm: pickup.km,
        dropKm: drop.km,
        minutesFromWanted: gap,
        isMatch: pickup.ok && drop.ok && dateOk && timeOk
      }
    })
    .sort((a, b) => {
      // Rides with free seats first, then the closest pickup + drop,
      // then the closest to the wanted time (or simply the earliest)
      const fullA = seatsLeft(a.ride) === 0 ? 1 : 0
      const fullB = seatsLeft(b.ride) === 0 ? 1 : 0
      if (fullA !== fullB) return fullA - fullB
      const distA = (a.pickupKm ?? 0) + (a.dropKm ?? 0)
      const distB = (b.pickupKm ?? 0) + (b.dropKm ?? 0)
      if (Math.abs(distA - distB) > 2) return distA - distB
      if (a.minutesFromWanted !== null && b.minutesFromWanted !== null) {
        const gapDiff = Math.abs(a.minutesFromWanted) - Math.abs(b.minutesFromWanted)
        if (gapDiff !== 0) return gapDiff
      }
      return rideDateTime(a.ride).getTime() - rideDateTime(b.ride).getTime()
    })
}

export function placeFromRide(ride: Ride, end: 'origin' | 'destination'): Place {
  return end === 'origin'
    ? { name: ride.origin, lat: ride.origin_lat, lng: ride.origin_lng }
    : { name: ride.destination, lat: ride.destination_lat, lng: ride.destination_lng }
}
