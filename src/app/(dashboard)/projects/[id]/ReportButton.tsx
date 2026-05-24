'use client'

import { useState } from 'react'
import { FileText, X, Loader2, Mail, Check, Download } from 'lucide-react'

interface ReportButtonProps {
  projectId: string
  projectName: string
  selectedDate: string
  dayLabel: string
}

export function ReportButton({ projectId, projectName, selectedDate, dayLabel }: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastDate, setLastDate] = useState<string | null>(null)
  const [emailing, setEmailing] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [extraEmail, setExtraEmail] = useState('')

  async function generate() {
    // Re-use cached report if same date
    if (report && lastDate === selectedDate) { setOpen(true); return }

    setOpen(true)
    setLoading(true)
    setReport(null)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, projectName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate report')
      } else if (!data.report) {
        setError(data.message ?? 'No transcripts available for this date.')
      } else {
        setReport(data.report)
        setLastDate(selectedDate)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function emailReport() {
    setEmailing(true)
    setEmailSent(false)
    try {
      const body: Record<string, string> = { date: selectedDate, projectName }
      if (extraEmail.trim()) body.recipientEmail = extraEmail.trim()
      await fetch(`/api/projects/${projectId}/report/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 4000)
    } finally {
      setEmailing(false)
    }
  }

  function downloadPdf() {
    if (!report) return
    const win = window.open('', '_blank')
    if (!win) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${projectName} — Daily Report ${dayLabel}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; max-width: 720px; margin: 40px auto; line-height: 1.6; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  h3 { font-size: 14px; margin: 20px 0 4px; }
  p, li { margin: 4px 0; }
  ul { padding-left: 20px; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>${projectName} — Daily Site Report</h1>
<p class="meta">${dayLabel}</p>
${report.split('\n').map((line) => {
  if (line.startsWith('## ') || line.startsWith('# ')) return `<h3>${line.replace(/^#+\s/, '')}</h3>`
  if (line.startsWith('**') && line.endsWith('**')) return `<h3>${line.slice(2, -2)}</h3>`
  if (line.startsWith('- ') || line.startsWith('* ')) return `<li>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`
  if (line.trim() === '') return '<br>'
  return `<p>${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`
}).join('\n')}
<script>window.onload = () => { window.print(); }<\/script>
</body></html>`
    win.document.write(html)
    win.document.close()
  }

  function downloadDocx() {
    if (!report) return
    // Word-compatible HTML document (opens natively in Word/LibreOffice)
    const bodyHtml = report.split('\n').map((line) => {
      if (line.startsWith('## ') || line.startsWith('# ')) return `<h2>${line.replace(/^#+\s/, '')}</h2>`
      if (line.startsWith('**') && line.endsWith('**')) return `<h2>${line.slice(2, -2)}</h2>`
      if (line.startsWith('- ') || line.startsWith('* ')) return `<li>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</li>`
      if (line.trim() === '') return '<br>'
      return `<p>${line.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</p>`
    }).join('\n')

    const content = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<title>${projectName} — Daily Report ${dayLabel}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; }
  h1 { font-size: 16pt; }
  h2 { font-size: 13pt; margin-top: 16pt; }
  p, li { font-size: 11pt; line-height: 1.5; }
</style>
</head><body>
<h1>${projectName} — Daily Site Report</h1>
<p style="color:#666;font-size:10pt;">${dayLabel}</p>
${bodyHtml}
</body></html>`

    const blob = new Blob([content], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daily-report-${selectedDate}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Render markdown-ish: bold headings, bullet points
  function renderReport(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        const content = line.replace(/^#+\s/, '')
        return <h3 key={i} className="text-sm font-bold text-[#111827] mt-4 mb-1 first:mt-0">{content}</h3>
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <h3 key={i} className="text-sm font-bold text-[#111827] mt-4 mb-1 first:mt-0">{line.slice(2, -2)}</h3>
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={i} className="flex gap-2 text-sm text-[#374151] leading-relaxed">
            <span className="text-[#FF8F00] flex-shrink-0 mt-1">•</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        )
      }
      if (line.trim() === '') return <div key={i} className="h-1" />
      return <p key={i} className="text-sm text-[#374151] leading-relaxed">{renderInline(line)}</p>
    })
  }

  function renderInline(text: string): React.ReactNode {
    // Bold **text**
    const parts = text.split(/\*\*(.*?)\*\*/g)
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="font-semibold text-[#111827]">{part}</strong> : part
    )
  }

  return (
    <>
      <button
        onClick={generate}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
      >
        <FileText size={14} />
        Reports
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          {/* Modal */}
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">Daily Site Report</h2>
                <p className="text-xs text-[#6B7280] mt-0.5">{projectName} — {dayLabel}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-[#6B7280] py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" />
                  Generating report from today&apos;s transcripts…
                </div>
              )}
              {error && (
                <p className="text-sm text-red-500 py-4">{error}</p>
              )}
              {report && (
                <div className="flex flex-col gap-0.5">
                  {renderReport(report)}
                </div>
              )}
            </div>

            {/* Footer */}
            {report && (
              <div className="px-6 py-3 border-t border-[#E5E7EB] flex flex-col gap-2">
                <input
                  type="email"
                  value={extraEmail}
                  onChange={(e) => setExtraEmail(e.target.value)}
                  placeholder="Send to another email (optional — defaults to yours)"
                  className="text-xs px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#FFD966] w-full"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-[#9CA3AF]">Generated by AI — review before sharing</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={emailReport}
                      disabled={emailing}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#111827] bg-[#FFD966] hover:bg-[#FFC107] rounded px-2.5 py-1 transition-colors disabled:opacity-50"
                    >
                      {emailing
                        ? <Loader2 size={12} className="animate-spin" />
                        : emailSent
                          ? <Check size={12} />
                          : <Mail size={12} />}
                      {emailSent ? 'Sent!' : 'Email'}
                    </button>
                    <button
                      onClick={downloadPdf}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#111827] bg-[#FFD966] hover:bg-[#FFC107] rounded px-2.5 py-1 transition-colors"
                      title="Download as PDF (print dialog)"
                    >
                      <Download size={12} />
                      PDF
                    </button>
                    <button
                      onClick={downloadDocx}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#111827] bg-[#FFD966] hover:bg-[#FFC107] rounded px-2.5 py-1 transition-colors"
                      title="Download as Word document"
                    >
                      <Download size={12} />
                      .docx
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(report) }}
                      className="text-xs font-medium text-[#111827] bg-[#FFD966] hover:bg-[#FFC107] rounded px-2.5 py-1 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
