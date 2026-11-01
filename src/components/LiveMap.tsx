import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed, LocateOff, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { distanceKm } from '../lib/places'
import { Ride } from '../lib/rides'

// Live trip map: OpenStreetMap tiles (free, no key) + each rider's phone GPS,
// shared only with the people on this ride and deleted soon after the trip.

interface LiveMapProps {
  ride: Ride
  userId: string
  names: Record<string, string> // user id -> first name
  onArrived: () => void // my phone reached the destination
}

interface Position {
  user_id: string
  lat: number
  lng: number
  updated_at: string
}

// Within this distance of the drop point counts as arrived
export const ARRIVAL_KM = 1
const SEND_EVERY_MS = 15000
const SEND_IF_MOVED_KM = 0.05

const storageKey = (rideId: string) => `tagalong-share-${rideId}`
const readPref = (rideId: string) => {
  try {
    return localStorage.getItem(storageKey(rideId)) === '1'
  } catch {
    return false
  }
}
const writePref = (rideId: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(storageKey(rideId), '1')
    else localStorage.removeItem(storageKey(rideId))
  } catch {
    // private mode: sharing just won't resume after a reload
  }
}

const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))

export default function LiveMap({ ride, userId, names, onArrived }: LiveMapProps) {
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)
  const watchId = useRef<number | null>(null)
  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null)
  const arrivedOnce = useRef(false)

  const [positions, setPositions] = useState<Position[]>([])
  const [sharing, setSharing] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const dest = ride.destination_lat != null && ride.destination_lng != null ? { lat: ride.destination_lat, lng: ride.destination_lng } : null
  const origin = ride.origin_lat != null && ride.origin_lng != null ? { lat: ride.origin_lat, lng: ride.origin_lng } : null

  // Map setup
  useEffect(() => {
    if (!mapEl.current || map.current) return
    const m = L.map(mapEl.current, { zoomControl: true, attributionControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    const start = origin || dest || { lat: 28.8528, lng: 76.5471 }
    m.setView([start.lat, start.lng], 11)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Everyone's latest position, live
  useEffect(() => {
    let alive = true
    supabase
      .from('ride_locations')
      .select('user_id, lat, lng, updated_at')
      .eq('ride_id', ride.id)
      .then(({ data }) => alive && setPositions((data || []) as Position[]))
    const channel = supabase
      .channel(`ride-locations-${ride.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_locations', filter: `ride_id=eq.${ride.id}` }, payload => {
        if (payload.eventType === 'DELETE') {
          const gone = (payload.old as Partial<Position>).user_id
          setPositions(prev => prev.filter(p => p.user_id !== gone))
        } else {
          const p = payload.new as Position
          setPositions(prev => [...prev.filter(x => x.user_id !== p.user_id), p])
        }
      })
      .subscribe()
    return () => {
      alive = false
      void supabase.removeChannel(channel)
    }
  }, [ride.id])

  // Draw pickup, drop and people
  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const points: L.LatLngExpression[] = []
    if (origin) {
      L.circleMarker([origin.lat, origin.lng], { radius: 7, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 })
        .bindTooltip('Pickup')
        .addTo(g)
      points.push([origin.lat, origin.lng])
    }
    if (dest) {
      L.circleMarker([dest.lat, dest.lng], { radius: 8, color: '#111827', fillColor: '#111827', fillOpacity: 1 })
        .bindTooltip('Drop')
        .addTo(g)
      L.circle([dest.lat, dest.lng], { radius: ARRIVAL_KM * 1000, color: '#111827', weight: 1, fillOpacity: 0.04 }).addTo(g)
      points.push([dest.lat, dest.lng])
    }
    for (const p of positions) {
      const me = p.user_id === userId
      const label = me ? 'You' : names[p.user_id] || 'Rider'
      L.circleMarker([p.lat, p.lng], {
        radius: me ? 9 : 8,
        color: '#ffffff',
        weight: 3,
        fillColor: me ? '#2563eb' : '#f59e0b',
        fillOpacity: 1
      })
        .bindTooltip(label, { direction: 'top', offset: [0, -8] })
        .addTo(g)
      points.push([p.lat, p.lng])
    }
    if (points.length > 0 && !fitted.current) {
      m.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 14 })
      fitted.current = positions.length > 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, names, userId])

  const send = async (lat: number, lng: number, accuracy: number) => {
    const now = Date.now()
    const last = lastSent.current
    const moved = last ? distanceKm({ lat, lng }, { lat: last.lat, lng: last.lng }) ?? 1 : 1
    if (last && now - last.at < SEND_EVERY_MS && moved < SEND_IF_MOVED_KM) return
    lastSent.current = { at: now, lat, lng }
    const { error } = await supabase
      .from('ride_locations')
      .upsert({ ride_id: ride.id, user_id: userId, lat, lng, accuracy, updated_at: new Date().toISOString() })
    if (error) setNote('Could not share your location right now.')
  }

  const startSharing = () => {
    if (!('geolocation' in navigator)) {
      setNote("This browser can't share location.")
      return
    }
    setNote('Asking for location permission...')
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setSharing(true)
        writePref(ride.id, true)
        setNote(null)
        // show my own dot straight away, without waiting for the server
        setPositions(prev => [...prev.filter(x => x.user_id !== userId), { user_id: userId, lat, lng, updated_at: new Date().toISOString() }])
        void send(lat, lng, accuracy)
        if (dest && !arrivedOnce.current) {
          const km = distanceKm({ lat, lng }, dest)
          if (km !== null && km <= ARRIVAL_KM) {
            arrivedOnce.current = true
            setNote('You have reached the drop point. Marking you as arrived.')
            onArrived()
          }
        }
      },
      err => {
        stopWatch()
        setSharing(false)
        writePref(ride.id, false)
        setNote(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location for this site in your browser settings to share it.'
            : 'Could not get your location. Check that location (GPS) is on.'
        )
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    )
  }

  const stopWatch = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }

  const stopSharing = async () => {
    stopWatch()
    setSharing(false)
    writePref(ride.id, false)
    lastSent.current = null
    await supabase.from('ride_locations').delete().eq('ride_id', ride.id).eq('user_id', userId)
    setPositions(prev => prev.filter(x => x.user_id !== userId))
    setNote('You stopped sharing your location.')
  }

  // Resume sharing after a reload if it was on
  useEffect(() => {
    if (readPref(ride.id)) startSharing()
    return stopWatch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.id])

  const others = positions.filter(p => p.user_id !== userId).length

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary-900">
          <MapPin size={16} className="text-primary-600" /> Live map
        </p>
        <span className="text-xs text-secondary-500">
          {others === 0 ? 'Nobody else sharing yet' : `${others} other${others > 1 ? 's' : ''} sharing`}
        </span>
      </div>
      <div ref={mapEl} className="relative z-0 h-64 w-full overflow-hidden rounded-xl border border-secondary-200" />
      {positions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary-700">
          {[...positions]
            .sort((a, b) => Number(b.user_id === userId) - Number(a.user_id === userId))
            .map(p => {
              const ago = minutesAgo(p.updated_at)
              const near = dest ? distanceKm(p, dest) : null
              return (
                <span key={p.user_id} className="flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.user_id === userId ? 'bg-blue-600' : 'bg-amber-500'}`} />
                  {p.user_id === userId ? 'You' : names[p.user_id] || 'Rider'}
                  <span className="text-secondary-400">
                    · {ago === 0 ? 'now' : `${ago} min ago`}
                    {near !== null && ` · ${near < 1 ? 'at drop' : `${Math.round(near)} km to drop`}`}
                  </span>
                </span>
              )
            })}
        </div>
      )}
      <button
        type="button"
        onClick={() => (sharing ? void stopSharing() : startSharing())}
        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${
          sharing ? 'border border-secondary-300 text-secondary-800 hover:bg-secondary-50' : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {sharing ? <LocateOff size={16} /> : <LocateFixed size={16} />}
        {sharing ? 'Stop sharing my location' : 'Share my live location'}
      </button>
      <p className="mt-1.5 text-xs text-secondary-500">
        {note ||
          (sharing
            ? 'Only people on this ride can see you. Keep this page open: phones pause location when the screen is off.'
            : dest
            ? `Only people on this ride can see it. When you're within ${ARRIVAL_KM} km of the drop point, you're marked as arrived.`
            : 'Only people on this ride can see it. The drop point has no map location, so arrival is marked by hand.')}
      </p>
    </div>
  )
}
