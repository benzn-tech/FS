import { type Metadata } from 'next'
import { FileText, Mic, Zap, Shield } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = { title: 'About — FieldSightAI' }

const values = [
  {
    icon: FileText,
    title: 'Documentation that writes itself',
    body: 'Site managers spend hours writing daily diaries. We eliminate that entirely — the camera runs, we handle the rest.',
  },
  {
    icon: Mic,
    title: 'Built for how sites actually work',
    body: 'Noisy, hands-on, and fast-moving. Our system is designed around body cameras, not keyboards.',
  },
  {
    icon: Zap,
    title: 'Speed matters on site',
    body: 'From footage to searchable, shareable transcript in minutes — not hours. Decisions move faster when information is instant.',
  },
  {
    icon: Shield,
    title: 'Your data, protected',
    body: 'All data is stored on secure cloud infrastructure in Australia. We follow industry-standard security practices and give you full control over access.',
  },
]

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Hero */}
      <div className="max-w-2xl mb-20">
        <p className="text-sm font-semibold text-[#FF8F00] uppercase tracking-widest mb-3">About FieldSightAI</p>
        <h1 className="text-4xl font-bold text-[#111827] leading-tight mb-5">
          We built the daily diary that writes itself.
        </h1>
        <p className="text-lg text-[#6B7280] leading-relaxed">
          FieldSightAI was created out of frustration with one of construction&rsquo;s oldest pain points: the daily diary. Critical information spoken on site every day — instructions, defects, progress, safety notes — disappears the moment the workday ends.
        </p>
      </div>

      {/* Story */}
      <div className="grid md:grid-cols-2 gap-12 mb-20 items-start">
        <div className="flex flex-col gap-4 text-[#374151] text-sm leading-relaxed">
          <p>
            We built FieldSightAI body cameras to capture what actually happens on site — no extra steps, no extra hardware beyond what teams already use. The footage is automatically ingested, transcribed with speaker identification, and organised by project and date.
          </p>
          <p>
            From there, AI turns raw transcripts into structured daily reports, action item lists, and searchable records — ready to export directly into Procore and Autodesk Forma.
          </p>
          <p>
            Our goal is simple: every site manager finishes their day without touching a keyboard for documentation, and every project has a complete, accurate record they can stand behind.
          </p>
        </div>
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-6 flex flex-col gap-4">
          <p className="text-sm font-semibold text-[#111827]">The problem we solve</p>
          <ul className="flex flex-col gap-3 text-sm text-[#6B7280]">
            {[
              'Daily diaries written from memory, hours after the fact',
              'Verbal instructions with no written record',
              'Defects and safety issues not captured in time',
              'No searchable history of what was said on site',
              'Compliance risk from incomplete documentation',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-[#FF8F00] mt-0.5">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Values */}
      <div className="mb-20">
        <h2 className="text-xl font-bold text-[#111827] mb-8">What we stand for</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {values.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="w-9 h-9 rounded-lg bg-[#FFF8E7] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={16} className="text-[#FF8F00]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827] mb-1">{title}</p>
                <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[#111827] rounded-2xl px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <p className="text-lg font-bold text-white mb-1">Ready to see it in action?</p>
          <p className="text-sm text-gray-400">We&rsquo;ll show you the full workflow on a live project — no slides, no sales deck.</p>
        </div>
        <Link
          href="/contact"
          className="flex-shrink-0 inline-flex items-center px-6 py-2.5 text-sm font-semibold bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] transition-colors"
        >
          Book a demo
        </Link>
      </div>
    </div>
  )
}
