// Campus cabs: TagAlong cabs that leave campus at fixed times. The team sets the
// schedule (Admin page); students book a seat on a departure without needing approval.
import { supabase } from './supabase'
import { RIDE_SELECT, Ride, rideDateTime, todayString } from './rides'

export interface CabSchedule {
  id: string
  origin: string
  destination: string
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  days: number[] // 0 = Sunday ... 6 = Saturday
  first_departure: string // "06:00:00"
  last_departure: string
  interval_minutes: number
  vehicle_type: string
  seats: number
  total_fare: number
  toll_included: boolean | null
  driver_id: string | null
  active: boolean
  created_at: string
}

export interface CabSlot {
  schedule: CabSchedule
  date: string
  time: string // "HH:MM"
  ride: Ride | null // the departure's ride once someone has booked
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const INTERVAL_OPTIONS = [
  { minutes: 30, label: 'Every 30 min' },
  { minutes: 60, label: 'Every hour' },
  { minutes: 90, label: 'Every 1.5 hours' },
  { minutes: 120, label: 'Every 2 hours' },
  { minutes: 180, label: 'Every 3 hours' },
  { minutes: 240, label: 'Every 4 hours' },
  { minutes: 360, label: 'Every 6 hours' },
  { minutes: 720, label: 'Every 12 hours' }
]

const toMinutes = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

// Departure times of one schedule on one day ("HH:MM")
export function departureTimes(s: Pick<CabSchedule, 'first_departure' | 'last_departure' | 'interval_minutes'>): string[] {
  const out: string[] = []
  const last = toMinutes(s.last_departure)
  for (let m = toMinutes(s.first_departure); m <= last && out.length < 96; m += s.interval_minutes) out.push(toHHMM(m))
  return out
}

export function scheduleSummary(s: CabSchedule): string {
  const days =
    s.days.length === 7
      ? 'Every day'
      : [...s.days]
          .sort()
          .map(d => DAY_LABELS[d])
          .join(', ')
  const every = INTERVAL_OPTIONS.find(o => o.minutes === s.interval_minutes)?.label.toLowerCase() || `every ${s.interval_minutes} min`
  const times = departureTimes(s)
  return times.length === 1 ? `${days} at ${times[0]}` : `${days}, ${every} from ${times[0]} to ${times[times.length - 1]}`
}

export async function fetchSchedules(includeInactive = false): Promise<CabSchedule[]> {
  let q = supabase.from('cab_schedules').select('*').order('created_at', { ascending: true })
  if (!includeInactive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as CabSchedule[]
}

// Upcoming campus-cab rides (the departures someone has already booked)
export async function fetchCabRides(): Promise<Ride[]> {
  const { data, error } = await supabase
    .from('rides')
    .select(RIDE_SELECT)
    .not('schedule_id', 'is', null)
    .gte('date', todayString())
    .in('status', ['open', 'full'])
  if (error) throw error
  return (data || []) as unknown as Ride[]
}

// The next departures over the coming days, soonest first. Bookable until 5 minutes before.
export function upcomingSlots(schedules: CabSchedule[], rides: Ride[], days = 3, now = Date.now()): CabSlot[] {
  const slots: CabSlot[] = []
  for (let i = 0; i < days; i++) {
    const day = new Date(now + i * 86400000)
    const date = todayString(day)
    const dow = day.getDay()
    for (const s of schedules) {
      if (!s.active || !s.days.includes(dow)) continue
      for (const time of departureTimes(s)) {
        if (rideDateTime({ date, departure_time: time }).getTime() <= now + 5 * 60000) continue
        const ride =
          rides.find(r => r.schedule_id === s.id && r.date === date && r.departure_time.slice(0, 5) === time) || null
        slots.push({ schedule: s, date, time, ride })
      }
    }
  }
  return slots.sort(
    (a, b) =>
      rideDateTime({ date: a.date, departure_time: a.time }).getTime() -
      rideDateTime({ date: b.date, departure_time: b.time }).getTime()
  )
}

export async function bookCampusCab(scheduleId: string, date: string, time: string): Promise<string> {
  const { data, error } = await supabase.rpc('book_campus_cab', { p_schedule: scheduleId, p_date: date, p_time: time })
  if (error) throw error
  return data as string
}

export async function leaveCampusCab(rideId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_campus_cab', { p_ride: rideId })
  if (error) throw error
}

export type ScheduleInput = Omit<CabSchedule, 'id' | 'created_at'>

export async function saveSchedule(input: ScheduleInput, id?: string): Promise<void> {
  const { error } = id
    ? await supabase.from('cab_schedules').update(input).eq('id', id)
    : await supabase.from('cab_schedules').insert(input)
  if (error) throw error
}

export async function setScheduleActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('cab_schedules').update({ active }).eq('id', id)
  if (error) throw error
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('cab_schedules').delete().eq('id', id)
  if (error) throw error
}
