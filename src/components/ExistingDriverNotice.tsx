import { BadgeCheck } from 'lucide-react'
import { ReactNode } from 'react'
import { ExistingDriver } from '../lib/drivers'

// "This number is already in our directory": avoids the same driver being added twice
export function ExistingDriverNotice({ driver, children }: { driver: ExistingDriver; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary-300 bg-primary-50 p-3" role="status">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-900">
        <BadgeCheck size={16} /> This driver is already in our directory
      </p>
      <p className="mt-0.5 text-sm text-primary-900">
        <span className="font-semibold">{driver.name}</span>
        {[driver.vehicle_type, driver.vehicle_number, driver.seats ? `${driver.seats} seats` : null].filter(Boolean).length > 0 && (
          <span className="text-primary-800"> · {[driver.vehicle_type, driver.vehicle_number, driver.seats ? `${driver.seats} seats` : null].filter(Boolean).join(' · ')}</span>
        )}
      </p>
      {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
