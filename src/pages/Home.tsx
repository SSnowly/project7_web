import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const cards = [
  {
    title: 'GTA V Hash Finder',
    description: 'Look up GTA V object hashes and model names',
    href: '/hash',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
  {
    title: 'FiveM / RedM Item Images',
    description: 'Thousands of item images for FiveM and RedM inventories',
    href: '/items',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    title: 'FiveM Inventory Editor',
    description: "Edit your shop and crafting station Lua configs with a simple visual editor.",
    href: '/inventory',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  }
]

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16 space-y-4"
      >
        <h1 className="text-4xl font-medium tracking-tight text-zinc-100">Project7 Creations</h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
          A collection of useful tools for FiveM development and server management
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-7xl"
      >
        {cards.map(card => (
          <motion.div key={card.href} variants={item}>
            <Link to={card.href} className="group block h-full">
              <div className="relative h-full bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm rounded-lg border border-zinc-800/50 p-6 overflow-hidden transition-all hover:border-zinc-700/50 hover:ring-1 hover:ring-zinc-700/50">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/50 to-zinc-900/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="inline-flex p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30 mb-4 text-zinc-400 group-hover:text-zinc-300 transition-colors">
                    {card.icon}
                  </div>
                  <h2 className="text-xl font-medium mb-2 text-zinc-200 group-hover:text-zinc-100 transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-zinc-400 group-hover:text-zinc-300 transition-colors">{card.description}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
