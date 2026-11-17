import 'server-only'

export const NATURAL_REPLY_STYLE = `
Writing style for every reply:
- Never use Unicode em dash punctuation. Use a comma, period, colon, or semicolon instead.
- Write like a real person responding naturally, not a customer-service script or marketing team.
- Match the customer's tone and the amount of context they provided.
- Prefer short, conversational, specific wording and use contractions when they sound natural.
- Avoid generic enthusiasm, corporate jargon, robotic politeness, repetitive phrasing, and promotional language.
- Avoid unnecessary apologies, excessive gratitude, emojis, hashtags, and exclamation marks.
- Never use clichés such as "We truly value your feedback" or similar boilerplate.
- Do not invent facts, promises, experiences, actions, or details that are not supported by the customer's words.
- Preserve empathy and professionalism when the situation calls for them.`

const BOILERPLATE_PATTERNS = [
  /\bwe truly value your feedback\b/i,
  /\byour feedback is (?:very )?important to us\b/i,
  /\bthank you for (?:your|the) feedback\b/i,
  /\bwe appreciate you taking the time to (?:share|write|leave)\b/i,
  /\bwe(?:['’]re| are) (?:so )?(?:thrilled|delighted)\b/i,
  /\bit means the world to us\b/i,
  /\brest assured\b/i,
  /\bwe strive to provide\b/i,
  /\bwe take (?:all )?feedback seriously\b/i,
  /\bplease do not hesitate to (?:reach out|contact us)\b/i,
]

export function validateReplyOutput(value: string, maxLength = 1000): string {
  const normalized = value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '$1')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/!{2,}/g, '!')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxLength)

  if (!normalized) throw new Error('OpenAI returned an empty reply')
  if (normalized.includes('\u2014')) throw new Error('Generated reply contained prohibited punctuation')
  if (BOILERPLATE_PATTERNS.some(pattern => pattern.test(normalized))) {
    throw new Error('Generated reply contained prohibited boilerplate')
  }

  return normalized
}
