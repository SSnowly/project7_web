import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Download, Upload, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import itemsData from '../data/items-data.json'
import type { Item } from '../types/api'

const ALL_ITEMS: Item[] = itemsData as Item[]

interface InvItem {
  slot: number
  name: string
  count: number
  metadata?: Record<string, unknown>
}

interface CtxMenu { slot: number; x: number; y: number }

export default function Database() {
  const [rawJson, setRawJson] = useState('')
  const [parseError, setParseError] = useState('')
  const [items, setItems] = useState<InvItem[]>([])
  const [maxSlots, setMaxSlots] = useState(41)
  const [columns, setColumns] = useState(5)
  const [imported, setImported] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [splitModal, setSplitModal] = useState<{ slot: number; max: number } | null>(null)
  const [splitAmount, setSplitAmount] = useState(1)
  const [changeSlot, setChangeSlot] = useState<number | null>(null)
  const [changeVal, setChangeVal] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addCount, setAddCount] = useState('1')
  const [addMeta, setAddMeta] = useState('')
  const [addSlot, setAddSlot] = useState('')
  const [suggestions, setSuggestions] = useState<Item[]>([])
  const [copied, setCopied] = useState(false)

  const imageMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of ALL_ITEMS) m.set(i.name.toLowerCase(), i.image)
    return m
  }, [])

  const slotMap = useMemo(() => {
    const m = new Map<number, InvItem>()
    for (const i of items) m.set(i.slot, i)
    return m
  }, [items])

  const nextFree = useCallback((exclude?: number) => {
    const used = new Set(items.map(i => i.slot))
    if (exclude !== undefined) used.delete(exclude)
    for (let i = 1; i <= maxSlots + 10; i++) if (!used.has(i)) return i
    return maxSlots + 1
  }, [items, maxSlots])

  const parseJson = () => {
    try {
      const data = JSON.parse(rawJson.trim())
      if (!Array.isArray(data)) throw new Error('Expected a JSON array')
      setItems(data as InvItem[])
      setParseError('')
      setImported(true)
    } catch (e) {
      setParseError(String(e))
    }
  }

  const exportJson = async () => {
    const sorted = [...items].sort((a, b) => a.slot - b.slot)
    await navigator.clipboard.writeText(JSON.stringify(sorted))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Drag
  const onDragStart = (slot: number) => setDragFrom(slot)
  const onDragEnd = () => { setDragFrom(null); setDragOver(null) }
  const onDragOver = (e: React.DragEvent, slot: number) => { e.preventDefault(); setDragOver(slot) }
  const onDrop = (toSlot: number) => {
    if (dragFrom === null || dragFrom === toSlot) { setDragOver(null); return }
    setItems(prev => {
      const from = prev.find(i => i.slot === dragFrom)
      const to = prev.find(i => i.slot === toSlot)
      if (!from) return prev
      // Stack same-name items
      if (to && to.name.toLowerCase() === from.name.toLowerCase()) {
        return prev.filter(i => i.slot !== dragFrom).map(i => i.slot === toSlot ? { ...i, count: i.count + from.count } : i)
      }
      // Swap
      return prev.map(i => {
        if (i.slot === dragFrom) return { ...i, slot: toSlot }
        if (i.slot === toSlot) return { ...i, slot: dragFrom }
        return i
      })
    })
    setDragOver(null)
  }

  // Context menu actions
  const deleteItem = (slot: number) => { setItems(p => p.filter(i => i.slot !== slot)); setCtxMenu(null) }

  const openChange = (slot: number) => {
    setChangeVal(String(slotMap.get(slot)?.count ?? 1))
    setChangeSlot(slot)
    setCtxMenu(null)
  }
  const applyChange = () => {
    const n = parseInt(changeVal)
    if (!isNaN(n) && n >= 0) {
      if (n === 0) setItems(p => p.filter(i => i.slot !== changeSlot))
      else setItems(p => p.map(i => i.slot === changeSlot ? { ...i, count: n } : i))
    }
    setChangeSlot(null)
  }

  const openSplit = (slot: number) => {
    const item = slotMap.get(slot)
    if (!item || item.count < 2) return
    setSplitAmount(Math.floor(item.count / 2))
    setSplitModal({ slot, max: item.count - 1 })
    setCtxMenu(null)
  }
  const applySplit = () => {
    if (!splitModal) return
    const item = slotMap.get(splitModal.slot)
    if (!item) return
    const free = nextFree()
    setItems(prev => [
      ...prev.filter(i => i.slot !== splitModal.slot),
      { ...item, count: item.count - splitAmount },
      { ...item, slot: free, count: splitAmount },
    ])
    setSplitModal(null)
  }

  // Add item
  const onAddName = (v: string) => {
    setAddName(v)
    if (v.length < 2) { setSuggestions([]); return }
    const lower = v.toLowerCase()
    setSuggestions(ALL_ITEMS.filter(i => i.name.includes(lower)).slice(0, 8))
  }

  const confirmAdd = () => {
    if (!addName.trim()) return
    let meta: Record<string, unknown> | undefined
    if (addMeta.trim()) {
      try { meta = JSON.parse(addMeta) } catch { setParseError('Invalid metadata JSON'); return }
    }
    const count = Math.max(1, parseInt(addCount) || 1)
    const slot = addSlot ? parseInt(addSlot) : nextFree()
    const actualSlot = slotMap.has(slot) ? nextFree() : slot
    setItems(p => [...p, { slot: actualSlot, name: addName.trim(), count, ...(meta ? { metadata: meta } : {}) }])
    setAddName(''); setAddCount('1'); setAddMeta(''); setAddSlot(''); setAddOpen(false); setSuggestions([])
  }

  const dismiss = () => setCtxMenu(null)

  const slots = useMemo(() => Array.from({ length: maxSlots }, (_, i) => i + 1), [maxSlots])

  // Slots that exceed maxSlots but have items
  const overflow = useMemo(() => items.filter(i => i.slot > maxSlots).sort((a, b) => a.slot - b.slot), [items, maxSlots])

  return (
    <div className="min-h-screen flex flex-col" onClick={dismiss}>
      <PageHeader title="Database Editor" />

      <div className="flex-1 p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">

        {!imported ? (
          /* ── Import screen ── */
          <div className="space-y-4">
            <p className="text-zinc-400">Paste the inventory JSON from your database</p>
            <textarea
              className="w-full h-44 px-4 py-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 text-zinc-300 font-mono text-xs resize-none focus:outline-none focus:border-zinc-700 transition-colors"
              placeholder={'[{"slot":1,"name":"money","count":500},...]'}
              value={rawJson}
              onChange={e => { setRawJson(e.target.value); setParseError('') }}
              onKeyDown={e => e.key === 'Enter' && e.ctrlKey && parseJson()}
            />
            {parseError && <p className="text-red-400 text-sm font-mono">{parseError}</p>}
            <button
              onClick={parseJson}
              className="px-6 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-700 transition-all"
            >
              Load Inventory
            </button>
          </div>
        ) : (
          <>
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">Slots</span>
                <input
                  type="number" min={1} value={maxSlots}
                  onChange={e => setMaxSlots(Math.max(1, parseInt(e.target.value) || 41))}
                  className="w-20 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800/50 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-zinc-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">Cols</span>
                <input
                  type="number" min={1} max={12} value={columns}
                  onChange={e => setColumns(Math.max(1, Math.min(12, parseInt(e.target.value) || 5)))}
                  className="w-16 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800/50 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-zinc-700"
                />
              </div>
              <button
                onClick={() => setAddOpen(true)}
                className="px-4 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm hover:bg-zinc-700 transition-all flex items-center gap-2"
              >
                <Plus size={14} /> Add Item
              </button>
              <button
                onClick={exportJson}
                className={`px-4 py-1.5 border rounded-lg text-sm transition-all flex items-center gap-2 ${copied ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300' : 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700'}`}
              >
                <Download size={14} /> {copied ? 'Copied!' : 'Copy JSON'}
              </button>
              <button
                onClick={() => { setImported(false); setItems([]); setRawJson(''); setParseError('') }}
                className="px-4 py-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-2"
              >
                <Upload size={14} /> Re-import
              </button>
              <span className="ml-auto text-xs text-zinc-600">{items.length} items / {maxSlots} slots</span>
            </div>

            {/* ── Grid ── */}
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {slots.map(slot => {
                const item = slotMap.get(slot)
                const img = item ? imageMap.get(item.name.toLowerCase()) : undefined
                return (
                  <div
                    key={slot}
                    className={`relative aspect-square rounded-lg border select-none transition-all ${
                      dragFrom === slot ? 'opacity-30 scale-95' :
                      dragOver === slot && dragFrom !== null ? 'border-zinc-400 bg-zinc-700/50 scale-[1.02]' :
                      item ? 'border-zinc-700/70 bg-zinc-800/50 hover:border-zinc-600 cursor-grab active:cursor-grabbing' :
                      'border-zinc-800/40 bg-zinc-900/20'
                    }`}
                    draggable={!!item}
                    onDragStart={() => item && onDragStart(slot)}
                    onDragEnd={onDragEnd}
                    onDragOver={e => onDragOver(e, slot)}
                    onDrop={() => onDrop(slot)}
                    onContextMenu={e => { if (!item) return; e.preventDefault(); e.stopPropagation(); setCtxMenu({ slot, x: e.clientX, y: e.clientY }) }}
                  >
                    <span className="absolute top-0.5 left-1 text-[9px] text-zinc-600 font-mono leading-none pointer-events-none">{slot}</span>
                    {item && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center p-2 pt-4">
                          {img
                            ? <img src={img} alt={item.name} loading="lazy" draggable={false} className="w-full h-full object-contain pointer-events-none" />
                            : <span className="text-[9px] text-zinc-400 font-mono text-center break-all leading-tight px-1 pointer-events-none">{item.name}</span>
                          }
                        </div>
                        {/* count badge */}
                        <span className="absolute bottom-0.5 right-1 text-[10px] text-zinc-200 font-mono leading-none pointer-events-none">
                          {item.count > 1 ? item.count : ''}
                        </span>
                        {/* name under image */}
                        {img && (
                          <span className="absolute bottom-0.5 left-1 text-[8px] text-zinc-600 leading-none truncate max-w-[65%] pointer-events-none">
                            {item.name}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Overflow items (slot > maxSlots) */}
            {overflow.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-amber-400 font-medium">Items outside slot range ({overflow.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {overflow.map(item => (
                    <div key={item.slot} className="px-3 py-1.5 bg-amber-900/20 border border-amber-700/30 rounded-lg text-xs font-mono text-amber-300 flex items-center gap-2">
                      <span className="text-amber-600">#{item.slot}</span>
                      {item.name}
                      <span className="text-amber-500">x{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Context menu ── */}
        <AnimatePresence>
          {ctxMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.08 }}
              className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden w-44"
              style={{ top: ctxMenu.y, left: ctxMenu.x }}
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const item = slotMap.get(ctxMenu.slot)
                return (
                  <>
                    {item && <div className="px-3 py-2 border-b border-zinc-800 text-xs text-zinc-500 font-mono truncate">{item.name}</div>}
                    <button onClick={() => openChange(ctxMenu.slot)} className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">Change Amount</button>
                    {(item?.count ?? 0) >= 2 && (
                      <button onClick={() => openSplit(ctxMenu.slot)} className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">Split Stack</button>
                    )}
                    <button onClick={() => deleteItem(ctxMenu.slot)} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/30 transition-colors">Delete</button>
                  </>
                )
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Change Amount modal ── */}
        <AnimatePresence>
          {changeSlot !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setChangeSlot(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-72 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-100 font-medium">Change Amount</h3>
                  <button onClick={() => setChangeSlot(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
                </div>
                <input type="number" min={0} value={changeVal} onChange={e => setChangeVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyChange()}
                  autoFocus
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-600" />
                <p className="text-xs text-zinc-500">Set to 0 to delete the item</p>
                <div className="flex gap-2">
                  <button onClick={applyChange} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-100 text-sm transition-all">Apply</button>
                  <button onClick={() => setChangeSlot(null)} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm">Cancel</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Split modal ── */}
        <AnimatePresence>
          {splitModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSplitModal(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-80 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-100 font-medium">Split Stack</h3>
                  <button onClick={() => setSplitModal(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
                </div>
                <div className="flex justify-between text-sm text-zinc-400">
                  <span>Keep <span className="text-zinc-100 font-mono">{splitModal.max + 1 - splitAmount}</span></span>
                  <span>Split off <span className="text-zinc-100 font-mono">{splitAmount}</span></span>
                </div>
                <input type="range" min={1} max={splitModal.max} value={splitAmount}
                  onChange={e => setSplitAmount(parseInt(e.target.value))}
                  className="w-full accent-zinc-400" />
                <div className="flex gap-2">
                  <button onClick={applySplit} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-100 text-sm transition-all">Split</button>
                  <button onClick={() => setSplitModal(null)} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm">Cancel</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Add Item modal ── */}
        <AnimatePresence>
          {addOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
              onClick={() => { setAddOpen(false); setSuggestions([]) }}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-96 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-100 font-medium">Add Item</h3>
                  <button onClick={() => { setAddOpen(false); setSuggestions([]) }} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
                </div>

                {/* Name with autocomplete */}
                <div className="relative space-y-1">
                  <label className="text-xs text-zinc-500">Item Name (spawn code)</label>
                  <input value={addName} onChange={e => onAddName(e.target.value)} autoFocus
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
                    placeholder="e.g. money, WEAPON_PISTOL" />
                  <AnimatePresence>
                    {suggestions.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="absolute z-10 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {suggestions.map(s => (
                          <button key={s.id} onClick={() => { setAddName(s.name); setSuggestions([]) }}
                            className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors">
                            <img src={s.image} alt={s.name} loading="lazy" className="w-6 h-6 object-contain flex-shrink-0" />
                            <span className="font-mono text-xs truncate">{s.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Amount</label>
                    <input type="number" min={1} value={addCount} onChange={e => setAddCount(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-zinc-600" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Slot (blank = auto)</label>
                    <input type="number" min={1} value={addSlot} onChange={e => setAddSlot(e.target.value)} placeholder="auto"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-500">Metadata JSON (optional)</label>
                  <textarea value={addMeta} onChange={e => setAddMeta(e.target.value)} rows={3}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 font-mono text-xs resize-none focus:outline-none focus:border-zinc-600"
                    placeholder='{"durability":100}' />
                </div>

                <div className="flex gap-2">
                  <button onClick={confirmAdd} disabled={!addName.trim()}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-100 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    Add Item
                  </button>
                  <button onClick={() => { setAddOpen(false); setSuggestions([]) }} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm">Cancel</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
