import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

type Tab = {
  id: string
  label: string
  isActive: boolean
  onClick: () => void
}

type PageHeaderProps = {
  title: string
  tabs?: Tab[]
  actions?: React.ReactNode
}

export default function PageHeader({ title, tabs, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800/50 mb-6">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between py-4 px-6 md:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-100">{title}</h1>
          </div>
          {actions}
        </div>

        {tabs && (
          <div className="flex gap-6 px-6 md:px-8 pb-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={tab.onClick}
                className={`text-sm font-medium transition-all relative ${
                  tab.isActive ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {tab.label}
                {tab.isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-zinc-100 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
