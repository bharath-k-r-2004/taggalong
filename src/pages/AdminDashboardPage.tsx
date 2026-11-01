import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, ChevronRight, IndianRupee, MessageSquare, RefreshCw, ShieldAlert, Table2, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  DashboardData,
  OUTCOME_LABELS,
  Outcome,
  RANGES,
  RangeKey,
  RideFact,
  change,
  computeMetrics,
  countBy,
  fetchDashboard,
  inr,
  pct,
  periodFor,
  rideFacts,
  weekLabel,
  weekOf,
  weeklySeries
} from '../lib/dashboard'
import { formatDateLabel, formatTime } from '../lib/rides'
import { ChartCard, Empty, KpiTile, LikertBars, LikertLegend, RankBars, SERIES, Spark, TimeBars, Trend } from '../components/dashboard/Charts'
import { LIKERT, MOODS, PARAMS, TONE_LABELS, THEMES, Tone, ParamKey, average, categoryLabel, summariseParams, summariseThemes, toneOf } from '../lib/feedback'

type Section = 'overview' | 'business' | 'customer' | 'financial' | 'feedback'
const SECTIONS: { key: Exclude<Section, 'overview'>; title: string; icon: typeof Briefcase; blurb: string }[] = [
  { key: 'business', title: 'Business', icon: Briefcase, blurb: 'Rides, matching, routes, demand and drivers' },
  { key: 'customer', title: 'Customer', icon: Users, blurb: 'Students on the network, activity, retention and ratings' },
  { key: 'financial', title: 'Financial', icon: IndianRupee, blurb: 'Fares, commission, pipeline and student savings' },
  { key: 'feedback', title: 'Feedback', icon: MessageSquare, blurb: 'Ratings on seven parameters, anonymous feedback and what to improve' }
]

// What a click on a chart drills into
type FocusKind = 'week' | 'outcome' | 'route' | 'hour' | 'driver' | 'mix' | 'signups' | 'cohort' | 'rating' | 'commission' | 'param' | 'tone' | 'fcat' | 'theme' | 'all'
interface Focus {
  kind: FocusKind
  key: string
}

