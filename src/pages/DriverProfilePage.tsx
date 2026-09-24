import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CalendarClock,
  Car,
  ChevronLeft,
  HeartHandshake,
  IndianRupee,
  Info,
  MessageCircle,
  Phone,
  Plus,
  UserCircle,
  Users
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { LocationInput } from '../components/LocationInput'
import { Place } from '../lib/places'
import { formatDateLabel, formatRupees, formatTime, shortPlace } from '../lib/rides'
import { friendlyError } from '../lib/errors'
import {
  Driver,
  DriverBooking,
  DriverQuote,
  DriverTraveller,
  QUOTE_DISCLAIMER,
  RELATIONSHIPS,
  fetchDriverBookings,
  fetchDrivers,
  fetchQuotes,
  fetchTravellers,
  introducedBy,
  recordQuote
} from '../lib/drivers'

export function DriverProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [driver, setDriver] = useState<Driver | null>(null)
  const [quotes, setQuotes] = useState<DriverQuote[]>([])
  const [travellers, setTravellers] = useState<DriverTraveller[]>([])
  const [bookings, setBookings] = useState<DriverBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showNumber, setShowNumber] = useState(false)
  const [vouching, setVouching] = useState(false)
  const [vouchType, setVouchType] = useState<'travelled' | 'know'>('travelled')
  const [busy, setBusy] = useState(false)

  // add-a-quote form
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [qFrom, setQFrom] = useState<Place | null>(null)
  const [qTo, setQTo] = useState<Place | null>(null)
  const [qPrice, setQPrice] = useState('')
  const [qToll, setQToll] = useState<boolean | null>(null)
  const [qNotes, setQNotes] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [all, q, t, b] = await Promise.all([
        fetchDrivers(),
        fetchQuotes(id),
        fetchTravellers(id),
        fetchDriverBookings().catch(() => [] as DriverBooking[])
      ])
      setDriver(all.find(d => d.id === id) || null)
      setQuotes(q)
      setTravellers(t)
      setBookings(b.filter(x => x.driver_id === id))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }
  if (!driver) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-secondary-700">{error || 'This driver is not in the directory.'}</p>
        <button type="button" onClick={() => navigate('/drivers')} className="mt-4 font-semibold text-primary-600 hover:underline">
          Back to drivers
        </button>
      </div>
    )
  }

  const vouch = async () => {
    try {
      setBusy(true)
      const { error: vouchError } = await supabase
        .from('driver_vouches')
        .insert({ driver_id: driver.id, user_id: user!.id, vouch_type: vouchType })
      if (vouchError && vouchError.code !== '23505') throw vouchError // 23505 = already vouched (double tap)
      setVouching(false)
      setNotice('Thanks! Your vouch helps other students choose.')
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const unvouch = async () => {
    setBusy(true)
    await supabase.from('driver_vouches').delete().eq('driver_id', driver.id).eq('user_id', user!.id)
    await load()
    setBusy(false)
  }

  const saveQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = Number(qPrice)
    if (!qFrom?.name || !qTo?.name || !(price > 0)) {
      setError('Please add the route and the quoted price.')
      return
    }
    try {
      setBusy(true)
      setError(null)
      await recordQuote({ driverId: driver.id, userId: user!.id, from: qFrom, to: qTo, price, tollIncluded: qToll, notes: qNotes })
      setQuoteOpen(false)
      setQFrom(null)
      setQTo(null)
      setQPrice('')
      setQToll(null)
      setQNotes('')
      setNotice('Quote saved. Thanks for keeping prices up to date!')
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const relationship = RELATIONSHIPS.find(r => r.value === driver.relationship)
  const batchmates = travellers.filter(t => t.same_batch)
  const otherTravellers = travellers.filter(t => !t.same_batch)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/drivers'))}
        className="mb-3 flex items-center gap-1 rounded-full py-1.5 pr-3 text-secondary-700 hover:bg-secondary-100"
      >
        <ChevronLeft size={20} /> Back
      </button>

      {notice && <div className="mb-3 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">{notice}</div>}
      {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Header + trust numbers */}
      <section className="rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <UserCircle size={40} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">{driver.name}</h1>
            <p className="text-sm text-secondary-600">Part of the IIM Rohtak community since {fmtDate(driver.created_at)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 divide-x divide-secondary-200 text-center">
          <div>
            <p className="text-2xl font-bold text-secondary-900">{driver.unique_students}</p>
            <p className="text-xs text-secondary-500">Students travelled with</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-secondary-900">{driver.recorded_trips}</p>
            <p className="text-xs text-secondary-500">Recorded trips</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-secondary-900">{driver.vouch_count}</p>
            <p className="text-xs text-secondary-500">Students vouched</p>
          </div>
        </div>
      </section>

      {/* Upcoming TagAlong bookings, so students don't all call a driver who's already busy */}
      <section className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-secondary-900">
          <CalendarClock size={18} className="text-primary-600" /> Upcoming TagAlong bookings
        </h2>
        {bookings.length === 0 ? (
          <p className="mt-1 text-sm text-secondary-500">
            No upcoming rides booked with this driver on TagAlong. He may still have work from outside TagAlong, so confirm when you call.
          </p>
        ) : (
          <>
            <div className="mt-2 divide-y divide-secondary-100">
              {bookings.slice(0, 6).map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => navigate(`/ride/${b.id}`)}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-secondary-50"
                >
                  <span className="text-sm font-medium text-secondary-900">
                    {formatDateLabel(b.date)}, {formatTime(b.departure_time)}
                  </span>
                  <span className="truncate text-sm text-secondary-500">
                    {shortPlace(b.origin)} → {shortPlace(b.destination)}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-amber-800">
              If your trip is near one of these times, he's probably busy. Tip: join that ride instead, or pick another driver.
            </p>
          </>
        )}
      </section>

      {/* Contact */}
      <section className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-secondary-900">Get driver's contact</p>
            <p className="text-sm text-secondary-500">Contact directly to discuss details and finalise your ride.</p>
          </div>
          {!showNumber && (
            <button
              type="button"
              onClick={() => setShowNumber(true)}
              className="shrink-0 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Show number
            </button>
          )}
        </div>
        {showNumber && (
          <div className="mt-3">
            <p className="mb-2 font-mono text-lg text-secondary-900">+91 {driver.phone}</p>
            <div className="flex gap-2">
              <a
                href={`tel:+91${driver.phone}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-secondary-300 py-2.5 font-semibold text-secondary-800 hover:bg-secondary-50"
              >
                <Phone size={18} /> Call driver
              </a>
              <a
                href={`https://wa.me/91${driver.phone}?text=${encodeURIComponent("Hi, I'm a student at IIM Rohtak and got your number from TagAlong.")}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 font-semibold text-white hover:opacity-90"
              >
                <MessageCircle size={18} /> WhatsApp driver
              </a>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate('/create-ride', { state: { driverId: driver.id } })}
          className="mt-3 w-full rounded-xl border border-primary-600 py-2.5 font-semibold text-primary-700 hover:bg-primary-50"
        >
          Post a ride with this driver
        </button>
      </section>

      {/* Introduced by + vehicle + about */}
      <section className="mt-3 space-y-4 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="flex gap-3">
          <Users size={20} className="mt-0.5 shrink-0 text-primary-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-secondary-500">Introduced by</p>
            <p className="font-semibold text-secondary-900">
              {driver.added_by_user_id === user?.id ? 'You' : introducedBy(driver)}
            </p>
            <p className="text-sm text-secondary-500">
              on {fmtDate(driver.created_at)}
              {relationship && ` · ${relationship.label}`}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Car size={20} className="mt-0.5 shrink-0 text-primary-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-secondary-500">Vehicle details</p>
            <p className="font-semibold text-secondary-900">{driver.vehicle_type || 'Not added'}</p>
            <p className="text-sm text-secondary-600">
              {driver.vehicle_number && <span className="font-mono">{driver.vehicle_number}</span>}
              {driver.vehicle_number && driver.seats ? ' · ' : ''}
              {driver.seats ? `${driver.seats} passenger seats` : ''}
            </p>
          </div>
        </div>
        {driver.about && (
          <div className="flex gap-3">
            <Info size={20} className="mt-0.5 shrink-0 text-primary-600" />
            <div>
              <p className="text-xs uppercase tracking-wide text-secondary-500">About</p>
              <p className="text-sm text-secondary-700">{driver.about}</p>
            </div>
          </div>
        )}
      </section>

      {/* Vouch */}
      <section className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <HeartHandshake size={20} className="text-primary-600" />
          <p className="font-semibold text-secondary-900">Vouched for by {driver.vouch_count} student{driver.vouch_count === 1 ? '' : 's'}</p>
        </div>
        {driver.i_vouched ? (
          <p className="mt-2 text-sm text-secondary-600">
            You vouched for this driver.{' '}
            <button type="button" disabled={busy} onClick={unvouch} className="font-medium text-secondary-500 underline">
              Remove my vouch
            </button>
          </p>
        ) : vouching ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-secondary-700">I confirm that:</p>
            {(['travelled', 'know'] as const).map(t => (
              <label key={t} className="flex items-center gap-2 text-sm text-secondary-800">
                <input type="radio" name="vouch" checked={vouchType === t} onChange={() => setVouchType(t)} />
                {t === 'travelled' ? 'I have personally travelled with this driver' : 'I personally know this driver'}
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={vouch}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Vouch
              </button>
              <button type="button" onClick={() => setVouching(false)} className="px-3 text-sm text-secondary-600">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setVouching(true)}
            className="mt-3 rounded-xl border border-secondary-300 px-4 py-2 text-sm font-semibold text-secondary-800 hover:bg-secondary-50"
          >
            Vouch for this driver
          </button>
        )}
      </section>

      {/* Price history */}
      <section className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-secondary-900">
            <IndianRupee size={18} className="text-primary-600" /> Recent route quotes
          </h2>
          {!quoteOpen && (
            <button
              type="button"
              onClick={() => setQuoteOpen(true)}
              className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline"
            >
              <Plus size={14} /> Add a quote
            </button>
          )}
        </div>

        {quoteOpen && (
          <form onSubmit={saveQuote} className="mb-4 space-y-3 rounded-xl bg-secondary-50 p-3">
            <LocationInput label="From" placeholder="Pickup" value={qFrom} onChange={setQFrom} kind="from" />
            <LocationInput label="To" placeholder="Destination" value={qTo} onChange={setQTo} kind="to" near={qFrom} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary-700">Quoted price (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={qPrice}
                  onChange={e => setQPrice(e.target.value)}
                  className="w-full rounded-xl border border-secondary-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary-700">Toll included?</label>
                <div className="flex gap-2">
                  {[
                    { l: 'Yes', v: true },
                    { l: 'No', v: false }
                  ].map(o => (
                    <button
                      key={o.l}
                      type="button"
                      onClick={() => setQToll(qToll === o.v ? null : o.v)}
                      className={`flex-1 rounded-xl border py-2 text-sm font-medium ${
                        qToll === o.v ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-300 bg-white'
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <input
              type="text"
              value={qNotes}
              onChange={e => setQNotes(e.target.value)}
              placeholder="Notes (optional), e.g. night charges extra"
              className="!rounded-xl"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Save quote
              </button>
              <button type="button" onClick={() => setQuoteOpen(false)} className="px-3 text-sm text-secondary-600">
                Cancel
              </button>
            </div>
          </form>
        )}

        {quotes.length === 0 ? (
          <p className="text-sm text-secondary-500">No quotes recorded yet.</p>
        ) : (
          <div className="divide-y divide-secondary-100">
            {quotes.slice(0, 8).map(q => (
              <div key={q.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-secondary-900">
                    {shortPlace(q.origin)} → {shortPlace(q.destination)}
                  </p>
                  <p className="text-xs text-secondary-500">
                    {fmtDate(q.created_at)}
                    {q.toll_included === true && ' · toll included'}
                    {q.toll_included === false && ' · toll extra'}
                    {q.notes && ` · ${q.notes}`}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-secondary-900">{formatRupees(Number(q.quoted_price))}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-secondary-500">{QUOTE_DISCLAIMER}</p>
      </section>

      {/* Who travelled */}
      <section className="mt-3 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-secondary-900">
          <Users size={18} className="text-primary-600" /> Recent travellers
        </h2>
        {travellers.length === 0 ? (
          <p className="text-sm text-secondary-500">No completed TagAlong trips with this driver yet.</p>
        ) : (
          <div className="space-y-4">
            {batchmates.length > 0 && (
              <TravellerRow title="From your batch" list={batchmates} fmtDate={fmtDate} />
            )}
            {otherTravellers.length > 0 && (
              <TravellerRow title={batchmates.length ? 'Other students' : ''} list={otherTravellers} fmtDate={fmtDate} />
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function TravellerRow({
  title,
  list,
  fmtDate
}: {
  title: string
  list: DriverTraveller[]
  fmtDate: (d: string) => string
}) {
  return (
    <div>
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary-500">{title}</p>}
      <div className="flex flex-wrap gap-4">
        {list.slice(0, 12).map((t, i) => (
          <div key={`${t.first_name}-${i}`} className="w-20 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
              {t.first_name.slice(0, 2).toUpperCase()}
            </span>
            <p className="mt-1 truncate text-xs font-medium text-secondary-900">{t.first_name}</p>
            <p className="text-[10px] text-secondary-500">
              {t.course}
              {t.batch}
              {t.trips > 1 ? ` · ${t.trips} trips` : ''}
            </p>
            {t.last_trip && <p className="text-[10px] text-secondary-400">{fmtDate(t.last_trip)}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
