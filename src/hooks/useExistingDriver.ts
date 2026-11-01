import { useEffect, useState } from 'react'
import { ExistingDriver, cleanPhone, findDriverByPhone, isValidPhone } from '../lib/drivers'

// As soon as a full 10-digit number is typed, look it up in the directory
export function useExistingDriver(phone: string, skip = false) {
  const [existing, setExisting] = useState<ExistingDriver | null>(null)
  const digits = cleanPhone(phone)
  useEffect(() => {
    setExisting(null)
    if (skip || !isValidPhone(digits)) return
    let alive = true
    findDriverByPhone(digits).then(d => alive && setExisting(d)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [digits, skip])
  return existing
}
