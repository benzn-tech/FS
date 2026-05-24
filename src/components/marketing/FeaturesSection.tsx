import { Mic, Video, ArrowUpRight } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'
import { FadeUpOnScroll } from '@/components/motion/FadeUpOnScroll'
import { FeatureCardsContainer, FeatureCardAnimated } from './FeatureCardsAnimated'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Mic,
    title: 'Auto Transcription',
    description:
      'Body camera footage is automatically transcribed the moment it hits the cloud. No manual uploads, no waiting.',
  },
  {
    icon: Video,
    title: 'Video Sync',
    description:
      'Every transcript segment is time-linked to the exact moment in your video. Click a line to jump straight to that point in the footage.',
  },
  {
    icon: ArrowUpRight,
    title: 'One-Click Export',
    description:
      'Reviewed transcripts are pushed directly into Procore and Autodesk Forma as RFIs, Site Diaries, and Action lists — formatted, timestamped, and compliance-ready.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6 bg-[#F9FAFB]">
      <div className="max-w-6xl mx-auto flex flex-col gap-12">
        {/* Heading */}
        <FadeUpOnScroll className="flex flex-col gap-3 text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-[#FF8F00] uppercase tracking-widest">
            Features
          </p>
          <h2 className="text-4xl font-extrabold text-[#111827] tracking-tight">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="text-[#6B7280] text-lg">
            FieldSightAI handles the entire documentation pipeline from capture to compliance — so your team can focus on the site, not the paperwork.
          </p>
        </FadeUpOnScroll>

        {/* Feature cards */}
        <FeatureCardsContainer className="grid md:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <FeatureCardAnimated
                key={feature.title}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-8 flex flex-col gap-5 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-[#FFD966]/25 flex items-center justify-center">
                  <Icon size={22} className="text-[#FF8F00]" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-[#111827]">{feature.title}</h3>
                  <p className="text-[#6B7280] text-sm leading-relaxed">{feature.description}</p>
                </div>
              </FeatureCardAnimated>
            )
          })}
        </FeatureCardsContainer>
      </div>
    </section>
  )
}
