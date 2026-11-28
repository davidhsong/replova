import { ProductPage } from '@/components/marketing/ProductPage'
import { createPageMetadata } from '@/lib/seo'

const description = 'Replova AI is in development to help you draft replies to Google reviews and see what customers keep praising or asking you to fix.'
export const metadata = createPageMetadata({ title: 'Replova AI · Google review replies and insights in development', description, path: '/products/replova-ai' })

export default function ReplovaAIPage() {
  return <ProductPage name="Replova AI" description={description} status="In progress"
    sectionTitle="What we’re building"
    details={[
      ['Editable reply drafts', 'You’ll be able to edit a draft in your own words before replying to a public Google review. Automatic publishing is planned as an opt-in setting.'],
      ['Sentiment in context', 'See whether a review is positive, negative, or mixed, and read the original comment to understand why.'],
      ['Recurring themes', 'Find praise and problems that come up across Google reviews. Feedback guests send through Dot and Tap stays in your private location inbox.'],
    ]} />
}
