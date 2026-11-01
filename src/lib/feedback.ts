// Ratings (Likert scale) and anonymous feedback: shared definitions and the analysis the admin dashboard uses.
import { supabase } from './supabase'

// ---------- Likert scale ----------

export const LIKERT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'] as const

export type ParamKey = 'punctuality' | 'driver_conduct' | 'safety' | 'comfort' | 'value_for_money' | 'coordination' | 'recommend'

export interface Param {
  key: ParamKey
  label: string // short name for charts
  statement: string // what the student rates, on the 5-point agree/disagree scale
}

export const PARAMS: Param[] = [
  { key: 'punctuality', label: 'Punctuality', statement: 'The cab arrived and left on time' },
  { key: 'driver_conduct', label: 'Driver conduct', statement: 'The driver was courteous and drove responsibly' },
  { key: 'safety', label: 'Safety', statement: 'I felt safe throughout the trip' },
  { key: 'comfort', label: 'Comfort', statement: 'The vehicle was clean and comfortable' },
  { key: 'value_for_money', label: 'Value for money', statement: 'The fare was fair for what I got' },
  { key: 'coordination', label: 'Coordination', statement: 'Finding co-riders and agreeing the pickup was easy' },
  { key: 'recommend', label: 'Would recommend', statement: 'I would recommend TagAlong to a friend' }
]

export const OVERALL_LABELS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent']

export interface RatingRow {
  ride_id: string
  user_id: string
  rating: number
  created_at: string
  comment: string | null
  seeded?: boolean
  punctuality: number | null
  driver_conduct: number | null
  safety: number | null
  comfort: number | null
  value_for_money: number | null
  coordination: number | null
  recommend: number | null
}

export interface ParamSummary {
  param: Param
  n: number
  mean: number | null
  dist: number[] // counts for 1..5
  agree: number | null // share answering 4 or 5
}

export function summariseParams(ratings: RatingRow[]): ParamSummary[] {
  return PARAMS.map(param => {
    const dist = [0, 0, 0, 0, 0]
    for (const r of ratings) {
      const v = r[param.key]
      if (v && v >= 1 && v <= 5) dist[v - 1]++
    }
    const n = dist.reduce((a, b) => a + b, 0)
    return {
      param,
      n,
      mean: n ? dist.reduce((s, c, i) => s + c * (i + 1), 0) / n : null,
      dist,
      agree: n ? (dist[3] + dist[4]) / n : null
    }
  })
}

// ---------- anonymous feedback ----------

export type CategoryKey = 'app' | 'rides' | 'drivers' | 'safety' | 'pricing' | 'campus_cabs' | 'other'

export const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'rides', label: 'Finding and sharing rides' },
  { key: 'campus_cabs', label: 'Campus cabs' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'safety', label: 'Safety' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'app', label: 'The app' },
  { key: 'other', label: 'Something else' }
]
export const categoryLabel = (k: string) => CATEGORIES.find(c => c.key === k)?.label ?? k

export const MOODS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Very unhappy' },
  { value: 2, emoji: '🙁', label: 'Unhappy' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Happy' },
  { value: 5, emoji: '😍', label: 'Love it' }
]

export interface FeedbackRow {
  id: string
  category: CategoryKey
  mood: number
  message: string
  created_at: string
  hidden?: boolean
  seeded?: boolean
}

export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 600

// The database function stores no user id with the message, so feedback stays anonymous
export async function submitFeedback(category: CategoryKey, mood: number, message: string) {
  const { error } = await supabase.rpc('submit_feedback', { p_category: category, p_mood: mood, p_message: message })
  if (error) throw error
}

// ---------- reading the feedback: praise, suggestions, concerns, themes ----------

export type Tone = 'praise' | 'suggestion' | 'concern'
export const TONE_LABELS: Record<Tone, string> = { praise: 'Praise', suggestion: 'Suggestions', concern: 'Concerns' }

const SUGGESTION = /\b(wish|would (love|be|like|help|feel)|please (add|leave|do not)|should|needs? to|could|missing|add|more (slots|evening|departures)|maybe|hopefully|too high|a bit|slightly)\b/i

// Unhappy → concern. Neutral, or happy but asking for something → suggestion. Otherwise praise (a top mood is always praise).
export function toneOf(f: Pick<FeedbackRow, 'mood' | 'message'>): Tone {
  if (f.mood <= 2) return 'concern'
  if (f.mood === 5) return 'praise'
  if (f.mood === 3 || SUGGESTION.test(f.message)) return 'suggestion'
  return 'praise'
}

export interface Theme {
  key: string
  label: string
  words: RegExp
}

export const THEMES: Theme[] = [
  { key: 'punctuality', label: 'Punctuality and waiting', words: /\b(late|wait(ed|ing)?|on time|delay|held|check-in|cut-off|punctual|early|minutes)\b/i },
  { key: 'pricing', label: 'Pricing and fares', words: /\b(fare|price|pricing|expensive|cheap|cost|saved?|rupees|toll|value|pass)\b/i },
  { key: 'safety', label: 'Safety and trust', words: /\b(safe|safer|secure|sos|emergency|women|stranger|parents|late-night|live location)\b/i },
  { key: 'driver', label: 'Drivers and vehicles', words: /\b(driver|drivers|car|cab was|ac|highway|vehicle|photo)\b/i },
  { key: 'timings', label: 'More slots and timings', words: /\b(slot|slots|evening|departures?|timings?|waitlist|early morning|fridays?|sundays?|flexible)\b/i },
  { key: 'matching', label: 'Finding co-riders', words: /\b(co-riders?|riders?|batchmates?|matched|pending|accept|community|junior)\b/i },
  { key: 'app', label: 'App experience', words: /\b(app|page|load|wi-fi|logged out|refresh|battery|notification|theme|layout|faq|help page|support)\b/i },
  { key: 'payments', label: 'Payments and splitting', words: /\b(upi|settle|split|splitting|payment)\b/i }
]

export function themesOf(message: string): Theme[] {
  return THEMES.filter(t => t.words.test(message))
}

export interface ThemeRow {
  theme: Theme
  mentions: number
  praise: number
  suggestion: number
  concern: number
}

export function summariseThemes(rows: FeedbackRow[]): ThemeRow[] {
  return THEMES.map(theme => {
    const mine = rows.filter(r => theme.words.test(r.message))
    const count = (t: Tone) => mine.filter(r => toneOf(r) === t).length
    return { theme, mentions: mine.length, praise: count('praise'), suggestion: count('suggestion'), concern: count('concern') }
  }).filter(t => t.mentions > 0)
}

export const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
