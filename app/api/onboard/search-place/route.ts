import { NextRequest, NextResponse } from 'next/server'
import { findPlaceId } from '@/lib/places'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')?.trim()
  const city = searchParams.get('city')?.trim()

  if (!name || !city) {
    return NextResponse.json({ error: 'name and city are required' }, { status: 400 })
  }
  if (name.length > 200 || city.length > 200) {
    return NextResponse.json({ error: 'Search terms are too long' }, { status: 400 })
  }

  try {
    const result = await findPlaceId(name, city)
    if (!result) {
      return NextResponse.json({ found: false })
    }
    return NextResponse.json({ found: true, placeId: result.placeId, name: result.name, address: result.address })
  } catch (err) {
    console.error('search-place error:', err)
    return NextResponse.json({ error: 'Business search is temporarily unavailable. Please try again.' }, { status: 502 })
  }
}
