import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Copy, Check, X, Package, ChevronDown, ChevronRight, ArrowUp } from 'lucide-react'
import JSZip from 'jszip'
import PageHeader from '../components/PageHeader'
import type { Item } from '../types/api'
import itemsData from '../data/items-data.json'

type Game = 'fivem' | 'redm'
type Format = 'png' | 'webp' | 'jpg'
type Template = 'ox' | 'qb' | 'qs'
type CopiedState = { itemId: string; template: Template } | null

const ALL_ITEMS: Item[] = itemsData as Item[]
const PAGE_SIZE = 100

async function convertImage(url: string, format: Format): Promise<Blob> {
  const resp = await fetch(url)
  const srcBlob = await resp.blob()
  if (format === 'png') return srcBlob
  const bitmap = await createImageBitmap(srcBlob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error('conversion failed'))),
      format === 'jpg' ? 'image/jpeg' : 'image/webp', 0.92)
  )
}

function buildConfig(item: Item, template: Template): string {
  const label = item.label
  const name = item.name
  if (template === 'ox') {
    return `['${name}'] = {\n    label = '${label}',\n    weight = 500,\n    stack = true,\n    close = true,\n},`
  }
  if (template === 'qb') {
    return `['${name}'] = {\n    name = '${name}',\n    label = '${label}',\n    weight = 500,\n    type = 'item',\n    image = '${name}.png',\n    unique = false,\n    useable = true,\n    shouldClose = true,\n    combinable = nil,\n    description = 'A ${label.toLowerCase()}'\n},`
  }
  return `['${name}'] = {\n    label = '${label}',\n    weight = 500,\n    type = 'item',\n    image = '${name}.png',\n    unique = false,\n    useable = true,\n    shouldClose = true,\n    description = 'A ${label.toLowerCase()}'\n},`
}

