// Location search for TagAlong.
// Suggestions come from Photon (free OpenStreetMap search, no API key needed),
// plus a list of places IIM Rohtak students travel to most often.

export interface Place {
  name: string // what we show and save, e.g. "Rohtak Junction, Rohtak"
  address?: string // extra line under the name in the suggestion list
  lat?: number | null
  lng?: number | null
}

interface Preset extends Place {
  keywords: string[]
}

export const IIM_ROHTAK: Place = {
  name: 'IIM Rohtak (Campus)',
  address: 'Management City, Sunaria, Rohtak',
  lat: 28.8528,
  lng: 76.5471
}

// Popular places, shown first when they match what the student types
export const POPULAR_PLACES: Preset[] = [
  { ...IIM_ROHTAK, keywords: ['iim', 'iim rohtak', 'campus', 'management city', 'sunaria', 'college', 'hostel'] },
  { name: 'Rohtak Junction (Railway Station)', address: 'Rohtak, Haryana', lat: 28.8909, lng: 76.5796, keywords: ['rohtak', 'railway', 'station', 'junction', 'train'] },
  { name: 'Rohtak Bus Stand', address: 'Rohtak, Haryana', lat: 28.9036, lng: 76.6019, keywords: ['rohtak', 'bus', 'stand', 'isbt'] },
  { name: 'Delhi Airport T3 (IGI)', address: 'Indira Gandhi International Airport, Delhi', lat: 28.5549, lng: 77.0842, keywords: ['delhi', 'airport', 'igi', 't3', 'terminal 3', 'flight'] },
  { name: 'Delhi Airport T1 (IGI)', address: 'Indira Gandhi International Airport, Delhi', lat: 28.5648, lng: 77.1227, keywords: ['delhi', 'airport', 'igi', 't1', 'terminal 1', 'flight'] },
  { name: 'New Delhi Railway Station', address: 'Paharganj, New Delhi', lat: 28.6423, lng: 77.2195, keywords: ['delhi', 'new delhi', 'ndls', 'railway', 'station', 'train'] },
  { name: 'Hazrat Nizamuddin Railway Station', address: 'South East Delhi', lat: 28.588, lng: 77.2531, keywords: ['delhi', 'nizamuddin', 'railway', 'station', 'train'] },
  { name: 'Kashmere Gate ISBT', address: 'Delhi', lat: 28.6687, lng: 77.2304, keywords: ['delhi', 'kashmere', 'kashmiri', 'isbt', 'bus'] },
  { name: 'Bahadurgarh', address: 'Haryana', lat: 28.6933, lng: 76.9332, keywords: ['bahadurgarh'] },
  { name: 'Gurugram (Cyber City)', address: 'Gurugram, Haryana', lat: 28.4979, lng: 77.0887, keywords: ['gurugram', 'gurgaon', 'cyber city', 'cyber hub'] },
  { name: 'Sonipat', address: 'Haryana', lat: 28.9954, lng: 77.0234, keywords: ['sonipat', 'sonepat'] },
  { name: 'Chandigarh', address: 'Chandigarh', lat: 30.7334, lng: 76.7797, keywords: ['chandigarh'] }
]

const toPlace = ({ keywords: _keywords, ...place }: Preset): Place => place

export function matchPopularPlaces(query: string, limit = 4): Place[] {
  const q = query.trim().toLowerCase()
  if (!q) return POPULAR_PLACES.slice(0, 6).map(toPlace)
  return POPULAR_PLACES.filter(
    p => p.name.toLowerCase().includes(q) || p.keywords.some(k => k.startsWith(q) || q.startsWith(k))
  )
    .slice(0, limit)
    .map(toPlace)
}

// ---- Photon (OpenStreetMap) ----

const PHOTON = 'https://photon.komoot.io'
const INDIA_BBOX = '68,6,98,37'

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: Record<string, string | undefined>
}

function featureToPlace(f: PhotonFeature): Place | null {
  const p = f.properties
  const [lng, lat] = f.geometry.coordinates
  const main = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || p.county || p.state
  if (!main) return null

  const extra: string[] = []
  for (const part of [p.district || p.locality, p.city || p.county, p.state]) {
    if (part && part !== main && !extra.includes(part)) extra.push(part)
  }

  return {
    name: extra.length ? `${main}, ${extra[0]}` : main,
    address: extra.join(', '),
    lat,
    lng
  }
}

export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number },
  signal?: AbortSignal
): Promise<Place[]> {
  const bias = near || { lat: IIM_ROHTAK.lat as number, lng: IIM_ROHTAK.lng as number }
  const url =
    `${PHOTON}/api/?q=${encodeURIComponent(query)}&limit=6&lang=en` +
    `&lat=${bias.lat}&lon=${bias.lng}&bbox=${INDIA_BBOX}`

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Location search is unavailable right now')
  const data = await res.json()

  const places: Place[] = []
  for (const f of (data.features || []) as PhotonFeature[]) {
    const place = featureToPlace(f)
    if (place && !places.some(x => x.name === place.name)) places.push(place)
  }
  return places
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place> {
  // If the student is on or near campus, call it IIM Rohtak
  const fromCampus = distanceKm({ lat, lng }, IIM_ROHTAK)
  if (fromCampus !== null && fromCampus < 1.5) {
    return { ...IIM_ROHTAK }
  }
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en&limit=1`)
    const data = await res.json()
    const place = data.features?.[0] ? featureToPlace(data.features[0]) : null
    if (place) return { ...place, lat, lng }
  } catch {
    // fall through to a generic name
  }
  return { name: 'My current location', address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng }
}

export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Your browser does not support location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission is off. Allow it in your browser, or type your pickup point.'))
        } else {
          reject(new Error('Could not get your location. Please type your pickup point.'))
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  })
}

// Straight-line distance in km (null if either place has no coordinates)
export function distanceKm(
  a: { lat?: number | null; lng?: number | null },
  b: { lat?: number | null; lng?: number | null }
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
