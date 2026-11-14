import { timingSafeEqual } from 'node:crypto'

export function hasValidYouTubeAutomationBearer(
  authorization: string | null,
  configuredSecret: string | undefined
): boolean {
  if (!configuredSecret || !authorization?.startsWith('Bearer ')) return false
  const supplied = authorization.slice('Bearer '.length)
  if (!supplied) return false
  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(configuredSecret)
  return suppliedBuffer.length === expectedBuffer.length
    && timingSafeEqual(suppliedBuffer, expectedBuffer)
}

export async function handleYouTubeAutomationRequest(
  request: Request,
  options: {
    configuredSecret: string | undefined
    run: () => Promise<{ status: number; body: Record<string, unknown> }>
  }
): Promise<Response> {
  if (!options.configuredSecret) {
    return Response.json({ error: 'YouTube automation is not configured.' }, { status: 503 })
  }
  if (!hasValidYouTubeAutomationBearer(request.headers.get('authorization'), options.configuredSecret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await options.run()
  return Response.json(result.body, { status: result.status })
}
