import { useEffect, useState } from 'react'
import { Bus, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { LocationInput } from './LocationInput'
import { IIM_ROHTAK, Place } from '../lib/places'
import { DEFAULT_SEATS, Driver, fetchDrivers } from '../lib/drivers'
import {
  CabSchedule,
  DAY_LABELS,
  INTERVAL_OPTIONS,
  ScheduleInput,
  deleteSchedule,
  departureTimes,
  fetchSchedules,
  saveSchedule,
  scheduleSummary,
  setScheduleActive
} from '../lib/campusCabs'
import { AUTO_MAX_MINUTES, autoAllowed, drivingMinutes, formatDuration, formatRupees, isAuto, shortPlace } from '../lib/rides'
import { friendlyError } from '../lib/errors'

const CAB_TYPES = ['Cab (Sedan)', 'Cab (SUV)', 'Cab (Hatchback)', 'Auto']

interface FormState {
  id?: string
  from: Place | null
  to: Place | null
  days: number[]
  first: string
  last: string
  interval: number
  vehicle: string
  seats: number
  fare: string
  toll: boolean | null
  driverId: string
}

const emptyForm = (): FormState => ({
  from: IIM_ROHTAK,
  to: null,
  days: [0, 1, 2, 3, 4, 5, 6],
  first: '06:00',
  last: '22:00',
  interval: 120,
  vehicle: 'Cab (Sedan)',
  seats: 4,
  fare: '',
  toll: null,
  driverId: ''
})

const placeOf = (name: string, lat: number | null, lng: number | null): Place => ({ name, lat: lat ?? undefined, lng: lng ?? undefined })

// Admin: set the times TagAlong cabs leave campus
export function CabScheduleAdmin() {
  const [schedules, setSchedules] = useState<CabSchedule[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = () =>
    fetchSchedules(true)
      .then(setSchedules)
      .catch(err => setError(friendlyError(err)))

  useEffect(() => {
    void load()
    fetchDrivers().then(setDrivers).catch(() => setDrivers([]))
  }, [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => (f ? { ...f, [key]: value } : f))

  const minutes = form ? drivingMinutes(form.from, form.to) : null
  const autoOk = autoAllowed(minutes)
  const vehicles = autoOk ? CAB_TYPES : CAB_TYPES.filter(v => !isAuto(v))
  const driverChoices = drivers.filter(d => autoOk || !isAuto(d.vehicle_type))
  const times = form ? departureTimes({ first_departure: form.first, last_departure: form.last, interval_minutes: form.interval }) : []

  const edit = (s: CabSchedule) =>
    setForm({
      id: s.id,
      from: placeOf(s.origin, s.origin_lat, s.origin_lng),
      to: placeOf(s.destination, s.destination_lat, s.destination_lng),
      days: s.days,
      first: s.first_departure.slice(0, 5),
      last: s.last_departure.slice(0, 5),
      interval: s.interval_minutes,
      vehicle: s.vehicle_type,
      seats: s.seats,
      fare: String(Math.round(Number(s.total_fare))),
      toll: s.toll_included,
      driverId: s.driver_id || ''
    })

  const save = async () => {
    if (!form) return
    const fare = Number(form.fare)
    const problem = !form.from?.name
      ? 'Choose where the cab leaves from.'
      : !form.to?.name
      ? 'Choose where the cab goes.'
      : form.days.length === 0
      ? 'Pick at least one day.'
      : form.first > form.last
      ? 'The first departure must be before the last.'
      : !(fare > 0)
      ? 'Enter the total fare for one cab.'
      : !autoOk && isAuto(form.vehicle)
      ? `This route takes about ${formatDuration(minutes || 0)}: use a cab (autos are for trips up to ${AUTO_MAX_MINUTES} minutes).`
      : null
    if (problem) return setError(problem)

    const input: ScheduleInput = {
      origin: form.from!.name.trim(),
      destination: form.to!.name.trim(),
      origin_lat: form.from!.lat ?? null,
      origin_lng: form.from!.lng ?? null,
      destination_lat: form.to!.lat ?? null,
      destination_lng: form.to!.lng ?? null,
      days: [...form.days].sort(),
      first_departure: form.first,
      last_departure: form.last,
      interval_minutes: form.interval,
      vehicle_type: form.vehicle,
      seats: form.seats,
      total_fare: fare,
      toll_included: form.toll,
      driver_id: form.driverId || null,
      active: true
    }
    try {
      setSaving(true)
      setError(null)
      await saveSchedule(input, form.id)
      setNotice(form.id ? 'Schedule updated.' : 'Schedule added. Students can now book these departures from Home.')
      setForm(null)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (s: CabSchedule) => {
    try {
      await setScheduleActive(s.id, !s.active)
      setNotice(s.active ? 'Schedule paused. Seats already booked stay booked.' : 'Schedule running again.')
      await load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const remove = async (s: CabSchedule) => {
    if (!window.confirm('Delete this schedule? Departures already booked become ordinary rides. Pausing keeps the schedule instead.')) return
    try {
      await deleteSchedule(s.id)
      setNotice('Schedule deleted.')
      await load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const driverName = (id: string | null) => drivers.find(d => d.id === id)?.name

  return (
    <section className="mt-6 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-secondary-900">
          <Bus size={18} className="text-primary-700" /> Campus cab schedule
        </h2>
        {!form && (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm())
              setNotice(null)
            }}
            className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus size={14} /> Add departures
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-secondary-600">
        Cabs that leave campus at set times. Students see the next departures on Home and book a seat directly.
      </p>
      {notice && <p className="mb-3 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</p>}
      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {form && (
        <div className="mb-4 space-y-3 rounded-2xl border border-primary-200 bg-primary-50/40 p-4">
          <LocationInput label="From" placeholder="Usually the campus" value={form.from} onChange={v => set('from', v)} kind="from" />
          <LocationInput label="To" placeholder="Delhi Airport, railway station..." value={form.to} onChange={v => set('to', v)} kind="to" near={form.from} />
          {minutes !== null && (
            <p className="text-xs text-secondary-600">
              About {formatDuration(minutes)} by road.{!autoOk && ' Only cabs can run this route.'}
            </p>
          )}

          <div>
            <p className="mb-1 text-sm font-medium text-secondary-700">Days</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('days', form.days.includes(i) ? form.days.filter(x => x !== i) : [...form.days, i])}
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${
                    form.days.includes(i) ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-300 bg-white text-secondary-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">First cab</label>
              <input type="time" value={form.first} onChange={e => set('first', e.target.value)} className="!rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Last cab</label>
              <input type="time" value={form.last} onChange={e => set('last', e.target.value)} className="!rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">How often</label>
              <select value={form.interval} onChange={e => set('interval', Number(e.target.value))} className="!rounded-xl !py-2.5">
                {INTERVAL_OPTIONS.map(o => (
                  <option key={o.minutes} value={o.minutes}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {times.length > 0 && (
            <p className="text-xs text-secondary-600">
              {times.length} departure{times.length > 1 ? 's' : ''} a day: {times.slice(0, 10).join(', ')}
              {times.length > 10 ? ', ...' : ''}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Vehicle</label>
              <select
                value={form.vehicle}
                onChange={e => setForm(f => (f ? { ...f, vehicle: e.target.value, seats: DEFAULT_SEATS[e.target.value] || f.seats } : f))}
                className="!rounded-xl !py-2.5"
              >
                {vehicles.map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Seats</label>
              <select value={form.seats} onChange={e => set('seats', Number(e.target.value))} className="!rounded-xl !py-2.5">
                {[2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>
                    {n} students
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Fare per cab (₹)</label>
              <input type="number" min={1} value={form.fare} onChange={e => set('fare', e.target.value)} placeholder="3000" className="!rounded-xl" />
            </div>
          </div>
          {Number(form.fare) > 0 && (
            <p className="text-xs text-secondary-600">{formatRupees(Number(form.fare) / form.seats)} per student when full.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-secondary-700">Toll included?</span>
            {[
              { l: 'Yes', v: true },
              { l: 'No', v: false }
            ].map(o => (
              <button
                key={o.l}
                type="button"
                onClick={() => set('toll', form.toll === o.v ? null : o.v)}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  form.toll === o.v ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-300 bg-white text-secondary-700'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Driver</label>
            <select value={form.driverId} onChange={e => set('driverId', e.target.value)} className="!rounded-xl !py-2.5">
              <option value="">Assign later (students see "driver to be confirmed")</option>
              {driverChoices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.vehicle_type ? ` · ${d.vehicle_type}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="flex-1 rounded-xl bg-primary-600 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : form.id ? 'Save changes' : 'Add schedule'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-secondary-300 px-4 font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {schedules.length === 0 && !form ? (
        <p className="rounded-xl border border-dashed border-secondary-300 py-6 text-center text-sm text-secondary-500">
          No campus cab departures yet.
        </p>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => (
            <div
              key={s.id}
              className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3 ${
                s.active ? 'border-secondary-200' : 'border-dashed border-secondary-300 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-secondary-900">
                  {shortPlace(s.origin)} → {shortPlace(s.destination)}
                  {!s.active && <span className="ml-2 text-xs font-medium text-secondary-500">Paused</span>}
                </p>
                <p className="text-sm text-secondary-600">{scheduleSummary(s)}</p>
                <p className="text-xs text-secondary-500">
                  {s.vehicle_type} · {s.seats} seats · {formatRupees(Number(s.total_fare))} per cab ·{' '}
                  {driverName(s.driver_id) || 'driver to be confirmed'}
                </p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => edit(s)} className="rounded-lg p-2 text-secondary-600 hover:bg-secondary-100" title="Edit">
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => void toggle(s)}
                  className="rounded-lg p-2 text-secondary-600 hover:bg-secondary-100"
                  title={s.active ? 'Pause' : 'Resume'}
                >
                  {s.active ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button type="button" onClick={() => void remove(s)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
