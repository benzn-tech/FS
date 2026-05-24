/**
 * logger.ts
 *
 * Structured JSON logger for Next.js API routes.
 * - Production: emits newline-delimited JSON (queryable in CloudWatch Log Insights)
 * - Development: pretty-prints via pino-pretty for readability
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ sessionId }, 'Session exported')
 *   logger.error({ err, sessionId }, 'Export failed')
 */

import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),

  // In production emit plain JSON so CloudWatch Log Insights can parse fields.
  // In dev use pino-pretty for human-readable output.
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,

  // Base fields included in every log line
  base: {
    service: 'fieldsightai-web',
    env: process.env.NODE_ENV,
  },

  // Serialize Error objects automatically
  serializers: {
    err: pino.stdSerializers.err,
  },
})
