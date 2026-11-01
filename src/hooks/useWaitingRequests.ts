import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchMyRides, waitingForReply } from '../lib/rides'

// How many students are waiting for my reply on rides I posted. Re-checked every minute and when `key` changes (e.g. on navigation).
export function useWaitingRequests(key?: string) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!user) return
    let alive = true
    const check = () =>
      fetchMyRides(user.id)
        .then(rides => alive && setCount(waitingForReply(rides, user.id).reduce((n, w) => n + w.requests.length, 0)))
        .catch(() => undefined)
    void check()
    const t = setInterval(() => void check(), 60000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [user, key])
  return count
}
