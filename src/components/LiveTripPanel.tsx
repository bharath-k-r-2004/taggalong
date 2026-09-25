import { useState } from 'react'
import { Car, CheckCircle2, MessageCircle, Phone, Share2, Siren, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getCurrentPosition } from '../lib/places'
import { Ride, clockTime, estimatedArrival, formatTime, myParticipation } from '../lib/rides'

interface LiveTripPanelProps {
  ride: Ride
  userId: string
  myName: string
  isCreator: boolean
  contact: string | null
  busy: boolean
  onEnd: (happened: boolean) => void
  onConfirm: (travelled: boolean) => void
}

const firstNameTag = (p?: { name: string | null; course: string | null; batch: string | null } | null) =>
  p ? `${(p.name || 'Student').split(' ')[0]}${p.course ? ` (${p.course}${p.batch ? ` ${p.batch}` : ''})` : ''}` : 'Student'

async function locationLink(): Promise<string | null> {
  try {
    const pos = await Promise.race([
      getCurrentPosition(),
      new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), 6000))
    ])
    return `https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}`
  } catch {
    return null
  }
}

// "Live trip": shown to the poster and accepted riders from departure until the ride is ended
export function LiveTripPanel({ ride, userId, myName, isCreator, contact, busy, onEnd, onConfirm }: LiveTripPanelProps) {
  const [endOpen, setEndOpen] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [sosNote, setSosNote] = useState<string | null>(null)
  const [shareNote, setShareNote] = useState<string | null>(null)

  const eta = estimatedArrival(ride)
  const mine = myParticipation(ride, userId)
  const companions = [
    ...(ride.creator_id !== userId ? [firstNameTag(ride.creator)] : []),
    ...(ride.ride_participants || []).filter(p => p.status === 'accepted' && p.user_id !== userId).map(p => firstNameTag(p.user))
  ]
  const car = [ride.vehicle_type, ride.vehicle_number].filter(Boolean).join(' ')

  const tripText = (location: string | null) =>
    [
      `I'm travelling with TagAlong (IIM Rohtak ride sharing).`,
      `${ride.origin} → ${ride.destination}`,
      `Left at ${formatTime(ride.departure_time)}${eta ? `, expected around ${clockTime(eta)}` : ''}.`,
      ride.driver_name || car || contact
        ? `Driver: ${ride.driver_name || 'not named'}${car ? `, ${car}` : ''}${contact ? `, +91 ${contact}` : ''}.`
        : '',
      companions.length ? `With: ${companions.join(', ')}.` : '',
      location ? `My location now: ${location}` : ''
    ]
      .filter(Boolean)
      .join('\n')

  const shareTrip = async () => {
    setShareNote('Getting your location...')
    const loc = await locationLink()
    const text = tripText(loc)
    try {
      if (navigator.share) await navigator.share({ title: 'My TagAlong trip', text })
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      setShareNote(loc ? 'Trip details and your location are ready to send.' : 'Trip details are ready to send (location was not available).')
    } catch {
      setShareNote(null) // share sheet closed
    }
  }

  const openSos = async () => {
    setSosOpen(true)
    setSosNote('Alerting your co-travellers...')
    const loc = await locationLink()
    const { error } = await supabase.from('messages').insert({
      ride_id: ride.id,
      user_id: userId,
      content: `🆘 SOS from ${myName.split(' ')[0]}: needs help now.${loc ? ` Location: ${loc}` : ''}`
    })
    setSosNote(error ? 'Could not alert the group. Call 112 now.' : 'Your co-travellers have been alerted in the ride chat.')
  }

  return (
    <section className="mb-3 rounded-2xl border border-primary-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-secondary-900">Live trip</h2>
        <span className="flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary-600" /> On trip
        </span>
      </div>
      <p className="mt-1 text-sm text-secondary-600">
        Left at {formatTime(ride.departure_time)}
        {eta && <> · expected around {clockTime(eta)} (rough estimate)</>}
      </p>

      {(ride.driver_name || car) && (
        <p className="mt-3 flex items-center gap-2 text-sm text-secondary-800">
          <Car size={16} className="text-secondary-500" />
          {ride.driver_name || 'Driver'}
          {car && <span className="text-secondary-500">· {car}</span>}
        </p>
      )}
      {companions.length > 0 && (
        <p className="mt-1 flex items-center gap-2 text-sm text-secondary-800">
          <Users size={16} className="text-secondary-500" /> With {companions.join(', ')}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {contact ? (
          <a
            href={`tel:+91${contact}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-secondary-300 py-2.5 text-sm font-semibold text-secondary-800 hover:bg-secondary-50"
          >
            <Phone size={16} /> Call driver
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl border border-dashed border-secondary-200 py-2.5 text-xs text-secondary-400">
            No driver number
          </span>
        )}
        <button
          type="button"
          onClick={() => document.getElementById('ride-chat')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex items-center justify-center gap-2 rounded-xl border border-secondary-300 py-2.5 text-sm font-semibold text-secondary-800 hover:bg-secondary-50"
        >
          <MessageCircle size={16} /> Ride chat
        </button>
        <button
          type="button"
          onClick={() => void shareTrip()}
          className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-secondary-300 py-2.5 text-sm font-semibold text-secondary-800 hover:bg-secondary-50"
        >
          <Share2 size={16} /> Share trip with family
        </button>
      </div>
      {shareNote && <p className="mt-2 text-xs text-secondary-500">{shareNote}</p>}

      {/* SOS */}
      {sosOpen ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <a
            href="tel:112"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700"
          >
            <Phone size={18} /> Call 112 (police, ambulance, fire)
          </a>
          {sosNote && <p className="mt-2 text-sm text-red-800">{sosNote}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => void shareTrip()} className="font-semibold text-red-800 underline">
              Share my location with family
            </button>
            <button type="button" onClick={() => setSosOpen(false)} className="text-red-700">
              Close
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void openSos()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          <Siren size={16} /> SOS: emergency
        </button>
      )}

      {/* Ending the trip */}
      <div className="mt-4 border-t border-secondary-100 pt-4">
        {isCreator ? (
          endOpen ? (
            <div>
              <p className="font-semibold text-secondary-900">Did this trip happen?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onEnd(true)}
                  className="rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Yes, we've arrived
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onEnd(false)}
                  className="rounded-xl border border-secondary-300 py-2.5 text-sm font-semibold text-secondary-800 disabled:opacity-50"
                >
                  No, it didn't happen
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEndOpen(true)}
              className="w-full rounded-xl bg-primary-600 py-3 font-semibold text-white hover:bg-primary-700"
            >
              End ride
            </button>
          )
        ) : mine?.arrived_at || mine?.trip_confirmed === true ? (
          <p className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <CheckCircle2 size={18} /> You marked that you've reached
            {mine.arrived_at ? ` (${clockTime(new Date(mine.arrived_at))})` : ''}. Safe travels!
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm(true)}
              className="flex-1 rounded-xl bg-primary-600 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              I've reached
            </button>
            <button type="button" disabled={busy} onClick={() => onConfirm(false)} className="text-sm text-secondary-500 underline">
              I didn't travel
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
