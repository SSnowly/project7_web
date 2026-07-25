import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import BlipSelector from '../components/BlipSelector'
import ErrorToast from '../components/ErrorToast'

interface Vec3 { x: number; y: number; z: number }
interface Zone { label?: string; icon?: string; coords: Vec3; size: Vec3; distance: number; rotation: number }
interface CraftingIngredient { [key: string]: number }
type MetadataValue = string | number | boolean
interface CraftingItemMetadata { [key: string]: MetadataValue }
interface CraftingItem {
  name: string
  ingredients: CraftingIngredient
  duration: number
  count: number | { min: number; max: number }
  metadata?: CraftingItemMetadata
}
interface CraftingStation {
  name: string
  items: CraftingItem[]
  points: Vec3[]
  zones: Zone[]
  blip: { id: number; colour: number; scale: number }
}

function findBlockEnd(code: string, start: number): number {
  let braceCount = 1
  for (let i = start + 1; i < code.length; i++) {
    if (code[i] === '{') braceCount++
    if (code[i] === '}') braceCount--
    if (braceCount === 0) return i
  }
  return -1
}

function parseIngredients(content: string): CraftingIngredient {
  const ingredients: CraftingIngredient = {}
  for (const pair of content.split(',')) {
    const [key, value] = pair.split('=').map(s => s.trim())
    if (key && value) ingredients[key] = parseFloat(value)
  }
  return ingredients
}

function extractItems(itemsContent: string): CraftingItem[] {
  const items: CraftingItem[] = []
  let currentIndex = 0
  while (currentIndex < itemsContent.length) {
    const itemStart = itemsContent.indexOf('{', currentIndex)
    if (itemStart === -1) break
    const itemEnd = findBlockEnd(itemsContent, itemStart)
    if (itemEnd === -1) break
    const itemBlock = itemsContent.slice(itemStart, itemEnd + 1)
    currentIndex = itemEnd + 1
    const nameMatch = itemBlock.match(/name\s*=\s*['"]([^'"]+)['"]/)
    if (!nameMatch) continue
    const ingredientsMatch = itemBlock.match(/ingredients\s*=\s*{([^}]+)}/)
    const countMatch = itemBlock.match(/count\s*=\s*{?\s*(\d+)(?:\s*,\s*(\d+))?\s*}?/)
    items.push({
      name: nameMatch[1],
      ingredients: ingredientsMatch ? parseIngredients(ingredientsMatch[1]) : {},
      duration: parseInt(itemBlock.match(/duration\s*=\s*(\d+)/)?.[1] || '0'),
      count: countMatch?.[2]
        ? { min: parseInt(countMatch[1]), max: parseInt(countMatch[2]) }
        : parseInt(countMatch?.[1] || '1')
    })
  }
  return items
}

function extractVec3(content: string): Vec3[] {
  const points: Vec3[] = []
  for (const m of content.matchAll(/vec3\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/g)) {
    points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) })
  }
  return points
}

function extractZones(zonesContent: string): Zone[] {
  const zones: Zone[] = []
  const content = zonesContent.replace(/^zones\s*=\s*{/, '').replace(/}\s*$/, '').trim()
  let currentIndex = 0
  while (currentIndex < content.length) {
    const zoneStart = content.indexOf('{', currentIndex)
    if (zoneStart === -1) break
    const zoneEnd = findBlockEnd(content, zoneStart)
    if (zoneEnd === -1) break
    const zoneBlock = content.slice(zoneStart, zoneEnd + 1)
    currentIndex = zoneEnd + 1
    const coordsMatch = zoneBlock.match(/coords\s*=\s*vec3\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/)
    const sizeMatch = zoneBlock.match(/size\s*=\s*vec3\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/)
    const distanceMatch = zoneBlock.match(/distance\s*=\s*([-\d.]+)/)
    const rotationMatch = zoneBlock.match(/rotation\s*=\s*([-\d.]+)/)
    if (coordsMatch && sizeMatch && distanceMatch && rotationMatch) {
      const zone: Zone = {
        coords: { x: parseFloat(coordsMatch[1]), y: parseFloat(coordsMatch[2]), z: parseFloat(coordsMatch[3]) },
        size: { x: parseFloat(sizeMatch[1]), y: parseFloat(sizeMatch[2]), z: parseFloat(sizeMatch[3]) },
        distance: parseFloat(distanceMatch[1]),
        rotation: parseFloat(rotationMatch[1])
      }
      const labelMatch = zoneBlock.match(/label\s*=\s*['"]([^'"]+)['"]/)
      const iconMatch = zoneBlock.match(/icon\s*=\s*['"]([^'"]+)['"]/)
      if (labelMatch) zone.label = labelMatch[1]
      if (iconMatch) zone.icon = iconMatch[1]
      zones.push(zone)
    }
  }
  return zones
}

