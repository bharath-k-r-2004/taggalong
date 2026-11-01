import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpDown, Car, IndianRupee, Info, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { LocationInput } from '../components/LocationInput'
import { useExistingDriver } from '../hooks/useExistingDriver'
import { ExistingDriverNotice } from '../components/ExistingDriverNotice'
import { DriverPicker } from '../components/DriverPicker'
import { PhoneInput, isTenDigitMobile } from '../components/PhoneInput'
import { Place } from '../lib/places'
import {
  AUTO_MAX_MINUTES,
  FLEXIBILITY_OPTIONS,
  autoAllowed,
  drivingMinutes,
  formatDateLabel,
  formatDuration,
  formatRupees,
  formatTime,
  isAuto,
  todayString
} from '../lib/rides'
import { RELATIONSHIPS, RankedDriver, addDriver, recordQuote } from '../lib/drivers'
import { friendlyError } from '../lib/errors'

const VEHICLES = ['Cab (Sedan)', 'Cab (SUV)', 'Cab (Hatchback)', 'Own car', 'Auto', 'Other']
// An auto's or your own car's driver number is optional; every cab (and other hired vehicle) needs one
const NUMBER_OPTIONAL = ['Auto', 'Own car']

type Mode = 'driver' | 'group'

interface Prefill {
  from?: Place | null
  to?: Place | null
  date?: string
  time?: string
  mode?: Mode
  driverId?: string // chosen on a driver's profile
  convertRideId?: string // a travel group getting its driver
  editRideId?: string // the poster changing an existing ride
  fare?: number | null
  toll?: boolean | null
  vehicleType?: string | null
  vehicleNumber?: string | null
  driverName?: string | null
  phone?: string | null
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
  const editing = Boolean(prefill.editRideId)
  const updating = converting || editing
  const minSeats = Math.max(2, prefill.onBoard || 1)

