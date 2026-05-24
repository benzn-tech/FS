import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB]">
      <h1 className="text-6xl font-bold text-[#111827]">404</h1>
      <p className="mt-4 text-xl text-[#6B7280]">Page not found</p>
      <Link
        href="/"
        className="mt-8 px-6 py-3 bg-[#FFD966] text-[#111827] font-semibold rounded-lg hover:bg-[#FFC107] transition-colors duration-200"
      >
        Back to home
      </Link>
    </div>
  )
}
