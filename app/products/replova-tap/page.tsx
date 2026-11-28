import { ProductPage } from '@/components/marketing/ProductPage'
import { createPageMetadata } from '@/lib/seo'
import photo from './replova-tap.png'

const description = 'A freestanding feedback sign for checkouts and front desks. Guests tap it with their phone to tell your team how their visit went.'
export const metadata = createPageMetadata({ title: 'Replova Tap · Freestanding feedback sign', description, path: '/products/replova-tap' })

export default function ReplovaTapPage() {
  return <ProductPage name="Replova Tap" description={description}
    photo={{ src: photo, alt: 'Upright rectangular navy Replova Tap sign in its silver stand, with a white contactless symbol and feedback instructions.' }}
    sectionTitle="How Tap works" walkthrough
    details={[
      ['Place the sign', 'Set the stand on a checkout counter or front desk with the printed prompt facing guests.'],
      ['Invite a tap', 'A tap opens a private form on the guest’s phone. They choose a rating from 1 to 5 and can leave a comment without signing in.'],
      ['Check the location’s inbox', 'In your Replova dashboard, open Feedback and choose the location. The rating and comment stay with your team.'],
    ]} />
}
