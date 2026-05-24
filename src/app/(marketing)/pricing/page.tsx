import { type Metadata } from 'next'
import { Check } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Pricing — FieldSightAI' }

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: 'during beta',
    description: 'Perfect for a single site or team trialling the platform.',
    highlight: false,
    features: [
      'Up to 2 active projects',
      'Up to 5 users',
      'Unlimited recordings & transcripts',
      'AI daily site reports',
      'Calendar & transcript search',
      'Email support',
    ],
    cta: 'Get started free',
    ctaHref: '/register',
  },
  {
    name: 'Professional',
    price: 'Contact us',
    period: 'per organisation',
    description: 'For growing teams managing multiple sites and integrations.',
    highlight: true,
    features: [
      'Unlimited projects',
      'Unlimited users',
      'Unlimited recordings & transcripts',
      'AI reports, tags & task lists',
      'Procore & Autodesk Forma export',
      'Custom device configuration',
      'Priority support',
      'Onboarding & training',
    ],
    cta: 'Talk to us',
    ctaHref: '/contact',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'tailored to your needs',
    description: 'For large contractors with complex requirements.',
    highlight: false,
    features: [
      'Everything in Professional',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantees',
      'Data residency options',
      'SSO / SAML',
    ],
    cta: 'Contact us',
    ctaHref: '/contact',
  },
]

const faqs = [
  {
    q: 'Is FieldSightAI free right now?',
    a: 'Yes — we are currently in beta and the platform is free for early teams. Paid plans will be introduced once we exit beta, and existing users will be given advance notice.',
  },
  {
    q: 'What hardware do I need?',
    a: 'FieldSightAI works with our own body cameras. No additional hardware is required beyond what we provide.',
  },
  {
    q: 'How does transcription work?',
    a: 'Footage is automatically ingested and transcribed with speaker diarisation, then stored in your project. The process is fully automatic — no manual uploading required.',
  },
  {
    q: 'Does my data leave New Zealand?',
    a: 'Data is stored and processed on secure cloud infrastructure in Sydney, Australia. While data does leave New Zealand, Australia\'s data protection standards are recognised as compliant under New Zealand\'s Privacy Act 2020.',
  },
  {
    q: 'Can I export to Procore or Autodesk Forma?',
    a: 'Yes — export to Procore and Autodesk Forma is available on Professional and Enterprise plans.',
  },
  {
    q: 'How do I get started?',
    a: 'Register for a free account or contact us for a demo. We can usually have a new team onboarded within a day.',
  },
]

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-14">
        <p className="text-sm font-semibold text-[#FF8F00] uppercase tracking-widest mb-3">Pricing</p>
        <h1 className="text-4xl font-bold text-[#111827] mb-4">Simple, transparent pricing</h1>
        <p className="text-[#6B7280] leading-relaxed">
          We&rsquo;re in beta — the platform is free to use right now. Paid plans will launch once we exit beta.
        </p>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 mb-20">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl border flex flex-col ${
              plan.highlight
                ? 'bg-[#111827] border-[#111827] text-white'
                : 'bg-white border-[#E5E7EB] text-[#374151]'
            }`}
          >
            <div className="p-6 flex-1">
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${plan.highlight ? 'text-[#FFD966]' : 'text-[#9CA3AF]'}`}>
                {plan.name}
              </p>
              <div className="mb-1">
                <span className={`text-3xl font-bold ${plan.highlight ? 'text-white' : 'text-[#111827]'}`}>{plan.price}</span>
                <span className={`text-xs ml-1.5 ${plan.highlight ? 'text-gray-400' : 'text-[#9CA3AF]'}`}>{plan.period}</span>
              </div>
              <p className={`text-sm mb-6 ${plan.highlight ? 'text-gray-400' : 'text-[#6B7280]'}`}>{plan.description}</p>
              <ul className="flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={14} className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-[#FFD966]' : 'text-[#FF8F00]'}`} />
                    <span className={`text-sm ${plan.highlight ? 'text-gray-300' : 'text-[#374151]'}`}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 pt-0">
              <Link
                href={plan.ctaHref}
                className={`block text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-[#FFD966] text-[#111827] hover:bg-[#FFC107]'
                    : 'bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-xl font-bold text-[#111827] mb-8 text-center">Frequently asked questions</h2>
        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-7 max-w-4xl mx-auto">
          {faqs.map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-semibold text-[#111827] mb-1.5">{q}</p>
              <p className="text-sm text-[#6B7280] leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
