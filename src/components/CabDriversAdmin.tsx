import { useState } from 'react'
import { Pencil, Plus, UserCircle } from 'lucide-react'
import { PhoneInput, isTenDigitMobile } from './PhoneInput'
import { BookedDeparture, CabDriver, CabDriverInput, assignCabDriver, saveCabDriver } from '../lib/campusCabs'
import { DEFAULT_SEATS } from '../lib/drivers'
import { autoAllowed, drivingMinutes, formatDateLabel, formatTime, isAuto, shortPlace } from '../lib/rides'
import { POPULAR_PLACES } from '../lib/places'
import { friendlyError } from '../lib/errors'

const CAB_TYPES = ['Cab (Sedan)', 'Cab (SUV)', 'Cab (Hatchback)', 'Auto']

const label = (d: CabDriver) => `${d.name}${d.placeholder && !/sample/i.test(d.name) ? ' (sample)' : ''}${d.vehicle_type ? ` · ${d.vehicle_type}` : ''}`

// ---------- Booked departures: assign or change the driver of each one ----------

export function BookedDeparturesPanel({
  departures,
  drivers,
  onChanged
}: {
  departures: BookedDeparture[]
  drivers: CabDriver[]
  onChanged: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assign = async (dep: BookedDeparture, driverId: string) => {
    try {
      setBusy(dep.id)
      setError(null)
      await assignCabDriver(dep.id, driverId || null)
      const d = drivers.find(x => x.id === driverId)
      setNote(
        !d
          ? 'Driver removed from that departure.'
          : d.placeholder
          ? `${d.name} assigned. Students still see "driver to be confirmed" until a real driver is set.`
          : `${d.name} assigned. Students on that cab now see his name and number.`
      )
      await onChanged()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  // Autos only for short trips, same rule as everywhere else
  const choicesFor = (dep: BookedDeparture) => {
    const from = POPULAR_PLACES.find(p => p.name === dep.origin)
    const to = POPULAR_PLACES.find(p => p.name === dep.destination)
    const ok = autoAllowed(drivingMinutes(from, to))
    return drivers.filter(d => ok || !isAuto(d.vehicle_type))
  }

  return (
    <div className="mt-6 border-t border-secondary-100 pt-5">
      <h3 className="font-semibold text-secondary-900">Booked departures</h3>
      <p className="mb-3 text-sm text-secondary-600">
        Cabs students have booked. Choose who drives each one; the riders see the change straight away.
      </p>
      {note && <p className="mb-3 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-800">{note}</p>}
      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {departures.length === 0 ? (
        <p className="rounded-xl border border-dashed border-secondary-300 py-5 text-center text-sm text-secondary-500">
          No campus cab has been booked yet.
        </p>
      ) : (
        <div className="space-y-2">
          {departures.map(dep => {
            const current = drivers.find(d => d.id === dep.driver_id)
            return (
              <div key={dep.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-secondary-200 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-secondary-900">
                    {formatDateLabel(dep.date)}, {formatTime(dep.departure_time)}
                  </p>
                  <p className="text-sm text-secondary-600">
                    {shortPlace(dep.origin)} → {shortPlace(dep.destination)} · {dep.current_participants}/{dep.max_seats} booked
                  </p>
                  {(!current || current.placeholder) && (
                    <p className="text-xs font-medium text-amber-700">Needs a real driver</p>
                  )}
                </div>
                <select
                  value={dep.driver_id || ''}
                  disabled={busy === dep.id}
                  onChange={e => void assign(dep, e.target.value)}
                  className="!w-auto !rounded-xl !py-2 text-sm"
                  aria-label="Driver for this departure"
                >
                  <option value="">No driver yet</option>
                  {choicesFor(dep).map(d => (
                    <option key={d.id} value={d.id}>
                      {label(d)}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Cab drivers: add real drivers, or replace a sample one ----------

interface DriverForm extends CabDriverInput {
  id?: string
}

const blank = (): DriverForm => ({ name: '', phone: '', vehicle_type: 'Cab (Sedan)', vehicle_number: '', seats: 4 })

export function CabDriversPanel({
  drivers,
  userId,
  onChanged
}: {
  drivers: CabDriver[]
  userId?: string
  onChanged: () => Promise<void> | void
}) {
  const [form, setForm] = useState<DriverForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const edit = (d: CabDriver) =>
    setForm({
      id: d.id,
      name: d.placeholder ? '' : d.name,
      phone: d.phone || '',
      vehicle_type: d.vehicle_type || 'Cab (Sedan)',
      vehicle_number: d.vehicle_number || '',
      seats: d.seats || 4
    })

  const save = async () => {
    if (!form || !userId) return
    const replacingSample = Boolean(form.id && drivers.find(d => d.id === form.id)?.placeholder)
    const problem =
      form.name.trim().length < 2
        ? "Enter the driver's name."
        : !isTenDigitMobile(form.phone)
        ? "Enter the driver's 10-digit mobile number."
        : null
    if (problem) return setError(problem)
    try {
      setSaving(true)
      setError(null)
      await saveCabDriver(form, userId, form.id)
      setNote(
        replacingSample
          ? `Sample driver replaced by ${form.name.trim()}. His upcoming campus cabs now show his name and number.`
          : form.id
          ? 'Driver updated. Upcoming campus cabs show the new details.'
          : `${form.name.trim()} added. Assign him to a route or a booked departure.`
      )
      setForm(null)
      await onChanged()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const samples = drivers.filter(d => d.placeholder).length

  return (
    <div className="mt-6 border-t border-secondary-100 pt-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-secondary-900">Cab drivers</h3>
        {!form && (
          <button
            type="button"
            onClick={() => {
              setForm(blank())
              setNote(null)
            }}
            className="flex items-center gap-1.5 rounded-xl border border-primary-600 px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"
          >
            <Plus size={14} /> Add driver
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-secondary-600">
        {samples > 0
          ? `${samples} sample driver${samples > 1 ? 's are' : ' is'} standing in. Tap Replace to add the real driver: every cab they're on updates.`
          : 'Drivers available for campus cabs.'}
      </p>
      {note && <p className="mb-3 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-800">{note}</p>}
      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {form && (
        <div className="mb-3 space-y-3 rounded-2xl border border-primary-200 bg-primary-50/40 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="!rounded-xl"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Mobile</label>
              <PhoneInput value={form.phone} onChange={v => setForm({ ...form, phone: v })} required ariaLabel="Driver's mobile" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Vehicle</label>
              <select
                value={form.vehicle_type}
                onChange={e => setForm({ ...form, vehicle_type: e.target.value, seats: DEFAULT_SEATS[e.target.value] || form.seats })}
                className="!rounded-xl !py-2.5"
              >
                {CAB_TYPES.map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Number plate</label>
              <input
                type="text"
                value={form.vehicle_number}
                onChange={e => setForm({ ...form, vehicle_number: e.target.value })}
                placeholder="HR12AB1234"
                className="!rounded-xl uppercase"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Seats</label>
              <select value={form.seats} onChange={e => setForm({ ...form, seats: Number(e.target.value) })} className="!rounded-xl !py-2.5">
                {[3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="flex-1 rounded-xl bg-primary-600 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : form.id ? 'Save driver' : 'Add driver'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-secondary-300 px-4 font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {drivers.map(d => (
          <div
            key={d.id}
            className={`flex items-center gap-3 rounded-xl border p-3 ${d.placeholder ? 'border-dashed border-amber-300 bg-amber-50/50' : 'border-secondary-200'}`}
          >
            <UserCircle size={28} className={d.placeholder ? 'text-amber-500' : 'text-primary-600'} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-medium text-secondary-900">
                {d.name}
                {d.placeholder && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Sample</span>}
              </p>
              <p className="truncate text-xs text-secondary-500">
                {[d.vehicle_type, d.seats ? `${d.seats} seats` : null, d.phone ? `+91 ${d.phone}` : 'no number'].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                edit(d)
                setNote(null)
              }}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              <Pencil size={14} /> {d.placeholder ? 'Replace' : 'Edit'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
