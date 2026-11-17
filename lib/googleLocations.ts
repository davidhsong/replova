const ACCOUNT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
const BUSINESS_INFORMATION_API = 'https://mybusinessbusinessinformation.googleapis.com/v1'

export type GoogleBusinessLocation = {
  accountResourceName: string
  accountId: string
  accountName: string
  accountType: string | null
  accountStatus: string | null
  locationResourceName: string
  locationId: string
  reviewResourceName: string
  title: string
  placeId: string | null
}

export type GoogleBusinessAccount = {
  resourceName: string
  id: string
  name: string
  type: string | null
  status: string | null
}

export class GoogleLocationsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code:
      | 'authorization_expired'
      | 'permission_denied'
      | 'quota_exhausted'
      | 'api_unavailable'
      | 'invalid_resource'
      | 'unauthorized_location'
  ) {
    super(message)
    this.name = 'GoogleLocationsError'
  }
}

function mapGoogleFailure(status: number, surface: 'accounts' | 'locations'): GoogleLocationsError {
  if (status === 401) {
    return new GoogleLocationsError(
      'Google authorization expired. Reconnect Google Business Profile.',
      401,
      'authorization_expired'
    )
  }
  if (status === 403) {
    return new GoogleLocationsError(
      'Google denied access. Confirm Business Profile API approval and that this Google account can manage the locations.',
      403,
      'permission_denied'
    )
  }
  if (status === 429) {
    return new GoogleLocationsError(
      'Google Business Profile quota is unavailable or exhausted. Try again after access and quota are confirmed.',
      429,
      'quota_exhausted'
    )
  }
  return new GoogleLocationsError(
    `Google Business Profile ${surface} service is temporarily unavailable.`,
    502,
    'api_unavailable'
  )
}

export function parseGoogleAccountResource(resourceName: string): string | null {
  const match = /^accounts\/([A-Za-z0-9_-]{1,128})$/.exec(resourceName)
  return match?.[1] ?? null
}

export function parseGoogleLocationResource(resourceName: string): string | null {
  const match = /^locations\/([A-Za-z0-9_-]{1,128})$/.exec(resourceName)
  return match?.[1] ?? null
}

export function buildGoogleReviewParentResource(
  accountResourceName: string,
  locationResourceName: string
): string {
  const accountId = parseGoogleAccountResource(accountResourceName)
  const locationId = parseGoogleLocationResource(locationResourceName)
  if (!accountId || !locationId) {
    throw new GoogleLocationsError(
      'Google returned an invalid account or location resource.',
      502,
      'invalid_resource'
    )
  }
  return `accounts/${accountId}/locations/${locationId}`
}

export function selectAuthorizedGoogleBusinessLocations(
  requestedResources: string[],
  authorizedLocations: GoogleBusinessLocation[]
): GoogleBusinessLocation[] {
  const authorizedByResource = new Map<string, GoogleBusinessLocation>()
  for (const location of authorizedLocations) {
    const existing = authorizedByResource.get(location.reviewResourceName)
    if (
      existing
      && (
        existing.accountId !== location.accountId
        || existing.locationId !== location.locationId
        || existing.locationResourceName !== location.locationResourceName
      )
    ) {
      throw new GoogleLocationsError(
        'Google returned conflicting location resource data.',
        502,
        'invalid_resource'
      )
    }
    authorizedByResource.set(location.reviewResourceName, location)
  }

  return requestedResources.map(resource => {
    const location = authorizedByResource.get(resource)
    if (!location) {
      throw new GoogleLocationsError(
        'One or more locations are not available to the connected Google account.',
        403,
        'unauthorized_location'
      )
    }
    return location
  })
}

export async function listGoogleBusinessLocations(
  accessToken: string,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}
): Promise<{ accounts: GoogleBusinessAccount[]; locations: GoogleBusinessLocation[] }> {
  const fetchImpl = options.fetchImpl ?? fetch
  const accounts: GoogleBusinessAccount[] = []
  const locations: GoogleBusinessLocation[] = []
  const seenAccountPageTokens = new Set<string>()
  let accountPageToken: string | undefined

  do {
    const accountParams = new URLSearchParams({ pageSize: '20' })
    if (accountPageToken) accountParams.set('pageToken', accountPageToken)
    const accountsResponse = await fetchImpl(`${ACCOUNT_API}?${accountParams}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: options.signal,
    })
    if (!accountsResponse.ok) throw mapGoogleFailure(accountsResponse.status, 'accounts')

    const accountsData = await accountsResponse.json() as {
      accounts?: Array<{
        name?: string
        accountName?: string
        type?: string
        state?: { status?: string }
      }>
      nextPageToken?: string
    }

    for (const rawAccount of accountsData.accounts ?? []) {
      if (!rawAccount.name) continue
      const accountId = parseGoogleAccountResource(rawAccount.name)
      if (!accountId) {
        throw new GoogleLocationsError(
          'Google returned an invalid account resource.',
          502,
          'invalid_resource'
        )
      }

      const account: GoogleBusinessAccount = {
        resourceName: rawAccount.name,
        id: accountId,
        name: rawAccount.accountName?.trim() || rawAccount.name,
        type: rawAccount.type ?? null,
        status: rawAccount.state?.status ?? null,
      }
      accounts.push(account)

      const seenLocationPageTokens = new Set<string>()
      let locationPageToken: string | undefined
      do {
        const params = new URLSearchParams({
          readMask: 'name,title,metadata',
          pageSize: '100',
        })
        if (locationPageToken) params.set('pageToken', locationPageToken)

        const locationResponse = await fetchImpl(
          `${BUSINESS_INFORMATION_API}/${account.resourceName}/locations?${params}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
            signal: options.signal,
          }
        )
        if (!locationResponse.ok) throw mapGoogleFailure(locationResponse.status, 'locations')

        const locationData = await locationResponse.json() as {
          locations?: Array<{
            name?: string
            title?: string
            metadata?: { placeId?: string }
          }>
          nextPageToken?: string
        }

        for (const rawLocation of locationData.locations ?? []) {
          if (!rawLocation.name) continue
          const locationId = parseGoogleLocationResource(rawLocation.name)
          if (!locationId) {
            throw new GoogleLocationsError(
              'Google returned an invalid location resource.',
              502,
              'invalid_resource'
            )
          }
          locations.push({
            accountResourceName: account.resourceName,
            accountId: account.id,
            accountName: account.name,
            accountType: account.type,
            accountStatus: account.status,
            locationResourceName: rawLocation.name,
            locationId,
            reviewResourceName: buildGoogleReviewParentResource(account.resourceName, rawLocation.name),
            title: rawLocation.title?.trim() || rawLocation.name,
            placeId: rawLocation.metadata?.placeId ?? null,
          })
        }

        locationPageToken = locationData.nextPageToken
        if (locationPageToken) {
          if (seenLocationPageTokens.has(locationPageToken)) {
            throw new GoogleLocationsError(
              'Google returned a repeated locations page token.',
              502,
              'api_unavailable'
            )
          }
          seenLocationPageTokens.add(locationPageToken)
        }
      } while (locationPageToken)
    }

    accountPageToken = accountsData.nextPageToken
    if (accountPageToken) {
      if (seenAccountPageTokens.has(accountPageToken)) {
        throw new GoogleLocationsError(
          'Google returned a repeated accounts page token.',
          502,
          'api_unavailable'
        )
      }
      seenAccountPageTokens.add(accountPageToken)
    }
  } while (accountPageToken)

  return { accounts, locations }
}
