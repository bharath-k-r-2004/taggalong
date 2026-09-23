import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpDown, IndianRupee, Info } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { LocationInput } from '../components/LocationInput'
import { Place } from '../lib/places'
import { formatRupees, todayString } from '../lib/rides'

const VEHICLES = ['Cab (Sedan)', 'Cab (SUV)', 'Cab (Hatchback)', 'Own car', 'Auto', 'Other']

interface Prefill {
  from?: Place | null
  to?: Place | null
  date?: string
}

export function CreateRidePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const prefill = (useLocation().state as Prefill | null) || {}

  const [from, setFrom] = useState<Place | null>(prefill.from || null)
  const [to, setTo] = useState<Place | null>(prefill.to || null)
  const [date, setDate] = useState(prefill.date || todayString())
  const [time, setTime] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [seats, setSeats] = useState('4')
  const [vehicleType, setVehicleType] = useState(VEHICLES[0])
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cost = Number(totalCost)
  const seatCount = Number(seats)
  const perPerson = cost > 0 && seatCount > 0 ? cost / seatCount : null

  const validate = (): string | null => {
    if (!from?.name) return 'Please choose where the ride starts.'
    if (!to?.name) return 'Please choose where the ride is going.'
    if (from.name.trim().toLowerCase() === to.name.trim().toLowerCase()) return 'Pickup and drop cannot be the same place.'
    if (!date || !time) return 'Please set the date and time.'
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    if (new Date(y, m - 1, d, hh, mm).getTime() < Date.now() - 5 * 60 * 1000) return 'The departure time has already passed.'
    if (!(cost > 0)) return 'Please enter the total fare for the ride.'
    const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
    if (!/^[6-9]\d{9}$/.test(digits)) return 'Please enter a valid 10-digit mobile number.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!user || !from || !to) return

    try {
      setSaving(true)
      setError(null)
      const { data, error: insertError } = await supabase
        .from('rides')
        .insert({
          creator_id: user.id,
          origin: from.name.trim(),
          destination: to.name.trim(),
          origin_lat: from.lat ?? null,
          origin_lng: from.lng ?? null,
          destination_lat: to.lat ?? null,
          destination_lng: to.lng ?? null,
          date,
          departure_time: time,
          total_cost: cost,
          max_seats: seatCount,
          current_participants: 1,
          vehicle_type: vehicleType,
          vehicle_number: vehicleNumber.trim().toUpperCase() || null,
          driver_name: driverName.trim() || user.user_metadata?.name || null,
          driver_phone: phone.replace(/\D/g, '').slice(-10),
          notes: notes.trim() || null,
          status: 'open'
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      navigate(`/ride/${data.id}`, { replace: true })
    } catch (err) {
      console.error('Create ride error:', err)
      setError(err instanceof Error ? err.message : 'Could not post the ride. Please try again.')
      setSaving(false)
    }
  }

  const fieldClass =
    'w-full rounded-xl border border-secondary-300 px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-secondary-900">Post a ride</h1>
      <p className="mb-6 text-secondary-600">Share your cab or car and split the fare with other students.</p>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Route */}
        <section className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
          <div className="relative space-y-3">
            <LocationInput
              label="From"
              placeholder="Pickup: campus, station, city..."
              value={from}
              onChange={setFrom}
              kind="from"
              allowCurrentLocation
            />
            <LocationInput label="To" placeholder="Where are you going?" value={to} onChange={setTo} kind="to" near={from} />
            <button
              type="button"
              onClick={() => {
                setFrom(to)
                setTo(from)
              }}
              className="absolute right-12 top-[3.35rem] z-10 rounded-full border border-secondary-200 bg-white p-1.5 text-secondary-600 shadow-sm hover:bg-secondary-50"
              title="Swap pickup and drop"
              aria-label="Swap pickup and drop"
            >
              <ArrowUpDown size={16} />
            </button>
          </div>
        </section>

        {/* When */}
        <section className="grid grid-cols-2 gap-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Date</label>
            <input type="date" value={date} min={todayString()} onChange={e => setDate(e.target.value)} className="!rounded-xl" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Departure time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="!rounded-xl" required />
          </div>
        </section>

        {/* Fare & seats */}
        <section className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Total fare (₹)</label>
              <div className="relative">
                <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={totalCost}
                  onChange={e => setTotalCost(e.target.value)}
                  placeholder="1200"
                  className={`${fieldClass} pl-9`}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Total seats</label>
              <select value={seats} onChange={e => setSeats(e.target.value)} className="!rounded-xl !py-2.5">
                {[2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>
                    {n} people (incl. you)
                  </option>
                ))}
              </select>
            </div>
          </div>
          {perPerson !== null && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-800">
              <Info size={16} className="shrink-0" />
              When all {seatCount} seats fill, each person pays about <strong>{formatRupees(perPerson)}</strong>.
            </p>
          )}
        </section>

        {/* Vehicle & contact */}
        <section className="space-y-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Vehicle</label>
              <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className="!rounded-xl !py-2.5">
                {VEHICLES.map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">
                Vehicle number <span className="font-normal text-secondary-400">(optional)</span>
              </label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value)}
                placeholder="HR12AB1234"
                className="!rounded-xl uppercase"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">
                Driver name <span className="font-normal text-secondary-400">(optional)</span>
              </label>
              <input
                type="text"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                placeholder="Leave blank if you drive"
                className="!rounded-xl"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Contact number</label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="98765 43210"
                className={fieldClass}
                required
              />
            </div>
          </div>
          <p className="text-xs text-secondary-500">
            Your contact number is shown only to students whose request you accept.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              Notes <span className="font-normal text-secondary-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Meeting point, luggage space, stops on the way..."
              className="!rounded-xl"
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary-600 py-3.5 text-lg font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Posting...' : 'Post ride'}
        </button>
      </form>
    </div>
  )
}
