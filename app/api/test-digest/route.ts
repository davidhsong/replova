import { NextResponse } from 'next/server'
import { sendWeeklyDigest } from '@/lib/sendDigest'

export async function GET() {
  // Replace restaurantId with a real UUID from your restaurants table
  // that has reviews with status = 'drafted'
  // Replace owner_email with your own email to receive the test
  await sendWeeklyDigest({
    id: '45ab2772-87c4-4672-b386-5dba93db064a',
    name: 'Bella Napoli',
    owner_email: 'davidhsongg@gmail.com',
  })

  return NextResponse.json({ success: true })
}
