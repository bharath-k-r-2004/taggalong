import { useEffect, useState } from 'react'
import { Check, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LIKERT, OVERALL_LABELS, PARAMS, ParamKey } from '../lib/feedback'

type Answers = Partial<Record<ParamKey, number>>

// "Rate this trip": overall stars, then a short 5-point (Likert) questionnaire, from the people who were on it
export function TripRating({ rideId, userId }: { rideId: string; userId: string }) {
  const [overall, setOverall] = useState<number | null>(null)
  const [hover, setHover] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [comment, setComment] = useState('')
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('trip_ratings')
      .select('rating, punctuality, driver_conduct, safety, comfort, value_for_money, coordination, recommend, comment')
      .eq('ride_id', rideId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setOverall(data.rating)
        setComment(data.comment ?? '')
        const a: Answers = {}
        for (const p of PARAMS) if (data[p.key]) a[p.key] = data[p.key] as number
        setAnswers(a)
        setSaved(true)
      })
  }, [rideId, userId])

  const answered = PARAMS.filter(p => answers[p.key]).length
  const open = !saved || editing

  const save = async () => {
    if (!overall) {
      setError('Please give the trip an overall star rating first.')
      return
    }
    setSaving(true)
    setError(null)
    const row = {
      ride_id: rideId,
      user_id: userId,
      rating: overall,
      punctuality: answers.punctuality ?? null,
      driver_conduct: answers.driver_conduct ?? null,
      safety: answers.safety ?? null,
      comfort: answers.comfort ?? null,
      value_for_money: answers.value_for_money ?? null,
      coordination: answers.coordination ?? null,
      recommend: answers.recommend ?? null,
      comment: comment.trim() || null,
      updated_at: new Date().toISOString()
    }
    const { error: err } = await supabase.from('trip_ratings').upsert(row, { onConflict: 'ride_id,user_id' })
    setSaving(false)
    if (err) {
      setError('Could not save your rating. Please try again.')
      return
    }
    setSaved(true)
    setEditing(false)
  }

  const shown = hover || overall || 0

  return (
    <section className="mb-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-secondary-900">{saved && !editing ? 'Thanks for rating this trip' : 'How was this trip?'}</p>
          {open && <p className="text-xs text-secondary-500">Takes about 30 seconds. Your answers help us improve TagAlong.</p>}
        </div>
        {saved && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-primary-700 hover:bg-primary-50">
            Edit
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={!open}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => setOverall(n)}
            className="rounded-lg p-1 transition hover:scale-110 disabled:hover:scale-100"
            aria-label={`${n} star${n > 1 ? 's' : ''}: ${OVERALL_LABELS[n]}`}
            aria-pressed={overall === n}
          >
            <Star size={28} className={n <= shown ? 'fill-amber-400 text-amber-400' : 'text-secondary-300'} />
          </button>
        ))}
        {shown > 0 && <span className="ml-2 text-sm font-medium text-secondary-700">{OVERALL_LABELS[shown]}</span>}
      </div>

      {open && overall && (
        <div className="mt-4 space-y-4 border-t border-secondary-100 pt-4">
          <p className="text-sm text-secondary-600">
            How much do you agree? <span className="text-secondary-400">1 = strongly disagree, 5 = strongly agree. Skip any you like.</span>
          </p>
          {PARAMS.map(p => (
            <fieldset key={p.key}>
              <legend className="text-sm font-medium text-secondary-900">{p.statement}</legend>
              <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label={p.statement}>
                {LIKERT.map((label, i) => {
                  const v = i + 1
                  const on = answers[p.key] === v
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${v}: ${label}`}
                      title={label}
                      onClick={() => setAnswers(a => ({ ...a, [p.key]: on ? undefined : v }))}
                      className={`h-10 flex-1 rounded-lg border text-sm font-semibold transition ${
                        on ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-200 bg-white text-secondary-600 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 h-4 text-xs text-secondary-500">{answers[p.key] ? LIKERT[answers[p.key]! - 1] : ''}</p>
            </fieldset>
          ))}

          <div>
            <label htmlFor={`comment-${rideId}`} className="text-sm font-medium text-secondary-900">
              Anything we should know? <span className="font-normal text-secondary-400">(optional)</span>
            </label>
            <textarea
              id={`comment-${rideId}`}
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 600))}
              rows={2}
              placeholder="What went well, and what could be better?"
              className="mt-1 w-full rounded-xl border border-secondary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            <Check size={16} /> {saving ? 'Saving…' : saved ? 'Update my rating' : `Submit rating${answered ? ` (${answered}/${PARAMS.length} answered)` : ''}`}
          </button>
        </div>
      )}
      {open && !overall && error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </section>
  )
}
