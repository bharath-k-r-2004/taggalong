import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, ChevronLeft, CreditCard, IndianRupee, Phone, UserCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { LocationInput } from '../components/LocationInput'
import { Place } from '../lib/places'
import { DEFAULT_SEATS, DRIVER_VEHICLE_TYPES, RELATIONSHIPS, addDriver, isValidPhone, recordQuote } from '../lib/drivers'
import { friendlyError } from '../lib/errors'

export function AddDriverPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState(DRIVER_VEHICLE_TYPES[0])
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [seats, setSeats] = useState(4)
  const [relationship, setRelationship] = useState('travelled')
  const [about, setAbout] = useState('')
  const [qFrom, setQFrom] = useState<Place | null>(null)
  const [qTo, setQTo] = useState<Place | null>(null)
  const [qPrice, setQPrice] = useState('')
  const [qToll, setQToll] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fieldClass =
    'w-full rounded-xl border border-secondary-300 px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError("Please enter the driver's name.")
    if (!isValidPhone(phone)) return setError("Please enter the driver's 10-digit mobile number.")
    const price = Number(qPrice)
    const addingQuote = Boolean(qFrom?.name || qTo?.name || qPrice)
    if (addingQuote && (!qFrom?.name || !qTo?.name || !(price > 0))) {
      return setError('To record a price, add the route (from and to) and the amount — or leave all three empty.')
    }
    if (!user) return

    try {
      setSaving(true)
      setError(null)
      const result = await addDriver({
        userId: user.id,
        name,
        phone,
        vehicleType: vehicle,
        vehicleNumber,
        seats,
        relationship,
        about
      })
      if (addingQuote && qFrom && qTo) {
        await recordQuote({ driverId: result.id, userId: user.id, from: qFrom, to: qTo, price, tollIncluded: qToll })
      }
      navigate(`/drivers/${result.id}`, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 flex items-center gap-1 rounded-full py-1.5 pr-3 text-secondary-700 hover:bg-secondary-100"
      >
        <ChevronLeft size={20} /> Back
      </button>
      <h1 className="text-2xl font-bold text-secondary-900">Add new driver</h1>
      <p className="mb-5 text-secondary-600">
        Share a driver you trust. Other IIM Rohtak students will be able to find and contact them.
      </p>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-secondary-700">
              <UserCircle size={16} /> Driver name
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter driver's name" className="!rounded-xl" required />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-secondary-700">
              <Phone size={16} /> Phone number
            </label>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-secondary-700">
                <Car size={16} /> Vehicle type
              </label>
              <select
                value={vehicle}
                onChange={e => {
                  setVehicle(e.target.value)
                  setSeats(DEFAULT_SEATS[e.target.value] || 4)
                }}
                className="!rounded-xl !py-2.5"
                aria-label="Vehicle type"
              >
                {DRIVER_VEHICLE_TYPES.map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-secondary-700">
                <CreditCard size={16} /> Vehicle number
              </label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value)}
                placeholder="e.g. HR26AB1234"
                className="!rounded-xl uppercase"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Passenger seats</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  className={`h-10 w-10 rounded-full border text-sm font-semibold ${
                    seats === n ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-300 text-secondary-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">How do you know this driver?</label>
            <select value={relationship} onChange={e => setRelationship(e.target.value)} className="!rounded-xl !py-2.5">
              {RELATIONSHIPS.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              About <span className="font-normal text-secondary-400">(optional)</span>
            </label>
            <textarea
              value={about}
              onChange={e => setAbout(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="e.g. Punctual, knows the Delhi airport route well, prefers daytime trips"
              className="!rounded-xl"
            />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
          <div>
            <p className="flex items-center gap-2 font-semibold text-secondary-900">
              <IndianRupee size={16} /> Quoted price <span className="text-sm font-normal text-secondary-400">(optional)</span>
            </p>
            <p className="text-xs text-secondary-500">The same driver may charge differently per route, so a price is saved with its route.</p>
          </div>
          <LocationInput label="From" placeholder="e.g. IIM Rohtak" value={qFrom} onChange={setQFrom} kind="from" />
          <LocationInput label="To" placeholder="e.g. Delhi Airport" value={qTo} onChange={setQTo} kind="to" near={qFrom} />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={qPrice}
              onChange={e => setQPrice(e.target.value)}
              placeholder="Total amount, e.g. 2000"
              className={fieldClass}
            />
            <div className="flex gap-2">
              {[
                { l: 'Toll incl.', v: true },
                { l: 'Toll extra', v: false }
              ].map(o => (
                <button
                  key={o.l}
                  type="button"
                  onClick={() => setQToll(qToll === o.v ? null : o.v)}
                  className={`flex-1 rounded-xl border px-1 text-xs font-medium ${
                    qToll === o.v ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-300'
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary-600 py-3.5 text-lg font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save driver'}
        </button>
      </form>
    </div>
  )
}