function extractCraftingData(luaCode: string): CraftingStation[] {
  try {
    luaCode = luaCode.replace(/^return\s*/, '').trim()
    const stations: CraftingStation[] = []
    let currentIndex = 0
    while (currentIndex < luaCode.length) {
      const stationStart = luaCode.indexOf('{', currentIndex)
      if (stationStart === -1) break
      let braceCount = 1
      let stationEnd = stationStart + 1
      for (let i = stationStart + 1; i < luaCode.length; i++) {
        if (luaCode[i] === '{') braceCount++
        if (luaCode[i] === '}') braceCount--
        if (braceCount === 0) { stationEnd = i; break }
      }
      const stationBlock = luaCode.slice(stationStart, stationEnd + 1)
      currentIndex = stationEnd + 1
      const nameMatch = stationBlock.match(/name\s*=\s*['"]([^'"]+)['"]/)
      const station: CraftingStation = {
        name: nameMatch ? nameMatch[1] : '',
        items: [],
        points: [],
        zones: [],
        blip: { id: 566, colour: 31, scale: 0.8 }
      }
      const itemsStart = stationBlock.indexOf('items = {')
      if (itemsStart !== -1) {
        const itemsEnd = findBlockEnd(stationBlock, itemsStart)
        station.items = extractItems(stationBlock.slice(itemsStart, itemsEnd + 1))
      }
      const pointsMatch = stationBlock.match(/points\s*=\s*{([\s\S]*?)}/)
      if (pointsMatch) station.points = extractVec3(pointsMatch[1])
      const zonesStart = stationBlock.indexOf('zones = {')
      if (zonesStart !== -1) {
        const zonesEnd = findBlockEnd(stationBlock, zonesStart)
        station.zones = extractZones(stationBlock.slice(zonesStart, zonesEnd + 1))
      }
      const blipMatch = stationBlock.match(/blip\s*=\s*{\s*id\s*=\s*(\d+),\s*colour\s*=\s*(\d+),\s*scale\s*=\s*([\d.]+)\s*}/)
      if (blipMatch) station.blip = { id: parseInt(blipMatch[1]), colour: parseInt(blipMatch[2]), scale: parseFloat(blipMatch[3]) }
      stations.push(station)
    }
    return stations
  } catch { return [] }
}

function validateIngredientValue(value: number): number {
  if (isNaN(value) || value < 0) return 0
  return value >= 1 ? Math.round(value) : parseFloat(value.toFixed(4))
}

