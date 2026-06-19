import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

/**
 * Sensitive field names that should be redacted in logs.
 * Values matching these keys (case-insensitive) are replaced with '***'.
 */
const SENSITIVE_KEYS = [
  'apiKey', 'appApiKey', 'secret', 'appSecret', 'clientSecret',
  'password', 'token', 'accessToken',
  'signatureSecret', 'verificationToken', 'authToken'
];

/**
 * Recursively redact sensitive values in an object.
 * Handles nested objects and stringified JSON within strings.
 */
function redactSensitive(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Try to detect and redact JSON strings embedded in plain strings
    try {
      const parsed = JSON.parse(obj);
      if (typeof parsed === 'object') {
        return JSON.stringify(redactSensitive(parsed));
      }
    } catch {
      // Not JSON, leave as-is
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        result[key] = typeof value === 'string' && value.length > 0 ? '***' : value;
      } else {
        result[key] = redactSensitive(value);
      }
    }
    return result;
  }

  return obj;
}

const sensitiveRedactFormat = winston.format((info) => {
  // Redact all fields except winston internals
  const redacted = { ...info };
  for (const key of Object.keys(redacted)) {
    if (key === 'level' || key === 'timestamp' || key === 'label') continue;
    redacted[key] = redactSensitive(redacted[key]);
  }
  return redacted;
});

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    sensitiveRedactFormat(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        sensitiveRedactFormat(),
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    })
  ]
});

export default logger;
