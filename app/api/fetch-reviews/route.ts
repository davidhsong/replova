import { NextRequest, NextResponse } from 'next/server'
import { getPlaceReviews } from '@/lib/places'
import { generateReplies } from '@/lib/generateReplies'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { placeId, restaurantId } = await req.json()

  if (!placeId || !restaurantId) {
    return NextResponse.json({ error: 'placeId and restaurantId are required' }, { status: 400 })
  }

  const placeData = await getPlaceReviews(placeId)

  const rows = placeData.reviews.map((r) => ({
    restaurant_id: restaurantId,
    author: r.author,
    rating: r.rating,
    review_text: r.text,
    review_timestamp: r.timestamp,
    status: 'pending',
  }))

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .upsert(rows, { onConflict: 'restaurant_id,review_timestamp', ignoreDuplicates: true })
    .select('id, author, rating, review_text')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const newRows = data ?? []
  let repliesGenerated = 0

  await Promise.all(
    newRows.map(async (row) => {
      try {
        const replies = await generateReplies({
          restaurantName: placeData.restaurantName,
          author: row.author ?? '',
          rating: row.rating ?? 0,
          reviewText: row.review_text ?? '',
        })

        const { error: updateError } = await supabaseAdmin
          .from('reviews')
          .update({
            reply_draft_1: replies.professional,
            reply_draft_2: replies.warm,
            reply_draft_3: replies.brief,
            status: 'drafted',
          })
          .eq('id', row.id)

        if (updateError) {
          console.error(`Failed to update reply drafts for review ${row.id}:`, updateError.message)
        } else {
          repliesGenerated++
        }
      } catch (err) {
        console.error(`generateReplies failed for review ${row.id}:`, err)
      }
    })
  )

  return NextResponse.json({
    success: true,
    restaurantName: placeData.restaurantName,
    reviewsFetched: placeData.reviews.length,
    newlyStored: newRows.length,
    repliesGenerated,
  })
}
