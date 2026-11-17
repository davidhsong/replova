import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

const TOKEN_VERSION = 'v1'
const KEY_BYTES = 32
const IV_BYTES = 12

export type GoogleBusinessTokenKind = 'access' | 'refresh'

type KeyEntry = {
  id: string
  key: Buffer
}

function decodeKey(encoded: string, variableName: string): Buffer {
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error(`${variableName} must contain a base64-encoded 32-byte key`)
  }
  return key
}

function keyId(key: Buffer): string {
  return createHash('sha256').update(key).digest('base64url').slice(0, 16)
}

function keyring(): { current: KeyEntry; entries: KeyEntry[] } {
  const currentEncoded = process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY
  if (!currentEncoded) {
    throw new Error('GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY is not configured')
  }

  const currentKey = decodeKey(currentEncoded, 'GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY')
  const current = { id: keyId(currentKey), key: currentKey }
  const previous = (process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY_PREVIOUS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map((encoded, index) => {
      const key = decodeKey(encoded, `GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY_PREVIOUS[${index}]`)
      return { id: keyId(key), key }
    })

  const entries = [current, ...previous.filter(entry => entry.id !== current.id)]
  return { current, entries }
}

function additionalAuthenticatedData(kind: GoogleBusinessTokenKind): Buffer {
  return Buffer.from(`replova:google-business:${TOKEN_VERSION}:${kind}`, 'utf8')
}

export function encryptGoogleBusinessToken(
  plaintext: string,
  kind: GoogleBusinessTokenKind
): string {
  if (!plaintext) throw new Error('Cannot encrypt an empty Google Business token')

  const { current } = keyring()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', current.key, iv)
  cipher.setAAD(additionalAuthenticatedData(kind))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    TOKEN_VERSION,
    current.id,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function decryptGoogleBusinessToken(
  payload: string,
  kind: GoogleBusinessTokenKind
): { plaintext: string; needsRotation: boolean } {
  const [version, encodedKeyId, encodedIv, encodedTag, encodedCiphertext, extra] = payload.split('.')
  if (
    version !== TOKEN_VERSION
    || !encodedKeyId
    || !encodedIv
    || !encodedTag
    || !encodedCiphertext
    || extra
  ) {
    throw new Error('Invalid encrypted Google Business token')
  }

  const { current, entries } = keyring()
  const entry = entries.find(candidate => candidate.id === encodedKeyId)
  if (!entry) throw new Error('Google Business token was encrypted with an unavailable key')

  const iv = Buffer.from(encodedIv, 'base64url')
  const tag = Buffer.from(encodedTag, 'base64url')
  const ciphertext = Buffer.from(encodedCiphertext, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Invalid encrypted Google Business token')
  }

  const decipher = createDecipheriv('aes-256-gcm', entry.key, iv)
  decipher.setAAD(additionalAuthenticatedData(kind))
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')

  return { plaintext, needsRotation: entry.id !== current.id }
}

export function rotateGoogleBusinessTokenIfNeeded(
  payload: string,
  kind: GoogleBusinessTokenKind
): { plaintext: string; encrypted: string; rotated: boolean } {
  const decrypted = decryptGoogleBusinessToken(payload, kind)
  return {
    plaintext: decrypted.plaintext,
    encrypted: decrypted.needsRotation
      ? encryptGoogleBusinessToken(decrypted.plaintext, kind)
      : payload,
    rotated: decrypted.needsRotation,
  }
}