export default function Crafting() {
  const [stations, setStations] = useState<CraftingStation[]>([])
  const [selectedStation, setSelectedStation] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showNewStationForm, setShowNewStationForm] = useState(false)
  const [newStationName, setNewStationName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [showBlipSelector, setShowBlipSelector] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateExportCode = useCallback((): string => {
    const fv = (v: Vec3) => `vec3(${v.x}, ${v.y}, ${v.z})`
    let code = 'return {\n'
    for (const station of stations) {
      code += '\t{\n'
      code += `\t\tname = '${station.name}',\n`
      code += '\t\titems = {\n'
      for (const item of station.items) {
        code += '\t\t\t{\n'
        code += `\t\t\t\tname = '${item.name}',\n`
        code += '\t\t\t\tingredients = {\n'
        for (const [k, v] of Object.entries(item.ingredients)) code += `\t\t\t\t\t${k} = ${v},\n`
        code += '\t\t\t\t},\n'
        code += `\t\t\t\tduration = ${item.duration},\n`
        if (typeof item.count === 'number') code += `\t\t\t\tcount = ${item.count},\n`
        else code += `\t\t\t\tcount = { ${item.count.min}, ${item.count.max} },\n`
        if (item.metadata) {
          code += '\t\t\t\tmetadata = {\n'
          for (const [k, v] of Object.entries(item.metadata)) code += `\t\t\t\t\t${k} = ${typeof v === 'string' ? `'${v}'` : v},\n`
          code += '\t\t\t\t},\n'
        }
        code += '\t\t\t},\n'
      }
      code += '\t\t},\n'
      code += '\t\tpoints = {\n'
      for (const p of station.points) code += `\t\t\t${fv(p)},\n`
      code += '\t\t},\n'
      code += '\t\tzones = {\n'
      for (const z of station.zones) {
        code += '\t\t\t{\n'
        if (z.label) code += `\t\t\t\tlabel = '${z.label}',\n`
        if (z.icon) code += `\t\t\t\ticon = '${z.icon}',\n`
        code += `\t\t\t\tcoords = ${fv(z.coords)},\n`
        code += `\t\t\t\tsize = ${fv(z.size)},\n`
        code += `\t\t\t\tdistance = ${z.distance},\n`
        code += `\t\t\t\trotation = ${z.rotation},\n`
        code += '\t\t\t},\n'
      }
      code += '\t\t},\n'
      code += `\t\tblip = { id = ${station.blip.id}, colour = ${station.blip.colour}, scale = ${station.blip.scale} },\n`
      code += '\t},\n'
    }
    code += '}'
    return code
  }, [stations])

  const exportFile = useCallback(() => {
    const code = generateExportCode()
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'crafting.lua'; a.click()
    URL.revokeObjectURL(url)
  }, [generateExportCode])

  useEffect(() => {
    const handler = () => exportFile()
    document.addEventListener('export-data', handler)
    return () => document.removeEventListener('export-data', handler)
  }, [exportFile])

  const addNewStation = () => {
    if (!newStationName.trim()) return
    if (stations.some(s => s.name === newStationName)) { setNameError('A crafting table with this name already exists'); return }
    const s: CraftingStation = { name: newStationName, items: [], points: [], zones: [], blip: { id: 566, colour: 31, scale: 0.8 } }
    setStations(prev => { const next = [...prev, s]; setSelectedStation(next.length - 1); return next })
    setNewStationName(''); setShowNewStationForm(false); setEditMode(true); setNameError(null)
  }

  const deleteStation = (index: number) => {
    setStations(prev => prev.filter((_, i) => i !== index))
    if (selectedStation === index) { setSelectedStation(null); setEditMode(false) }
  }

  const addItemToStation = (stationIndex: number) => {
    setStations(prev => {
      const next = [...prev]
      next[stationIndex] = { ...next[stationIndex], items: [...next[stationIndex].items, { name: 'new_item', ingredients: {}, duration: 5000, count: 1 }] }
      return next
    })
  }

  const handleFileImport = (content: string) => {
    try {
      const normalized = content.trim().replace(/\r\n/g, '\n')
      if (!normalized.toLowerCase().startsWith('return {') || !normalized.endsWith('}'))
        throw new Error('File must start with "return {" and end with "}"')
      const parsed = extractCraftingData(normalized)
      if (!parsed.length) throw new Error('No crafting stations found')
      setStations(parsed)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const updateStation = (index: number, fn: (s: CraftingStation) => CraftingStation) => {
    setStations(prev => { const next = [...prev]; next[index] = fn(next[index]); return next })
  }

  const sel = selectedStation

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <ErrorToast message={error || ''} isVisible={!!error} onClose={() => setError(null)} />
      <input ref={fileInputRef} type="file" accept=".lua" className="hidden" onChange={e => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = ev => handleFileImport(ev.target?.result as string)
        reader.readAsText(file)
      }} />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800/50 mb-6">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between py-4 px-6 md:px-8">
            <div className="flex items-center gap-4">
              <Link to="/" className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-medium tracking-tight text-zinc-100">Inventory Editor</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all">Import</button>
              <button onClick={exportFile} className="px-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all">Export</button>
            </div>
          </div>
          <div className="flex gap-6 px-6 md:px-8 pb-4">
            <Link to="/inventory/shop" className="text-sm font-medium text-zinc-400 hover:text-zinc-300">Shop</Link>
            <Link to="/inventory/crafting" className="text-sm font-medium text-zinc-100 relative">
              Crafting
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-zinc-100 rounded-full" />
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Station list */}
          <div className="col-span-3">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-zinc-400">Crafting Tables</h2>
                <button onClick={() => setShowNewStationForm(true)} className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-all">
                  <Plus size={14} />
                </button>
              </div>

              {showNewStationForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 rounded-lg border border-zinc-800/50 backdrop-blur-sm">
                  <input
                    type="text"
                    value={newStationName}
                    onChange={e => { setNewStationName(e.target.value); setNameError(null) }}
                    onKeyDown={e => e.key === 'Enter' && addNewStation()}
                    placeholder="Crafting table name"
                    className={`w-full px-2 py-1.5 text-sm bg-zinc-800/50 rounded-md border ${nameError ? 'border-red-500/50' : 'border-zinc-700/50'} focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50 placeholder-zinc-500`}
                  />
                  {nameError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 mt-1">{nameError}</motion.p>}
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => { setShowNewStationForm(false); setNameError(null) }} className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300">Cancel</button>
                    <button onClick={addNewStation} className="px-2 py-1 text-xs bg-zinc-800/50 hover:bg-zinc-700/50 rounded-md transition-all">Add Table</button>
                  </div>
                </motion.div>
              )}

              <div className="space-y-1">
                {stations.map((station, index) => (
                  <motion.div
                    key={index}
                    onClick={() => { setSelectedStation(index); setEditMode(false) }}
                    className={`w-full p-2 text-left rounded-md transition-all group cursor-pointer ${selectedStation === index ? 'bg-zinc-800/50 text-zinc-100 ring-1 ring-zinc-700/50' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-300 hover:ring-1 hover:ring-zinc-800/50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{station.name}</span>
                      <button onClick={e => { e.stopPropagation(); deleteStation(index) }} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 rounded transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="text-xs mt-0.5 text-zinc-500">{station.items.length} recipes</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Station details */}
          <div className="col-span-9">
            {sel !== null && stations[sel] ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium tracking-tight">
                    {editMode
                      ? <input type="text" value={stations[sel].name} onChange={e => updateStation(sel, s => ({ ...s, name: e.target.value }))} className="bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-700/50" />
                      : stations[sel].name}
                  </h2>
                  <button onClick={() => setEditMode(!editMode)} className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all ${editMode ? 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50 ring-1 ring-zinc-700/50' : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 hover:ring-1 hover:ring-zinc-700/50'}`}>
                    {editMode ? 'Save' : 'Edit'}
                  </button>
                </div>

                {/* Points */}
                <div className="p-4 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 rounded-lg border border-zinc-800/50 backdrop-blur-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Points</h3>
                    {editMode && <button onClick={() => updateStation(sel, s => ({ ...s, points: [...s.points, { x: 0, y: 0, z: 0 }] }))} className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-all"><Plus size={14} /></button>}
                  </div>
                  <div className="space-y-2">
                    {stations[sel].points.map((point, pi) => (
                      <div key={pi} className="flex items-center gap-4 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
                        <div className="flex-1 grid grid-cols-3 gap-4">
                          {(['x', 'y', 'z'] as (keyof Vec3)[]).map(coord => (
                            <div key={coord}>
                              <label className="block text-xs text-zinc-500 mb-1">{coord.toUpperCase()}</label>
                              {editMode
                                ? <input type="number" value={point[coord]} onChange={e => updateStation(sel, s => { const pts = [...s.points]; pts[pi] = { ...pts[pi], [coord]: parseFloat(e.target.value) }; return { ...s, points: pts } })} className="w-full bg-zinc-800/50 px-2 py-1 text-sm rounded-md border border-zinc-700/50" step="0.000001" />
                                : <span className="text-sm text-zinc-300">{point[coord].toFixed(6)}</span>}
                            </div>
                          ))}
                        </div>
                        {editMode && <button onClick={() => updateStation(sel, s => { const pts = [...s.points]; pts.splice(pi, 1); return { ...s, points: pts } })} className="p-1 text-zinc-500 hover:text-red-400 rounded"><Trash2 size={14} /></button>}
                      </div>
                    ))}
                    {stations[sel].points.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-zinc-500">No points added yet</p>
                        {editMode && <button onClick={() => updateStation(sel, s => ({ ...s, points: [...s.points, { x: 0, y: 0, z: 0 }] }))} className="mt-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-md transition-all">Add First Point</button>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Zones */}
                <div className="p-4 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 rounded-lg border border-zinc-800/50 backdrop-blur-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Zones</h3>
                    {editMode && <button onClick={() => updateStation(sel, s => ({ ...s, zones: [...s.zones, { coords: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, distance: 1.5, rotation: 0 }] }))} className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-all"><Plus size={14} /></button>}
                  </div>
                  <div className="space-y-4">
                    {stations[sel].zones.map((zone, zi) => (
                      <div key={zi} className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
                        <div className="space-y-2">
                          {(['coords', 'size'] as const).map(field => (
                            <div key={field}>
                              <label className="block text-xs text-zinc-500 mb-1">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                              <div className="flex gap-2">
                                {editMode
                                  ? (['x', 'y', 'z'] as (keyof Vec3)[]).map(coord => (
                                      <input key={coord} type="number" value={zone[field][coord]} onChange={e => updateStation(sel, s => { const zones = [...s.zones]; zones[zi] = { ...zones[zi], [field]: { ...zones[zi][field], [coord]: parseFloat(e.target.value) } }; return { ...s, zones } })} className="w-24 bg-zinc-800/50 px-2 py-1 text-sm rounded-md border border-zinc-700/50" step={field === 'coords' ? '0.000001' : '0.01'} />
                                    ))
                                  : <span className="text-sm text-zinc-300">{zone[field].x.toFixed(field === 'coords' ? 6 : 2)}, {zone[field].y.toFixed(field === 'coords' ? 6 : 2)}, {zone[field].z.toFixed(field === 'coords' ? 6 : 2)}</span>}
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-4">
                            {(['distance', 'rotation'] as const).map(field => (
                              <div key={field}>
                                <label className="block text-xs text-zinc-500 mb-1">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                                {editMode
                                  ? <input type="number" value={zone[field]} onChange={e => updateStation(sel, s => { const zones = [...s.zones]; zones[zi] = { ...zones[zi], [field]: parseFloat(e.target.value) }; return { ...s, zones } })} className="w-24 bg-zinc-800/50 px-2 py-1 text-sm rounded-md border border-zinc-700/50" step="0.1" />
                                  : <span className="text-sm text-zinc-300">{zone[field].toFixed(1)}{field === 'rotation' ? '°' : ''}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        {editMode && <div className="mt-3 flex justify-end"><button onClick={() => updateStation(sel, s => { const zones = [...s.zones]; zones.splice(zi, 1); return { ...s, zones } })} className="p-1 text-zinc-500 hover:text-red-400 rounded"><Trash2 size={14} /></button></div>}
                      </div>
                    ))}
                    {stations[sel].zones.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-zinc-500">No zones added yet</p>
                        {editMode && <button onClick={() => updateStation(sel, s => ({ ...s, zones: [...s.zones, { coords: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, distance: 1.5, rotation: 0 }] }))} className="mt-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-md transition-all">Add First Zone</button>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Blip */}
                <div className="p-4 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 rounded-lg border border-zinc-800/50 backdrop-blur-sm">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">Blip Settings</h3>
                  <div className="flex gap-4 items-center">
                    {editMode
                      ? <button onClick={() => setShowBlipSelector(true)} className="px-3 py-1.5 text-sm bg-zinc-800/50 hover:bg-zinc-700/50 rounded-md border border-zinc-700/50 transition-all">Blip ID: {stations[sel].blip.id}, Color: {stations[sel].blip.colour}</button>
                      : <div className="text-sm text-zinc-300">Blip ID: {stations[sel].blip.id}, Color: {stations[sel].blip.colour}</div>}
                    <span className="text-sm text-zinc-500">Scale:</span>
                    {editMode
                      ? <input type="number" value={stations[sel].blip.scale} onChange={e => updateStation(sel, s => ({ ...s, blip: { ...s.blip, scale: parseFloat(e.target.value) } }))} className="w-20 bg-zinc-800/50 px-2 py-1 text-sm rounded-md border border-zinc-700/50" step="0.1" />
                      : <span className="text-sm text-zinc-300">{stations[sel].blip.scale.toFixed(1)}</span>}
                  </div>
                </div>

                {/* Items */}
                <div className="p-4 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 rounded-lg border border-zinc-800/50 backdrop-blur-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-zinc-400">Items</h3>
                    {editMode && <button onClick={() => addItemToStation(sel)} className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-all"><Plus size={14} /></button>}
                  </div>
                  <div className="space-y-2">
                    {stations[sel].items.map((item, ii) => (
                      <div key={ii} className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            {editMode
                              ? <input type="text" value={item.name} onChange={e => updateStation(sel, s => { const items = [...s.items]; items[ii] = { ...items[ii], name: e.target.value }; return { ...s, items } })} className="bg-zinc-800/50 px-2 py-1 text-sm rounded-md border border-zinc-700/50" />
                              : <span className="text-sm font-medium text-zinc-200">{item.name}</span>}
                            <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                              <div className="flex items-center gap-2">
                                <span>Duration:</span>
                                {editMode
                                  ? <input type="number" value={item.duration} onChange={e => updateStation(sel, s => { const items = [...s.items]; items[ii] = { ...items[ii], duration: parseFloat(e.target.value) }; return { ...s, items } })} step="100" className="w-24 bg-zinc-800/50 px-2 py-1 text-xs rounded-md border border-zinc-700/50" />
                                  : <span>{item.duration}ms</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span>Output:</span>
                                {editMode ? (
                                  <div className="flex items-center gap-2">
                                    <select value={typeof item.count === 'number' ? 'fixed' : 'range'} onChange={e => updateStation(sel, s => { const items = [...s.items]; items[ii] = { ...items[ii], count: e.target.value === 'fixed' ? 1 : { min: 1, max: 2 } }; return { ...s, items } })} className="bg-zinc-800/50 px-2 py-1 text-xs rounded-md border border-zinc-700/50">
                                      <option value="fixed">Fixed</option>
                                      <option value="range">Range</option>
                                    </select>
                                    {typeof item.count === 'number'
                                      ? <input type="number" value={item.count} min="1" step="1" onChange={e => updateStation(sel, s => { const items = [...s.items]; items[ii] = { ...items[ii], count: Math.max(1, parseInt(e.target.value)) }; return { ...s, items } })} className="w-20 bg-zinc-800/50 px-2 py-1 text-xs rounded-md border border-zinc-700/50" />
                                      : (
                                        <div className="flex items-center gap-1">
                                          <input type="number" value={item.count.min} min="1" step="1" onChange={e => updateStation(sel, s => { const items = [...s.items]; const min = Math.max(1, parseInt(e.target.value)); items[ii] = { ...items[ii], count: { min, max: Math.max(min, (item.count as {min:number;max:number}).max) } }; return { ...s, items } })} className="w-16 bg-zinc-800/50 px-2 py-1 text-xs rounded-md border border-zinc-700/50" />
                                          <span>-</span>
                                          <input type="number" value={item.count.max} min="1" step="1" onChange={e => updateStation(sel, s => { const items = [...s.items]; const max = Math.max(1, parseInt(e.target.value)); items[ii] = { ...items[ii], count: { min: Math.min((item.count as {min:number;max:number}).min, max), max } }; return { ...s, items } })} className="w-16 bg-zinc-800/50 px-2 py-1 text-xs rounded-md border border-zinc-700/50" />
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <span>{typeof item.count === 'number' ? `${item.count}x` : `${item.count.min}-${item.count.max}x`}</span>
                                )}
                              </div>
                            </div>
                            {/* Ingredients */}
                            <div>
                              <div className="text-xs text-zinc-500 mb-2">Ingredients:</div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(item.ingredients).map(([ingName, amount]) => (
                                  <div key={ingName} className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-xs border border-zinc-700/50">
                                    {editMode ? (
                                      <>
                                        <input type="text" value={ingName} onChange={e => updateStation(sel, s => {
                                          const items = [...s.items]
                                          const oldIng = { ...items[ii].ingredients }
                                          const newIng: CraftingIngredient = {}
                                          for (const [k, v] of Object.entries(oldIng)) newIng[k === ingName ? e.target.value : k] = v
                                          items[ii] = { ...items[ii], ingredients: newIng }
                                          return { ...s, items }
                                        })} className="w-24 bg-zinc-800/50 px-1.5 py-0.5 text-xs rounded-md border border-zinc-700/50" />
                                        <input type="number" value={amount === 0 ? 0 : amount < 1 ? +(amount * 100).toFixed(2) : Math.round(amount)} min="0" step={amount < 1 ? '0.01' : '1'} onChange={e => {
                                          const v = parseFloat(e.target.value)
                                          const final = validateIngredientValue(v < 1 && amount < 1 ? v / 100 : v)
                                          updateStation(sel, s => { const items = [...s.items]; items[ii] = { ...items[ii], ingredients: { ...items[ii].ingredients, [ingName]: final } }; return { ...s, items } })
                                        }} className="w-20 bg-zinc-800/50 px-1.5 py-0.5 text-xs rounded-md border border-zinc-700/50" />
                                        <button onClick={() => updateStation(sel, s => { const items = [...s.items]; const ing = { ...items[ii].ingredients }; delete ing[ingName]; items[ii] = { ...items[ii], ingredients: ing }; return { ...s, items } })} className="ml-1 text-zinc-500 hover:text-red-400"><Trash2 size={12} /></button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-zinc-300">{ingName}</span>
                                        <span className="text-zinc-500">{amount === 0 ? '(Required)' : amount < 1 ? `${(amount * 100).toFixed(2)}%` : `${amount}x`}</span>
                                      </>
                                    )}
                                  </div>
                                ))}
                                {editMode && (
                                  <button onClick={() => updateStation(sel, s => {
                                    const items = [...s.items]
                                    const ing = { ...items[ii].ingredients }
                                    let newKey = 'new_ingredient'
                                    let counter = 1
                                    while (newKey in ing) newKey = `new_ingredient_${counter++}`
                                    ing[newKey] = 1
                                    items[ii] = { ...items[ii], ingredients: ing }
                                    return { ...s, items }
                                  })} className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-800/30 hover:bg-zinc-800/50 rounded text-xs text-zinc-400 hover:text-zinc-300">
                                    <Plus size={12} />Add
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          {editMode && <button onClick={() => updateStation(sel, s => { const items = [...s.items]; items.splice(ii, 1); return { ...s, items } })} className="p-1 text-zinc-500 hover:text-red-400 rounded flex-shrink-0"><Trash2 size={14} /></button>}
                        </div>
                      </div>
                    ))}
                    {stations[sel].items.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-zinc-500">No items added yet</p>
                        {editMode && <button onClick={() => addItemToStation(sel)} className="mt-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-md transition-all">Add First Item</button>}
                      </div>
                    )}
                  </div>
                </div>

                {sel !== null && (
                  <BlipSelector
                    isOpen={showBlipSelector}
                    onClose={() => setShowBlipSelector(false)}
                    initialId={stations[sel].blip.id}
                    initialColour={stations[sel].blip.colour}
                    onSelect={({ id, colour }) => updateStation(sel, s => ({ ...s, blip: { ...s.blip, id, colour } }))}
                  />
                )}
              </div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center">
                <Package size={32} className="text-zinc-700 mb-4" />
                <h3 className="text-lg font-medium text-zinc-400 mb-2">No Crafting Table Selected</h3>
                <p className="text-sm text-zinc-500">Select a crafting table from the list or create a new one to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
