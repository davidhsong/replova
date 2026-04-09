import { NextResponse } from 'next/server'
import { sendWeeklyDigest } from '@/lib/sendDigest'

export async function GET() {
  // Replace restaurantId with a real UUID from your restaurants table
  // that has reviews with status = 'drafted'
  // Replace owner_email with your own email to receive the test
  await sendWeeklyDigest({
    id: 'Taco Bell',
    name: 'David Song',
    owner_email: 'davidhsongg@gmail.com',
  })

  return NextResponse.json({ success: true })
}
