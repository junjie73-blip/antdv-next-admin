export const ErrorCode = {
  SUCCESS: 200,
  VALIDATION_FAILED: 400001,
  UNAUTHORIZED: 401001,
  FORBIDDEN: 403001,
  NOT_FOUND: 404001,
  BLOCKED: 403,
  INTERNAL_ERROR: 500000,
  HTTP_BAD_GATEWAY: 502,
  HTTP_SERVICE_UNAVAILABLE: 503,
  HTTP_GATEWAY_TIMEOUT: 504,
} as const

const SERVER_ERROR_STATUS = new Set([
  500, 501, 502, 503, 504, 505, 507, 508, 510, 511,
])

export function isServerErrorCode(code?: number): boolean {
  return code !== undefined && code >= 500000 && code < 600000
}

export function isServerFailure(status: number, code?: number): boolean {
  return SERVER_ERROR_STATUS.has(status) || isServerErrorCode(code)
}

export class RequestError<T = unknown> extends Error {
  data?: T
  status: number
  statusText: string
  retryCount: number
  code: number
  handled = false

  constructor(
    message: string,
    options: {
      data?: T
      status: number
      statusText?: string
      code?: number
      retryCount?: number
    },
  ) {
    super(message)
    this.name = 'RequestError'
    this.data = options.data
    this.status = options.status
    this.statusText = options.statusText ?? ''
    this.code = options.code ?? options.status
    this.retryCount = options.retryCount ?? 0
  }
}
