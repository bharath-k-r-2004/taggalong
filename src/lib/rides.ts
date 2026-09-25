// Shared ride types, database queries and formatting helpers.
import { supabase } from './supabase'
import { distanceKm, Place } from './places'

export interface Profile {
  name: string | null
  course: string | null
  batch: string | null
}

// withdrawn = closed automatically because the student was accepted on another ride around that time
export type ParticipantStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'withdrawn'

export interface Participant {
  id: string
  user_id: string
  status: ParticipantStatus
  message?: string | null
  joined_at?: string | null
  withdrawn_for?: string | null // the ride that accepted them instead
  trip_confirmed?: boolean | null // rider's answer after the trip: true travelled, false didn't, null not yet
  arrived_at?: string | null
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
  total_cost: number | null // empty for travel groups still looking for a driver
  max_seats: number
  current_participants: number | null
  driver_name: string | null
  vehicle_type: string | null
  vehicle_number: string | null
  notes: string | null
  driver_id: string | null
  time_flexibility: number | null // minutes either side; null = flexible
  toll_included: boolean | null
  cancel_reason: string | null
  ended_at?: string | null // when the poster ended the ride
  // open / full / looking (travel group, no driver yet) / cancelled / completed
  status: 'open' | 'full' | 'looking' | 'cancelled' | 'completed' | string
  created_at: string
  creator?: Profile | null
  ride_participants?: Participant[]
}

// What we load for every ride: the ride, who posted it, and who asked to join.
// The contact number is deliberately NOT here: see fetchRideContact below.
export const RIDE_SELECT =
  'id, creator_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, ' +
  'date, departure_time, total_cost, max_seats, current_participants, driver_name, vehicle_type, ' +
  'vehicle_number, notes, status, created_at, driver_id, time_flexibility, toll_included, cancel_reason, ended_at, ' +
  'creator:users(name, course, batch), ' +
  // "!ride_id" names the exact link to follow, so extra links can never confuse the API
  'ride_participants!ride_id(id, user_id, status, message, joined_at, withdrawn_for, trip_confirmed, arrived_at, ' +
  'user:users(name, course, batch))'

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

export function isTravelGroup(ride: Ride): boolean {
  return ride.status === 'looking'
}

export function hasFare(ride: Ride): boolean {
  return ride.total_cost != null && Number(ride.total_cost) > 0
}

export const FLEXIBILITY_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: 'Exact', minutes: 0 },
  { label: '± 30 mins', minutes: 30 },
  { label: '± 1 hour', minutes: 60 },
  { label: 'Flexible', minutes: null }
]

