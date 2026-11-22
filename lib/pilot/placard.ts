import QRCode from 'qrcode'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function printablePlacard(destination: string) {
  const [qr, logo] = await Promise.all([
    QRCode.toString(destination, { type: 'svg', width: 640, margin: 4, errorCorrectionLevel: 'M' }),
    readFile(path.join(process.cwd(), 'public/brand/logos/logo-primary-light.svg'), 'utf8'),
  ])
  // The complete QR retains its original viewBox and four-module quiet zone.
  const lockup = logo.replace('width="790" height="220"', 'x="229" y="644" width="182" height="51"')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="716" viewBox="0 0 640 716"><title>Replova Tap placard</title><rect width="640" height="716" fill="white"/>${qr}${lockup}</svg>`
}
