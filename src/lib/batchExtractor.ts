/**
 * Extract course and batch from IIM email
 * Examples:
 * - pgp17xxxxx@iimrohtak.ac.in → { course: 'PGP', batch: '17', fullBatch: 'PGP17' }
 * - ipm04xxxxx@iimrohtak.ac.in → { course: 'IPM', batch: '04', fullBatch: 'IPM04' }
 * - dpm02xxxxx@iimrohtak.ac.in → { course: 'DPM', batch: '02', fullBatch: 'DPM02' }
 * - ipl05xxxxx@iimrohtak.ac.in → { course: 'IPL', batch: '05', fullBatch: 'IPL05' }
 */

export interface BatchInfo {
  course: 'PGP' | 'IPM' | 'DPM' | 'IPL' | null
  batch: string | null
  fullBatch: string | null
}

export function extractBatchFromEmail(email: string): BatchInfo {
  // Validate email domain
  if (!email.endsWith('@iimrohtak.ac.in')) {
    return { course: null, batch: null, fullBatch: null }
  }

  const localPart = email.split('@')[0].toLowerCase()
  
  // Match patterns like pgp17xxxxx, ipm04xxxxx, etc.
  const match = localPart.match(/^([a-z]+)(\d+)/)
  
  if (!match) {
    return { course: null, batch: null, fullBatch: null }
  }

  const courseCode = match[1].toUpperCase()
  const batchNum = match[2]

  const validCourses = ['PGP', 'IPM', 'DPM', 'IPL']
  
  if (!validCourses.includes(courseCode)) {
    return { course: null, batch: null, fullBatch: null }
  }

  return {
    course: courseCode as 'PGP' | 'IPM' | 'DPM' | 'IPL',
    batch: batchNum,
    fullBatch: `${courseCode}${batchNum}`
  }
}
