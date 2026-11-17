export type PlaybookDatabaseErrorResult = {
  status: 400 | 409 | 500
  userMessage: string
  logMessage: string
}

function errorDetails(error: unknown) {
  if (error instanceof Error) return { message: error.message, code: '' }
  if (error && typeof error === 'object') {
    const source = error as { message?: unknown; code?: unknown }
    return {
      message: typeof source.message === 'string' ? source.message : String(error),
      code: typeof source.code === 'string' ? source.code : '',
    }
  }
  return { message: String(error), code: '' }
}

export function classifyPlaybookDatabaseError(error: unknown): PlaybookDatabaseErrorResult {
  const { message, code } = errorDetails(error)
  const normalized = `${code} ${message}`.toLowerCase()
  if (normalized.includes('conflict') || normalized.includes('40001')) {
    return {
      status: 409,
      userMessage: 'This record changed in another request. Reload and try again.',
      logMessage: message,
    }
  }
  if (
    normalized.includes('playbook_proposal_not_')
    || normalized.includes('playbook_proposal_missing_approval_audit')
  ) {
    return {
      status: 409,
      userMessage: 'This proposal is not in a valid state for that action.',
      logMessage: message,
    }
  }
  if (normalized.includes('duplicate') || normalized.includes('23505')) {
    return { status: 409, userMessage: 'That record already exists.', logMessage: message }
  }
  if (
    normalized.includes('invalid_')
    || normalized.includes('invalid ')
    || normalized.includes('not_found')
    || normalized.includes('not found')
    || normalized.includes('required')
  ) {
    return {
      status: 400,
      userMessage: message.replace(/^.*playbook_/, '').replaceAll('_', ' '),
      logMessage: message,
    }
  }
  return { status: 500, userMessage: 'Unable to save this Playbook change.', logMessage: message }
}
