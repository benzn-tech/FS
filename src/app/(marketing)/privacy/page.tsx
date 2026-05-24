import { type Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy — FieldSightAI' }

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-[#111827] mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#6B7280] mb-10">Last updated: April 2026</p>

      <div className="flex flex-col gap-8 text-[#374151] text-sm leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">1. Overview</h2>
          <p>FieldSightAI Pty Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the FieldSightAI platform, which automatically captures, transcribes, and manages footage from construction site body cameras. This policy explains how we collect, use, store, and protect personal information in connection with our services.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">2. Information We Collect</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>Account information</strong> — name, email address, and role provided at registration.</li>
            <li><strong>Video and audio recordings</strong> — footage uploaded from RealPTT body cameras worn on site.</li>
            <li><strong>Transcripts</strong> — automatically generated text from recordings, including speaker labels and edited versions.</li>
            <li><strong>Usage data</strong> — log data, IP addresses, browser type, and pages visited, used to operate and improve the platform.</li>
            <li><strong>Site information</strong> — project names, addresses, GPS coordinates, and daily site notes entered by users.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>To provide the transcription, reporting, and documentation features of the platform.</li>
            <li>To generate AI-assisted daily site reports and action items from transcripts.</li>
            <li>To send transactional emails (reports, invites, password resets).</li>
            <li>To export records to third-party construction platforms at the direction of your organisation.</li>
            <li>To improve our services and investigate security incidents.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">4. Data Storage and Security</h2>
          <p>All data is stored on secure cloud infrastructure in Sydney, Australia. Video files are stored in private cloud storage and served only via short-lived secure URLs. Transcripts and project data are stored in an encrypted database. We implement role-based access controls, secure authentication, and rate limiting on all API endpoints.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">5. Third-Party Services</h2>
          <p>We use the following third-party services to operate the platform:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-2">
            <li><strong>Cloud infrastructure provider</strong> — hosting, storage, transcription, and AI generation.</li>
            <li><strong>Construction management platforms</strong> — platforms to which users may export transcripts (Procore, Autodesk Forma).</li>
          </ul>
          <p className="mt-2">We do not sell personal information to third parties.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">6. Data Retention</h2>
          <p>We retain recordings, transcripts, and project data for as long as your organisation account is active. You may request deletion of your organisation&rsquo;s data at any time by contacting us.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">7. Your Rights</h2>
          <p>You have the right to access, correct, or request deletion of personal information we hold about you. To exercise these rights, contact us at <a href="mailto:privacy@fieldsightai.com" className="text-[#FF8F00] hover:underline">privacy@fieldsightai.com</a>.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">8. Changes to This Policy</h2>
          <p>We may update this policy from time to time. We will notify account administrators of material changes by email. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#111827] mb-2">9. Contact</h2>
          <p>Questions about this policy? Email us at <a href="mailto:privacy@fieldsightai.com" className="text-[#FF8F00] hover:underline">privacy@fieldsightai.com</a>.</p>
        </section>

      </div>
    </div>
  )
}