export function flexibilityLabel(minutes: number | null | undefined): string {
  if (minutes == null) return 'Flexible'
  if (minutes === 0) return 'Exact time'
  return minutes >= 60 ? `± ${minutes / 60} hour${minutes > 60 ? 's' : ''}` : `± ${minutes} mins`
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export const CANCEL_REASONS = ['Emergency', 'Change of plans', 'No longer travelling', 'Other']

// Cancelling within 2 hours of departure counts as a last-minute cancellation
export function isLastMinute(ride: Ride): boolean {
  return rideDateTime(ride).getTime() - Date.now() < 2 * 60 * 60 * 1000
}

export interface StudentStats {
  completed_trips: number
  cancelled_trips: number
  last_minute_cancellations: number
}

export async function fetchStudentStats(userId: string): Promise<StudentStats | null> {
  const { data, error } = await supabase.rpc('student_stats', { p_user: userId })
  if (error) return null
  return ((data || [])[0] as StudentStats) || null
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

// ---------- trip phases ----------

// A ride counts as "in progress" from departure until the poster ends it, for up to 12 hours
export const TRIP_WINDOW_HOURS = 12

export type RidePhase = 'upcoming' | 'in_progress' | 'completed' | 'unconfirmed' | 'cancelled'

export function ridePhase(ride: Ride): RidePhase {
  if (ride.status === 'cancelled') return 'cancelled'
  if (ride.status === 'completed') return 'completed'
  const leaves = rideDateTime(ride).getTime()
  const now = Date.now()
  if (now < leaves) return 'upcoming'
  if (now < leaves + TRIP_WINDOW_HOURS * 3600000) return 'in_progress'
  return 'unconfirmed' // left long ago but nobody ended it
}

// Accepted rider who still has to say whether they travelled
export function needsRiderConfirmation(ride: Ride, userId?: string): boolean {
  const p = myParticipation(ride, userId)
  const phase = ridePhase(ride)
  return Boolean(p && p.status === 'accepted' && p.trip_confirmed == null && (phase === 'completed' || phase === 'unconfirmed'))
}

// Poster who never ended a ride that left long ago
export function needsPosterConfirmation(ride: Ride, userId?: string): boolean {
  return ride.creator_id === userId && ridePhase(ride) === 'unconfirmed'
}

// Rough arrival estimate from straight-line distance (road ≈ 1.35×, ~45 km/h average, +10 min)
export function estimatedArrival(ride: Ride): Date | null {
  const km = distanceKm(
    { lat: ride.origin_lat, lng: ride.origin_lng },
    { lat: ride.destination_lat, lng: ride.destination_lng }
  )
  if (km === null) return null
  const minutes = (km * 1.35 * 60) / 45 + 10
  return new Date(rideDateTime(ride).getTime() + minutes * 60000)
}

export function clockTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
}

// ---------- one ride at a time ----------

// Rides leaving within 4 hours of each other count as the same trip (matches the database rule)
export const CLASH_HOURS = 4

export function ridesClash(a: Pick<Ride, 'date' | 'departure_time'>, b: Pick<Ride, 'date' | 'departure_time'>): boolean {
  return Math.abs(rideDateTime(a).getTime() - rideDateTime(b).getTime()) <= CLASH_HOURS * 60 * 60 * 1000
}

export interface ConfirmedRide {
  id: string
  date: string
  departure_time: string
  origin: string
  destination: string
  status: string
}

// Rides the student has been accepted on (not cancelled), to warn before a clashing request
export async function fetchMyConfirmedRides(userId: string): Promise<ConfirmedRide[]> {
  const { data, error } = await supabase
    .from('ride_participants')
    .select('ride:rides!ride_id(id, date, departure_time, origin, destination, status)')
    .eq('user_id', userId)
    .eq('status', 'accepted')
  if (error) return []
  return ((data || []) as unknown as { ride: ConfirmedRide | null }[])
    .map(r => r.ride)
    .filter((r): r is ConfirmedRide => Boolean(r) && r!.status !== 'cancelled')
}

// ---------- queries ----------

// Rides that can still be joined (departure time not reached)
export function isJoinable(ride: Ride): boolean {
  return isUpcoming(ride) && rideDateTime(ride).getTime() > Date.now()
}

export async function fetchUpcomingRides(): Promise<Ride[]> {
  const { data, error } = await supabase
    .from('rides')
    .select(RIDE_SELECT)
    .gte('date', todayString())
    .not('status', 'in', '(cancelled,completed)')
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
    supabase.from('ride_participants').select(`ride:rides!ride_id(${RIDE_SELECT})`).eq('user_id', userId)
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
      // Both sides' flexibility counts: the student's window plus the ride's own window
      const rideFlex = ride.time_flexibility ?? 120
      const timeOk = gap === null || flexMinutes == null || Math.abs(gap) <= flexMinutes + rideFlex
      return {
        ride,
        pickupKm: pickup.km,
        dropKm: drop.km,
        minutesFromWanted: gap,
        isMatch: pickup.ok && drop.ok && dateOk && timeOk
      }
    })
    .sort((a, b) => {
      // 1. rides with a free seat first
      const fullA = seatsLeft(a.ride) === 0 ? 1 : 0
      const fullB = seatsLeft(b.ride) === 0 ? 1 : 0
      if (fullA !== fullB) return fullA - fullB
      // 2. route: closer pickup + drop (within ~10 km counts as the same route)
      const routeA = Math.floor(((a.pickupKm ?? 0) + (a.dropKm ?? 0)) / 10)
      const routeB = Math.floor(((b.pickupKm ?? 0) + (b.dropKm ?? 0)) / 10)
      if (routeA !== routeB) return routeA - routeB
      // 3. time: closer to the wanted time (in 30-minute steps)
      if (a.minutesFromWanted !== null && b.minutesFromWanted !== null) {
        const timeA = Math.floor(Math.abs(a.minutesFromWanted) / 30)
        const timeB = Math.floor(Math.abs(b.minutesFromWanted) / 30)
        if (timeA !== timeB) return timeA - timeB
      }
      // 4. occupancy first: rides that already have more students (fills cars, fewer separate rides)
      const peopleDiff = peopleOnBoard(b.ride) - peopleOnBoard(a.ride)
      if (peopleDiff !== 0) return peopleDiff
      // 5. rides that already have a driver before groups still looking for one
      const groupA = isTravelGroup(a.ride) ? 1 : 0
      const groupB = isTravelGroup(b.ride) ? 1 : 0
      if (groupA !== groupB) return groupA - groupB
      return rideDateTime(a.ride).getTime() - rideDateTime(b.ride).getTime()
    })
}

// Plain-language reason shown on the best match
export function recommendationFor(match: RideMatch): string {
  const people = peopleOnBoard(match.ride)
  const similarTime = match.minutesFromWanted !== null && Math.abs(match.minutesFromWanted) <= 60
  if (people >= 2) {
    return `${people} students are already travelling${similarTime ? ' at a similar time' : ' on this route'}. Joining helps fill this ride.`
  }
  return similarTime ? 'Closest to your route and time.' : 'Closest to your route.'
}

export function placeFromRide(ride: Ride, end: 'origin' | 'destination'): Place {
  return end === 'origin'
    ? { name: ride.origin, lat: ride.origin_lat, lng: ride.origin_lng }
    : { name: ride.destination, lat: ride.destination_lat, lng: ride.destination_lng }
}
