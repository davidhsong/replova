export const sampleCampaign = { sent: 148, delivered: 132, opened: 96, clicked: 41 } as const

export function deliveredRate(count: number, delivered: number) {
  return (delivered ? 100 * count / delivered : 0).toFixed(1) + '%'
}
