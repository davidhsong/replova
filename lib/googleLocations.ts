export type GoogleBusinessLocation = {
  name: string
  title: string
  placeId: string | null
}

export class GoogleLocationsError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'GoogleLocationsError'
  }
}

export async function listGoogleBusinessLocations(
  accessToken: string
): Promise<GoogleBusinessLocation[]> {
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!accountsRes.ok) {
    throw new GoogleLocationsError(
      `Google accounts API error (${accountsRes.status}). Please reconnect and try again.`,
      accountsRes.status === 401 ? 401 : 502
    )
  }

  const accountsData = (await accountsRes.json()) as { accounts?: { name: string }[] }
  const locations: GoogleBusinessLocation[] = []

  for (const account of accountsData.accounts ?? []) {
    let pageToken: string | undefined

    do {
      const params = new URLSearchParams({
        readMask: 'name,title,metadata',
        pageSize: '100',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?${params.toString()}`
      const locationsRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!locationsRes.ok) {
        throw new GoogleLocationsError(
          `Google locations API error (${locationsRes.status}). Please reconnect and try again.`,
          locationsRes.status === 401 ? 401 : 502
        )
      }

      const data = (await locationsRes.json()) as {
        locations?: { name: string; title?: string; metadata?: { placeId?: string } }[]
        nextPageToken?: string
      }

      for (const location of data.locations ?? []) {
        locations.push({
          name: location.name,
          title: location.title ?? location.name,
          placeId: location.metadata?.placeId ?? null,
        })
      }

      pageToken = data.nextPageToken
    } while (pageToken)
  }

  return locations
}
