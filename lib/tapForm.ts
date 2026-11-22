const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )

export function tapDocument(content: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visit feedback | Replova</title><link rel="icon" href="/favicon.ico?v=arrow1"><link rel="stylesheet" href="/tap-form.css"></head><body><main><img src="/brand/logos/logo-primary-light.svg?v=arrow1" width="89" height="25" alt="Replova">${content}</main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  )
}

export function renderTapForm(
  name: string,
  encounter: string,
  test: boolean,
  error = '',
  comment = '',
) {
  return tapDocument(
    `<p>${escapeHtml(name)}${test ? ' · Test submission' : ''}</p><h1>How was your visit?</h1><p>No sign-in required.</p>${error ? '<p role="alert">' + escapeHtml(error) + '</p>' : ''}<form method="post" action="?visit=${encodeURIComponent(encounter)}${test ? '&amp;test=1' : ''}"><input type="hidden" name="encounter" value="${escapeHtml(encounter)}"><fieldset><legend>Rate your experience</legend><div class="ratings">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" required name="rating" value="${n}"><span>${n}</span></label>`).join('')}</div><small>1 = poor · 5 = excellent</small></fieldset><label for="comment">Comment (optional)</label><small id="hint">Please leave out names, contact details and other personal information.</small><textarea id="comment" aria-describedby="hint" name="comment" maxlength="2000" rows="4">${escapeHtml(comment)}</textarea><button>Send feedback</button></form>`,
    error ? 422 : 200,
  )
}
