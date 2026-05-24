import { type Metadata } from 'next'
import ContactForm from './ContactForm'

export const metadata: Metadata = { title: 'Contact — FieldSightAI' }

export default function ContactPage() {
  return <ContactForm />
}
