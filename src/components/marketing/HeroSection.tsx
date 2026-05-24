import { siteConfig } from '@/config/site'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { CheckCircle, Mic, FileText } from 'lucide-react'
import { HeroCopyAnimated, HeroCopyItem } from './HeroCopyAnimated'
import { HeroMockupAnimated } from './HeroMockupAnimated'

export function HeroSection() {
  return (
    <section className="relative pt-36 pb-24 px-6 overflow-hidden bg-[#FAFAF7]">
      {/* Subtle grid background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:48px_48px] opacity-40"
      />
      {/* Brand glow */}
      <div
        aria-hidden
        className="absolute top-[-10rem] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#FFD966]/20 blur-3xl pointer-events-none"
      />

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-[1fr_1.2fr] gap-16 items-center">
        {/* Left — copy */}
        <HeroCopyAnimated>
          <HeroCopyItem>
            <Badge variant="info" className="self-start">
              Built for construction site managers
            </Badge>
          </HeroCopyItem>

          <HeroCopyItem>
            <h1 className="text-6xl font-extrabold leading-[1.08] text-[#111827] tracking-tight">
              Your site,{' '}
              <span className="bg-gradient-to-r from-[#FF8F00] to-[#FFD966] bg-clip-text text-transparent">documented</span>{' '}
              automatically.
            </h1>
          </HeroCopyItem>

          <HeroCopyItem>
            <p className="text-lg text-[#6B7280] leading-relaxed max-w-lg">
              {siteConfig.description} Stop writing daily diaries by hand — let FieldSightAI™ turn your body camera footage into compliance-ready records.
            </p>
          </HeroCopyItem>

          <HeroCopyItem>
            <div className="flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg">Get Started Free</Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" size="lg">
                  Watch a Demo →
                </Button>
              </Link>
            </div>
          </HeroCopyItem>

          <HeroCopyItem>
            <ul className="flex flex-col gap-2 mt-2">
              {[
                'No manual diary writing',
                'Exports to Procore and Autodesk Forma',
                'Timestamped audit trail',
              ].map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm text-[#6B7280]">
                  <CheckCircle size={16} className="text-[#FF8F00] flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </HeroCopyItem>
        </HeroCopyAnimated>

        {/* Right — UI mockup */}
        <HeroMockupAnimated>
          <div className="w-full bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl overflow-hidden">
            {/* Browser chrome */}
            <div className="bg-[#F3F4F6] px-4 py-3 flex items-center gap-3 border-b border-[#E5E7EB]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 font-mono border border-[#E5E7EB]">
                fieldsightai.com/sessions
              </div>
            </div>

            {/* App layout */}
            <div className="flex" style={{ minHeight: 320 }}>
              {/* Sidebar */}
              <div className="w-44 bg-[#111827] flex flex-col gap-1 p-3 flex-shrink-0">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 pt-1 pb-2">FieldSightAI</p>
                {['Recordings', 'Reports', 'Exports', 'Settings'].map((item, i) => (
                  <div key={item} className={`px-2 py-1.5 rounded-lg text-xs font-medium ${i === 0 ? 'bg-[#FFD966]/20 text-[#FFD966]' : 'text-gray-400'}`}>
                    {item}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 p-4 bg-[#FAFAF7] flex flex-col gap-3">
                <p className="text-xs font-bold text-[#111827]">Recent Recordings</p>

                {/* Session cards */}
                {[
                  { title: 'Site Walkthrough — Block A', time: 'Today · 42 min', status: 'Ready', statusColor: 'bg-green-100 text-green-700' },
                  { title: 'Foundation Inspection — Level 1', time: 'Yesterday · 28 min', status: 'Processing', statusColor: 'bg-blue-100 text-blue-700' },
                  { title: 'Safety Audit — Scaffold Zone', time: '2 days ago · 35 min', status: 'Exported', statusColor: 'bg-gray-100 text-gray-600' },
                ].map((s) => (
                  <div key={s.title} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#E5E7EB]">
                    <div className="w-8 h-8 rounded-lg bg-[#FFD966]/30 flex items-center justify-center flex-shrink-0">
                      <Mic size={14} className="text-[#FF8F00]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#111827] truncate">{s.title}</p>
                      <p className="text-[10px] text-[#6B7280]">{s.time}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${s.statusColor}`}>{s.status}</span>
                  </div>
                ))}

                {/* Transcript snippet */}
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#FFFDE7] border border-[#FFD966]/40 mt-1">
                  <div className="flex items-center gap-1.5">
                    <FileText size={12} className="text-[#FF8F00]" />
                    <span className="text-[10px] font-semibold text-[#FF8F00]">Auto-generated transcript</span>
                  </div>
                  <p className="text-[10px] text-[#111827] leading-relaxed">
                    "Inspected formwork on level 2 — steel ties correctly placed. Concrete pour scheduled for Thursday..."
                  </p>
                  <div className="flex gap-2 mt-1">
                    <div className="flex-1 h-7 rounded-lg bg-[#FFD966] flex items-center justify-center">
                      <span className="text-[10px] font-semibold text-[#111827]">Export to Aconex</span>
                    </div>
                    <div className="h-7 px-2 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center">
                      <span className="text-[10px] text-[#6B7280]">···</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </HeroMockupAnimated>
      </div>
    </section>
  )
}