  // Coming from a driver's profile with no driver of your own: that's the "Not yet" flow with the driver chosen
  const [mode, setMode] = useState<Mode>(
    converting ? 'driver' : prefill.mode || (prefill.driverId && !editing ? 'group' : 'driver')
  )
  const [from, setFrom] = useState<Place | null>(prefill.from || null)
  const [to, setTo] = useState<Place | null>(prefill.to || null)
  const [date, setDate] = useState(prefill.date || todayString())
  const [time, setTime] = useState(prefill.time || '')
  const [flex, setFlex] = useState<number | null>(prefill.flex !== undefined ? prefill.flex : 30)
  const [totalCost, setTotalCost] = useState(prefill.fare ? String(Math.round(Number(prefill.fare))) : '')
  const [toll, setToll] = useState<boolean | null>(prefill.toll ?? null)
  const [seats, setSeats] = useState(String(Math.max(prefill.seats || 4, minSeats)))
  const [vehicleType, setVehicleType] = useState(prefill.vehicleType || VEHICLES[0])
  const [vehicleNumber, setVehicleNumber] = useState(prefill.vehicleNumber || '')
  const [driverName, setDriverName] = useState(prefill.driverName || '')
  const [phone, setPhone] = useState((prefill.phone || '').replace(/\D/g, '').slice(-10))
  const [notes, setNotes] = useState(prefill.notes || '')
  const [picked, setPicked] = useState<RankedDriver | null>(null)
  const [pickSource, setPickSource] = useState<'auto' | 'manual' | null>(null)
  const [noDriver, setNoDriver] = useState(false) // chose to post without a driver for now
  const [autoBest, setAutoBest] = useState<RankedDriver | null>(null)
  const [quoteNote, setQuoteNote] = useState<string | null>(null)
  const [saveToDirectory, setSaveToDirectory] = useState(true)
  const [relationship, setRelationship] = useState('travelled')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phoneDigits = phone // the phone box only ever holds digits, at most 10
  const numberRequired = !NUMBER_OPTIONAL.includes(vehicleType)
  const phoneValid = isTenDigitMobile(phone)
  // Only hired drivers with a proper 10-digit number go into the community directory
  // (never "Own car": the student is the driver)
  const ownCar = vehicleType === 'Own car'
  const canSaveToDirectory = phoneValid && !ownCar
  const keptDriverId = editing && prefill.driverId && phoneDigits === (prefill.phone || '') ? prefill.driverId : null
  // Number already in the directory: link the ride to that driver instead of adding a duplicate
  const existing = useExistingDriver(phone, Boolean(picked || keptDriverId || ownCar))
  // A new driver saved to the directory needs a name; otherwise the name is optional
  const nameNeeded = !picked && !existing && saveToDirectory && canSaveToDirectory
  const cost = Number(totalCost)
  const seatCount = Number(seats)
  const perPerson = cost > 0 && seatCount > 0 ? cost / seatCount : null
  // Trips over an hour by road only offer cabs (and your own car)
  const tripMinutes = drivingMinutes(from, to)
  const autoOk = autoAllowed(tripMinutes)
  const allowedVehicles = autoOk ? VEHICLES : VEHICLES.filter(v => !isAuto(v))
  const vehicleOptions = allowedVehicles.includes(vehicleType) ? allowedVehicles : [vehicleType, ...allowedVehicles]
  const [vehicleNote, setVehicleNote] = useState<string | null>(null)
  useEffect(() => {
    if (!autoOk && isAuto(vehicleType) && !picked) {
      setVehicleType(VEHICLES[0])
      setVehicleNote(`Changed to a cab: this trip takes about ${formatDuration(tripMinutes || 0)}, and autos are for trips up to ${AUTO_MAX_MINUTES} minutes.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOk])
  // The community driver list (and auto-assign) is for students without a driver of their own,
  // and for a travel group that's now getting its driver
  const showPicker = converting || (mode === 'group' && !editing)
  // "Not yet" with a driver assigned posts a normal ride; without one, a travel group
  const postsAsGroup = mode === 'group' && !picked
  const routeSet = Boolean(from?.name && to?.name)

  // Choosing a community driver fills in the details below
  const clearDriver = () => {
    setPicked(null)
    setPickSource(null)
    setQuoteNote(null)
    if (editing) return
    setDriverName('')
    setPhone('')
    setVehicleNumber('')
    if (!converting) setVehicleType(VEHICLES[0])
    setTotalCost('')
    setToll(null)
  }

  const pickDriver = (item: RankedDriver | null, source: 'auto' | 'manual' = 'manual') => {
    if (!item) return clearDriver()
    setPicked(item)
    setPickSource(source)
    setQuoteNote(null)
    const d = item.driver
    setDriverName(d.name)
    setPhone((d.phone || '').replace(/\D/g, '').slice(-10))
    if (d.vehicle_type) setVehicleType(d.vehicle_type)
    setVehicleNumber(d.vehicle_number || '')
    if (d.seats) setSeats(String(Math.min(7, Math.max(minSeats, d.seats))))
    if (item.routeQuote && !editing) {
      setTotalCost(String(Math.round(Number(item.routeQuote.quoted_price))))
      setToll(item.routeQuote.toll_included)
      const when = new Date(item.routeQuote.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      setQuoteNote(`Fare filled from a community quote recorded on ${when}. Please confirm it with the driver.`)
    }
  }

  // The list reports the best available driver whenever the route, date or time changes.
  // Assign it unless the student picked someone themselves or chose to go without a driver.
  const handleAutoBest = (item: RankedDriver | null) => {
    setAutoBest(item)
    if (!showPicker || pickSource === 'manual' || noDriver) return
    if (item) {
      if (item.driver.id !== picked?.driver.id || pickSource !== 'auto') pickDriver(item, 'auto')
    } else if (pickSource === 'auto') {
      clearDriver()
    }
  }

  const chooseFromList = (item: RankedDriver | null) => {
    if (item) {
      setNoDriver(false)
      pickDriver(item, 'manual')
    } else {
      // tapped the chosen driver again: go without one
      clearDriver()
      setNoDriver(true)
    }
  }

  const goWithoutDriver = () => {
    clearDriver()
    setNoDriver(true)
  }

  const switchMode = (next: Mode) => {
    if (next === mode) return
    clearDriver()
    setNoDriver(false)
    setMode(next)
  }

  const validate = (): string | null => {
    if (!from?.name) return 'Please choose where the ride starts.'
    if (!to?.name) return 'Please choose where the ride is going.'
    if (from.name.trim().toLowerCase() === to.name.trim().toLowerCase()) return 'Pickup and drop cannot be the same place.'
    if (!date || !time) return 'Please set the date and time.'
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    if (new Date(y, m - 1, d, hh, mm).getTime() < Date.now() - 5 * 60 * 1000) return 'The departure time has already passed.'
    if (postsAsGroup) return null
    if (!(cost > 0)) return 'Please enter the total fare for the ride.'
    if (!autoOk && isAuto(vehicleType))
      return `This trip takes about ${formatDuration(tripMinutes || 0)} by road. Please choose a cab: autos are for trips up to ${AUTO_MAX_MINUTES} minutes.`
    if (cost > 100000) return 'Please enter a total fare between ₹1 and ₹1,00,000.'
    if (numberRequired && !phoneValid) return "Please enter the driver's 10-digit mobile number."
    if (!numberRequired && phone.trim() && !phoneValid)
      return `Enter a valid 10-digit number, or leave it empty for ${vehicleType === 'Auto' ? 'an auto' : 'your own car'}.`
    if (nameNeeded && driverName.trim().length < 2)
      return "Please add the driver's name so other students can find them in the directory."
    return null
  }

  // After an edit, riders who already joined get a note in the ride chat
  const announceChange = async (rideId: string) => {
    if (!user || (prefill.onBoard || 1) < 2) return
    const fare = mode === 'driver' && cost > 0 ? `, total fare ${formatRupees(cost)}` : ''
    await supabase
      .from('messages')
      .insert({
        ride_id: rideId,
        user_id: user.id,
        content: `📝 I updated the ride: ${formatDateLabel(date)} at ${formatTime(time)}${fare}. Please check the details.`
      })
      .then(({ error: chatError }) => chatError && console.error('Chat note not sent:', chatError))
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

      // Editing a travel group: only trip details change
      if (mode === 'group' && editing && prefill.editRideId) {
        const { error: updateError } = await supabase.from('rides').update(route).eq('id', prefill.editRideId)
        if (updateError) throw updateError
        await announceChange(prefill.editRideId)
        navigate(`/ride/${prefill.editRideId}`, { replace: true, state: { justPosted: 'edited' } })
        return
      }

      // "Not yet" without a driver: a travel group with no driver or fare yet
      if (postsAsGroup) {
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
      let driverId = picked?.driver.id || keptDriverId || existing?.id || null
      if (!driverId && saveToDirectory && canSaveToDirectory) {
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
        driver_phone: phoneValid ? phoneDigits : null,
        driver_id: driverId
      }

      let rideId: string
      if (editing && prefill.editRideId) {
        const { error: updateError } = await supabase.from('rides').update(rideFields).eq('id', prefill.editRideId)
        if (updateError) throw updateError
        rideId = prefill.editRideId
      } else if (converting && prefill.convertRideId) {
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

      // Every ride adds a route price to the driver's history (edits only if the price or driver changed)
      const priceChanged = !editing || cost !== Number(prefill.fare) || driverId !== (prefill.driverId || null)
      if (driverId && priceChanged) {
        await recordQuote({ driverId, userId: user.id, from, to, price: cost, tollIncluded: toll, rideId }).catch(err =>
          console.error('Quote not recorded:', err)
        )
      }

      if (editing) await announceChange(rideId)
      navigate(`/ride/${rideId}`, {
        replace: true,
        state: {
          justPosted: editing ? 'edited' : converting ? 'converted' : pickSource === 'auto' ? 'assigned' : picked ? 'picked' : 'ride'
        }
      })
    } catch (err) {
      console.error('Create ride error:', err)
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  const fieldClass =
    'w-full rounded-xl border border-secondary-300 px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-secondary-900">
        {editing ? 'Edit ride' : converting ? 'Add a driver to your group' : 'Post a ride'}
      </h1>
      <p className="mb-6 text-secondary-600">
        {editing
          ? 'Students who already joined will see the new details, and get a note in the ride chat.'
          : converting
          ? 'Your group becomes a ride with a driver and fare that members can see.'
          : mode === 'group'
          ? "No driver yet? We'll assign a community driver who has driven your route, or you can gather travellers first."
          : 'Share your cab or car and split the fare with other students.'}
      </p>

      {/* Do you have a driver? */}
      {!updating && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          {[
            { value: 'driver' as Mode, icon: Car, title: 'I have a driver', text: "Enter your driver's details" },
            { value: 'group' as Mode, icon: Users, title: 'Not yet', text: "We'll assign a community driver" }
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => switchMode(opt.value)}
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
                {postsAsGroup ? 'Preferred time' : 'Departure time'}
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

        {/* Community driver: shown when you don't have a driver of your own */}
        {showPicker && (
          <section className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-secondary-900">{converting ? 'Choose a driver' : 'Your driver'}</h2>
            {picked && pickSource === 'auto' ? (
              <div className="mb-3 mt-2 rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Sparkles size={16} className="shrink-0 text-primary-600" /> {picked.driver.name} has been assigned automatically
                </p>
                <p className="mt-1 text-primary-800">
                  Has a recorded price for this route and isn't booked through TagAlong around your time. You'll see his number
                  after posting: call him to confirm he's free.
                </p>
                {!converting && (
                  <button type="button" onClick={goWithoutDriver} className="mt-2 text-sm font-semibold text-primary-700 underline">
                    Post without a driver for now
                  </button>
                )}
              </div>
            ) : picked ? (
              <div className="mb-3 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary-50 px-3 py-2 text-sm text-secondary-700">
                <span>
                  You chose <strong>{picked.driver.name}</strong>. Call him after posting to confirm.
                </span>
                {!converting && (
                  <button type="button" onClick={goWithoutDriver} className="font-semibold text-primary-700 underline">
                    Post without a driver
                  </button>
                )}
              </div>
            ) : noDriver ? (
              <div className="mb-3 mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {converting
                  ? "Pick a driver below, or enter your own driver's details further down."
                  : 'Posting without a driver. Students can still join, and you can add a driver later from your ride page.'}
                {autoBest && (
                  <button
                    type="button"
                    onClick={() => {
                      setNoDriver(false)
                      pickDriver(autoBest, 'auto')
                    }}
                    className="ml-1 font-semibold text-primary-700 underline"
                  >
                    Assign {autoBest.driver.name} instead
                  </button>
                )}
              </div>
            ) : (
              <p className="mb-3 mt-1 text-sm text-secondary-500">
                {!routeSet
                  ? "Enter where you're going and we'll assign a community driver who has driven that route."
                  : converting
                  ? "No community driver has a price for this route yet. Pick one below, or enter your own driver's details further down."
                  : 'No community driver has a price for this route yet (or they are busy at that time), so this will post as a travel group. You can still pick a driver below and enter the fare.'}
              </p>
            )}
            <DriverPicker
              from={from}
              to={to}
              userId={user?.id}
              selectedId={picked?.driver.id || null}
              onSelect={chooseFromList}
              preselectId={editing ? null : prefill.driverId || null}
              date={date}
              time={time}
              onAutoBest={handleAutoBest}
              selectedTag={pickSource === 'auto' ? 'Auto-assigned' : 'Chosen'}
            />
          </section>
        )}

        {postsAsGroup ? (
          /* Travel group: just the group size and notes */
          <section className="space-y-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Group size you're aiming for</label>
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
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Info size={16} className="mt-0.5 shrink-0" />
              Students can join your group now. Once you have a driver, add the driver and fare from your ride page and the cost is split automatically.
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

            {/* Community driver chosen: vehicle and number come from the directory */}
            {mode === 'group' ? (
              <section className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
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
              </section>
            ) : (
              <>
                {/* Vehicle & contact */}
                <section className="space-y-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-secondary-700">Vehicle</label>
                      <select
                    value={vehicleType}
                    onChange={e => {
                      setVehicleType(e.target.value)
                      setVehicleNote(null)
                    }}
                    className="!rounded-xl !py-2.5"
                  >
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
                  {vehicleNote && <p className="text-xs text-amber-800">{vehicleNote}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-secondary-700">
                        Driver name{' '}
                        <span className="font-normal text-secondary-400">{nameNeeded ? '(needed for the directory)' : '(optional)'}</span>
                      </label>
                      <input
                        type="text"
                        required={nameNeeded}
                        minLength={nameNeeded ? 2 : undefined}
                        value={driverName}
                        onChange={e => setDriverName(e.target.value)}
                        placeholder="e.g. Ramesh (or your name if you drive)"
                        className="!rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-secondary-700">
                        Driver's number {!numberRequired && <span className="font-normal text-secondary-400">(optional)</span>}
                      </label>
                      <PhoneInput value={phone} onChange={setPhone} required={numberRequired} ariaLabel="Driver's number" />
                    </div>
                  </div>
                  {existing && !picked && (
                    <ExistingDriverNotice driver={existing}>
                      <button
                        type="button"
                        onClick={() => {
                          setDriverName(existing.name)
                          if (existing.vehicle_type && VEHICLES.includes(existing.vehicle_type)) setVehicleType(existing.vehicle_type)
                          if (existing.vehicle_number) setVehicleNumber(existing.vehicle_number)
                        }}
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
                      >
                        Use {existing.name.split(' ')[0]}'s details
                      </button>
                      <span className="self-center text-xs text-primary-800">Your ride will be linked to this driver, not added again.</span>
                    </ExistingDriverNotice>
                  )}
                  <p className="text-xs text-secondary-500">
                    {numberRequired
                      ? "The driver's number is shown only to you and the students whose request you accept."
                      : `Optional for ${vehicleType === 'Auto' ? 'an auto' : 'your own car'}. If you add it, only you and accepted students see it.`}
                  </p>

                  {/* New driver: offer to add them to the community directory */}
                  {!picked && !keptDriverId && !canSaveToDirectory && !ownCar && (
                    <p className="rounded-xl bg-secondary-50 px-3 py-2 text-xs text-secondary-600">
                      Add the driver's 10-digit number to save them to the TagAlong driver directory.
                    </p>
                  )}
                  {!picked && !keptDriverId && !existing && canSaveToDirectory && (
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
          </>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary-600 py-3.5 text-lg font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
        >
          {saving
            ? 'Saving...'
            : editing
            ? 'Save changes'
            : converting
            ? 'Save driver & update ride'
            : postsAsGroup
            ? 'Post & find travellers'
            : picked && mode === 'group'
            ? `Post ride with ${picked.driver.name.split(' ')[0]}`
            : 'Post ride'}
        </button>
      </form>
    </div>
  )
}