const LIVE_REFRESH_MS = 60000

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const section = (params.get('s') as Section) || 'overview'
  const range = (params.get('r') as RangeKey) || '30d'
  const ratePct = Math.min(50, Math.max(0, Number(params.get('c') ?? 10)))
  const rate = ratePct / 100
  const focus: Focus | null = params.get('f') ? { kind: params.get('f')!.split(':')[0] as FocusKind, key: params.get('f')!.split(':').slice(1).join(':') } : null

  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v))
    setParams(next)
  }
  const go = (s: Section, f?: Focus | null) => set({ s: s === 'overview' ? null : s, f: f ? `${f.kind}:${f.key}` : null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchDashboard())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.rpc('is_admin').then(({ data: ok }) => setAllowed(Boolean(ok)))
  }, [])
  useEffect(() => {
    if (!allowed) return
    void load()
    const t = setInterval(() => void load(), LIVE_REFRESH_MS) // live: refresh every minute
    return () => clearInterval(t)
  }, [allowed, load])

  const now = Date.now()
  const facts = useMemo(() => (data ? rideFacts(data) : []), [data])
  const period = useMemo(() => (data ? periodFor(range, data, now) : null), [data, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMemo(() => (data && period ? computeMetrics(data, facts, period.start, period.end, rate, now) : null), [data, facts, period, rate]) // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(
    () => (data && period?.prevStart ? computeMetrics(data, facts, period.prevStart, period.start, rate, now) : null),
    [data, facts, period, rate] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const weeks = useMemo(() => (data && period ? weeklySeries(data, facts, period.start, Math.max(now, ...facts.map(f => f.when)), rate) : []), [data, facts, period, rate]) // eslint-disable-line react-hooks/exhaustive-deps

  // feedback analysis for the chosen period
  const fb = useMemo(() => {
    if (!data || !period) return null
    const rideIds = new Set(facts.filter(f => f.when >= period.start).map(f => f.ride.id))
    const ratings = data.ratings.filter(r => rideIds.has(r.ride_id))
    const feedback = (data.feedback ?? []).filter(f => new Date(f.created_at).getTime() >= period.start)
    const scores = summariseParams(ratings)
    const themes = summariseThemes(feedback)
    const tones: Record<Tone, number> = { praise: 0, suggestion: 0, concern: 0 }
    for (const f of feedback) tones[toneOf(f)]++
    const byWeek = new Map<string, typeof ratings>()
    for (const r of ratings) {
      const k = weekOf(new Date(r.created_at).getTime())
      byWeek.set(k, [...(byWeek.get(k) || []), r])
    }
    const mean = (rs: typeof ratings, k: 'rating' | ParamKey) => average(rs.map(r => r[k]).filter((v): v is number => typeof v === 'number'))
    const trend = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, rs]) => ({ week, label: weekLabel(week), overall: mean(rs, 'rating'), punctuality: mean(rs, 'punctuality'), value: mean(rs, 'value_for_money') }))
    const riders = facts.filter(f => f.outcome === 'completed' && f.when >= period.start).reduce((s, f) => s + f.riders, 0)
    const seeded = { feedback: feedback.filter(f => f.seeded).length, ratings: ratings.filter(r => r.seeded).length }
    return {
      ratings,
      feedback,
      scores,
      themes,
      tones,
      trend,
      seeded,
      overall: mean(ratings, 'rating'),
      recommend: scores.find(p => p.param.key === 'recommend')?.agree ?? null,
      avgMood: average(feedback.map(f => f.mood)),
      response: riders ? ratings.length / riders : null,
      lowest: scores.filter(p => p.mean !== null && p.param.key !== 'recommend').sort((a, b) => a.mean! - b.mean!).slice(0, 2),
      improve: [...themes].sort((a, b) => b.suggestion + b.concern - (a.suggestion + a.concern)).filter(t => t.suggestion + t.concern > 0).slice(0, 4)
    }
  }, [data, period, facts])

  if (allowed === null || (allowed && !data && !error)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }
  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <ShieldAlert size={40} className="mx-auto text-secondary-400" />
        <p className="mt-3 font-semibold text-secondary-900">Admins only</p>
      </div>
    )
  }
  if (!data || !m || !period || !fb) return <p className="p-6 text-red-700">{error}</p>

  // rides in the chosen period (same rule as the metrics)
  const inPeriod = facts.filter(f => (f.when >= period.start && f.when < period.end) || f.when >= period.end)
  const d = (cur: number, p?: number | null) => (prev && p !== undefined ? change(cur, p ?? 0) : null)
  const sectionTitle = SECTIONS.find(s => s.key === section)?.title

  return (
    <div className={`mx-auto max-w-6xl px-4 py-6 transition-opacity ${loading ? 'opacity-70' : ''}`}>
      {/* Header */}
      <Link to="/admin" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-secondary-600 hover:text-primary-700">
        <ArrowLeft size={16} /> Admin
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">TagAlong dashboard</h1>
          <p className="flex items-center gap-2 text-sm text-secondary-500">
            <span className="flex items-center gap-1.5 font-semibold text-primary-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-600" /> Live
            </span>
            Updated {new Date(data.generated_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · refreshes every minute
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-xl border border-secondary-300 bg-white px-3 py-2 text-sm font-semibold text-secondary-700 hover:bg-secondary-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters: one row, scope everything below */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-secondary-200 bg-white p-2 shadow-sm">
        {RANGES.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => set({ r: r.key === '30d' ? null : r.key })}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
              range === r.key ? 'bg-primary-600 text-white' : 'text-secondary-700 hover:bg-secondary-100'
            }`}
          >
            {r.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 px-2 text-sm text-secondary-600">
          Commission
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={ratePct}
            onChange={e => set({ c: e.target.value === '10' ? null : e.target.value })}
            className="!w-16 !rounded-lg !border !border-secondary-300 !px-2 !py-1 text-right font-semibold text-secondary-900"
            aria-label="Commission rate in percent"
          />
          %
        </label>
      </div>

      {/* Breadcrumb + section tabs */}
      <nav className="mt-4 flex flex-wrap items-center gap-1 text-sm" aria-label="Dashboard levels">
        <button type="button" onClick={() => go('overview')} className={section === 'overview' ? 'font-semibold text-secondary-900' : 'text-primary-700 hover:underline'}>
          Overview
        </button>
        {section !== 'overview' && (
          <>
            <ChevronRight size={14} className="text-secondary-400" />
            <button type="button" onClick={() => go(section)} className={!focus ? 'font-semibold text-secondary-900' : 'text-primary-700 hover:underline'}>
              {sectionTitle}
            </button>
          </>
        )}
        {focus && (
          <>
            <ChevronRight size={14} className="text-secondary-400" />
            <span className="font-semibold text-secondary-900">{focusLabel(focus, data)}</span>
          </>
        )}
        <div className="ml-auto flex gap-1">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(s.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${
                section === s.key ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-200 bg-white text-secondary-700 hover:border-primary-300'
              }`}
            >
              <s.icon size={14} /> {s.title}
            </button>
          ))}
        </div>
      </nav>
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">Couldn't refresh: {error}. Showing the last data.</p>}

      <div className="mt-4 space-y-4">
        {section === 'overview' && (
          <>
            {/* Investor headline */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiTile big label="Rides booked" value={String(m.booked)} delta={d(m.booked, prev?.booked)} note={`${m.completed} completed`} onClick={() => go('business')} definition="Rides where at least one other student joined, or a campus cab seat was booked." />
              <KpiTile big label={`Commission @ ${ratePct}%`} value={inr(m.commission)} delta={d(m.commission, prev?.commission)} note={`${inr(m.pipelineCommission)} in pipeline`} onClick={() => go('financial')} definition="Commission rate × fares of completed trips. Pipeline = upcoming booked rides." />
              <KpiTile big label="Students on the network" value={String(m.students)} note={`+${m.newStudents} this period`} onClick={() => go('customer')} definition="IIM Rohtak students who have signed up." />
              <KpiTile big label="Average rating" value={m.avgRating === null ? '–' : `${m.avgRating.toFixed(1)} ★`} note={m.ratingsCount ? `${m.ratingsCount} ratings` : 'No ratings yet'} onClick={() => go('customer')} definition="Average of the 1-5 star ratings riders give after a trip." />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SectionCard title="Business" blurb={SECTIONS[0].blurb} onOpen={() => go('business')} spark={<Spark data={weeks} k="booked" name="Rides booked" />} stats={[
                ['Rides posted', String(m.posted)],
                ['Match rate', pct(m.matchRate)],
                ['Seats filled', pct(m.occupancy)]
              ]} />
              <SectionCard title="Customer" blurb={SECTIONS[1].blurb} onOpen={() => go('customer')} spark={<Spark data={weeks} k="students" name="Students" />} stats={[
                ['Active students', String(m.activeStudents)],
                ['Activation', pct(m.activation)],
                ['Repeat riders', String(m.repeatRiders)]
              ]} />
              <SectionCard title="Financial" blurb={SECTIONS[2].blurb} onOpen={() => go('financial')} spark={<Spark data={weeks} k="commission" name="Commission" fmt={inr} />} stats={[
                ['Completed fares', inr(m.gmv)],
                ['Avg fare', m.avgFare === null ? '–' : inr(m.avgFare)],
                ['Student savings', inr(m.savings)]
              ]} />
              <SectionCard title="Feedback" blurb={SECTIONS[3].blurb} onOpen={() => go('feedback')} spark={fb.trend.length ? <Spark data={fb.trend} k="overall" name="Average rating" fmt={v => v.toFixed(1)} /> : <div className="h-14" />} stats={[
                ['Average rating', fb.overall === null ? '–' : `${fb.overall.toFixed(1)} ★`],
                ['Would recommend', pct(fb.recommend)],
                ['Anonymous notes', String(fb.feedback.length)]
              ]} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Rides per week" subtitle="Posted vs booked" hint="Click a week to drill into its rides">
                {weeks.some(w => w.posted) ? (
                  <TimeBars data={weeks} x="label" series={[{ key: 'posted', name: 'Posted' }, { key: 'booked', name: 'Booked' }]} onSelect={w => go('business', { kind: 'week', key: w.week })} />
                ) : (
                  <Empty>No rides in this period yet.</Empty>
                )}
              </ChartCard>
              <ChartCard title="Students on the network" subtitle="Total signed up, by week" hint="Click a week to see who joined">
                <Trend data={weeks} x="label" series={[{ key: 'students', name: 'Students' }]} area onSelect={w => go('customer', { kind: 'signups', key: w.week })} />
              </ChartCard>
            </div>
          </>
        )}

        {section === 'business' && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile label="Rides posted" value={String(m.posted)} delta={d(m.posted, prev?.posted)} onClick={() => go('business', { kind: 'all', key: 'all' })} />
              <KpiTile label="Rides booked" value={String(m.booked)} delta={d(m.booked, prev?.booked)} definition="At least one other student joined, or a campus cab seat was booked." />
              <KpiTile label="Match rate" value={pct(m.matchRate)} note="posted rides that got riders" definition="Rides booked ÷ rides posted." />
              <KpiTile label="Trips completed" value={String(m.completed)} delta={d(m.completed, prev?.completed)} onClick={() => go('business', { kind: 'outcome', key: 'completed' })} />
              <KpiTile label="Seats filled" value={pct(m.occupancy)} note={m.avgRiders ? `${m.avgRiders.toFixed(1)} people per ride` : undefined} definition="People on board ÷ seats, on booked rides." />
              <KpiTile label="Cancelled" value={pct(m.cancelRate)} note={`${pct(m.expiredRate)} expired`} onClick={() => go('business', { kind: 'outcome', key: 'cancelled' })} definition="Of rides that have left or been cancelled: the share cancelled (and, below, the share that expired with nobody joining)." />
              <KpiTile label="Campus cab bookings" value={String(m.campusCabBookings)} note={`${m.peerBookings} peer rides`} onClick={() => go('business', { kind: 'mix', key: 'cab' })} />
              <KpiTile label="Drivers" value={String(m.drivers)} note={`${m.driversUsed} drove booked rides`} definition="Real drivers on the network (sample drivers not counted)." />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Rides per week" subtitle="Posted vs booked" hint="Click a week to see its rides">
                {weeks.some(w => w.posted) ? (
                  <TimeBars data={weeks} x="label" series={[{ key: 'posted', name: 'Posted' }, { key: 'booked', name: 'Booked' }]} selected={focus?.kind === 'week' ? weekLabel(focus.key) : null} onSelect={w => go('business', { kind: 'week', key: w.week })} />
                ) : <Empty>No rides in this period yet.</Empty>}
              </ChartCard>
              <ChartCard title="What happened to each ride" hint="Click a bar to see those rides">
                {inPeriod.length ? (
                  <RankBars name="Rides" data={(Object.keys(OUTCOME_LABELS) as Outcome[]).map(o => ({ key: o, label: OUTCOME_LABELS[o], value: inPeriod.filter(f => f.outcome === o).length }))} selected={focus?.kind === 'outcome' ? focus.key : null} onSelect={k => go('business', { kind: 'outcome', key: k })} />
                ) : <Empty>No rides in this period yet.</Empty>}
              </ChartCard>
              <ChartCard title="Top routes" subtitle="Rides by route" hint="Click a route to see its rides">
                {inPeriod.length ? (
                  <RankBars name="Rides" data={countBy(inPeriod, f => f.route).slice(0, 8)} selected={focus?.kind === 'route' ? focus.key : null} onSelect={k => go('business', { kind: 'route', key: k })} />
                ) : <Empty>No rides in this period yet.</Empty>}
              </ChartCard>
              <ChartCard title="When students travel" subtitle="Rides by departure hour" hint="Click an hour to see those rides">
                {inPeriod.length ? (
                  <TimeBars data={Array.from({ length: 24 }, (_, h) => ({ hour: String(h), label: hourLabel(h), rides: inPeriod.filter(f => f.hour === h).length }))} x="label" series={[{ key: 'rides', name: 'Rides' }]} selected={focus?.kind === 'hour' ? hourLabel(Number(focus.key)) : null} onSelect={r => go('business', { kind: 'hour', key: r.hour })} />
                ) : <Empty>No rides in this period yet.</Empty>}
              </ChartCard>
              <ChartCard title="Peer rides vs campus cabs" subtitle="Booked rides">
                {m.booked ? (
                  <RankBars name="Booked rides" data={[{ key: 'peer', label: 'Student-posted rides', value: m.peerBookings }, { key: 'cab', label: 'TagAlong campus cabs', value: m.campusCabBookings }]} selected={focus?.kind === 'mix' ? focus.key : null} onSelect={k => go('business', { kind: 'mix', key: k })} />
                ) : <Empty height={120}>No booked rides in this period yet.</Empty>}
              </ChartCard>
              <ChartCard title="Drivers by trips" subtitle="Booked rides per driver" hint="Click a driver to see their rides">
                {(() => {
                  const names = new Map(data.drivers.map(x => [x.id, x.placeholder ? `${x.name}` : x.name]))
                  const rows = countBy(inPeriod.filter(f => f.booked && f.ride.driver_id), f => f.ride.driver_id!).slice(0, 8).map(r => ({ ...r, label: names.get(r.key) || 'Driver' }))
                  return rows.length ? <RankBars name="Rides" data={rows} selected={focus?.kind === 'driver' ? focus.key : null} onSelect={k => go('business', { kind: 'driver', key: k })} /> : <Empty height={120}>No booked rides with a driver yet.</Empty>
                })()}
              </ChartCard>
            </div>
          </>
        )}

        {section === 'customer' && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile label="Students on the network" value={String(m.students)} onClick={() => go('customer', { kind: 'cohort', key: 'all' })} />
              <KpiTile label="New this period" value={String(m.newStudents)} delta={d(m.newStudents, prev?.newStudents)} />
              <KpiTile label="Active students" value={String(m.activeStudents)} delta={d(m.activeStudents, prev?.activeStudents)} definition="Posted a ride or joined one in this period." />
              <KpiTile label="Activation" value={pct(m.activation)} note="have ever posted or joined" definition="Students who have ever posted or joined a ride ÷ all students." />
              <KpiTile label="Repeat riders" value={String(m.repeatRiders)} note="2+ booked trips" />
              <KpiTile label="Average rating" value={m.avgRating === null ? '–' : `${m.avgRating.toFixed(1)} ★`} note={m.ratingsCount ? `${m.ratingsCount} ratings` : 'No ratings yet'} />
              <KpiTile label="Chat messages" value={String(m.messages)} delta={d(m.messages, prev?.messages)} note="in ride chats" />
              <KpiTile label="Programmes" value={String(new Set(data.users.map(u => u.course).filter(Boolean)).size)} note={countBy(data.users, u => u.course || 'Not set').map(c => `${c.key} ${c.value}`).join(' · ')} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Students on the network" subtitle="Total signed up" hint="Click a week to see who joined">
                <Trend data={weeks} x="label" series={[{ key: 'students', name: 'Students' }]} area onSelect={w => go('customer', { kind: 'signups', key: w.week })} />
              </ChartCard>
              <ChartCard title="New and active students per week" hint="Click a week to see who joined">
                <TimeBars data={weeks} x="label" series={[{ key: 'signups', name: 'New sign-ups' }, { key: 'active', name: 'Active' }]} selected={focus?.kind === 'signups' ? weekLabel(focus.key) : null} onSelect={w => go('customer', { kind: 'signups', key: w.week })} />
              </ChartCard>
              <ChartCard title="Students by programme and batch" hint="Click a group to see its students">
                <RankBars name="Students" data={countBy(data.users, u => `${u.course || 'Not set'}${u.batch ? ` ${u.batch}` : ''}`).slice(0, 8)} selected={focus?.kind === 'cohort' ? focus.key : null} onSelect={k => go('customer', { kind: 'cohort', key: k })} />
              </ChartCard>
              <ChartCard title="Trip ratings" subtitle="How riders rated their trips" hint="Click a rating to see those trips">
                {data.ratings.length ? (
                  <RankBars name="Ratings" color="#eda100" data={[5, 4, 3, 2, 1].map(n => ({ key: String(n), label: `${'★'.repeat(n)}`, value: data.ratings.filter(r => r.rating === n).length }))} selected={focus?.kind === 'rating' ? focus.key : null} onSelect={k => go('customer', { kind: 'rating', key: k })} />
                ) : (
                  <Empty>No ratings yet. Riders are asked to rate each trip once it has left.</Empty>
                )}
              </ChartCard>
            </div>
          </>
        )}

        {section === 'financial' && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <KpiTile label="Completed fares" value={inr(m.gmv)} delta={d(m.gmv, prev?.gmv)} onClick={() => go('financial', { kind: 'outcome', key: 'completed' })} definition="Total cab fares of completed trips (gross value through TagAlong)." />
              <KpiTile label={`Commission @ ${ratePct}%`} value={inr(m.commission)} delta={d(m.commission, prev?.commission)} definition="Commission rate × completed fares. Change the rate above." />
              <KpiTile label="Pipeline commission" value={inr(m.pipelineCommission)} note={`on ${inr(m.bookedFares - m.gmv)} of upcoming booked fares`} onClick={() => go('financial', { kind: 'outcome', key: 'booked' })} definition="Commission on rides already booked that haven't happened yet." />
              <KpiTile label="Average fare" value={m.avgFare === null ? '–' : inr(m.avgFare)} note="per completed trip" />
              <KpiTile label="Average share" value={m.avgShare === null ? '–' : inr(m.avgShare)} note="each rider paid" definition="Fare ÷ people on board, averaged over completed trips." />
              <KpiTile label="Student savings" value={inr(m.savings)} note="vs each taking the cab alone" definition="For each completed trip: fare × (people on board − 1)." />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title={`Commission per week @ ${ratePct}%`} subtitle="From completed trips" hint="Click a week to see the trips behind it">
                {weeks.some(w => w.commission) ? (
                  <TimeBars data={weeks} x="label" series={[{ key: 'commission', name: 'Commission' }]} fmt={inr} selected={focus?.kind === 'commission' ? weekLabel(focus.key) : null} onSelect={w => go('financial', { kind: 'commission', key: w.week })} />
                ) : <Empty>No completed trips with a fare in this period yet.</Empty>}
              </ChartCard>
              <ChartCard title="Completed fares per week" subtitle="Gross value through TagAlong" hint="Click a week to see the trips">
                {weeks.some(w => w.gmv) ? (
                  <TimeBars data={weeks} x="label" series={[{ key: 'gmv', name: 'Fares' }]} fmt={inr} onSelect={w => go('financial', { kind: 'commission', key: w.week })} />
                ) : <Empty>No completed trips with a fare in this period yet.</Empty>}
              </ChartCard>
              <ChartCard title="Commission by route" subtitle="Completed and upcoming booked" hint="Click a route to see its rides">
                {(() => {
                  const rows = countBy(inPeriod.filter(f => f.outcome === 'completed' || f.outcome === 'booked'), f => f.route, f => f.fare * rate).filter(r => r.value > 0).slice(0, 8)
                  return rows.length ? <RankBars name="Commission" fmt={inr} data={rows} selected={focus?.kind === 'route' ? focus.key : null} onSelect={k => go('financial', { kind: 'route', key: k })} /> : <Empty height={120}>No priced rides yet.</Empty>
                })()}
              </ChartCard>
              <ChartCard title="Revenue mix" subtitle="Commission by ride type" hint="Click a bar to see those rides">
                {(() => {
                  const booked = inPeriod.filter(f => f.outcome === 'completed' || f.outcome === 'booked')
                  const rows = [
                    { key: 'peer', label: 'Student-posted rides', value: booked.filter(f => !f.campusCab).reduce((s, f) => s + f.fare * rate, 0) },
                    { key: 'cab', label: 'TagAlong campus cabs', value: booked.filter(f => f.campusCab).reduce((s, f) => s + f.fare * rate, 0) }
                  ]
                  return rows.some(r => r.value) ? <RankBars name="Commission" fmt={inr} color={SERIES[1]} data={rows} onSelect={k => go('financial', { kind: 'mix', key: k })} /> : <Empty height={120}>No priced rides yet.</Empty>
                })()}
              </ChartCard>
            </div>
          </>
        )}

        {section === 'feedback' && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile label="Overall rating" value={fb.overall === null ? '–' : `${fb.overall.toFixed(2)} ★`} note={`${fb.ratings.length} trip ratings`} definition="Average of the 1-5 stars riders gave their trip." onClick={() => go('feedback', { kind: 'param', key: 'punctuality' })} />
              <KpiTile label="Would recommend" value={pct(fb.recommend)} note="agree or strongly agree" definition="Share of riders who agreed or strongly agreed: I would recommend TagAlong to a friend." />
              <KpiTile label="Rating response" value={pct(fb.response)} note="of riders rated their trip" definition="Trip ratings ÷ people on board on completed trips." />
              <KpiTile label="Anonymous feedback" value={String(fb.feedback.length)} note={fb.avgMood === null ? undefined : `${fb.avgMood.toFixed(1)} / 5 average mood`} onClick={() => go('feedback', { kind: 'tone', key: 'all' })} />
            </div>

            {/* The analysis, in words */}
            <section className="rounded-2xl border border-primary-200 bg-primary-50/60 p-5">
              <h3 className="font-semibold text-secondary-900">What the feedback tells us</h3>
              {fb.ratings.length + fb.feedback.length === 0 ? (
                <p className="mt-1 text-sm text-secondary-600">No ratings or feedback yet in this period.</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-sm text-secondary-800">
                  {fb.scores.some(p => p.mean !== null) && (
                    <li>
                      <span className="font-semibold text-primary-800">Strongest:</span>{' '}
                      {[...fb.scores].filter(p => p.mean !== null).sort((a, b) => b.mean! - a.mean!).slice(0, 2).map(p => `${p.param.label} (${p.mean!.toFixed(1)}/5)`).join(' and ')}.
                    </li>
                  )}
                  {fb.lowest.length > 0 && (
                    <li>
                      <span className="font-semibold text-amber-800">Improve first:</span> {fb.lowest.map(p => `${p.param.label} (${p.mean!.toFixed(1)}/5)`).join(' and ')}.
                    </li>
                  )}
                  {fb.feedback.length > 0 && (
                    <li>
                      <span className="font-semibold text-primary-800">Anonymous notes:</span> {Math.round((fb.tones.praise / fb.feedback.length) * 100)}% praise, {Math.round((fb.tones.suggestion / fb.feedback.length) * 100)}% suggestions,{' '}
                      {Math.round((fb.tones.concern / fb.feedback.length) * 100)}% concerns.
                    </li>
                  )}
                  {fb.improve.length > 0 && (
                    <li>
                      <span className="font-semibold text-amber-800">Most requested:</span> {fb.improve.slice(0, 3).map(t => `${t.theme.label.toLowerCase()} (${t.suggestion + t.concern})`).join(', ')}.
                    </li>
                  )}
                </ul>
              )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="How riders scored us" subtitle="Share of riders at each point of the 5-point scale" hint="Click a bar to see the trips that scored 3 or below">
                <LikertLegend names={LIKERT} />
                <LikertBars rows={fb.scores.map(p => ({ key: p.param.key, label: p.param.label, dist: p.dist }))} names={LIKERT} onSelect={k => go('feedback', { kind: 'param', key: k })} />
              </ChartCard>
              <ChartCard title="Scorecard" subtitle="Average out of 5, best first" hint="Click a bar to see the low-scoring trips">
                <RankBars
                  name="Average"
                  fmt={v => v.toFixed(2)}
                  data={[...fb.scores].filter(p => p.mean !== null).sort((a, b) => b.mean! - a.mean!).map(p => ({ key: p.param.key, label: p.param.label, value: Number(p.mean!.toFixed(2)) }))}
                  selected={focus?.kind === 'param' ? focus.key : null}
                  onSelect={k => go('feedback', { kind: 'param', key: k })}
                />
              </ChartCard>
              <ChartCard title="Rating trend" subtitle="Weekly average out of 5" hint="Hover to compare the week's scores">
                {fb.trend.length > 1 ? (
                  <Trend
                    data={fb.trend}
                    x="label"
                    yDomain={[1, 5]}
                    fmt={v => v.toFixed(1)}
                    series={[
                      { key: 'overall', name: 'Overall' },
                      { key: 'punctuality', name: 'Punctuality' },
                      { key: 'value', name: 'Value for money' }
                    ]}
                  />
                ) : (
                  <Empty>The trend appears once ratings span two or more weeks.</Empty>
                )}
              </ChartCard>
              <ChartCard title="Average rating by route" subtitle="Stars, trips in this period" hint="Click a route to see its trips">
                {(() => {
                  const rows = countBy(inPeriod.filter(f => f.rating !== null), f => f.route)
                    .map(r => ({ key: r.key, value: Number((average(inPeriod.filter(f => f.route === r.key && f.rating !== null).map(f => f.rating as number)) ?? 0).toFixed(2)) }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 8)
                  return rows.length ? <RankBars name="Average rating" fmt={v => v.toFixed(2)} data={rows} onSelect={k => go('feedback', { kind: 'route', key: k })} /> : <Empty>No rated trips yet.</Empty>
                })()}
              </ChartCard>
              <ChartCard title="Anonymous feedback" subtitle="Praise, suggestions and concerns" hint="Click a bar to read the messages">
                {fb.feedback.length ? (
                  <RankBars
                    name="Messages"
                    data={(['praise', 'suggestion', 'concern'] as Tone[]).map(t => ({ key: t, label: TONE_LABELS[t], value: fb.tones[t] }))}
                    selected={focus?.kind === 'tone' ? focus.key : null}
                    onSelect={k => go('feedback', { kind: 'tone', key: k })}
                  />
                ) : (
                  <Empty>No anonymous feedback yet.</Empty>
                )}
              </ChartCard>
              <ChartCard title="Feedback by topic" subtitle="What students write about" hint="Click a topic to read the messages">
                {fb.feedback.length ? (
                  <RankBars
                    name="Messages"
                    color={SERIES[1]}
                    data={countBy(fb.feedback, f => f.category).map(r => ({ key: r.key, label: categoryLabel(r.key), value: r.value }))}
                    selected={focus?.kind === 'fcat' ? focus.key : null}
                    onSelect={k => go('feedback', { kind: 'fcat', key: k })}
                  />
                ) : (
                  <Empty>No anonymous feedback yet.</Empty>
                )}
              </ChartCard>
            </div>

            <ChartCard title="Themes in the feedback" subtitle="Found by keywords in the messages. Longest bars are mentioned most" hint="Click a theme to read the messages">
              {fb.themes.length ? (
                <ul className="space-y-2">
                  {[...fb.themes].sort((a, b) => b.mentions - a.mentions).map(t => {
                    const max = Math.max(...fb.themes.map(x => x.mentions))
                    const w = (n: number) => `${(n / max) * 100}%`
                    return (
                      <li key={t.theme.key}>
                        <button type="button" onClick={() => go('feedback', { kind: 'theme', key: t.theme.key })} className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-primary-50 ${focus?.kind === 'theme' && focus.key === t.theme.key ? 'bg-primary-50' : ''}`}>
                          <span className="w-44 shrink-0 text-sm text-secondary-800">{t.theme.label}</span>
                          <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-secondary-100" title={`${t.praise} praise · ${t.suggestion} suggestions · ${t.concern} concerns`}>
                            <span style={{ width: w(t.praise), background: SERIES[0] }} />
                            <span style={{ width: w(t.suggestion), background: '#eda100' }} />
                            <span style={{ width: w(t.concern), background: '#c2410c' }} />
                          </span>
                          <span className="w-8 shrink-0 text-right text-sm font-semibold text-secondary-900">{t.mentions}</span>
                        </button>
                      </li>
                    )
                  })}
                  <li className="flex gap-4 pl-2 pt-1 text-xs text-secondary-500">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[0] }} /> Praise</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#eda100' }} /> Suggestions</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#c2410c' }} /> Concerns</span>
                  </li>
                </ul>
              ) : (
                <Empty height={120}>No themes yet.</Empty>
              )}
            </ChartCard>

            {(fb.seeded.feedback > 0 || fb.seeded.ratings > 0) && (
              <p className="rounded-xl bg-secondary-100 px-3 py-2 text-xs text-secondary-600">
                Note for admins: {fb.seeded.ratings} of {fb.ratings.length} ratings and {fb.seeded.feedback} of {fb.feedback.length} messages here are illustrative entries added for the demo (flagged <code>seeded</code> in the database), so they can be removed once real feedback comes in.
              </p>
            )}
          </>
        )}

        {/* Level 3: the rides or students behind a number */}
        {section !== 'overview' && (
          <Detail
            focus={focus ?? (section === 'customer' ? { kind: 'cohort', key: 'all' } : section === 'feedback' ? { kind: 'tone', key: 'all' } : { kind: 'all', key: 'all' })}
            explicit={Boolean(focus)}
            data={data}
            facts={inPeriod}
            allFacts={facts}
            rate={rate}
            since={period.start}
            onClose={() => go(section)}
            onOpenRide={id => navigate(`/ride/${id}`)}
          />
        )}
      </div>
    </div>
  )
}

const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`)

function focusLabel(f: Focus, data: DashboardData): string {
  switch (f.kind) {
    case 'week':
    case 'commission':
      return `Week of ${weekLabel(f.key)}`
    case 'signups':
      return `Joined in the week of ${weekLabel(f.key)}`
    case 'outcome':
      return OUTCOME_LABELS[f.key as Outcome] || f.key
    case 'hour':
      return `Leaving around ${hourLabel(Number(f.key))}`
    case 'driver':
      return data.drivers.find(x => x.id === f.key)?.name || 'Driver'
    case 'mix':
      return f.key === 'cab' ? 'Campus cabs' : 'Student-posted rides'
    case 'cohort':
      return f.key === 'all' ? 'All students' : f.key
    case 'rating':
      return `${f.key}★ trips`
    case 'param':
      return `Trips where ${PARAMS.find(p => p.key === f.key)?.label ?? f.key} scored 3 or below`
    case 'tone':
      return f.key === 'all' ? 'All anonymous feedback' : TONE_LABELS[f.key as Tone]
    case 'fcat':
      return categoryLabel(f.key)
    case 'theme':
      return THEMES.find(t => t.key === f.key)?.label ?? f.key
    case 'route':
      return f.key
    default:
      return 'All rides'
  }
}

function SectionCard({ title, blurb, stats, spark, onOpen }: { title: string; blurb: string; stats: [string, string][]; spark: ReactNode; onOpen: () => void }) {
  return (
    <section className="flex flex-col rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-secondary-900">{title}</h2>
      <p className="text-sm text-secondary-500">{blurb}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(([l, v]) => (
          <div key={l}>
            <p className="text-lg font-bold text-secondary-900">{v}</p>
            <p className="text-xs text-secondary-500">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-2">{spark}</div>
      <button type="button" onClick={onOpen} className="mt-auto flex items-center gap-1 pt-2 text-sm font-semibold text-primary-700 hover:underline">
        Explore {title.toLowerCase()} <ChevronRight size={16} />
      </button>
    </section>
  )
}

// ---------- detail table ----------

function Detail({
  focus,
  explicit,
  data,
  facts,
  allFacts,
  rate,
  since,
  onClose,
  onOpenRide
}: {
  focus: Focus
  explicit: boolean
  data: DashboardData
  facts: RideFact[]
  allFacts: RideFact[]
  rate: number
  since: number
  onClose: () => void
  onOpenRide: (id: string) => void
}) {
  const userFocus = focus.kind === 'signups' || focus.kind === 'cohort'
  const title = focusLabel(focus, data)

  if (userFocus) {
    const trips = new Map<string, number>()
    for (const f of allFacts.filter(x => x.booked)) trips.set(f.ride.creator_id, (trips.get(f.ride.creator_id) || 0) + 1)
    for (const p of data.participants) if (p.status === 'accepted') trips.set(p.user_id, (trips.get(p.user_id) || 0) + 1)
    const users = data.users
      .filter(u =>
        focus.kind === 'signups'
          ? weekOf(new Date(u.created_at).getTime()) === focus.key
          : focus.key === 'all' || `${u.course || 'Not set'}${u.batch ? ` ${u.batch}` : ''}` === focus.key
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return (
      <DetailFrame title={`${title} · ${users.length} student${users.length === 1 ? '' : 's'}`} explicit={explicit} onClose={onClose}>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-secondary-500">
            <tr>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Programme</th>
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2 text-right">Booked trips</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100">
            {users.map(u => (
              <tr key={u.id}>
                <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="px-3 py-2">{u.course || '–'}</td>
                <td className="px-3 py-2">{u.batch || '–'}</td>
                <td className="px-3 py-2 text-right">{trips.get(u.id) || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetailFrame>
    )
  }

  if (focus.kind === 'tone' || focus.kind === 'fcat' || focus.kind === 'theme') {
    const theme = THEMES.find(t => t.key === focus.key)
    const rows = (data.feedback ?? [])
      .filter(f => new Date(f.created_at).getTime() >= since)
      .filter(f => (focus.kind === 'tone' ? focus.key === 'all' || toneOf(f) === focus.key : focus.kind === 'fcat' ? f.category === focus.key : Boolean(theme?.words.test(f.message))))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return (
      <DetailFrame title={`${title} · ${rows.length} message${rows.length === 1 ? '' : 's'}`} summary="Anonymous: no names or accounts are stored with feedback." explicit={explicit} onClose={onClose}>
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-secondary-400">No messages here.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-secondary-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Mood</th>
                <th className="px-3 py-2">Topic</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {rows.map(f => (
                <tr key={f.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">{new Date(f.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-3 py-2 text-lg" title={MOODS[f.mood - 1]?.label}>{MOODS[f.mood - 1]?.emoji}</td>
                  <td className="whitespace-nowrap px-3 py-2">{categoryLabel(f.category)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{TONE_LABELS[toneOf(f)]}</td>
                  <td className="px-3 py-2">{f.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DetailFrame>
    )
  }

  const pick = (f: RideFact) => {
    switch (focus.kind) {
      case 'week':
        return weekOf(f.when) === focus.key
      case 'commission':
        return weekOf(f.when) === focus.key && f.outcome === 'completed'
      case 'outcome':
        return f.outcome === focus.key
      case 'route':
        return f.route === focus.key
      case 'hour':
        return f.hour === Number(focus.key)
      case 'driver':
        return f.ride.driver_id === focus.key && f.booked
      case 'mix':
        return f.booked && (focus.key === 'cab' ? f.campusCab : !f.campusCab)
      case 'rating':
        return data.ratings.some(r => r.ride_id === f.ride.id && r.rating === Number(focus.key))
      case 'param':
        return data.ratings.some(r => r.ride_id === f.ride.id && (r[focus.key as ParamKey] ?? 5) <= 3)
      default:
        return true
    }
  }
  const source = focus.kind === 'week' || focus.kind === 'commission' || focus.kind === 'rating' || focus.kind === 'param' ? allFacts : facts
  const rows = source.filter(pick).sort((a, b) => b.when - a.when)
  const fares = rows.filter(r => r.outcome === 'completed').reduce((s, r) => s + r.fare, 0)

  return (
    <DetailFrame
      title={`${title} · ${rows.length} ride${rows.length === 1 ? '' : 's'}`}
      summary={fares ? `${inr(fares)} completed fares · ${inr(fares * rate)} commission` : undefined}
      explicit={explicit}
      onClose={onClose}
    >
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-secondary-400">No rides here.</p>
      ) : (
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-secondary-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2 text-right">On board</th>
              <th className="px-3 py-2 text-right">Fare</th>
              <th className="px-3 py-2 text-right">Commission</th>
              <th className="px-3 py-2 text-right">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100">
            {rows.map(f => (
              <tr key={f.ride.id} onClick={() => onOpenRide(f.ride.id)} className="cursor-pointer hover:bg-primary-50">
                <td className="whitespace-nowrap px-3 py-2">
                  {formatDateLabel(f.ride.date)}, {formatTime(f.ride.departure_time)}
                </td>
                <td className="px-3 py-2">
                  {f.route}
                  {f.campusCab && <span className="ml-1.5 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">Cab</span>}
                </td>
                <td className="px-3 py-2">{OUTCOME_LABELS[f.outcome]}</td>
                <td className="px-3 py-2 text-right">
                  {f.riders}/{f.ride.max_seats}
                </td>
                <td className="px-3 py-2 text-right">{f.fare ? inr(f.fare) : '–'}</td>
                <td className="px-3 py-2 text-right">{f.fare && (f.outcome === 'completed' || f.outcome === 'booked') ? inr(f.fare * rate) : '–'}</td>
                <td className="px-3 py-2 text-right">{f.rating === null ? '–' : `${f.rating.toFixed(1)} ★`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DetailFrame>
  )
}

function DetailFrame({ title, summary, explicit, onClose, children }: { title: string; summary?: string; explicit: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border bg-white shadow-sm ${explicit ? 'border-primary-300 ring-2 ring-primary-100' : 'border-secondary-200'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary-100 px-5 py-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-secondary-900">
            <Table2 size={16} className="text-primary-700" /> {title}
          </h3>
          {summary && <p className="text-sm text-secondary-500">{summary}</p>}
          {!explicit && <p className="text-xs text-secondary-400">The data behind this section. Click any chart to narrow it down.</p>}
        </div>
        {explicit && (
          <button type="button" onClick={onClose} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-secondary-600 hover:bg-secondary-100">
            <X size={14} /> Clear
          </button>
        )}
      </div>
      <div className="max-h-[420px] overflow-auto">{children}</div>
    </section>
  )
}
