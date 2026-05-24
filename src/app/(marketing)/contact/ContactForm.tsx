'use client'

import { useState } from 'react'
import { Mail, MapPin, Clock } from 'lucide-react'

export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    const form = e.currentTarget
    const data = {
      firstName: (form.elements.namedItem('first_name') as HTMLInputElement).value,
      lastName: (form.elements.namedItem('last_name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      company: (form.elements.namedItem('company') as HTMLInputElement).value,
      topic: (form.elements.namedItem('topic') as HTMLSelectElement).value,
      message: (form.elements.namedItem('body') as HTMLTextAreaElement).value,
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Something went wrong')
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Header */}
      <div className="max-w-xl mb-14">
        <h1 className="text-3xl font-bold text-[#111827] mb-3">Get in touch</h1>
        <p className="text-[#6B7280] leading-relaxed">
          Whether you&rsquo;re interested in a demo, have a question about the platform, or want to discuss a custom integration — we&rsquo;d love to hear from you.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Contact form */}
        <div>
          {status === 'success' ? (
            <div className="p-6 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
              <p className="text-sm font-semibold text-[#111827] mb-1">Message sent!</p>
              <p className="text-sm text-[#6B7280]">Thanks for reaching out — we&rsquo;ll get back to you within one business day.</p>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">First name</label>
                  <input
                    type="text"
                    name="first_name"
                    required
                    className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966] bg-white"
                    placeholder="Ben"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Last name</label>
                  <input
                    type="text"
                    name="last_name"
                    required
                    className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966] bg-white"
                    placeholder="Smith"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966] bg-white"
                  placeholder="ben@yourcompany.co.nz"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Company</label>
                <input
                  type="text"
                  name="company"
                  className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966] bg-white"
                  placeholder="Smith Construction"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">What can we help with?</label>
                <select
                  name="topic"
                  className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966] bg-white text-[#374151]"
                >
                  <option value="">Select a topic…</option>
                  <option value="Book a demo">Book a demo</option>
                  <option value="Pricing enquiry">Pricing enquiry</option>
                  <option value="Custom integration">Custom integration</option>
                  <option value="Technical support">Technical support</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Message</label>
                <textarea
                  name="body"
                  rows={4}
                  required
                  className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966] bg-white resize-none"
                  placeholder="Tell us about your project or question…"
                />
              </div>
              {status === 'error' && (
                <p className="text-sm text-[#EF4444]">{errorMsg || 'Something went wrong. Please try again.'}</p>
              )}
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === 'submitting' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>

        {/* Contact details */}
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-[#FFF8E7] flex items-center justify-center flex-shrink-0">
                <Mail size={16} className="text-[#FF8F00]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827] mb-0.5">Email us</p>
                <a href="mailto:contact@fieldsightai.com" className="text-sm text-[#6B7280] hover:text-[#FF8F00] transition-colors">
                  contact@fieldsightai.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-[#FFF8E7] flex items-center justify-center flex-shrink-0">
                <MapPin size={16} className="text-[#FF8F00]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827] mb-0.5">Based in</p>
                <p className="text-sm text-[#6B7280]">Auckland, New Zealand</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-[#FFF8E7] flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-[#FF8F00]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827] mb-0.5">Response time</p>
                <p className="text-sm text-[#6B7280]">We typically respond within one business day.</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
            <p className="text-sm font-semibold text-[#111827] mb-1">Looking for a demo?</p>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              We&rsquo;ll walk you through the full platform — from camera footage through to the finished daily diary — on a live construction project.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
