/**
 * Profile Completion Tracker Service
 * Calculates completion percentage based on core profile fields
 */

const CORE_FIELDS = [
  'name',
  'age',
  'gender',
  'ethnicity',
  'medications',
  'known_health_problems',
  'family_history',
  'surgeries',
  'alcohol_and_smoking',
  'allergies'
]

/**
 * Calculate profile completion percentage
 * @param {Object} profile - User profile object
 * @returns {Object} - { percentage, completed, total, missingFields }
 */
export function calculateProfileCompletion(profile) {
  if (!profile) {
    return {
      percentage: 0,
      completed: 0,
      total: CORE_FIELDS.length,
      missingFields: CORE_FIELDS
    }
  }

  let completed = 0
  const missingFields = []

  CORE_FIELDS.forEach(field => {
    const value = profile[field]
    
    // Check if field has meaningful data
    if (value !== null && value !== undefined && value !== '') {
      // Handle array fields
      if (Array.isArray(value)) {
        if (value.length > 0) {
          completed++
        } else {
          missingFields.push(field)
        }
      } 
      // Handle string fields that might be JSON arrays
      else if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed && trimmed !== '[]' && trimmed !== '{}') {
          completed++
        } else {
          missingFields.push(field)
        }
      }
      // Handle other types
      else {
        completed++
      }
    } else {
      missingFields.push(field)
    }
  })

  const percentage = Math.round((completed / CORE_FIELDS.length) * 100)

  return {
    percentage,
    completed,
    total: CORE_FIELDS.length,
    missingFields
  }
}

/**
 * Get friendly field name for display
 */
export function getFriendlyFieldName(field) {
  const fieldNames = {
    name: 'Name',
    age: 'Age',
    gender: 'Gender',
    ethnicity: 'Ethnicity',
    medications: 'Current Medications',
    known_health_problems: 'Known Health Problems',
    family_history: 'Family History',
    surgeries: 'Previous Surgeries',
    alcohol_and_smoking: 'Alcohol & Smoking',
    allergies: 'Allergies'
  }
  
  return fieldNames[field] || field
}