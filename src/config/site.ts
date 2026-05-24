export const siteConfig = {
  name: 'FieldSightAI™',
  tagline: 'Your site, documented automatically.',
  description:
    'Eliminate manual daily diaries with automatic transcription from body camera footage.',
  url: 'https://www.fieldsightai.com',
  nav: {
    marketing: [
      { label: 'Features', href: '/#features' },
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  footer: {
    columns: [
      {
        heading: 'Product',
        links: [
          { label: 'Features', href: '/#features' },
          { label: 'How It Works', href: '/#how-it-works' },
          { label: 'Pricing', href: '/pricing' },
        ],
      },
      {
        heading: 'Company',
        links: [
          { label: 'About', href: '/about' },
          { label: 'Contact', href: '/contact' },
        ],
      },
      {
        heading: 'Legal',
        links: [
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Terms of Service', href: '/terms' },
        ],
      },
    ],
  },
} as const
