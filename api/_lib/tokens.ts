import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { ApiError } from './errors.js'

type TokenKind = 'session' | 'attempt'

type BaseTokenClaims = {
  kind: TokenKind
  issuedAt: number
  expiresAt: number
}

export type SessionTokenClaims = BaseTokenClaims & {
  kind: 'session'
  teacherSessionId: string
  allowedPeriod: string
}

export type AttemptTokenClaims = BaseTokenClaims & {
  kind: 'attempt'
  teacherSessionId: string
  attemptId: string
  studentKeyHash: string
  classPeriod: string
  variantSeed: string
  contentVersion: string
}

export type TokenClaims = SessionTokenClaims | AttemptTokenClaims

const TOKEN_VERSION = 'v1'
const TOKEN_AAD = Buffer.from('pirate-path-v2-token', 'utf8')

function getTokenKey(): Buffer {
  const secret = process.env.TOKEN_SIGNING_SECRET ?? process.env.PIRATE_PATH_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    throw new ApiError(
      'BACKEND_NOT_CONFIGURED',
      'The classroom session service is not configured yet. Ask the teacher to use the demo preview or try again later.',
      503,
    )
  }
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function sealToken(claims: TokenClaims): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getTokenKey(), iv)
  cipher.setAAD(TOKEN_AAD)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    TOKEN_VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.')
}

export function openToken<T extends TokenClaims>(token: string, expectedKind: T['kind']): T {
  try {
    const [version, encodedIv, encodedCiphertext, encodedTag, extra] = token.split('.')
    if (version !== TOKEN_VERSION || !encodedIv || !encodedCiphertext || !encodedTag || extra) {
      throw new Error('Malformed token')
    }

    const tag = Buffer.from(encodedTag, 'base64url')
    if (tag.length !== 16) throw new Error('Invalid authentication tag length')
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getTokenKey(),
      Buffer.from(encodedIv, 'base64url'),
      { authTagLength: 16 },
    )
    decipher.setAAD(TOKEN_AAD)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    const claims = JSON.parse(plaintext) as TokenClaims

    if (
      claims.kind !== expectedKind ||
      !Number.isFinite(claims.issuedAt) ||
      !Number.isFinite(claims.expiresAt) ||
      claims.issuedAt > Date.now() + 60_000 ||
      claims.expiresAt <= claims.issuedAt
    ) {
      throw new Error('Wrong token kind')
    }
    if (claims.expiresAt <= Date.now()) {
      throw new ApiError('TOKEN_EXPIRED', 'This classroom session has expired.', 401)
    }
    return claims as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('INVALID_TOKEN', 'This classroom session is no longer valid.', 401)
  }
}
