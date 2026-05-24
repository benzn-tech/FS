import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const FROM_ADDRESS = 'noreply@fieldsightai.com'

// Create a fresh SESClient per call so Amplify SSR runtime credentials
// are read from process.env at request time, not cached at module load time.
function makeSESClient() {
  return new SESClient({
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    credentials: process.env.APP_AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,
  })
}

function formatSecs(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface TranscriptSegmentForEmail {
  start_time: string | number
  speaker_label: string | null
  text: string
}

export async function sendTranscriptEmail(
  to: string,
  sessionTitle: string,
  segments: TranscriptSegmentForEmail[],
): Promise<void> {
  const lines = segments.map((seg) => {
    const ts = formatSecs(Number(seg.start_time))
    const speaker = seg.speaker_label ? `${seg.speaker_label}: ` : ''
    return `[${ts}] ${speaker}${seg.text}`
  })

  const plainText = `Transcript: ${sessionTitle}\n\n${lines.join('\n')}\n\n---\nFieldSightAI`

  const htmlLines = lines
    .map((l) => `<p style="margin:0 0 4px 0;font-family:monospace;font-size:13px">${escapeHtml(l)}</p>`)
    .join('\n')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111827;padding:24px;max-width:680px">
  <h2 style="color:#FF8F00;margin-bottom:4px">FieldSightAI</h2>
  <h3 style="margin-top:0">${escapeHtml(sessionTitle)}</h3>
  <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-top:16px">
    ${htmlLines}
  </div>
</body>
</html>`

  await makeSESClient().send(
    new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `Transcript: ${sessionTitle}`, Charset: 'UTF-8' },
        Body: {
          Text: { Data: plainText, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}

export async function sendReportEmail(
  to: string,
  projectName: string,
  date: string,
  reportMarkdown: string,
): Promise<void> {
  const formattedDate = new Date(date).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const subject = `Site Report — ${projectName} — ${formattedDate}`

  // Convert simple markdown to HTML
  const htmlBody = reportMarkdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return `<h3 style="color:#111827;margin:16px 0 4px 0">${escapeHtml(line.replace(/^#+\s/, ''))}</h3>`
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return `<li style="margin:2px 0">${escapeHtml(line.slice(2)).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</li>`
      }
      if (line.trim() === '') return '<br>'
      return `<p style="margin:4px 0">${escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`
    })
    .join('\n')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111827;padding:24px;max-width:680px">
  <h2 style="color:#FF8F00;margin-bottom:4px">FieldSightAI</h2>
  <h3 style="margin-top:0">${escapeHtml(projectName)} — Daily Report</h3>
  <p style="color:#6B7280">${formattedDate}</p>
  <div style="margin-top:16px">${htmlBody}</div>
</body>
</html>`

  await makeSESClient().send(
    new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: `${projectName} — ${formattedDate}\n\n${reportMarkdown}`, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}

export async function sendInviteEmail(
  to: string,
  name: string,
  inviteLink: string,
): Promise<void> {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111827;padding:24px;max-width:680px">
  <h2 style="color:#FF8F00;margin-bottom:4px">FieldSightAI</h2>
  <p>Hi ${escapeHtml(name)},</p>
  <p>You've been invited to join a project on FieldSightAI — the construction site recording platform.</p>
  <p>Click the button below to set your password and get started:</p>
  <p style="margin:24px 0">
    <a href="${inviteLink}" style="background:#FFD966;color:#111827;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
      Accept Invitation
    </a>
  </p>
  <p style="color:#6B7280;font-size:13px">This link expires in 24 hours. If you didn't expect this invitation, you can safely ignore this email.</p>
</body>
</html>`

  await makeSESClient().send(
    new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: "You've been invited to FieldSightAI", Charset: 'UTF-8' },
        Body: {
          Text: { Data: `Hi ${name},\n\nYou've been invited to FieldSightAI.\n\nAccept your invitation: ${inviteLink}\n\nThis link expires in 24 hours.`, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111827;padding:24px;max-width:680px">
  <h2 style="color:#FF8F00;margin-bottom:4px">FieldSightAI</h2>
  <p>We received a request to reset your password.</p>
  <p style="margin:24px 0">
    <a href="${resetUrl}" style="background:#FFD966;color:#111827;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
      Reset Password
    </a>
  </p>
  <p style="color:#6B7280;font-size:13px">This link expires in 15 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
</body>
</html>`

  await makeSESClient().send(
    new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: 'Reset your FieldSightAI password', Charset: 'UTF-8' },
        Body: {
          Text: { Data: `Reset your FieldSightAI password\n\n${resetUrl}\n\nThis link expires in 15 minutes.`, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const loginUrl = `${process.env.APP_URL ?? 'https://www.fieldsightai.com'}/login`
  const demoUrl = `${process.env.APP_URL ?? 'https://www.fieldsightai.com'}/contact`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111827;padding:24px;max-width:680px">
  <h2 style="color:#FF8F00;margin-bottom:4px">FieldSightAI</h2>
  <p>Hi ${escapeHtml(name)},</p>
  <p>Welcome to FieldSightAI! Your account is ready. You can log in using the button below.</p>
  <p style="margin:24px 0">
    <a href="${loginUrl}" style="background:#FFD966;color:#111827;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
      Log in to FieldSightAI
    </a>
  </p>
  <h3 style="margin:32px 0 12px 0;color:#111827">What to expect</h3>
  <table style="border-collapse:collapse;width:100%">
    <tr>
      <td style="padding:12px 16px;background:#FFF8E7;border-radius:8px;font-weight:700;font-size:18px;color:#FF8F00;width:40px;vertical-align:top">1</td>
      <td style="padding:12px 16px;vertical-align:top">
        <strong>Your FieldSightAI cameras are set up on site</strong><br>
        <span style="color:#6B7280;font-size:14px">Our team will configure your cameras and link them to your account.</span>
      </td>
    </tr>
    <tr><td colspan="2" style="height:8px"></td></tr>
    <tr>
      <td style="padding:12px 16px;background:#FFF8E7;border-radius:8px;font-weight:700;font-size:18px;color:#FF8F00;width:40px;vertical-align:top">2</td>
      <td style="padding:12px 16px;vertical-align:top">
        <strong>Footage is automatically transcribed within the hour</strong><br>
        <span style="color:#6B7280;font-size:14px">Once recorded, your footage is uploaded and transcribed — no manual steps required.</span>
      </td>
    </tr>
    <tr><td colspan="2" style="height:8px"></td></tr>
    <tr>
      <td style="padding:12px 16px;background:#FFF8E7;border-radius:8px;font-weight:700;font-size:18px;color:#FF8F00;width:40px;vertical-align:top">3</td>
      <td style="padding:12px 16px;vertical-align:top">
        <strong>Review, edit, and export your daily diary</strong><br>
        <span style="color:#6B7280;font-size:14px">Log in to review recordings, edit transcripts, and push finished diaries to Aconex or Safebase.</span>
      </td>
    </tr>
  </table>
  <p style="margin-top:32px">
    <a href="${demoUrl}" style="color:#FF8F00;font-size:14px">Book a demo to get a walkthrough of the full platform →</a>
  </p>
  <p style="color:#6B7280;font-size:13px;margin-top:32px">If you have any questions, reply to this email or contact us at <a href="mailto:contact@fieldsightai.com" style="color:#FF8F00">contact@fieldsightai.com</a>.</p>
</body>
</html>`

  const plain = `Hi ${name},

Welcome to FieldSightAI! Your account is ready.

Log in here: ${loginUrl}

What to expect:
1. Your FieldSightAI cameras are set up on site — our team will configure your cameras and link them to your account.
2. Footage is automatically transcribed within the hour — no manual steps required.
3. Review, edit, and export your daily diary — push finished diaries to Aconex or Safebase.

Book a demo: ${demoUrl}

Questions? Contact us at contact@fieldsightai.com`

  await makeSESClient().send(
    new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: 'Welcome to FieldSightAI', Charset: 'UTF-8' },
        Body: {
          Text: { Data: plain, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}

export async function sendContactEmail(fields: {
  firstName: string
  lastName: string
  email: string
  company?: string
  topic?: string
  message: string
}): Promise<void> {
  const { firstName, lastName, email, company, topic, message } = fields
  const subject = `Contact form: ${topic || 'General enquiry'} — ${firstName} ${lastName}`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111827;padding:24px;max-width:680px">
  <h2 style="color:#FF8F00;margin-bottom:4px">FieldSightAI</h2>
  <h3 style="margin-top:0">New contact form submission</h3>
  <table style="border-collapse:collapse;width:100%;margin-top:16px">
    <tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600;width:120px">Name</td><td style="padding:8px 12px;border:1px solid #E5E7EB">${escapeHtml(firstName)} ${escapeHtml(lastName)}</td></tr>
    <tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600">Email</td><td style="padding:8px 12px;border:1px solid #E5E7EB"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
    ${company ? `<tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600">Company</td><td style="padding:8px 12px;border:1px solid #E5E7EB">${escapeHtml(company)}</td></tr>` : ''}
    ${topic ? `<tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600">Topic</td><td style="padding:8px 12px;border:1px solid #E5E7EB">${escapeHtml(topic)}</td></tr>` : ''}
    <tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;font-weight:600;vertical-align:top">Message</td><td style="padding:8px 12px;border:1px solid #E5E7EB;white-space:pre-wrap">${escapeHtml(message)}</td></tr>
  </table>
</body>
</html>`

  const plain = `New contact form submission\n\nName: ${firstName} ${lastName}\nEmail: ${email}${company ? `\nCompany: ${company}` : ''}${topic ? `\nTopic: ${topic}` : ''}\n\nMessage:\n${message}`

  await makeSESClient().send(
    new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [process.env.CONTACT_EMAIL ?? 'josh.wild@southbase.co.nz'] },
      ReplyToAddresses: [email],
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: plain, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}

export interface TaskForEmail {
  text: string
  priority: string
  tag: string | null
  assignee_name: string | null
  done: boolean
}

export async function sendTasksEmail(
  to: string,
  projectName: string,
  date: string,
  tasks: TaskForEmail[],
): Promise<void> {
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const subject = `Action Items — ${projectName} — ${formattedDate}`

  const priorityColour: Record<string, string> = {
    high: '#EF4444',
    medium: '#F97316',
    low: '#6B7280',
  }

  const rows = tasks.map((t) => {
    const done = t.done ? '<s style="color:#9CA3AF">' : ''
    const doneEnd = t.done ? '</s>' : ''
    const badge = (label: string, colour: string) =>
      `<span style="display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;background:${colour}20;color:${colour}">${escapeHtml(label)}</span>`
    const priorityBadge = badge(t.priority, priorityColour[t.priority] ?? '#6B7280')
    const tagBadge = t.tag ? `&nbsp;${badge(t.tag, '#6366F1')}` : ''
    const assignee = t.assignee_name
      ? `<span style="font-size:11px;color:#6B7280;margin-left:6px">→ ${escapeHtml(t.assignee_name)}</span>`
      : ''
    const checkbox = t.done ? '☑' : '☐'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;vertical-align:top;width:20px;color:#6B7280">${checkbox}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6">${done}${escapeHtml(t.text)}${doneEnd}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;white-space:nowrap">${priorityBadge}${tagBadge}${assignee}</td>
    </tr>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111827;padding:24px;max-width:680px">
  <h2 style="color:#FF8F00;margin-bottom:4px">FieldSightAI</h2>
  <h3 style="margin-top:0">${escapeHtml(projectName)} — Action Items</h3>
  <p style="color:#6B7280;margin-top:0">${escapeHtml(formattedDate)}</p>
  <table style="border-collapse:collapse;width:100%;margin-top:12px">
    <thead>
      <tr style="background:#F9FAFB">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB"></th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB">Task</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB">Priority / Tag / Assignee</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:24px;font-size:12px;color:#9CA3AF">Sent from FieldSightAI</p>
</body>
</html>`

  const plain = `Action Items — ${projectName} — ${formattedDate}\n\n` +
    tasks.map((t) => `[${t.done ? 'x' : ' '}] ${t.text} (${t.priority}${t.tag ? `, ${t.tag}` : ''}${t.assignee_name ? `, → ${t.assignee_name}` : ''})`).join('\n')

  await makeSESClient().send(
    new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: plain, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
