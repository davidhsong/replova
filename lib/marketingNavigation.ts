export const productLinks = [
  ['Replova Dot', 'A flat NFC tag for private guest feedback.', '/products/replova-dot', 'dot'],
  ['Replova Tap', 'A freestanding sign for private guest feedback.', '/products/replova-tap', 'tap'],
  ['Replova AI', 'In progress · Reply drafts and trends for Google reviews.', '/products/replova-ai', 'reply'],
] as const

export const featuredIndustries = [
  ['Tea brands', 'Guest feedback on drinks and pickup at boba cafés.', 'boba-tea-shops', 'cup'],
  ['Hotels', 'Hear about room issues before checkout.', 'hotels-short-stays', 'bed'],
  ['Multifamily', 'Hear what residents flag in shared spaces.', 'apartment-communities', 'building'],
  ['Restaurants', 'Find out where service slows down.', 'restaurants-cafes', 'utensils'],
  ['Retail', 'Spot confusing steps at checkout and returns.', 'specialty-retail-stores', 'bag'],
  ['Fitness', 'See where first-time members need a hand.', 'fitness-studios', 'dumbbell'],
  ['Auto service', 'Find gaps in updates from drop-off to pickup.', 'auto-repair-quick-lube', 'wrench'],
] as const

export const industryLinks = [
  ...featuredIndustries.map(([name, description, slug, icon]) => [name, description, `/industries/${slug}`, icon] as const),
  ['All industries', 'Explore feedback examples for your business.', '/industries', 'local'],
] as const
