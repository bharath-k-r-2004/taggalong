import { useEffect, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, Navigation, X } from 'lucide-react'
import {
  Place,
  getCurrentPosition,
  matchPopularPlaces,
  reverseGeocode,
  searchPlaces
} from '../lib/places'

interface LocationInputProps {
  label: string
  placeholder: string
  value: Place | null
  onChange: (place: Place | null) => void
  kind: 'from' | 'to'
  allowCurrentLocation?: boolean
  near?: Place | null // bias suggestions towards this place (e.g. the pickup point)
}

export function LocationInput({
  label,
  placeholder,
  value,
  onChange,
  kind,
  allowCurrentLocation = false,
  near
}: LocationInputProps) {
  const [text, setText] = useState(value?.name || '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [active, setActive] = useState(-1)
  const lastPicked = useRef<string | null>(value?.name || null)

  // Keep the box in sync when the parent changes the value (swap, clear, prefill)
  useEffect(() => {
    const incoming = value?.name || ''
    setText(prev => (prev.trim() === incoming ? prev : incoming))
    if (!value) lastPicked.current = null
    else if (value.lat != null) lastPicked.current = value.name
  }, [value?.name, value?.lat])

  // Search as you type (waits 300 ms after the last key press)
  useEffect(() => {
    const query = text.trim()
    if (!open || query.length < 2 || query === lastPicked.current) {
      setResults([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const bias =
          near?.lat != null && near?.lng != null ? { lat: near.lat, lng: near.lng } : undefined
        const places = await searchPlaces(query, bias, controller.signal)
        setResults(places)
        setMessage(null)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([])
          setMessage('Online suggestions are unavailable right now. You can still pick a popular place or type the name.')
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, open, near?.lat, near?.lng])

  const popular = matchPopularPlaces(text === lastPicked.current ? '' : text)
  const suggestions: Place[] = [...popular]
  for (const r of results) {
    if (suggestions.length >= 8) break
    if (!suggestions.some(s => s.name === r.name)) suggestions.push(r)
  }

  const pick = (place: Place) => {
    lastPicked.current = place.name
    setText(place.name)
    onChange(place)
    setOpen(false)
    setActive(-1)
    setMessage(null)
  }

  const useMyLocation = async () => {
    try {
      setLocating(true)
      setMessage(null)
      const pos = await getCurrentPosition()
      const place = await reverseGeocode(pos.lat, pos.lng)
      pick(place)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not get your location.')
      setOpen(true)
    } finally {
      setLocating(false)
    }
  }

  const handleType = (next: string) => {
    setText(next)
    setOpen(true)
    setActive(-1)
    // Typed text without picking a suggestion is still allowed (no map point)
    onChange(next.trim() ? { name: next.trim() } : null)
    if (!next.trim()) lastPicked.current = null
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && active >= 0 && suggestions[active]) {
      e.preventDefault()
      pick(suggestions[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const hasPoint = value?.lat != null && value?.lng != null

  return (
    <div className="relative">
      <label className="block text-xs font-semibold uppercase tracking-wide text-secondary-500 mb-1">
        {label}
      </label>

      <div
        className={`flex items-center gap-2 rounded-xl border bg-secondary-50 px-3 py-2.5 transition-colors ${
          open ? 'border-primary-500 bg-white ring-2 ring-primary-100' : 'border-secondary-200'
        }`}
      >
        {kind === 'from' ? (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary-600" aria-hidden="true" />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 bg-secondary-900" aria-hidden="true" />
        )}

        <input
          type="text"
          value={text}
          placeholder={placeholder}
          onChange={e => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-label={label}
          className="!w-full !border-0 !bg-transparent !p-0 !shadow-none !ring-0 focus:!ring-0 text-secondary-900 placeholder:text-secondary-400"
        />

        {(searching || locating) && <Loader2 size={16} className="shrink-0 animate-spin text-secondary-400" />}

        {text && !searching && !locating && (
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => handleType('')}
            className="shrink-0 rounded-full p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
            aria-label={`Clear ${label}`}
          >
            <X size={14} />
          </button>
        )}

        {allowCurrentLocation && (
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={useMyLocation}
            disabled={locating}
            className="shrink-0 rounded-full p-1 text-primary-600 hover:bg-primary-50 disabled:opacity-50"
            title="Use my current location"
            aria-label="Use my current location"
          >
            <Crosshair size={18} />
          </button>
        )}
      </div>

      {value?.name && !hasPoint && !open && (
        <p className="mt-1 text-xs text-amber-700">Pick a place from the suggestions so nearby rides can be matched.</p>
      )}

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-secondary-200 bg-white shadow-lg">
          {allowCurrentLocation && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={useMyLocation}
              className="flex w-full items-center gap-3 border-b border-secondary-100 px-4 py-3 text-left hover:bg-primary-50"
            >
              <Navigation size={18} className="shrink-0 text-primary-600" />
              <span className="font-medium text-primary-700">
                {locating ? 'Finding you...' : 'Use my current location'}
              </span>
            </button>
          )}

          {message && <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50">{message}</p>}

          {suggestions.map((place, i) => (
            <button
              key={`${place.name}-${i}`}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(place)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${
                i === active ? 'bg-secondary-100' : 'hover:bg-secondary-50'
              }`}
            >
              <MapPin size={18} className="mt-0.5 shrink-0 text-secondary-400" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-secondary-900">{place.name}</span>
                {place.address && (
                  <span className="block truncate text-xs text-secondary-500">{place.address}</span>
                )}
              </span>
            </button>
          ))}

          {!searching && text.trim().length >= 2 && suggestions.length === 0 && !message && (
            <p className="px-4 py-3 text-sm text-secondary-500">No places found. Try a nearby landmark or city.</p>
          )}

          <p className="border-t border-secondary-100 px-4 py-1.5 text-[10px] text-secondary-400">
            Place suggestions © OpenStreetMap contributors
          </p>
        </div>
      )}
    </div>
  )
}
