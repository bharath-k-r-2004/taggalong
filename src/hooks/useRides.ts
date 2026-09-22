import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Ride {
  id: string
  creator_id: string
  origin: string
  destination: string
  date: string
  departure_time: string
  total_cost: number
  max_seats: number
  driver_name: string
  driver_phone: string
  vehicle_type: string
  vehicle_number: string
  status: string
  created_at: string
}

export function useRides() {
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRides = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('rides')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setRides(data || [])
      setError(null)
    } catch (err) {
      console.error('Fetch rides error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch rides')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRides()

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('rides_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides'
        },
        () => {
          fetchRides()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { rides, loading, error, refetch: fetchRides }
}