export default function Items() {
  const [game, setGame] = useState<Game>('fivem')
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [downloadFormat, setDownloadFormat] = useState<Format>('png')
  const [showFormatDropdown, setShowFormatDropdown] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState<string | null>(null)
  const [showBulkDropdown, setShowBulkDropdown] = useState(false)
  const [copiedState, setCopiedState] = useState<CopiedState>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null)
  const [bulkTemplate, setBulkTemplate] = useState<Template | null>(null)
  const [bulkConfig, setBulkConfig] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkCopied, setBulkCopied] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [showScrollTop, setShowScrollTop] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { rootCategories, childrenOf, vehicleCategories } = useMemo(() => {
    const items = ALL_ITEMS.filter(i => i.game === game)
    // Build parent→children map from consecutive category pairs
    const childrenOf = new Map<string, Set<string>>()
    const hasParent = new Set<string>()
    for (const item of items) {
      for (let i = 0; i < item.categories.length - 1; i++) {
        const parent = item.categories[i]
        const child = item.categories[i + 1]
        if (!childrenOf.has(parent)) childrenOf.set(parent, new Set())
        childrenOf.get(parent)!.add(child)
        hasParent.add(child)
      }
    }
    const allCats = Array.from(new Set(items.flatMap(i => i.categories))).sort()
    const multiChar = allCats.filter(c => c.length > 1)
    return {
      rootCategories: multiChar.filter(c => !hasParent.has(c)),
      childrenOf,
      vehicleCategories: allCats.filter(c => c.length === 1),
    }
  }, [game])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return ALL_ITEMS.filter(item => {
      if (item.game !== game) return false
      if (selectedCategories.length > 0 && !item.categories.some(c => selectedCategories.includes(c))) return false
      if (q && !item.name.includes(q) && !item.label.toLowerCase().includes(q)) return false
      return true
    })
  }, [game, search, selectedCategories])

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filtered])

  // Infinite scroll via Intersection Observer
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(n => Math.min(n + PAGE_SIZE, filtered.length))
      }
    }, { rootMargin: '300px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [filtered.length])

  const visible = filtered.slice(0, visibleCount)

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(filtered.map(i => i.id)))
  const clearSelection = () => setSelectedIds(new Set())

  // Scroll-to-top visibility
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const switchGame = (g: Game) => {
    setGame(g)
    setSelectedCategories([])
    setSelectedIds(new Set())
    setExpandedCategories(new Set())
  }

  const toggleExpanded = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const downloadSingle = async (item: Item, fmt: Format) => {
    setDownloadingId(item.id)
    try {
      const blob = await convertImage(item.image, fmt)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.name}.${fmt === 'jpg' ? 'jpg' : fmt}`
      a.click()
      URL.revokeObjectURL(url)
      setTimeout(() => setDownloadingId(null), 2000)
    } catch {
      setDownloadingId(null)
    }
  }

  const downloadZip = useCallback(async () => {
    const items = filtered.filter(i => selectedIds.has(i.id))
    if (!items.length) return
    const zip = new JSZip()
    const ext = downloadFormat === 'jpg' ? 'jpg' : downloadFormat
    setZipProgress({ current: 0, total: items.length })
    for (let i = 0; i < items.length; i++) {
      try {
        const blob = await convertImage(items[i].image, downloadFormat)
        zip.file(`${items[i].name}.${ext}`, blob)
      } catch { /* skip failed */ }
      setZipProgress({ current: i + 1, total: items.length })
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'project7-items.zip'
    a.click()
    URL.revokeObjectURL(url)
    setZipProgress(null)
  }, [filtered, selectedIds, downloadFormat])

  const copySingleTemplate = async (item: Item, template: Template) => {
    const config = buildConfig(item, template)
    await navigator.clipboard.writeText(config)
    setCopiedState({ itemId: item.id, template })
    setTimeout(() => setCopiedState(null), 2000)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fallback for non-secure context
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    }
  }

  const openBulkConfig = async (template: Template) => {
    const items = filtered.filter(i => selectedIds.has(i.id))
    const config = items.map(item => buildConfig(item, template)).join('\n\n')
    setBulkConfig(config)
    setBulkTemplate(template)
    setBulkCopied(false)
    setShowBulkModal(true)
    setShowBulkDropdown(false)
    const ok = await copyToClipboard(config)
    setBulkCopied(ok)
  }

  const selectedCount = selectedIds.size

  return (
    <div className="min-h-screen flex flex-col" onClick={() => {
      setShowFormatDropdown(null)
      setShowTemplates(null)
      setShowBulkDropdown(false)
    }}>
      <PageHeader title="Item Images" />

      <div className="flex-1 flex w-full px-6 md:px-8 gap-6">
        {/* Left sidebar - sticky filters */}
        <aside className="w-56 flex-shrink-0">
          <div className="sticky top-20 space-y-4 py-6 max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
            {/* Game toggle */}
            <div className="flex gap-1 p-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
              {(['fivem', 'redm'] as Game[]).map(g => (
                <button
                  key={g}
                  onClick={() => switchGame(g)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    game === g
                      ? 'bg-zinc-800 text-zinc-100 shadow'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  {g === 'fivem' ? 'FiveM' : 'RedM'}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              ref={searchRef}
              type="text"
              placeholder="Search items..."
              className="w-full px-3 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 focus:outline-none transition-all text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />

            {/* Categories with subcategory expand */}
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider px-1 mb-1">Categories</p>
              {rootCategories.map(cat => {
                const children = childrenOf.get(cat)
                const hasChildren = children && children.size > 0
                const isExpanded = expandedCategories.has(cat)
                const isSelected = selectedCategories.includes(cat)
                return (
                  <div key={cat}>
                    <div className={`flex items-center rounded-lg transition-all ${isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-900/50'}`}>
                      <button
                        onClick={() => toggleCategory(cat)}
                        className={`flex-1 text-left px-3 py-1.5 text-sm font-medium transition-colors ${isSelected ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-300'}`}
                      >
                        {cat}
                      </button>
                      {hasChildren && (
                        <button
                          onClick={() => toggleExpanded(cat)}
                          className="pr-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </div>
                    <AnimatePresence>
                      {hasChildren && isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden pl-3 border-l border-zinc-800 ml-3 mt-0.5 mb-0.5 space-y-0.5"
                        >
                          {Array.from(children!).sort().map(child => (
                            <button
                              key={child}
                              onClick={() => toggleCategory(child)}
                              className={`w-full text-left px-3 py-1 rounded-lg text-sm transition-all ${
                                selectedCategories.includes(child)
                                  ? 'bg-zinc-800 text-zinc-100'
                                  : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                              }`}
                            >
                              {child}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Vehicle letter groups */}
            {vehicleCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider px-1">Vehicles</p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {vehicleCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium uppercase transition-all ${
                        selectedCategories.includes(cat)
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 py-6 space-y-4 min-w-0">
          {/* Results count + select all */}
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>{filtered.length} items{visibleCount < filtered.length ? ` (showing ${visibleCount})` : ''}</span>
            <div className="flex items-center gap-3">
              {selectedCount > 0 && (
                <button onClick={clearSelection} className="hover:text-zinc-300 transition-colors">
                  Clear ({selectedCount})
                </button>
              )}
              <button onClick={selectAll} className="hover:text-zinc-300 transition-colors">
                Select all
              </button>
            </div>
          </div>

          {/* Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {visible.map(item => {
                const isSelected = selectedIds.has(item.id)
                const isDownloading = downloadingId === item.id
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`group relative bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm rounded-lg border p-4 space-y-4 transition-all ${
                      isSelected
                        ? 'border-zinc-600 ring-1 ring-zinc-600/50'
                        : 'border-zinc-800/50 hover:border-zinc-700/50 hover:ring-1 hover:ring-zinc-700/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(item.id)}
                      className={`absolute top-3 right-3 w-5 h-5 rounded border flex items-center justify-center transition-all z-10 ${
                        isSelected
                          ? 'bg-zinc-600 border-zinc-500 opacity-100'
                          : 'bg-zinc-900/80 border-zinc-700 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-zinc-100" />}
                    </button>

                    {/* Image */}
                    <div
                      className="aspect-square bg-zinc-800/30 rounded-lg p-4 flex items-center justify-center cursor-pointer"
                      onClick={() => toggleSelect(item.id)}
                    >
                      <img
                        src={item.image}
                        alt={item.label}
                        loading="lazy"
                        decoding="async"
                        className="w-32 h-32 object-contain transition-transform group-hover:scale-105"
                      />
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="text-base font-medium text-zinc-100 truncate">{item.label}</h3>
                      <p className="text-zinc-400 text-sm font-mono truncate">{item.name}</p>
                      <span className="inline-block px-2 py-0.5 bg-zinc-800/30 border border-zinc-700/30 rounded-md text-xs mt-1.5 text-zinc-300">
                        {item.categories[item.categories.length - 1]}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Download dropdown */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setShowFormatDropdown(prev => prev === item.id ? null : item.id)}
                          className={`w-full px-2 py-2 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
                            isDownloading
                              ? 'bg-emerald-500/10 border-emerald-700/30 text-emerald-300'
                              : 'bg-zinc-800/30 border-zinc-700/30 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          {isDownloading ? <Check size={13} /> : <Download size={13} />}
                          <span className="text-xs">{isDownloading ? 'Done!' : 'Download'}</span>
                          {!isDownloading && <ChevronDown size={13} />}
                        </button>

                        <AnimatePresence>
                          {showFormatDropdown === item.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute bottom-full mb-1 left-0 right-0 bg-zinc-900 rounded-lg border border-zinc-800 shadow-lg overflow-hidden z-20"
                            >
                              {(['png', 'webp', 'jpg'] as Format[]).map(fmt => (
                                <button
                                  key={fmt}
                                  onClick={() => {
                                    setShowFormatDropdown(null)
                                    downloadSingle(item, fmt)
                                  }}
                                  className="w-full px-3 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-800 transition-colors uppercase"
                                >
                                  {fmt}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Config copy */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setShowTemplates(prev => prev === item.id ? null : item.id)}
                          className="w-full px-2 py-2 rounded-lg text-sm font-medium bg-zinc-800/30 border border-zinc-700/30 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Copy size={13} />
                          <span className="text-xs">Copy</span>
                          <ChevronDown size={13} />
                        </button>

                        <AnimatePresence>
                          {showTemplates === item.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute bottom-full mb-1 left-0 right-0 bg-zinc-900 rounded-lg border border-zinc-800 shadow-lg overflow-hidden z-20"
                            >
                              {(['ox', 'qb', 'qs'] as Template[]).map(template => (
                                <button
                                  key={template}
                                  onClick={() => copySingleTemplate(item, template)}
                                  className={`w-full px-3 py-2 text-sm font-medium text-left hover:bg-zinc-800 transition-colors flex items-center gap-2 ${
                                    copiedState?.itemId === item.id && copiedState?.template === template
                                      ? 'text-emerald-400'
                                      : 'text-zinc-300'
                                  }`}
                                >
                                  {copiedState?.itemId === item.id && copiedState?.template === template
                                    ? <Check size={13} />
                                    : <Copy size={13} />
                                  }
                                  <span className="uppercase">{template}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>

          {/* Intersection sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-4" />
        </div>
      </div>

      {/* Sticky bulk toolbar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800 px-6 py-4"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-zinc-300 mr-2">
                {selectedCount} selected
              </span>

              {/* Format picker */}
              <div className="flex gap-1 p-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                {(['png', 'webp', 'jpg'] as Format[]).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setDownloadFormat(fmt)}
                    className={`px-3 py-1 rounded-md text-xs font-medium uppercase transition-all ${
                      downloadFormat === fmt
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {/* ZIP download */}
              <button
                onClick={downloadZip}
                disabled={!!zipProgress}
                className="px-4 py-2 text-sm font-medium bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg hover:bg-zinc-700 transition-all inline-flex items-center gap-2 disabled:opacity-60"
              >
                <Download size={14} />
                {zipProgress
                  ? `Zipping ${zipProgress.current} / ${zipProgress.total}…`
                  : `Download ZIP (${downloadFormat.toUpperCase()})`
                }
              </button>

              {/* Bulk config dropdown */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setShowBulkDropdown(p => !p)}
                  className="px-4 py-2 text-sm font-medium bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-all inline-flex items-center gap-2"
                >
                  <Copy size={14} />
                  Copy Config
                  <ChevronDown size={14} />
                </button>
                <AnimatePresence>
                  {showBulkDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-full mb-2 left-0 bg-zinc-900 rounded-lg border border-zinc-800 shadow-lg overflow-hidden z-20 w-36"
                    >
                      {(['ox', 'qb', 'qs'] as Template[]).map(t => (
                        <button
                          key={t}
                          onClick={() => openBulkConfig(t)}
                          className="w-full px-4 py-2.5 text-sm font-medium text-left text-zinc-300 hover:bg-zinc-800 transition-colors uppercase"
                        >
                          {t} inventory
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={clearSelection} className="ml-auto p-2 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll to top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors flex items-center justify-center shadow-lg"
          >
            <ArrowUp size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bulk config modal */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowBulkModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl bg-zinc-900 rounded-lg border border-zinc-800 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-zinc-400" />
                  <h2 className="text-sm font-medium text-zinc-100">
                    {bulkTemplate?.toUpperCase()} config for {selectedCount} items
                  </h2>
                  {bulkCopied && <span className="text-xs text-emerald-400">Copied to clipboard!</span>}
                </div>
                <button onClick={() => setShowBulkModal(false)} className="p-1 text-zinc-500 hover:text-zinc-300">
                  <X size={18} />
                </button>
              </div>
              <textarea
                readOnly
                value={bulkConfig}
                className="w-full h-96 p-4 font-mono text-xs text-zinc-300 bg-zinc-950 resize-none focus:outline-none"
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="flex justify-end gap-2 p-3 border-t border-zinc-800">
                <button
                  onClick={async () => { const ok = await copyToClipboard(bulkConfig); setBulkCopied(ok) }}
                  className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-all inline-flex items-center gap-2"
                >
                  <Copy size={14} />
                  {bulkCopied ? 'Copied!' : 'Copy to clipboard'}
                </button>
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
