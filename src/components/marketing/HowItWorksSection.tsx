import { FadeUpOnScroll } from '@/components/motion/FadeUpOnScroll'
import { StepsContainer, StepItemAnimated } from './HowItWorksStepsAnimated'

const steps = [
  {
    number: '01',
    title: 'Wear your camera on site',
    description:
      'A site manager wears a FieldSightAI body camera during inspections, walkarounds, and meetings. No extra setup required.',
  },
  {
    number: '02',
    title: 'Footage uploads automatically',
    description:
      'The moment a recording is stopped, footage syncs to the cloud automatically. FieldSightAI picks it up instantly.',
  },
  {
    number: '03',
    title: 'AI transcribes the recording',
    description:
      'Audio is converted to text, split into timestamped segments with speaker labels.',
  },
  {
    number: '04',
    title: 'Review and edit in minutes',
    description:
      'Log in, watch the video, correct any transcript errors inline. The video and transcript are perfectly synced.',
  },
  {
    number: '05',
    title: 'Export to your platform',
    description:
      'One click pushes the finalised diary entry into Procore and Autodesk Forma — formatted, dated, and audit-ready.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto flex flex-col gap-12">
        {/* Heading */}
        <FadeUpOnScroll className="flex flex-col gap-3 text-center">
          <p className="text-sm font-semibold text-[#FF8F00] uppercase tracking-widest">
            How It Works
          </p>
          <h2 className="text-4xl font-extrabold text-[#111827] tracking-tight">
            From site to diary in five steps
          </h2>
        </FadeUpOnScroll>

        {/* Steps */}
        <StepsContainer>
          {steps.map((step, i) => (
            <StepItemAnimated key={step.number} className="flex gap-6 relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  aria-hidden
                  className="absolute left-6 top-14 bottom-0 w-px bg-[#E5E7EB]"
                />
              )}

              {/* Step number bubble */}
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#FFD966] flex items-center justify-center font-bold text-sm text-[#111827] z-10">
                {step.number}
              </div>

              {/* Content */}
              <div className="pb-10 flex flex-col gap-1">
                <h3 className="text-base font-bold text-[#111827]">{step.title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{step.description}</p>
              </div>
            </StepItemAnimated>
          ))}
        </StepsContainer>
      </div>
    </section>
  )
}
