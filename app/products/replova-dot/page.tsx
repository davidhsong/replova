import { ProductPage } from '@/components/marketing/ProductPage'
import { createPageMetadata } from '@/lib/seo'
import photo from './replova-dot.png'

const description = 'A flat NFC tag for tables, counters, and walls. Guests tap it with their phone to send feedback privately to your team.'
export const metadata = createPageMetadata({ title: 'Replova Dot · Flat NFC feedback tag', description, path: '/products/replova-dot' })

export default function ReplovaDotPage() {
  return <ProductPage name="Replova Dot" description={description}
    photo={{ src: photo, alt: 'Round navy Replova Dot decal lying flat on a pale tabletop, with a white contactless symbol and tap instructions.' }}
    sectionTitle="How Dot works"
    details={[
      ['Choose a spot', 'Place the tag where guests have a moment to respond, such as a table, a pickup counter, or a wall beside the exit.'],
      ['Collect a private rating', 'A tap opens a short form in the phone’s browser. Guests choose a rating and can add a comment without signing in.'],
      ['Read the feedback', 'Open Feedback in your Replova dashboard and select the location to see its ratings and comments. Only your team can read them.'],
    ]} />
}
