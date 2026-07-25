import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageHeader from '../components/PageHeader'

const cards = [
  {
    title: 'Shop Editor',
    description: 'Build and edit ox_inventory shop configs with a visual editor',
    href: '/inventory/shop',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: 'Crafting Editor',
    description: 'Design crafting station configs with recipes and station placement',
    href: '/inventory/crafting',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    title: 'Database Editor',
    description: 'Load raw inventory JSON from the DB, edit items visually, and export back',
    href: '/inventory/database',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
]

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const cardAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

export default function Inventory() {
  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader title="Inventory Tools" />
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl"
        >
          {cards.map(card => (
            <motion.div key={card.href} variants={cardAnim}>
              <Link to={card.href} className="group block h-full">
                <div className="relative h-full bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm rounded-lg border border-zinc-800/50 p-6 overflow-hidden transition-all hover:border-zinc-700/50 hover:ring-1 hover:ring-zinc-700/50">
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/50 to-zinc-900/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="inline-flex p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30 mb-4 text-zinc-400 group-hover:text-zinc-300 transition-colors">
                      {card.icon}
                    </div>
                    <h2 className="text-lg font-medium mb-2 text-zinc-200 group-hover:text-zinc-100 transition-colors">{card.title}</h2>
                    <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">{card.description}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
