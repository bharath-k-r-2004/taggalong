import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, ShieldAlert, Wrench, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDateLabel, formatRupees, formatTime, shortPlace } from '../lib/rides'

type Tab = 'rides' | 'drivers' | 'students' | 'quotes'
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
interface Health {
  check_name: string
  status: 'ok' | 'warning' | 'problem'
  detail: string
}

const OVERVIEW_LABELS: [string, string][] = [
  ['students', 'Students signed up'],
  ['students_without_name', 'Haven’t entered a name'],
  ['rides_upcoming', 'Upcoming rides'],
  ['travel_groups', 'Groups looking for a driver'],
  ['rides_completed', 'Completed rides'],
  ['rides_cancelled', 'Cancelled rides'],
  ['requests_pending', 'Join requests waiting'],
  ['riders_accepted', 'Riders accepted (all time)'],
  ['drivers', 'Community drivers'],
  ['quotes', 'Route quotes'],
  ['vouches', 'Vouches'],
  ['messages_7d', 'Chat messages (7 days)'],
  ['last_minute_cancellations_30d', 'Last-minute cancellations (30 days)'],
  ['non_iim_accounts', 'Non-IIM accounts']
]

export function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [overview, setOverview] = useState<Record<string, number> | null>(null)
  const [health, setHealth] = useState<Health[]>([])
  const [tab, setTab] = useState<Tab>('rides')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    const [o, h] = await Promise.all([supabase.rpc('admin_overview'), supabase.rpc('admin_health_checks')])
    if (o.error || h.error) throw o.error || h.error
    setOverview(o.data as Record<string, number>)
    setHealth((h.data || []) as Health[])
  }, [])

  const loadList = useCallback(async (kind: Tab) => {
    setLoading(true)
    const { data, error: listError } = await supabase.rpc('admin_list', { p_kind: kind })
    setLoading(false)
    if (listError) setError(listError.message)
    else setRows((data || []) as Row[])
  }, [])

  const refresh = useCallback(async () => {
    try {
      setError(null)
      await Promise.all([loadSummary(), loadList(tab)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard')
    }
  }, [loadSummary, loadList, tab])

  useEffect(() => {
    supabase.rpc('is_admin').then(({ data }) => setAllowed(Boolean(data)))
  }, [])

  useEffect(() => {
    if (allowed) void refresh()
  }, [allowed, refresh])

  const action = async (fn: string, args: Record<string, unknown>, success: string) => {
    const { error: actionError } = await supabase.rpc(fn, args)
    if (actionError) {
      setError(actionError.message)
      return
    }
    setNotice(success)
    await refresh()
  }

  const runRepairs = async () => {
    const { data, error: repairError } = await supabase.rpc('admin_run_repairs')
    if (repairError) return setError(repairError.message)
    const r = data as Record<string, number>
    setNotice(
      `Repairs done: ${r.seat_counts_fixed} seat count(s) fixed, ${r.profiles_created} profile(s) created, ${r.stale_requests_closed} stale request(s) closed.`
    )
    await refresh()
  }

  if (allowed === null) {
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
        <p className="text-sm text-secondary-600">This page is for the TagAlong team.</p>
      </div>
    )
  }

  const problems = health.filter(h => h.status === 'problem').length
  const warnings = health.filter(h => h.status === 'warning').length

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Admin dashboard</h1>
          <p className="text-sm text-secondary-600">Health of the app, and tools to fix problems. Chat messages stay private.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex items-center gap-1.5 rounded-xl border border-secondary-300 px-3 py-2 text-sm font-medium hover:bg-secondary-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {notice && <div className="mb-3 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">{notice}</div>}
      {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Overview */}
      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {OVERVIEW_LABELS.map(([key, label]) => (
            <div
              key={key}
              className={`rounded-xl border bg-white p-3 ${
                key === 'non_iim_accounts' && overview[key] > 0 ? 'border-amber-300' : 'border-secondary-200'
              }`}
            >
              <p className="text-2xl font-bold text-secondary-900">{overview[key] ?? 0}</p>
              <p className="text-xs text-secondary-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Health checks */}
      <section className="mt-6 rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-secondary-900">
            Health checks{' '}
            <span className="text-sm font-normal text-secondary-500">
              · {problems} problem{problems === 1 ? '' : 's'}, {warnings} warning{warnings === 1 ? '' : 's'}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => void runRepairs()}
            className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Wrench size={14} /> Run automatic repairs
          </button>
        </div>
        <div className="divide-y divide-secondary-100">
          {health.map(h => (
            <div key={h.check_name} className="flex items-start gap-3 py-2.5">
              {h.status === 'ok' ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary-600" />
              ) : h.status === 'warning' ? (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
              ) : (
                <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
              )}
              <div>
                <p className="text-sm font-medium text-secondary-900">{h.check_name}</p>
                <p className="text-xs text-secondary-600">{h.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-secondary-500">
          Repairs only fix bookkeeping: seat counts, open/full labels, missing profiles and requests left on old rides.
        </p>
      </section>

      {/* Lists */}
      <section className="mt-6">
        <div className="mb-3 inline-flex rounded-xl bg-secondary-100 p-1">
          {(['rides', 'drivers', 'students', 'quotes'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t)
                void loadList(t)
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                tab === t ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-8 text-center text-secondary-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-secondary-300 bg-white py-8 text-center text-secondary-500">Nothing here yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-secondary-200 bg-white">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-secondary-100">
                {tab === 'rides' &&
                  rows.map(r => (
                    <tr key={r.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {formatDateLabel(r.date)}, {formatTime(r.departure_time)}
                        </p>
                        <p className="text-secondary-600">
                          {shortPlace(r.origin)} → {shortPlace(r.destination)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{r.creator_name || 'No name'}</p>
                        <p className="text-xs text-secondary-500">{r.creator_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="capitalize">{r.status}</p>
                        <p className="text-xs text-secondary-500">
                          {r.current_participants}/{r.max_seats} on board · {r.pending} waiting
                          {r.total_cost ? ` · ${formatRupees(Number(r.total_cost))}` : ''}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link to={`/ride/${r.id}`} className="mr-3 font-medium text-primary-600 hover:underline">
                          Open
                        </Link>
                        {r.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              const reason = window.prompt('Reason for cancelling (visible on the ride):', 'Cancelled by admin')
                              if (reason !== null) void action('admin_cancel_ride', { p_ride: r.id, p_reason: reason }, 'Ride cancelled.')
                            }}
                            className="font-medium text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                {tab === 'drivers' &&
                  rows.map(d => (
                    <tr key={d.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-secondary-500">
                          +91 {d.phone} · {d.vehicle_type || 'no vehicle'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>Added by {d.added_by || 'unknown'}</p>
                        <p className="text-xs text-secondary-500">{d.added_by_email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary-600">
                        {d.rides} rides · {d.quotes} quotes · {d.vouches} vouches
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link to={`/drivers/${d.id}`} className="mr-3 font-medium text-primary-600 hover:underline">
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove ${d.name} from the directory? Their quotes and vouches are removed too.`))
                              void action('admin_remove_driver', { p_driver: d.id }, 'Driver removed.')
                          }}
                          className="font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}

                {tab === 'students' &&
                  rows.map(u => (
                    <tr key={u.id} className={u.last_minute_cancellations >= 3 ? 'bg-amber-50' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.name || <span className="text-secondary-400">No name yet</span>}</p>
                        <p className="text-xs text-secondary-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {u.course || '—'} {u.batch || ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary-600">
                        {u.completed_trips} completed · {u.cancelled_trips} cancelled ·{' '}
                        <span className={u.last_minute_cancellations >= 3 ? 'font-semibold text-amber-800' : ''}>
                          {u.last_minute_cancellations} last-minute
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-secondary-500">
                        joined {new Date(u.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}

                {tab === 'quotes' &&
                  rows.map(q => {
                    const odd = q.quoted_price < 100 || q.quoted_price > 20000
                    return (
                      <tr key={q.id} className={odd ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {shortPlace(q.origin)} → {shortPlace(q.destination)}
                          </p>
                          <p className="text-xs text-secondary-500">Driver: {q.driver_name}</p>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${odd ? 'text-amber-800' : ''}`}>
                          {formatRupees(Number(q.quoted_price))}
                          {odd && <span className="block text-xs font-normal">looks unusual</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary-500">
                          by {q.recorded_by || 'unknown'} · {new Date(q.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Delete this quote?')) void action('admin_delete_quote', { p_quote: q.id }, 'Quote deleted.')
                            }}
                            className="font-medium text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Deeper tools */}
      <section className="mt-6 rounded-2xl border border-secondary-200 bg-white p-5 text-sm text-secondary-700 shadow-sm">
        <h2 className="mb-2 font-semibold text-secondary-900">When you need to dig deeper</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Something fails for a student:</strong> Supabase → Logs → <em>API Gateway</em> shows every request and its error.
          </li>
          <li>
            <strong>Login problems:</strong> Supabase → Logs → <em>Auth</em>; accounts are in Authentication → Users.
          </li>
          <li>
            <strong>Site won't load or update:</strong> Vercel → Deployments → the latest one → Build Logs.
          </li>
          <li>
            <strong>Look at raw data:</strong> Supabase → Table Editor (read-only browsing is safe; avoid editing rows by hand).
          </li>
        </ul>
        <a
          href="https://supabase.com/dashboard/project/tjuyeqorhhrppislcmlf/logs/edge-logs"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline"
        >
          Open Supabase logs <ExternalLink size={14} />
        </a>
      </section>
    </div>
  )
}
