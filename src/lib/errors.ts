// Turns technical database/network errors into plain messages students can act on.
export function friendlyError(err: unknown, whenRefused = "You can't make this change right now. Refresh the page and try again."): string {
  const raw = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err)
  if (/fetch failed|failed to fetch|networkerror|network request failed|load failed/i.test(raw))
    return 'No internet connection. Check your network and try again.'
  if (/jwt expired|invalid jwt|not authenticated/i.test(raw)) return 'Your session expired. Please sign in again.'
  if (/row-level security/i.test(raw)) return whenRefused
  if (/rides_fare_sensible/.test(raw)) return 'Please enter a total fare between ₹1 and ₹1,00,000.'
  if (/rides_seats_sensible/.test(raw)) return 'Seats must be between 2 and 10.'
  if (/drivers_phone_valid|rides_driver_phone_valid|users_phone_valid/.test(raw)) return 'Please enter a valid 10-digit mobile number.'
  if (/duplicate key/i.test(raw)) return 'That has already been saved.'
  if (/violates check constraint/i.test(raw)) return 'Some details look invalid. Please check and try again.'
  return raw || 'Something went wrong. Please try again.'
}
