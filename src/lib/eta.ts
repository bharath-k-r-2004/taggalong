// Travel time between two places.
// Uses the free OpenStreetMap routing service (OSRM, no key) for real road distance and time.
// If it is slow, down or blocked, falls back to the straight-line estimate used elsewhere in the app,
// so a time is always shown.
import { useEffect, useRef, useState } from 'react'
import { distanceKm } from './places'

export interface LatLng {
  lat?: number | null
  lng?: number | null
}

export interface RouteEstimate {
  minutes: number // driving time, with a little allowance for traffic and stops
  km: number // road distance
  routed: boolean // true: real road route; false: rough straight-line estimate
  at: number // when it was worked out (ms)
}

const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const TRAFFIC_ALLOWANCE = 1.15 // the routing service assumes free-flowing roads
const TIMEOUT_MS = 6000

const has = (p?: LatLng | null): p is { lat: number; lng: number } => Boolean(p && p.lat != null && p.lng != null)

// Same rule as drivingMinutes(): road km = straight line x 1.35, about 45 km/h on average
export function roughEstimate(from: LatLng, to: LatLng): RouteEstimate | null {
  const km = distanceKm(from, to)
  if (km === null) return null
  return { minutes: Math.max(1, Math.round((km * 1.35 * 60) / 45)), km: km * 1.35, routed: false, at: Date.now() }
}

const cache = new Map<string, RouteEstimate>()
const inflight = new Map<string, Promise<RouteEstimate | null>>()
const failedAt = new Map<string, number>() // after a failure, don't ask again for a minute
const keyOf = (a: { lat: number; lng: number }, b: { lat: number; lng: number }, grid: number) =>
  [a.lat, a.lng, b.lat, b.lng].map(n => n.toFixed(grid)).join(',')

// grid = decimals kept in the cache key: 3 is about 100 m, 2 is about 1 km (good enough for a moving phone)
export async function routeEstimate(from: LatLng, to: LatLng, opts: { maxAgeMs?: number; grid?: number } = {}): Promise<RouteEstimate | null> {
  if (!has(from) || !has(to)) return null
  const { maxAgeMs = 10 * 60000, grid = 3 } = opts
  const key = keyOf(from, to, grid)
  const hit = cache.get(key)
  if (hit && hit.routed && Date.now() - hit.at < maxAgeMs) return hit
  const running = inflight.get(key)
  if (running) return running
  const failed = failedAt.get(key)
  if (failed && Date.now() - failed < 60000) return roughEstimate(from, to)

  const job = (async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as { code?: string; routes?: { duration: number; distance: number }[] }
      const route = json.routes?.[0]
      if (json.code !== 'Ok' || !route) throw new Error('no route')
      const out: RouteEstimate = {
        minutes: Math.max(1, Math.round((route.duration / 60) * TRAFFIC_ALLOWANCE)),
        km: route.distance / 1000,
        routed: true,
        at: Date.now()
      }
      cache.set(key, out)
      return out
    } catch {
      failedAt.set(key, Date.now())
      return roughEstimate(from, to)
    } finally {
      clearTimeout(timer)
      inflight.delete(key)
    }
  })()
  inflight.set(key, job)
  return job
}

// React: shows the rough estimate straight away, then upgrades it when the road route arrives.
// refreshMs re-checks on a timer (for a moving phone).
export function useRouteEstimate(from: LatLng | null | undefined, to: LatLng | null | undefined, opts: { refreshMs?: number; grid?: number } = {}) {
  const { refreshMs, grid = 3 } = opts
  const [est, setEst] = useState<RouteEstimate | null>(null)
  const [tick, setTick] = useState(0)
  const fromLat = from?.lat
  const fromLng = from?.lng
  const toLat = to?.lat
  const toLng = to?.lng
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!refreshMs) return
    const t = setInterval(() => setTick(n => n + 1), refreshMs)
    return () => clearInterval(t)
  }, [refreshMs])

  useEffect(() => {
    const a = { lat: fromLat, lng: fromLng }
    const b = { lat: toLat, lng: toLng }
    if (!has(a) || !has(b)) {
      setEst(null)
      return
    }
    setEst(prev => prev ?? roughEstimate(a, b))
    let cancelled = false
    void routeEstimate(a, b, { grid, maxAgeMs: refreshMs ? refreshMs - 1000 : undefined }).then(r => {
      if (!cancelled && alive.current && r) setEst(r)
    })
    return () => {
      cancelled = true
    }
  }, [fromLat, fromLng, toLat, toLng, grid, refreshMs, tick])

  return est
}

// "Now" that re-renders every so often, so a countdown stays current
export function useNow(everyMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}
