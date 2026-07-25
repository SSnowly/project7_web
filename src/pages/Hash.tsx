import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageHeader from '../components/PageHeader'

function joaat(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash += str.charCodeAt(i)
    hash += hash << 10
    hash ^= hash >>> 6
  }
  hash += hash << 3
  hash ^= hash >>> 11
  hash += hash << 15
  return hash >>> 0
}

type Source = 'object' | 'ped' | 'vehicle' | 'weapon'
type Match = { name: string; source: Source }
type HashResult = { input: string; hash: number; matches: Match[] }

const SOURCE_LABELS: Record<Source, string> = {
  object: 'Object',
  ped: 'Ped',
  vehicle: 'Vehicle',
  weapon: 'Weapon',
}

const SOURCE_COLORS: Record<Source, string> = {
  object:  'bg-zinc-700/50 text-zinc-300 border-zinc-600/50',
  ped:     'bg-blue-900/40 text-blue-300 border-blue-700/40',
  vehicle: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  weapon:  'bg-red-900/40 text-red-300 border-red-700/40',
}

// Parse ObjectList.ini: lines like [name] or plain name
function parseObjectList(text: string): string[] {
  return text.split('\n')
    .map(l => l.trim().replace(/^\[|\]$/g, ''))
    .filter(Boolean)
}

// Parse name=hash files (PedList, VehicleList, WeaponList)
function parseNameHashList(text: string): string[] {
  return text.split('\n')
    .map(l => l.trim().split('=')[0].trim())
    .filter(Boolean)
}

export default function Hash() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HashResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null)

  const listsRef = useRef<Record<Source, string[]> | null>(null)

  const loadLists = async (): Promise<Record<Source, string[]>> => {
    if (listsRef.current) return listsRef.current
    const [objText, pedText, vehText, wepText] = await Promise.all([
      fetch('/ObjectList.ini').then(r => r.text()),
      fetch('/PedList.ini').then(r => r.text()),
      fetch('/VehicleList.ini').then(r => r.text()),
      fetch('/WeaponList.ini').then(r => r.text()),
    ])
    const lists: Record<Source, string[]> = {
      object:  parseObjectList(objText),
      ped:     parseNameHashList(pedText),
      vehicle: parseNameHashList(vehText),
      weapon:  parseNameHashList(wepText),
    }
    listsRef.current = lists
    return lists
  }

  const copyMatch = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(key)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const searchHash = async () => {
    const q = query.trim()
    if (!q) return
    setIsLoading(true)
    setError('')
    try {
      const lists = await loadLists()
      const parts = q.split(',').map(s => s.trim()).filter(Boolean)
      const out: HashResult[] = []

      for (const part of parts) {
        const asNum = parseInt(part, part.startsWith('0x') ? 16 : 10)
        const isNum = !isNaN(asNum) && part !== ''
        const matches: Match[] = []

        for (const [src, names] of Object.entries(lists) as [Source, string[]][]) {
          if (isNum) {
            for (const name of names) {
              if (joaat(name.toLowerCase()) === asNum) matches.push({ name, source: src })
            }
          } else {
            const lower = part.toLowerCase()
            for (const name of names) {
              if (name.toLowerCase().includes(lower)) matches.push({ name, source: src })
            }
          }
        }

        out.push({
          input: part,
          hash: isNum ? asNum : joaat(part.toLowerCase()),
          matches,
        })
      }

      setResults(out)
    } catch {
      setError('Failed to load hash lists. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader title="Hash Finder" />

      <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Search bar */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Name, hash, or hex… separate multiple with commas"
              className="flex-1 px-4 py-2.5 bg-zinc-900/50 rounded-lg border border-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 focus:outline-none transition-all"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchHash()}
            />
            <button
              onClick={searchHash}
              disabled={isLoading}
              className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 hover:bg-zinc-800/50 hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-100 rounded-full animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </>
              )}
            </button>
          </div>

          {/* Source legend */}
          <div className="flex flex-wrap gap-2 text-xs">
            {(Object.entries(SOURCE_LABELS) as [Source, string][]).map(([src, label]) => (
              <span key={src} className={`px-2 py-1 rounded border font-medium ${SOURCE_COLORS[src]}`}>
                {label}
              </span>
            ))}
            <span className="text-zinc-500 self-center ml-1 text-xs">all lists searched simultaneously</span>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-zinc-500 border-t-zinc-100 rounded-full animate-spin" />
              </motion.div>
            ) : (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {results.map((result, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-6 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm rounded-lg border border-zinc-800/50 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-zinc-500 mb-0.5">Input</p>
                        <p className="text-zinc-100 font-mono">{result.input}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-zinc-500 mb-0.5">JOAAT Hash</p>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-zinc-100 font-mono">{result.hash}</span>
                          <span className="text-zinc-500 font-mono text-sm">0x{result.hash.toString(16).toUpperCase().padStart(8, '0')}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-zinc-500 mb-2">
                        {result.matches.length ? `${result.matches.length} match${result.matches.length !== 1 ? 'es' : ''}` : 'No matches found in any list'}
                      </p>
                      {result.matches.length > 0 && (
                        <div className="space-y-1.5">
                          {result.matches.map((match, mi) => {
                            const key = `${i}-${mi}`
                            return (
                              <div
                                key={mi}
                                className="group px-3 py-2 bg-zinc-800/30 border border-zinc-700/30 rounded-lg flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium border ${SOURCE_COLORS[match.source]}`}>
                                    {SOURCE_LABELS[match.source]}
                                  </span>
                                  <span className="font-mono text-zinc-300 truncate">{match.name}</span>
                                </div>
                                <button
                                  onClick={() => copyMatch(match.name, key)}
                                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 px-3 py-1 bg-zinc-800 rounded-md hover:bg-zinc-700 transition-all text-sm text-zinc-300"
                                >
                                  {copiedIdx === key ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
