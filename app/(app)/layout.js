'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function AppLayout({ children }) {
  const pathname = usePathname()

  const tabs = [
    { href: '/chat', label: 'Chat', icon: '💬' },
    { href: '/profile', label: 'Profile', icon: '👤' },
    { href: '/summary', label: 'Summary', icon: '📋' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      
      {/* Enhanced Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50 shadow-sm">
        <div className="flex max-w-2xl mx-auto px-2">
          {tabs.map(tab => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all duration-200"
              >
                {/* Micro-container for active state icon */}
                <span className={`text-xl px-4 py-1 rounded-full transition-all ${
                  active ? 'bg-emerald-50 scale-105' : 'bg-transparent'
                }`}>
                  {tab.icon}
                </span>
                
                <span className={`text-[11px] font-semibold tracking-wide transition-colors duration-200 ${
                  active ? 'text-emerald-600' : 'text-gray-400'
                }`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}