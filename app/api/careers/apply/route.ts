import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { Resend } from 'resend'
import { getCareerRoleByKey } from '@/lib/careerRoles'
import { getEmailLogoUrl } from '@/lib/emailBrand'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

const MAX_RESUME_BYTES = 4 * 1024 * 1024
const MAX_REQUEST_BYTES = 5 * 1024 * 1024
function readText(form: FormData, key: string, maxLength: number): string {
  const value = form.get(key)
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeFilename(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  return cleaned || 'resume'
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Application upload must be 5 MB or smaller.' }, { status: 413 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'The application could not be read.' }, { status: 400 })
  }

  // Honeypot submissions receive a normal response without sending email.
  if (readText(form, 'website', 200)) return NextResponse.json({ success: true })

  const roleKey = readText(form, 'role', 80)
  const roleRecord = getCareerRoleByKey(roleKey)
  const firstName = readText(form, 'firstName', 80)
  const lastName = readText(form, 'lastName', 80)
  const fullName = `${firstName} ${lastName}`.trim()
  const email = readText(form, 'email', 254).toLowerCase()
  const profileUrl = readText(form, 'profileUrl', 500) || readText(form, 'linkedin', 500)
  const school = readText(form, 'school', 160)
  const program = readText(form, 'program', 160)
  const graduation = readText(form, 'graduation', 40)
  const timezone = readText(form, 'timezone', 80)
  const availability = readText(form, 'availability', 80)
  const sponsorship = readText(form, 'sponsorship', 10)
  const motivation = readText(form, 'motivation', 2500)
  const roleResponse = readText(form, 'roleResponse', 2000)
  const learningGoal = readText(form, 'learningGoal', 1500)
  const eligibilityConfirmed = readText(form, 'eligibilityConfirmed', 10)
  const privacyAccepted = readText(form, 'privacyAccepted', 10)

  if (!roleRecord || !firstName || !lastName || !email || !school || !graduation || !timezone || !availability || !motivation || !roleResponse || !learningGoal) {
    return NextResponse.json({ error: 'Please complete every required field.' }, { status: 400 })
  }
  const role = roleRecord.title
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (eligibilityConfirmed !== 'on' || privacyAccepted !== 'on') {
    return NextResponse.json({ error: 'Please confirm eligibility and accept the applicant privacy notice.' }, { status: 400 })
  }
  if (!['yes', 'no'].includes(sponsorship)) {
    return NextResponse.json({ error: 'Please answer the work sponsorship question.' }, { status: 400 })
  }
  if (profileUrl) {
    try {
      const parsed = new URL(profileUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol')
    } catch {
      return NextResponse.json({ error: 'Profile URL must be a valid http or https link.' }, { status: 400 })
    }
  }
  if (motivation.length < 40 || roleResponse.length < 30 || learningGoal.length < 20) {
    return NextResponse.json({ error: 'Please provide a little more detail in the written responses.' }, { status: 400 })
  }

  const resumeValue = form.get('resume')
  const resume = resumeValue instanceof File && resumeValue.size > 0 ? resumeValue : null
  let resumeContentType: string | null = null
  const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = []
  if (resume) {
    const extension = resume.name.split('.').pop()?.toLowerCase()
    const allowedExtension = extension && ['pdf', 'doc', 'docx'].includes(extension)
    const allowedMime = !resume.type || [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(resume.type)
    if (!allowedExtension || !allowedMime) {
      return NextResponse.json({ error: 'Résumé must be a PDF, DOC, or DOCX file.' }, { status: 400 })
    }
    if (resume.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: 'Résumé must be 4 MB or smaller.' }, { status: 400 })
    }
    resumeContentType = resume.type || ({
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    } as Record<string, string>)[extension ?? ''] || null
    attachments.push({
      filename: safeFilename(resume.name),
      content: Buffer.from(await resume.arrayBuffer()),
      contentType: resumeContentType || undefined,
    })
  }

  const admin = getSupabaseAdmin()
  const applicationId = randomUUID()
  const resumeFilename = resume ? safeFilename(resume.name) : null
  let resumePath = resume && resumeFilename ? `${applicationId}/${resumeFilename}` : null

  if (resume && resumePath) {
    const { error: uploadError } = await admin.storage
      .from('career-resumes')
      .upload(resumePath, attachments[0].content, {
        contentType: resumeContentType!,
        upsert: false,
      })
    if (uploadError) {
      console.error('[careers/apply] resume upload failed:', uploadError.message)
      // Keep the direct website application available while a legacy
      // deployment is being moved to the applicant-tracking schema. The
      // resume remains attached to the notification email below.
      resumePath = null
    }
  }

  let applicationStored = false
  const { error: insertError } = await admin.from('career_applications').insert({
    id: applicationId,
    role_key: roleKey,
    role_title: role,
    first_name: firstName,
    last_name: lastName,
    email,
    profile_url: profileUrl || null,
    school,
    program: program || null,
    graduation,
    timezone,
    availability,
    requires_sponsorship: sponsorship === 'yes',
    motivation,
    role_response: roleResponse,
    learning_goal: learningGoal,
    resume_path: resumePath,
    resume_filename: resumeFilename,
    resume_content_type: resumeContentType,
    status: 'new',
  })

  if (insertError) {
    if (resumePath) await admin.storage.from('career-resumes').remove([resumePath])
    console.error('[careers/apply] database insert failed:', insertError.code)
  } else {
    applicationStored = true
  }

  const destination = process.env.CAREERS_EMAIL
  const apiKey = process.env.RESEND_API_KEY

  const rows = [
    ['Role', role],
    ['First name', firstName],
    ['Last name', lastName],
    ['Email', email],
    ['Profile', profileUrl || 'Not provided'],
    ['School', school],
    ['Program', program || 'Not provided'],
    ['Expected graduation', graduation],
    ['Time zone', timezone],
    ['Weekly availability', availability],
    ['Requires sponsorship', sponsorship === 'yes' ? 'Yes' : 'No'],
  ]
  const htmlRows = rows.map(([label, value]) => `<tr><td style="padding:6px 16px 6px 0;color:#6b665e;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:#191713">${escapeHtml(value)}</td></tr>`).join('')
  const emailLogo = getEmailLogoUrl()

  if (destination && apiKey) {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'Replova Careers <notifications@replova.app>',
      to: destination,
      replyTo: email,
      subject: `${role} application - ${fullName.replace(/[\r\n]/g, ' ')}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#191713">
          <div style="display:inline-block;padding:5px 9px;background:#ffffff;border:1px solid #e4dfd6;border-radius:4px"><img src="${emailLogo}" width="120" height="36" alt="Replova" style="display:block;width:120px;height:36px;border:0;object-fit:contain"></div>
          <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8379">New Replova application</p>
          <h1 style="font-size:26px;margin:8px 0 24px">${escapeHtml(role)}</h1>
          <table style="border-collapse:collapse;width:100%;font-size:14px">${htmlRows}</table>
          <hr style="border:0;border-top:1px solid #e4dfd6;margin:26px 0">
          <h2 style="font-size:15px">Why Replova</h2>
          <p style="font-size:14px;line-height:1.65;white-space:pre-wrap">${escapeHtml(motivation)}</p>
          <h2 style="font-size:15px;margin-top:24px">${escapeHtml(roleRecord.applicationQuestion)}</h2>
          <p style="font-size:14px;line-height:1.65;white-space:pre-wrap">${escapeHtml(roleResponse)}</p>
          <h2 style="font-size:15px;margin-top:24px">What they want to learn</h2>
          <p style="font-size:14px;line-height:1.65;white-space:pre-wrap">${escapeHtml(learningGoal)}</p>
        </div>
      `.trim(),
      text: `${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nWhy Replova:\n${motivation}\n\n${roleRecord.applicationQuestion}\n${roleResponse}\n\nWhat they want to learn:\n${learningGoal}`,
      attachments: attachments.length ? attachments : undefined,
    })

    if (error) {
      console.error('[careers/apply] email delivery failed:', error.name)
      if (applicationStored) {
        await admin.from('career_applications').update({
          email_notification_error: error.name,
          updated_at: new Date().toISOString(),
        }).eq('id', applicationId)
      } else {
        return NextResponse.json({ error: 'We could not save or deliver the application. Please try again.' }, { status: 502 })
      }
    } else if (applicationStored) {
      await admin.from('career_applications').update({
        email_notification_sent: true,
        email_notification_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', applicationId)
    }
  }

  if (!applicationStored && (!destination || !apiKey)) {
    return NextResponse.json({ error: 'Applications are temporarily unavailable. Please email careers@replova.app.' }, { status: 503 })
  }

  return NextResponse.json({
    success: true,
    applicationId: applicationStored ? applicationId : undefined,
    trackingStored: applicationStored,
  })
}
