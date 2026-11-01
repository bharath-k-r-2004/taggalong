import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { EyeOff, MessageSquare, Send } from 'lucide-react'
import {
  CATEGORIES,
  CategoryKey,
  FeedbackRow,
  MESSAGE_MAX,
  MESSAGE_MIN,
  MOODS,
  TONE_LABELS,
  Tone,
  average,
  categoryLabel,
  fetchFeedback,
  submitFeedback,
  toneOf
} from '../lib/feedback'

const TONE_STYLE: Record<Tone, string> = {
  praise: 'bg-primary-50 text-primary-800',
  suggestion: 'bg-amber-50 text-amber-800',
  concern: 'bg-red-50 text-red-700'
}

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const PAGE = 12

export function FeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tone, setTone] = useState<Tone | 'all'>('all')
  const [cat, setCat] = useState<CategoryKey | 'all'>('all')
  const [shown, setShown] = useState(PAGE)

  const [category, setCategory] = useState<CategoryKey | null>(null)
  const [mood, setMood] = useState(0)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [thanks, setThanks] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(await fetchFeedback())
      setLoadError(null)
    } catch {
      setLoadError('Could not load feedback right now.')
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => (rows ?? []).filter(r => (tone === 'all' || toneOf(r) === tone) && (cat === 'all' || r.category === cat)),
    [rows, tone, cat]
  )
  const avgMood = average((rows ?? []).map(r => r.mood))
  const praiseShare = rows?.length ? rows.filter(r => toneOf(r) === 'praise').length / rows.length : null
  const length = message.trim().length
  const ready = Boolean(category) && mood > 0 && length >= MESSAGE_MIN

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready || !category) return
    setSending(true)
    setFormError(null)
    try {
      await submitFeedback(category, mood, message)
      setThanks(true)
      setMessage('')
      setMood(0)
      setCategory(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send your feedback. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-secondary-900">
        <MessageSquare size={26} className="text-primary-700" /> Feedback
      </h1>
      <p className="mb-5 text-secondary-600">Tell us what is working and what is not. It is anonymous, and the team reads every message.</p>

      {/* Share feedback */}
      <form onSubmit={e => void submit(e)} className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary-800">
          <EyeOff size={15} /> Anonymous. We do not store your name or account with your feedback.
        </p>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-secondary-900">How are you finding TagAlong?</legend>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="How are you finding TagAlong?">
            {MOODS.map(m => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mood === m.value}
                onClick={() => setMood(m.value)}
                className={`flex flex-1 flex-col items-center rounded-xl border py-2 transition ${
                  mood === m.value ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-100' : 'border-secondary-200 hover:border-primary-300'
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {m.emoji}
                </span>
                <span className="mt-0.5 text-[11px] font-medium text-secondary-600">{m.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-secondary-900">What is it about?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                type="button"
                aria-pressed={category === c.key}
                onClick={() => setCategory(c.key)}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  category === c.key ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-200 bg-white text-secondary-700 hover:border-primary-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label htmlFor="fb-message" className="text-sm font-semibold text-secondary-900">
            Your feedback
          </label>
          <textarea
            id="fb-message"
            value={message}
            onChange={e => {
              setMessage(e.target.value.slice(0, MESSAGE_MAX))
              setThanks(false)
            }}
            rows={4}
            placeholder="What did we get right? What should we fix or add? Be as honest as you like."
            className="mt-1 w-full rounded-xl border border-secondary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <p className="mt-1 text-right text-xs text-secondary-400">
            {length < MESSAGE_MIN ? `At least ${MESSAGE_MIN} characters · ` : ''}
            {message.length}/{MESSAGE_MAX}
          </p>
        </div>

        {formError && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        {thanks && <p className="mt-2 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-800">Thank you! Your feedback is now on the wall below.</p>}

        <button
          type="submit"
          disabled={!ready || sending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} /> {sending ? 'Sending…' : 'Share anonymously'}
        </button>
        <p className="mt-2 text-center text-xs text-secondary-400">Please be respectful and do not name individuals. Up to 3 messages a day.</p>
      </form>

      {/* The wall */}
      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-secondary-900">What students are saying</h2>
            {rows && rows.length > 0 && (
              <p className="text-sm text-secondary-500">
                {rows.length} messages · {avgMood?.toFixed(1)} / 5 average mood · {Math.round((praiseShare ?? 0) * 100)}% pure praise
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(['all', 'praise', 'suggestion', 'concern'] as const).map(t => (
            <button
              key={t}
              type="button"
              aria-pressed={tone === t}
              onClick={() => {
                setTone(t)
                setShown(PAGE)
              }}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                tone === t ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-200 bg-white text-secondary-700 hover:border-primary-300'
              }`}
            >
              {t === 'all' ? 'All' : TONE_LABELS[t]}
            </button>
          ))}
          <select
            value={cat}
            onChange={e => {
              setCat(e.target.value as CategoryKey | 'all')
              setShown(PAGE)
            }}
            aria-label="Filter by topic"
            className="ml-auto rounded-full border border-secondary-200 bg-white px-3 py-1 text-sm text-secondary-700"
          >
            <option value="all">All topics</option>
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {loadError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}
        {rows === null && !loadError && (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        )}
        {rows && visible.length === 0 && (
          <p className="mt-3 rounded-2xl border border-dashed border-secondary-300 bg-white px-4 py-8 text-center text-sm text-secondary-500">
            Nothing here yet. Be the first to share!
          </p>
        )}

        <ul className="mt-3 space-y-3">
          {visible.slice(0, shown).map(r => {
            const t = toneOf(r)
            return (
              <li key={r.id} className="rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl" aria-label={MOODS[r.mood - 1]?.label}>
                    {MOODS[r.mood - 1]?.emoji}
                  </span>
                  <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-700">{categoryLabel(r.category)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_STYLE[t]}`}>{t === 'praise' ? 'Praise' : t === 'suggestion' ? 'Suggestion' : 'Concern'}</span>
                  <span className="ml-auto text-xs text-secondary-400">{ago(r.created_at)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-secondary-800">{r.message}</p>
              </li>
            )
          })}
        </ul>
        {visible.length > shown && (
          <button type="button" onClick={() => setShown(s => s + PAGE)} className="mt-4 w-full rounded-xl border border-secondary-200 bg-white py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50">
            Show more ({visible.length - shown} left)
          </button>
        )}
      </div>
    </div>
  )
}
