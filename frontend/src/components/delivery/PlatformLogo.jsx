const logos = {
  jahez: ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect width="48" height="48" rx="12" fill="#F97316" />
      <path d="M14 14h20v3.5H24.5V34h-5V17.5H14V14z" fill="white" />
      <circle cx="34" cy="30" r="4" fill="white" opacity="0.9" />
    </svg>
  ),
  hungerstation: ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect width="48" height="48" rx="12" fill="#EC4899" />
      <path d="M24 10c-5 0-9 4-9 9 0 5 4 9 9 14 5-5 9-9 9-14 0-5-4-9-9-9z" fill="white" />
      <circle cx="24" cy="19" r="3.5" fill="#EC4899" />
    </svg>
  ),
  ninja: ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect width="48" height="48" rx="12" fill="#7C3AED" />
      <path d="M24 12l-10 6v12l10 6 10-6V18l-10-6z" fill="white" opacity="0.15" />
      <path d="M18 20h12M18 24h12M18 28h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="11" stroke="white" strokeWidth="2" opacity="0.4" />
    </svg>
  ),
  keeta: ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect width="48" height="48" rx="12" fill="#059669" />
      <path d="M24 12c-2 4-6 6-10 6 0 8 4 14 10 18 6-4 10-10 10-18-4 0-8-2-10-6z" fill="white" />
      <path d="M20 22l3 3 5-5" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mrsool: ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect width="48" height="48" rx="12" fill="#2563EB" />
      <path d="M16 16c0-2 2-4 4-4h8c2 0 4 2 4 4v2H16v-2z" fill="white" />
      <rect x="14" y="18" width="20" height="16" rx="3" fill="white" />
      <path d="M20 26h8M22 30h4" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="38" r="3" fill="white" />
      <circle cx="30" cy="38" r="3" fill="white" />
    </svg>
  ),
  jumlaty: ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect width="48" height="48" rx="12" fill="#D97706" />
      <path d="M24 10l12 6v10c0 6-5 10-12 12-7-2-12-6-12-12V16l12-6z" fill="white" />
      <path d="M18 22l4 4 8-8" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  toyou: ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect width="48" height="48" rx="12" fill="#0284C7" />
      <circle cx="24" cy="24" r="10" fill="white" />
      <path d="M18 25l4 4 8-9" stroke="#0284C7" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  direct: ({ className = 'w-8 h-8' }) => (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <rect width="48" height="48" rx="12" fill="#4B5563" />
      <path d="M18 14h12l4 6v12a2 2 0 01-2 2H16a2 2 0 01-2-2V20l4-6z" fill="white" />
      <path d="M18 14l-4 6h20l-4-6" stroke="#4B5563" strokeWidth="1.5" />
      <circle cx="18" cy="34" r="2.5" fill="#4B5563" />
      <circle cx="30" cy="34" r="2.5" fill="#4B5563" />
    </svg>
  ),
}

export default function PlatformLogo({ platform, className }) {
  const Logo = logos[platform] || logos.direct
  return <Logo className={className} />
}
