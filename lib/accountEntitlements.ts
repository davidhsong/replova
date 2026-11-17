import { getStripe, subscriptionGrantsAccess } from '@/lib/stripe'

export async function accountCanActivateNewLocations(account: {
  stripe_customer_id: string | null
  created_at: string
}): Promise<boolean> {
  if (!account.stripe_customer_id) {
    return Date.now() < new Date(account.created_at).getTime() + 30 * 24 * 60 * 60 * 1000
  }

  try {
    const subscriptions = await getStripe().subscriptions.list({
      customer: account.stripe_customer_id,
      status: 'all',
      limit: 10,
    })
    return subscriptions.data.some(subscription => subscriptionGrantsAccess(subscription.status))
  } catch {
    return false
  }
}
