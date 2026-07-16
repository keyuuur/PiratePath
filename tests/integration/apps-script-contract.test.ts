import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const codePath = resolve(process.cwd(), 'apps-script/Code.js')
const source = readFileSync(codePath, 'utf8')
const indexSource = readFileSync(resolve(process.cwd(), 'apps-script/Index.html'), 'utf8')

function appsScriptContext(cacheHit = false): Record<string, unknown> {
  const context: Record<string, unknown> = {
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({
        text,
        setMimeType() { return this },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => 'bridge-secret-that-is-at-least-thirty-two-characters',
      }),
    },
    CacheService: {
      getScriptCache: () => ({ get: () => cacheHit ? '1' : null, put: () => undefined }),
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (message: string, secret: string) =>
        Array.from(createHmac('sha256', secret).update(message, 'utf8').digest(), byte => byte > 127 ? byte - 256 : byte),
      base64EncodeWebSafe: (bytes: number[]) =>
        Buffer.from(bytes.map(byte => (byte + 256) % 256)).toString('base64url'),
    },
  }
  runInNewContext(`${source}\nthis.__doPost = doPost; this.__toSheetValue = toSheetValue_;`, context)
  return context
}

function responseJson(result: unknown): Record<string, unknown> {
  return JSON.parse((result as { text: string }).text) as Record<string, unknown>
}

describe('Apps Script bridge contract', () => {
  it('remains valid JavaScript for the Apps Script V8 runtime', () => {
    expect(() => execFileSync(process.execPath, ['--check', codePath])).not.toThrow()
  })

  it('disables the legacy browser mutation path and keeps signed V2 operations', () => {
    const publicFunctions = [...source.matchAll(/^function ([A-Za-z0-9]+)\(/gm)].map((match) => match[1])
    expect(publicFunctions).toEqual(['onOpen', 'doPost', 'doGet'])
    expect(source).toContain('function doGet()')
    expect(source).toContain('function submitPiratePathSubmission_()')
    expect(source).toContain('The legacy browser submission path is disabled')
    expect(source).toContain('function doPost(e)')
    expect(source).toContain("action === 'session.validate'")
    expect(source).toContain("action === 'attempt.start'")
    expect(source).toContain("action === 'attempt.checkpoint'")
    expect(source).toContain("action === 'attempt.submit'")
    expect(source).toContain('getDocumentLock()')
    expect(source).toContain('PIRATE_PATH_BRIDGE_MAX_AGE_MS')
    expect(indexSource).not.toContain('google.script.run')
    expect(indexSource).not.toContain('correctOptionId')
    expect(indexSource).not.toContain('submitPiratePathSubmission')
    expect(indexSource).toContain('does not accept scores or student answers')
  })

  it('neutralizes common spreadsheet formula prefixes at the shared writer boundary', () => {
    const sanitize = appsScriptContext().__toSheetValue as (value: unknown) => unknown
    for (const value of ['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)']) {
      expect(sanitize(value)).toBe(`'${value}`)
    }
    expect(sanitize('Pirate Student')).toBe('Pirate Student')
    expect(sanitize(4)).toBe(4)
    expect(source).toContain('setValues(summaryRows.map(row => row.map(toSheetValue_)))')
    expect(source).toContain('setValues(missRows.map(row => row.map(toSheetValue_)))')
  })

  it('defines additive session, registry, audit, and teacher-only cue columns', () => {
    expect(source).toContain("sessions: 'Sessions'")
    expect(source).toContain("attemptRegistry: 'AttemptRegistry'")
    expect(source).toContain("attemptAudit: 'AttemptAudit'")
    expect(source).toContain("'classPointsCue'")
    expect(source).toContain('classPointsCue: result.masteryTier')
  })

  it('maps each teacher menu action to a distinct private handler', () => {
    const handlers = [...source.matchAll(/\.addItem\([^,]+, '([^']+)'\)/g)].map((match) => match[1])
    expect(handlers).toHaveLength(5)
    expect(new Set(handlers).size).toBe(handlers.length)
    for (const handler of handlers) expect(source).toContain(`function ${handler}(`)
    expect(handlers.every((handler) => handler.endsWith('_'))).toBe(true)
  })

  it('rejects stale signed requests before touching Sheets', () => {
    const context = appsScriptContext()
    const result = (context.__doPost as (event: unknown) => unknown)({
      postData: { contents: JSON.stringify({
        timestamp: 1,
        nonce: 'd1f74d5c-f79a-4ae6-901a-8da4f2c33c00',
        body: JSON.stringify({ action: 'session.validate', data: {} }),
        signature: 'unused',
      }) },
    })
    expect(responseJson(result)).toMatchObject({ ok: false, error: { code: 'STALE_REQUEST' } })
  })

  it('rejects a replayed valid signature before dispatching an action', () => {
    const context = appsScriptContext(true)
    const timestamp = Date.now()
    const nonce = 'd1f74d5c-f79a-4ae6-901a-8da4f2c33c00'
    const body = JSON.stringify({ action: 'session.validate', data: {} })
    const signature = createHmac('sha256', 'bridge-secret-that-is-at-least-thirty-two-characters')
      .update(`${timestamp}.${nonce}.${body}`, 'utf8')
      .digest('base64url')
    const result = (context.__doPost as (event: unknown) => unknown)({
      postData: { contents: JSON.stringify({ timestamp, nonce, body, signature }) },
    })
    expect(responseJson(result)).toMatchObject({ ok: false, error: { code: 'REPLAYED_REQUEST' } })
  })
})
