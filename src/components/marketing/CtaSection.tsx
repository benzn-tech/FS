import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { CtaContentAnimated } from './CtaSectionAnimated'

export function CtaSection() {
  return (
    <section id="contact" className="py-24 px-6 bg-[#FFD966]">
      <CtaContentAnimated>
        <h2 className="text-4xl font-extrabold text-[#111827] tracking-tight leading-tight">
          Ready to eliminate daily diary writing?
        </h2>
        <p className="text-lg text-[#111827]/70 max-w-xl">
          Join construction teams using FieldSightAI to turn body camera footage into compliance-ready records — automatically, every shift.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/register">
            <Button
              size="lg"
              className="bg-[#111827] text-white hover:bg-[#1F2937] transition-colors duration-200"
            >
              Get Started Free
            </Button>
          </Link>
          <Link href="#how-it-works">
            <Button
              variant="ghost"
              size="lg"
              className="text-[#111827] hover:bg-[#FFD966]/60"
            >
              Learn More
            </Button>
          </Link>
        </div>
      </CtaContentAnimated>
    </section>
  )
}
