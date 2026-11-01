import { FormEvent, useState } from 'react'
import { EyeOff, MessageSquare, Send } from 'lucide-react'
import { CATEGORIES, CategoryKey, MESSAGE_MAX, MESSAGE_MIN, MOODS, submitFeedback } from '../lib/feedback'

export function FeedbackPage() {
  const [category, setCategory] = useState<CategoryKey | null>(null)
  const [mood, setMood] = useState(0)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [thanks, setThanks] = useState(false)

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
      <p className="mb-5 text-secondary-600">Tell us what is working and what is not. It is anonymous, and only the TagAlong team can read it.</p>

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
        {thanks && <p className="mt-2 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-800">Thank you! Your feedback has been sent to the TagAlong team.</p>}

        <button
          type="submit"
          disabled={!ready || sending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} /> {sending ? 'Sending…' : 'Share anonymously'}
        </button>
        <p className="mt-2 text-center text-xs text-secondary-400">Please be respectful and do not name individuals. Up to 3 messages a day.</p>
      </form>
    </div>
  )
}
