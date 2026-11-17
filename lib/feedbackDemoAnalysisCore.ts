import type {
  DemoFeedbackAnalysis,
  DemoFeedbackEntry,
  FeedbackSentiment,
} from '@/lib/feedbackDemo'

export type RawFeedbackAnalysisFinding = {
  title: string
  theme: string
  severity: 'high' | 'medium' | 'low'
  summary: string
  recommendation: string
  supportingFeedbackIds: string[]
  confidence: number
}

export type RawFeedbackAnalysisTheme = {
  name: string
  sentiment: FeedbackSentiment | 'mixed'
  summary: string
  supportingFeedbackIds: string[]
}

export type RawFeedbackAnalysis = {
  executiveSummary: string
  findings: RawFeedbackAnalysisFinding[]
  themes: RawFeedbackAnalysisTheme[]
}

function uniqueValidIds(ids: unknown, validIds: Set<string>, max: number): string[] {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && validIds.has(id)))].slice(0, max)
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

export function buildFeedbackAnalysisInput(entries: DemoFeedbackEntry[]): string {
  return JSON.stringify({
    business: {
      category: 'independent auto repair and detailing shop',
      locationCount: 1,
      datasetLabel: 'fictional synthetic product demo',
    },
    feedback: entries.map(entry => ({
      id: entry.id,
      rating: entry.rating,
      service: entry.service,
      text: entry.text,
    })),
  })
}

export function normalizeFeedbackAnalysis(
  raw: RawFeedbackAnalysis,
  entries: DemoFeedbackEntry[],
  generatedAt: string,
  model: string
): DemoFeedbackAnalysis {
  const validIds = new Set(entries.map(entry => entry.id))
  const severityOrder = { high: 0, medium: 1, low: 2 }
  const findings = (Array.isArray(raw.findings) ? raw.findings : [])
    .map((finding, index) => ({
      id: `finding-${index + 1}`,
      title: cleanText(finding.title, 100),
      theme: cleanText(finding.theme, 60),
      severity: finding.severity,
      summary: cleanText(finding.summary, 360),
      recommendation: cleanText(finding.recommendation, 600),
      supportingFeedbackIds: uniqueValidIds(finding.supportingFeedbackIds, validIds, 16),
      confidence: Math.round(Math.max(0, Math.min(1, Number(finding.confidence) || 0)) * 100) / 100,
    }))
    .filter(finding => (
      finding.title.length >= 5
      && finding.theme.length >= 3
      && finding.summary.length >= 20
      && finding.recommendation.length >= 20
      && ['high', 'medium', 'low'].includes(finding.severity)
      && finding.supportingFeedbackIds.length >= 2
    ))
    .sort((a, b) => (
      severityOrder[a.severity] - severityOrder[b.severity]
      || b.supportingFeedbackIds.length - a.supportingFeedbackIds.length
    ))
    .map((finding, index) => ({ ...finding, id: `finding-${index + 1}` }))

  const recommendations = new Set(findings.map(finding => finding.recommendation.toLocaleLowerCase()))
  if (findings.length < 3 || recommendations.size !== findings.length) {
    throw new Error('AI analysis did not produce three distinct, traceable recommendations.')
  }

  const themes = (Array.isArray(raw.themes) ? raw.themes : [])
    .map((theme, index) => ({
      id: `theme-${index + 1}`,
      name: cleanText(theme.name, 60),
      sentiment: theme.sentiment,
      summary: cleanText(theme.summary, 240),
      supportingFeedbackIds: uniqueValidIds(theme.supportingFeedbackIds, validIds, 20),
    }))
    .filter(theme => (
      theme.name.length >= 3
      && theme.summary.length >= 12
      && ['positive', 'neutral', 'negative', 'mixed'].includes(theme.sentiment)
      && theme.supportingFeedbackIds.length >= 2
    ))
    .sort((a, b) => b.supportingFeedbackIds.length - a.supportingFeedbackIds.length)
    .map((theme, index) => ({ ...theme, id: `theme-${index + 1}` }))

  if (themes.length < 4) {
    throw new Error('AI analysis did not produce enough traceable themes.')
  }

  const executiveSummary = cleanText(raw.executiveSummary, 500)
  if (executiveSummary.length < 40) throw new Error('AI analysis summary was incomplete.')

  return {
    executiveSummary,
    findings,
    themes,
    generatedAt,
    model,
  }
}
