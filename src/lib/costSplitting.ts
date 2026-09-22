export interface CostSplitResult {
  totalCost: number
  numParticipants: number
  costPerPerson: number
  breakdown: {
    name: string
    share: number
  }[]
}

/**
 * Calculate cost per person for a ride
 * @param totalCost - Total ride cost in rupees
 * @param participants - Array of participant names
 * @returns Cost split details
 */
export function calculateCostSplit(
  totalCost: number,
  participants: string[]
): CostSplitResult {
  const numParticipants = participants.length
  
  if (numParticipants === 0) {
    return {
      totalCost,
      numParticipants: 0,
      costPerPerson: 0,
      breakdown: []
    }
  }

  const costPerPerson = Math.round((totalCost / numParticipants) * 100) / 100

  return {
    totalCost,
    numParticipants,
    costPerPerson,
    breakdown: participants.map(name => ({
      name,
      share: costPerPerson
    }))
  }
}

/**
 * Format cost for display in INR
 */
export function formatCost(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`
}

/**
 * Format cost with decimals for display in INR
 */
export function formatCostWithDecimals(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}
