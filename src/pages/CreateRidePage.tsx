import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpDown, Car, IndianRupee, Info, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { LocationInput } from '../components/LocationInput'
import { DriverPicker } from '../components/DriverPicker'
import { Place } from '../lib/places'
import { FLEXIBILITY_OPTIONS, formatRupees, todayString } from '../lib/rides'
import { RELATIONSHIPS, RankedDriver, addDriver, recordQuote } from '../lib/drivers'

const VEHICLES = ['Cab (Sedan)', 'Cab (SUV)', 'Cab (Hatchback)', 'Own car', 'Auto', 'Other']

type Mode = 'driver' | 'group'

interface Prefill {
  from?: Place | null
  to?: Place | null
  date?: string
  time?: string
  mode?: Mode
  driverId?: string // chosen on a driver's profile
  convertRideId?: string // a travel group getting its driver
  seats?: number
  onBoard?: number
  flex?: number | null
  notes?: string | null
}

export function CreateRidePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const prefill = (useLocation().state as Prefill | null) || {}
  const converting = Boolean(prefill.convertRideId)
  const minSeats = Math.max(2, prefill.onBoard || 1)

  const [mode, setMode] = useState<Mode>(converting ? 'driver' : prefill.mode || 'driver')
  const [from, setFrom] = useState<Place | null>(prefill.from || null)
  const [to, setTo] = useState<Place | null>(prefill.to || null)
  const [date, setDate] = useState(prefill.date || todayString())
  const [time, setTime] = useState(prefill.time || '')
  const [flex, setFlex] = useState<number | null>(prefill.flex !== undefined ? prefill.flex : 30)
  const [totalCost, setTotalCost] = useState('')
  const [toll, setToll] = useState<boolean | null>(null)
  const [seats, setSeats] = useState(String(Math.max(prefill.seats || 4, minSeats)))
  const [vehicleType, setVehicleType] = useState(VEHICLES[0])
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState(prefill.notes || '')
  const [picked, setPicked] = useState<RankedDriver | null>(null)
  const [quoteNote, setQuoteNote] = useState<string | null>(null)
  const [saveToDirectory, setSaveToDirectory] = useState(true)
  const [relationship, setRelationship] = useState('travelled')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cost = Number(totalCost)
  const seatCount = Number(seats)
  const perPerson = cost > 0 && seatCount > 0 ? cost / seatCount : null
  const vehicleOptions = VEHICLES.includes(vehicleType) ? VEHICLES : [vehicleType, ...VEHICLES]

  // Choosing a community driver fills in the details below
  const pickDriver = (item: RankedDriver | null) => {
    setPicked(item)
    setQuoteNote(null)
    if (!item) return
    const d = item.driver
    setDriverName(d.name)
    setPhone(d.phone)
    if (d.vehicle_type) setVehicleType(d.vehicle_type)
    setVehicleNumber(d.vehicle_number || '')
    if (d.seats) setSeats(String(Math.min(7, Math.max(minSeats, d.seats))))
    if (item.routeQuote) {
      setTotalCost(String(Math.round(Number(item.routeQuote.quoted_price))))
      setToll(item.routeQuote.toll_included)
      const when = new Date(item.routeQuote.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      setQuoteNote(`Fare filled from a community quote recorded on ${when}. Please confirm it with the driver.`)
    }
  }

  const validate = (): string | null => {
    if (!from?.name) return 'Please choose where the ride starts.'
    if (!to?.name) return 'Please choose where the ride is going.'
    if (from.name.trim().toLowerCase() === to.name.trim().toLowerCase()) return 'Pickup and drop cannot be the same place.'
    if (!date || !time) return 'Please set the date and time.'
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    if (new Date(y, m - 1, d, hh, mm).getTime() < Date.now() - 5 * 60 * 1000) return 'The departure time has already passed.'
    if (mode === 'group') return null
    if (!(cost > 0)) return 'Please enter the total fare for the ride.'
    const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
    if (!/^[6-9]\d{9}$/.test(digits)) return "Please enter the driver's 10-digit mobile number."
    if (!picked && saveToDirectory && driverName.trim().length < 2)
      return "Please add the driver's name so other students can find them in the directory."
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

      const route = {
        origin: from.name.trim(),
        destination: to.name.trim(),
        origin_lat: from.lat ?? null,
        origin_lng: from.lng ?? null,
        destination_lat: to.lat ?? null,
        destination_lng: to.lng ?? null,
        date,
        departure_time: time,
        time_flexibility: flex,
        max_seats: seatCount,
        notes: notes.trim() || null
      }

      // "Find travellers first": a travel group with no driver or fare yet
      if (mode === 'group') {
        const { data, error: insertError } = await supabase
          .from('rides')
          .insert({ ...route, creator_id: user.id, current_participants: 1, status: 'looking' })
          .select('id')
          .single()
        if (insertError) throw insertError
        navigate(`/ride/${data.id}`, { replace: true, state: { justPosted: 'group' } })
        return
      }

      // Save a new driver to the community directory (or reuse the listed one)
      let driverId = picked?.driver.id || null
      if (!driverId && saveToDirectory) {
        const result = await addDriver({
          userId: user.id,
          name: driverName,
          phone,
          vehicleType: vehicleType === 'Other' ? '' : vehicleType,
          vehicleNumber,
          seats: seatCount,
          relationship
        })
        driverId = result.id
      }

      const rideFields = {
        ...route,
        total_cost: cost,
        toll_included: toll,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.trim().toUpperCase() || null,
        driver_name: driverName.trim() || user.user_metadata?.name || null,
        driver_phone: phone.replace(/\D/g, '').slice(-10),
        driver_id: driverId
      }

      let rideId: string
      if (converting && prefill.convertRideId) {
        const { error: updateError } = await supabase
          .from('rides')
          .update({ ...rideFields, status: (prefill.onBoard || 1) >= seatCount ? 'full' : 'open' })
          .eq('id', prefill.convertRideId)
        if (updateError) throw updateError
        rideId = prefill.convertRideId
      } else {
        const { data, error: insertError } = await supabase
          .from('rides')
          .insert({ ...rideFields, creator_id: user.id, current_participants: 1, status: 'open' })
          .select('id')
          .single()
        if (insertError) throw insertError
        rideId = data.id
      }

      // Every ride adds a route price to the driver's history
      if (driverId) {
        await recordQuote({ driverId, userId: user.id, from, to, price: cost, tollIncluded: toll, rideId }).catch(err =>
          console.error('Quote not recorded:', err)
        )
      }

      navigate(`/ride/${rideId}`, { replace: true, state: { justPosted: converting ? 'converted' : 'ride' } })
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
      <h1 className="text-2xl font-bold text-secondary-900">
        {converting ? 'Add a driver to your group' : mode === 'group' ? 'Find travellers first' : 'Post a ride'}
      </h1>
      <p className="mb-6 text-secondary-600">
        {converting
          ? 'Your group becomes a ride with a driver and fare that members can see.'
          : mode === 'group'
          ? "No driver yet? Post your trip, gather students going the same way, then pick a driver together."
          : 'Share your cab or car and split the fare with other students.'}
      </p>

      {/* Do you have a driver? */}
      {!converting && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          {[
            { value: 'driver' as Mode, icon: Car, title: 'I have a driver', text: 'Share the ride and split the fare' },
            { value: 'group' as Mode, icon: Users, title: 'Not yet', text: 'Find fellow travellers first' }
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`rounded-2xl border p-3 text-left transition ${
                mode === opt.value
                  ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-100'
                  : 'border-secondary-200 bg-white hover:border-primary-300'
              }`}
            >
              <opt.icon size={22} className={mode === opt.value ? 'text-primary-700' : 'text-secondary-500'} />
              <p className="mt-1 font-semibold text-secondary-900">{opt.title}</p>
              <p className="text-xs text-secondary-600">{opt.text}</p>
            </button>
          ))}
        </div>
      )}

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
        <section className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Date</label>
              <input type="date" value={date} min={todayString()} onChange={e => setDate(e.target.value)} className="!rounded-xl" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">
                {mode === 'group' ? 'Preferred time' : 'Departure time'}
              </label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="!rounded-xl" required />
            </div>
          </div>
          <p className="mb-1.5 mt-3 text-sm font-medium text-secondary-700">Time flexibility</p>
          <div className="flex flex-wrap gap-2">
            {FLEXIBILITY_OPTIONS.map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setFlex(opt.minutes)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  flex === opt.minutes
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-secondary-200 bg-white text-secondary-700 hover:border-primary-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {mode === 'group' ? (
          /* Travel group: just the group size and notes */
          <section className="space-y-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Group size you're aiming for</label>
              <select value={seats} onChange={e => setSeats(e.target.value)} className="!rounded-xl !py-2.5">
                {[2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>
                    {n} people (incl. you)
                  </option>
                ))}
              </select>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Info size={16} className="mt-0.5 shrink-0" />
              Students can join your group now. Once you choose a driver, add the driver and fare from your ride page and the cost is split automatically.
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
                placeholder="Meeting point, luggage, preferred car type..."
                className="!rounded-xl"
              />
            </div>
          </section>
        ) : (
          <>
            {/* Select your driver (community directory) */}
            <section className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-secondary-900">Select your driver</h2>
              <p className="mb-3 text-sm text-secondary-500">
                Drivers IIM Rohtak students have travelled with. Not listed? Enter your driver's details further below.
              </p>
              <DriverPicker
                from={from}
                to={to}
                userId={user?.id}
                selectedId={picked?.driver.id || null}
                onSelect={pickDriver}
                preselectId={prefill.driverId || null}
              />
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
                    {[2, 3, 4, 5, 6, 7]
                      .filter(n => n >= minSeats)
                      .map(n => (
                        <option key={n} value={n}>
                          {n} people (incl. you)
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm font-medium text-secondary-700">Toll included?</span>
                {[
                  { l: 'Yes', v: true },
                  { l: 'No', v: false }
                ].map(o => (
                  <button
                    key={o.l}
                    type="button"
                    onClick={() => setToll(toll === o.v ? null : o.v)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium ${
                      toll === o.v ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-300 text-secondary-700'
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              {quoteNote && <p className="mt-2 text-xs text-primary-700">{quoteNote}</p>}
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
                    {vehicleOptions.map(v => (
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
                    placeholder="e.g. Ramesh (or your name if you drive)"
                    className="!rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-secondary-700">Driver's number</label>
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
                The driver's number is shown only to you and the students whose request you accept. Driving yourself? Enter your own number.
              </p>

              {/* New driver: offer to add them to the community directory */}
              {!picked && (
                <div className="space-y-2 rounded-xl bg-secondary-50 p-3">
                  <label className="flex items-start gap-2 text-sm text-secondary-800">
                    <input
                      type="checkbox"
                      checked={saveToDirectory}
                      onChange={e => setSaveToDirectory(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary-600"
                    />
                    <span>
                      Add this driver to the TagAlong driver directory
                      <span className="block text-xs text-secondary-500">
                        Other students can then find and contact them. Untick if you're driving yourself.
                      </span>
                    </span>
                  </label>
                  {saveToDirectory && (
                    <select value={relationship} onChange={e => setRelationship(e.target.value)} className="!rounded-xl !py-2">
                      {RELATIONSHIPS.map(r => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

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
          </>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary-600 py-3.5 text-lg font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Posting...' : converting ? 'Save driver & update ride' : mode === 'group' ? 'Post & find travellers' : 'Post ride'}
        </button>
      </form>
    </div>
  )
}
