import { NextResponse } from 'next/server'
import { generateReplies } from '@/lib/generateReplies'

export async function GET() {
  const result = await generateReplies({
    restaurantName: "Bella Napoli",
    author: "Sarah Johnson",
    rating: 4,
    reviewText: "The truffle pasta was absolutely divine — easily the best I've had in the city. Our server Marco was attentive without being intrusive. Only knocked a star off because the wait for a table was nearly 45 minutes even with a reservation.",
  })
  return NextResponse.json(result, { status: 200 })
}
