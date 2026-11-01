import { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Info } from 'lucide-react'

// Brand green first, then the validated blue and orange (colour-blind safe as a set)
export const SERIES = ['#16a34a', '#2a78d6', '#eb6834']
const GRID = '#e5e7eb'
const TICK = { fill: '#6b7280', fontSize: 12 }

// ---------- frame ----------

export function ChartCard({
  title,
  subtitle,
  hint,
  children,
  action
}: {
  title: string
  subtitle?: string
  hint?: string // shown as "Click a bar to see the rides"
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-secondary-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-secondary-900">{title}</h3>
          {subtitle && <p className="text-sm text-secondary-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
      {hint && <p className="mt-2 text-xs text-secondary-400">{hint}</p>}
    </section>
  )
}

export function Empty({ children, height = 220 }: { children: ReactNode; height?: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-secondary-200 px-4 text-center text-sm text-secondary-400" style={{ height }}>
      {children}
    </div>
  )
}

// ---------- KPI tile ----------

export function KpiTile({
  label,
  value,
  delta,
  note,
  onClick,
  big,
  definition
}: {
  label: string
  value: string
  delta?: { text: string; up: boolean } | null
  note?: string
  onClick?: () => void
  big?: boolean
  definition?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group rounded-2xl border border-secondary-200 bg-white p-4 text-left shadow-sm transition ${
        onClick ? 'hover:border-primary-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500' : ''
      }`}
    >
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-secondary-500">
        {label}
        {definition && (
          <span title={definition} className="cursor-help text-secondary-400">
            <Info size={12} />
          </span>
        )}
      </p>
      <p className={`mt-1 font-bold text-secondary-900 ${big ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        {delta && (
          <span className={`flex items-center font-semibold ${delta.up ? 'text-primary-700' : 'text-red-600'}`}>
            {delta.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {delta.text}
          </span>
        )}
        {note && <span className="text-secondary-500">{note}</span>}
        {onClick && <ChevronRight size={14} className="ml-auto text-secondary-300 transition group-hover:text-primary-600" />}
      </div>
    </Tag>
  )
}

// ---------- tooltip: value first, series name second, a line key ----------

type Fmt = (v: number) => string

export function ChartTooltip({ active, payload, label, fmt, hint }: TooltipProps<number, string> & { fmt?: Fmt; hint?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="min-w-[140px] rounded-xl border border-secondary-200 bg-white px-3 py-2 shadow-lg">
      {label !== undefined && <p className="mb-1 text-xs font-medium text-secondary-500">{String(label)}</p>}
      {payload.map(p => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded" style={{ background: p.color }} />
          <span className="text-sm font-bold text-secondary-900">{fmt ? fmt(Number(p.value)) : Number(p.value).toLocaleString('en-IN')}</span>
          <span className="text-xs text-secondary-500">{p.name}</span>
        </div>
      ))}
      {hint && <p className="mt-1 text-[11px] text-primary-700">{hint}</p>}
    </div>
  )
}

// ---------- vertical bars over time (1-3 series), clickable ----------

export function TimeBars<T extends object>({
  data,
  x,
  series,
  fmt,
  onSelect,
  selected,
  height = 240
}: {
  data: T[]
  x: keyof T & string
  series: { key: keyof T & string; name: string }[]
  fmt?: Fmt
  onSelect?: (row: T) => void
  selected?: string | null
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={x} tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={fmt ? v => fmt(Number(v)) : undefined} width={fmt ? 64 : 40} />
        <Tooltip
          cursor={{ fill: '#f0fdf4' }}
          content={<ChartTooltip fmt={fmt} hint={onSelect ? 'Click to see the rides' : undefined} />}
        />
        {series.length > 1 && <Legend iconType="rect" iconSize={10} wrapperStyle={{ fontSize: 12, color: '#4b5563' }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={SERIES[i]}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={onSelect ? (d: { payload?: T }) => d.payload && onSelect(d.payload) : undefined}
          >
            {data.map((row, j) => (
              <Cell key={j} fillOpacity={selected && String((row as Record<string, unknown>)[x]) !== selected ? 0.35 : 1} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- horizontal ranked bars (one series), clickable ----------

export function RankBars({
  data,
  fmt,
  onSelect,
  selected,
  color = SERIES[0],
  name = 'Value'
}: {
  data: { key: string; label?: string; value: number }[]
  fmt?: Fmt
  onSelect?: (key: string) => void
  selected?: string | null
  color?: string
  name?: string
}) {
  const rows = data.map(d => ({ ...d, label: d.label || d.key }))
  const height = Math.max(120, rows.length * 38 + 16)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap="28%">
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ ...TICK, fill: '#374151' }} axisLine={false} tickLine={false} width={170} />
        <Tooltip cursor={{ fill: '#f0fdf4' }} content={<ChartTooltip fmt={fmt} hint={onSelect ? 'Click to see the details' : undefined} />} />
        <Bar
          dataKey="value"
          name={name}
          fill={color}
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          cursor={onSelect ? 'pointer' : undefined}
          onClick={onSelect ? (d: { payload?: { key: string } }) => d.payload && onSelect(d.payload.key) : undefined}
          label={{ position: 'right', fill: '#374151', fontSize: 12, formatter: (v: number) => (fmt ? fmt(v) : v) }}
        >
          {rows.map((r, j) => (
            <Cell key={j} fillOpacity={selected && r.key !== selected ? 0.35 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- a trend (line or filled area) with a crosshair ----------

export function Trend<T extends object>({
  data,
  x,
  series,
  fmt,
  area,
  height = 240,
  onSelect
}: {
  data: T[]
  x: keyof T & string
  series: { key: keyof T & string; name: string }[]
  fmt?: Fmt
  area?: boolean
  height?: number
  onSelect?: (row: T) => void
}) {
  const click = onSelect
    ? (e: { activePayload?: { payload: T }[] } | null) => e?.activePayload?.[0] && onSelect(e.activePayload[0].payload)
    : undefined
  const common = {
    data,
    margin: { top: 8, right: 12, left: -12, bottom: 0 },
    onClick: click,
    style: onSelect ? { cursor: 'pointer' } : undefined
  }
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey={x} tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
      <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={fmt ? v => fmt(Number(v)) : undefined} width={fmt ? 64 : 40} />
      <Tooltip cursor={{ stroke: '#9ca3af', strokeWidth: 1 }} content={<ChartTooltip fmt={fmt} hint={onSelect ? 'Click to see this week' : undefined} />} />
      {series.length > 1 && <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: 12, color: '#4b5563' }} />}
    </>
  )
  return (
    <ResponsiveContainer width="100%" height={height}>
      {area ? (
        <AreaChart {...common}>
          {axes}
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={SERIES[i]}
              strokeWidth={2}
              fill={SERIES[i]}
              fillOpacity={0.12}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              dot={false}
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart {...common}>
          {axes}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={SERIES[i]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}

// ---------- sparkline for the overview cards ----------

export function Spark<T extends object>({ data, k, name, fmt }: { data: T[]; k: keyof T & string; name: string; fmt?: Fmt }) {
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Tooltip cursor={{ stroke: '#9ca3af', strokeWidth: 1 }} content={<ChartTooltip fmt={fmt} />} />
        <XAxis dataKey="label" hide />
        <Area type="monotone" dataKey={k} name={name} stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.12} dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
