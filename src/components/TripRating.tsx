import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '../lib/supabase'

const LABELS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent']

// "Rate this trip": 1-5 stars from the people who were on it, once it has left
export function TripRating({ rideId, userId }: { rideId: string; userId: string }) {
  const [rating, setRating] = useState<number | null>(null)
  const [hover, setHover] = useState(0)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('trip_ratings')
      .select('rating')
      .eq('ride_id', rideId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setRating(data?.rating ?? null))
  }, [rideId, userId])

  const rate = async (value: number) => {
    setSaving(true)
    const { error } = await supabase
      .from('trip_ratings')
      .upsert({ ride_id: rideId, user_id: userId, rating: value, updated_at: new Date().toISOString() }, { onConflict: 'ride_id,user_id' })
    setSaving(false)
    if (error) {
      setNote('Could not save your rating. Please try again.')
      return
    }
    setRating(value)
    setNote('Thanks! Your rating helps TagAlong pick better drivers.')
  }

  const shown = hover || rating || 0
  return (
    <section className="mb-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
      <p className="font-semibold text-secondary-900">{rating ? 'Your rating' : 'How was this trip?'}</p>
      <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={saving}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => void rate(n)}
            className="rounded-lg p-1 transition hover:scale-110 disabled:opacity-50"
            aria-label={`${n} star${n > 1 ? 's' : ''}: ${LABELS[n]}`}
            aria-pressed={rating === n}
          >
            <Star size={28} className={n <= shown ? 'fill-amber-400 text-amber-400' : 'text-secondary-300'} />
          </button>
        ))}
        {shown > 0 && <span className="ml-2 text-sm font-medium text-secondary-700">{LABELS[shown]}</span>}
      </div>
      {note && <p className="mt-1 text-xs text-secondary-500">{note}</p>}
    </section>
  )
}
