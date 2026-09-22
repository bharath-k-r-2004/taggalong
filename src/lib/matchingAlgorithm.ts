export interface Ride {
  id: string
  origin: string
  destination: string
  date: string
  departureTime: string
  totalCost: number
  maxSeats: number
  currentParticipants: number
  driverName: string
  driverPhone: string
  vehicleType: string
  vehicleNumber: string
  status: string
  createdAt: string
  createdBy: string
}

export interface MatchScore {
  ride: Ride
  score: number
  reason: string
}

/**
 * Match rides based on:
 * 1. Same origin and destination
 * 2. Same date
 * 3. Similar departure time (within 30 mins)
 * 4. Occupancy level (higher occupancy = higher priority)
 */
export function matchRides(
  allRides: Ride[],
  userOrigin: string,
  userDestination: string,
  userDate: string,
  userTime: string,
  timeFlexibility: 'exact' | '30mins' | '1hour' | 'flexible' = 'flexible'
): MatchScore[] {
  const userTimeInMinutes = timeToMinutes(userTime)

  const matches: MatchScore[] = []

  for (const ride of allRides) {
    // Skip if ride is full or cancelled
    if (ride.status === 'cancelled' || ride.currentParticipants >= ride.maxSeats) {
      continue
    }

    // Check route match (case-insensitive)
    if (
      ride.origin.toLowerCase() !== userOrigin.toLowerCase() ||
      ride.destination.toLowerCase() !== userDestination.toLowerCase()
    ) {
      continue
    }

    // Check date match
    if (ride.date !== userDate) {
      continue
    }

    // Check time match
    const rideTimeInMinutes = timeToMinutes(ride.departureTime)
    const timeDiff = Math.abs(rideTimeInMinutes - userTimeInMinutes)

    let timeMatch = false
    switch (timeFlexibility) {
      case 'exact':
        timeMatch = timeDiff <= 5
        break
      case '30mins':
        timeMatch = timeDiff <= 30
        break
      case '1hour':
        timeMatch = timeDiff <= 60
        break
      case 'flexible':
        timeMatch = timeDiff <= 120
        break
    }

    if (!timeMatch) {
      continue
    }

    // Calculate match score (higher = better)
    // Occupancy-first: Higher occupancy = higher priority
    const occupancyRatio = ride.currentParticipants / ride.maxSeats
    const occupancyScore = occupancyRatio * 100

    // Time proximity: Closer time = higher score
    const timeScore = Math.max(0, 100 - timeDiff)

    // Combined score: 70% occupancy, 30% time
    const totalScore = occupancyScore * 0.7 + timeScore * 0.3

    matches.push({
      ride,
      score: totalScore,
      reason: `${ride.currentParticipants}/${ride.maxSeats} seats filled, departs at ${ride.departureTime}`
    })
  }

  // Sort by score (descending) - best matches first
  return matches.sort((a, b) => b.score - a.score)
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
