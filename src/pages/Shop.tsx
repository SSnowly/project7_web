import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Package, Edit, X, Check } from 'lucide-react'
import BlipSelector from '../components/BlipSelector'
import ErrorToast from '../components/ErrorToast'
import PageHeader from '../components/PageHeader'
import { Link } from 'react-router-dom'

type Vec3 = { x: number; y: number; z: number }

type ShopTarget = {
  loc: Vec3
  length: number
  width: number
  heading: number
  minZ: number
  maxZ: number
  distance: number
}

type ShopBlip = { id: number; colour: number; scale: number }
type MetadataValue = string | number | boolean

type ShopItem = {
  name: string
  price: number
  currency?: string
  grade?: number
  metadata?: Record<string, MetadataValue>
}

type Shop = {
  name: string
  inventory: ShopItem[]
  locations: Vec3[]
  blip?: ShopBlip
  groups?: string[] | Record<string, number>
  targets?: ShopTarget[]
  model?: string | string[]
}

function extractShopData(luaCode: string): Record<string, Shop> {
  const shops: Record<string, Shop> = {}

  luaCode = luaCode
    .replace(/^\s*[\r\n]/gm, '')
    .replace(/\s+$/gm, '')
    .replace(/return\s*{/, '')
    .replace(/}\s*$/, '')

  let currentIndex = 0
  while (currentIndex < luaCode.length) {
    const shopMatch = luaCode.slice(currentIndex).match(/(\w+)\s*=\s*{/)
    if (!shopMatch) break

    const shopId = shopMatch[1]
    const blockStartIndex = currentIndex + shopMatch.index! + shopMatch[0].length
    let braceCount = 1
    let blockEndIndex = blockStartIndex

    for (let i = blockStartIndex; i < luaCode.length; i++) {
      if (luaCode[i] === '{') braceCount++
      if (luaCode[i] === '}') braceCount--
      if (braceCount === 0) { blockEndIndex = i; break }
    }

    const block = luaCode.slice(blockStartIndex, blockEndIndex)

    try {
      const name = block.match(/name\s*=\s*['"]([^'"]+)['"]/)?.[1] || shopId
      shops[shopId] = { name, inventory: [], locations: [], groups: undefined }

      const groupsStart = block.match(/groups\s*=\s*{/)
      if (groupsStart) {
        const groupStartIndex = groupsStart.index! + groupsStart[0].length
        let groupBraceCount = 1
        let groupEndIndex = groupStartIndex
        for (let i = groupStartIndex; i < block.length; i++) {
          if (block[i] === '{') groupBraceCount++
          if (block[i] === '}') groupBraceCount--
          if (groupBraceCount === 0) { groupEndIndex = i; break }
        }
        const groupsBlock = block.slice(groupStartIndex, groupEndIndex)
        const groups: Record<string, number> = {}
        for (const [, job, grade] of groupsBlock.matchAll(/\['([^']+)'\]\s*=\s*(\d+)/g)) {
          groups[job] = parseInt(grade)
        }
        if (Object.keys(groups).length > 0) shops[shopId].groups = groups
      } else {
        const simpleGroupMatch = block.match(/groups\s*=\s*(shared\.\w+|['"][^'"]+['"])/s)
        if (simpleGroupMatch) {
          const groupsStr = simpleGroupMatch[1].trim()
          if (groupsStr.startsWith('shared.')) shops[shopId].groups = { [groupsStr]: 0 }
          else if (groupsStr.startsWith('"') || groupsStr.startsWith("'"))
            shops[shopId].groups = groupsStr.replace(/['"]/g, '').split(',')
        }
      }

      const blipMatch = block.match(/blip\s*=\s*{\s*id\s*=\s*(\d+)\s*,\s*colour\s*=\s*(\d+)\s*,\s*scale\s*=\s*([\d.]+)\s*}/)
      if (blipMatch) shops[shopId].blip = { id: parseInt(blipMatch[1]), colour: parseInt(blipMatch[2]), scale: parseFloat(blipMatch[3]) }

      const inventoryItems: ShopItem[] = []
      const inventoryStart = block.match(/inventory\s*=\s*{/)
      if (inventoryStart) {
        const invStartIndex = inventoryStart.index! + inventoryStart[0].length
        let invBraceCount = 1
        let invEndIndex = invStartIndex
        for (let i = invStartIndex; i < block.length; i++) {
          if (block[i] === '{') invBraceCount++
          if (block[i] === '}') invBraceCount--
          if (invBraceCount === 0) { invEndIndex = i; break }
        }
        const inventoryBlock = block.slice(invStartIndex, invEndIndex)
        let itemStart = 0
        while (itemStart < inventoryBlock.length) {
          const itemMatch = inventoryBlock.slice(itemStart).match(/{/)
          if (!itemMatch) break
          const itemStartIndex = itemStart + itemMatch.index! + 1
          let itemBraceCount = 1
          let itemEndIndex = itemStartIndex
          for (let i = itemStartIndex; i < inventoryBlock.length; i++) {
            if (inventoryBlock[i] === '{') itemBraceCount++
            if (inventoryBlock[i] === '}') itemBraceCount--
            if (itemBraceCount === 0) { itemEndIndex = i; break }
          }
          const itemBlock = inventoryBlock.slice(itemStartIndex, itemEndIndex)
          const nameMatch = itemBlock.match(/name\s*=\s*['"]([^'"]+)['"]/)
          const priceMatch = itemBlock.match(/price\s*=\s*(\d+)/)
          if (nameMatch && priceMatch) {
            const item: ShopItem = { name: nameMatch[1], price: parseInt(priceMatch[1]) }
            const currencyMatch = itemBlock.match(/currency\s*=\s*['"]([^'"]+)['"]/)
            if (currencyMatch) item.currency = currencyMatch[1]
            const gradeMatch = itemBlock.match(/grade\s*=\s*(\d+)/)
            if (gradeMatch) item.grade = parseInt(gradeMatch[1])
            const metadataMatch = itemBlock.match(/metadata\s*=\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/)
            if (metadataMatch) {
              const metadata: Record<string, MetadataValue> = {}
              for (const [, key, value] of Array.from(metadataMatch[1].matchAll(/(\w+)\s*=\s*(false|true|['"]([^'"]+)['"])/g))) {
                if (value === 'true') metadata[key] = true
                else if (value === 'false') metadata[key] = false
                else metadata[key] = value.replace(/['"]/g, '')
              }
              if (Object.keys(metadata).length > 0) item.metadata = metadata
            }
            inventoryItems.push(item)
          }
          itemStart = itemEndIndex + 1
        }
      }

      const locations: Vec3[] = []
      const locationsStart = block.match(/locations\s*=\s*{/)
      if (locationsStart) {
        const locStartIndex = locationsStart.index! + locationsStart[0].length
        let locBraceCount = 1
        let locEndIndex = locStartIndex
        for (let i = locStartIndex; i < block.length; i++) {
          if (block[i] === '{') locBraceCount++
          if (block[i] === '}') locBraceCount--
          if (locBraceCount === 0) { locEndIndex = i; break }
        }
        const locationsBlock = block.slice(locStartIndex, locEndIndex)
        for (const match of locationsBlock.matchAll(/vec3\(([-\d.,\s]+)\)/g)) {
          const [x, y, z] = match[1].split(',').map(n => parseFloat(n.trim()))
          locations.push({ x, y, z })
        }
      }

      const targets: ShopTarget[] = []
      const targetsStart = block.match(/targets\s*=\s*{/)
      if (targetsStart) {
        const targetStartIndex = targetsStart.index! + targetsStart[0].length
        let targetBraceCount = 1
        let targetEndIndex = targetStartIndex
        for (let i = targetStartIndex; i < block.length; i++) {
          if (block[i] === '{') targetBraceCount++
          if (block[i] === '}') targetBraceCount--
          if (targetBraceCount === 0) { targetEndIndex = i; break }
        }
        const targetsBlock = block.slice(targetStartIndex, targetEndIndex)
        let targetItemStart = 0
        while (targetItemStart < targetsBlock.length) {
          const targetMatch = targetsBlock.slice(targetItemStart).match(/{/)
          if (!targetMatch) break
          const targetItemStartIndex = targetItemStart + targetMatch.index! + 1
          let targetItemBraceCount = 1
          let targetItemEndIndex = targetItemStartIndex
          for (let i = targetItemStartIndex; i < targetsBlock.length; i++) {
            if (targetsBlock[i] === '{') targetItemBraceCount++
            if (targetsBlock[i] === '}') targetItemBraceCount--
            if (targetItemBraceCount === 0) { targetItemEndIndex = i; break }
          }
          const targetBlock = targetsBlock.slice(targetItemStartIndex, targetItemEndIndex)
          const locMatch = targetBlock.match(/loc\s*=\s*vec3\(([-\d.,\s]+)\)/)
          if (locMatch) {
            const [x, y, z] = locMatch[1].split(',').map(n => parseFloat(n.trim()))
            targets.push({
              loc: { x, y, z },
              length: parseFloat(targetBlock.match(/length\s*=\s*([\d.]+)/)?.[1] || '0'),
              width: parseFloat(targetBlock.match(/width\s*=\s*([\d.]+)/)?.[1] || '0'),
              heading: parseFloat(targetBlock.match(/heading\s*=\s*([\d.]+)/)?.[1] || '0'),
              minZ: parseFloat(targetBlock.match(/minZ\s*=\s*([\d.]+)/)?.[1] || '0'),
              maxZ: parseFloat(targetBlock.match(/maxZ\s*=\s*([\d.]+)/)?.[1] || '0'),
              distance: parseFloat(targetBlock.match(/distance\s*=\s*([\d.]+)/)?.[1] || '0')
            })
          }
          targetItemStart = targetItemEndIndex + 1
        }
      }

      const modelMatch = block.match(/model\s*=\s*{([^}]+)}|model\s*=\s*['"]([^'"]+)['"]/)
      if (modelMatch) {
        if (modelMatch[1]) shops[shopId].model = modelMatch[1].split(',').map(m => m.trim().replace(/`/g, ''))
        else if (modelMatch[2]) shops[shopId].model = modelMatch[2]
      }

      shops[shopId] = {
        name,
        groups: shops[shopId].groups,
        inventory: inventoryItems,
        locations,
        blip: shops[shopId].blip,
        targets: targets.length > 0 ? targets : undefined,
        model: shops[shopId].model
      }
    } catch (error) {
      console.error(`Error processing shop block ${shopId}:`, error)
    }

    currentIndex = blockEndIndex + 1
  }

  return shops
}

export default function Shop() {
  const [shops, setShops] = useState<Record<string, Shop>>({})
  const [selectedShop, setSelectedShop] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [newShopName, setNewShopName] = useState('')
  const [showNewShopForm, setShowNewShopForm] = useState(false)
  const [showBlipSelector, setShowBlipSelector] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addNewShop = () => {
    if (!newShopName.trim()) return
    const id = newShopName.replace(/\s+/g, '')
    setShops(prev => ({
      ...prev,
      [id]: { name: newShopName, blip: { id: 1, colour: 1, scale: 0.8 }, inventory: [], locations: [] }
    }))
    setSelectedShop(id)
    setNewShopName('')
    setShowNewShopForm(false)
    setEditMode(true)
  }

  const deleteShop = (shopId: string) => {
    const updated = { ...shops }
    delete updated[shopId]
    setShops(updated)
    if (selectedShop === shopId) { setSelectedShop(null); setEditMode(false) }
  }

  const addItemToShop = (shopId: string) => {
    setShops(prev => {
      const updated = { ...prev }
      updated[shopId] = { ...updated[shopId], inventory: [...updated[shopId].inventory, { name: 'new_item', price: 0, currency: 'money', metadata: {} }] }
      return updated
    })
  }

  const addTarget = (shopId: string) => {
    setShops(prev => {
      const updated = { ...prev }
      const targets = [...(updated[shopId].targets || []), { loc: { x: 0, y: 0, z: 0 }, length: 0.6, width: 0.5, heading: 0, minZ: 0, maxZ: 0.4, distance: 1.5 }]
      updated[shopId] = { ...updated[shopId], targets }
      return updated
    })
  }

  const updateTarget = (shopId: string, index: number, field: keyof ShopTarget | 'x' | 'y' | 'z', value: number) => {
    setShops(prev => {
      const updated = { ...prev }
      const targets = [...(updated[shopId].targets || [])]
      if (field === 'x' || field === 'y' || field === 'z') targets[index] = { ...targets[index], loc: { ...targets[index].loc, [field]: value } }
      else targets[index] = { ...targets[index], [field]: value }
      updated[shopId] = { ...updated[shopId], targets }
      return updated
    })
  }

  const removeTarget = (shopId: string, index: number) => {
    setShops(prev => {
      const updated = { ...prev }
      const targets = [...(updated[shopId].targets || [])]
      targets.splice(index, 1)
      updated[shopId] = { ...updated[shopId], targets }
      return updated
    })
  }

  const updateStringField = (shopId: string, index: number, field: 'name' | 'currency', value: string) => {
    setShops(prev => {
      const updated = { ...prev }
      const inventory = [...updated[shopId].inventory]
      inventory[index] = { ...inventory[index], [field]: value }
      updated[shopId] = { ...updated[shopId], inventory }
      return updated
    })
  }

  const updateNumberField = (shopId: string, index: number, field: 'price' | 'grade', value: number) => {
    setShops(prev => {
      const updated = { ...prev }
      const inventory = [...updated[shopId].inventory]
      inventory[index] = { ...inventory[index], [field]: value }
      updated[shopId] = { ...updated[shopId], inventory }
      return updated
    })
  }

  const removeItem = (shopId: string, index: number) => {
    setShops(prev => {
      const updated = { ...prev }
      const inventory = [...updated[shopId].inventory]
      inventory.splice(index, 1)
      updated[shopId] = { ...updated[shopId], inventory }
      return updated
    })
  }

  const addLocation = (shopId: string) => {
    setShops(prev => {
      const updated = { ...prev }
      updated[shopId] = { ...updated[shopId], locations: [...updated[shopId].locations, { x: 0, y: 0, z: 0 }] }
      return updated
    })
  }

  const updateLocation = (shopId: string, index: number, field: keyof Vec3, value: number) => {
    setShops(prev => {
      const updated = { ...prev }
      const locations = [...updated[shopId].locations]
      locations[index] = { ...locations[index], [field]: value }
      updated[shopId] = { ...updated[shopId], locations }
      return updated
    })
  }

  const removeLocation = (shopId: string, index: number) => {
    setShops(prev => {
      const updated = { ...prev }
      const locations = [...updated[shopId].locations]
      locations.splice(index, 1)
      updated[shopId] = { ...updated[shopId], locations }
      return updated
    })
  }

  const updateGroups = (shopId: string, groups: Shop['groups']) => {
    setShops(prev => ({ ...prev, [shopId]: { ...prev[shopId], groups } }))
  }

  const addMetadata = (shopId: string, index: number) => {
    setShops(prev => {
      const updated = { ...prev }
      const inventory = [...updated[shopId].inventory]
      const item = { ...inventory[index] }
      const metadata = { ...(item.metadata || {}) }
      let newKey = 'new_key'
      let counter = 1
      while (newKey in metadata) newKey = `new_key_${counter++}`
      metadata[newKey] = ''
      item.metadata = metadata
      inventory[index] = item
      updated[shopId] = { ...updated[shopId], inventory }
      return updated
    })
  }

  const removeMetadata = (shopId: string, index: number, key: string) => {
    setShops(prev => {
      const updated = { ...prev }
      const inventory = [...updated[shopId].inventory]
      const item = { ...inventory[index] }
      const metadata = { ...(item.metadata || {}) }
      delete metadata[key]
      item.metadata = Object.keys(metadata).length > 0 ? metadata : undefined
      inventory[index] = item
      updated[shopId] = { ...updated[shopId], inventory }
      return updated
    })
  }

  const generateExportCode = useCallback(() => {
    const fv = (v: Vec3) => `vec3(${v.x}, ${v.y}, ${v.z})`
    let code = 'return {\n'
    for (const [shopId, shop] of Object.entries(shops)) {
      code += `\t${shopId} = {\n`
      code += `\t\tname = '${shop.name}',\n`
      code += '\t\tinventory = {\n'
      for (const item of shop.inventory) {
        code += '\t\t\t{\n'
        code += `\t\t\t\tname = '${item.name}',\n`
        code += `\t\t\t\tprice = ${item.price}`
        if (item.currency) code += `,\n\t\t\t\tcurrency = '${item.currency}'`
        if (item.grade !== undefined) code += `,\n\t\t\t\tgrade = ${item.grade}`
        if (item.metadata) {
          code += ',\n\t\t\t\tmetadata = {\n'
          for (const [k, v] of Object.entries(item.metadata)) {
            code += `\t\t\t\t\t${k} = ${typeof v === 'string' ? `'${v}'` : v},\n`
          }
          code += '\t\t\t\t}'
        }
        code += '\n\t\t\t},\n'
      }
      code += '\t\t},\n'
      code += '\t\tlocations = {\n'
      for (const loc of shop.locations) code += `\t\t\t${fv(loc)},\n`
      code += '\t\t},\n'
      if (shop.blip) code += `\t\tblip = { id = ${shop.blip.id}, colour = ${shop.blip.colour}, scale = ${shop.blip.scale} },\n`
      if (shop.groups) {
        if (Array.isArray(shop.groups)) code += `\t\tgroups = { ${shop.groups.map((g: string) => `'${g}'`).join(', ')} },\n`
        else {
          code += '\t\tgroups = {\n'
          for (const [job, grade] of Object.entries(shop.groups as Record<string, number>)) code += `\t\t\t['${job}'] = ${grade},\n`
          code += '\t\t},\n'
        }
      }
      if (shop.targets?.length) {
        code += '\t\ttargets = {\n'
        for (const t of shop.targets) {
          code += `\t\t\t{ loc = ${fv(t.loc)}, length = ${t.length}, width = ${t.width}, heading = ${t.heading}, minZ = ${t.minZ}, maxZ = ${t.maxZ}, distance = ${t.distance} },\n`
        }
        code += '\t\t},\n'
      }
      if (shop.model) {
        if (Array.isArray(shop.model)) code += `\t\tmodel = { ${shop.model.map((m: string) => `'${m}'`).join(', ')} },\n`
        else code += `\t\tmodel = '${shop.model}',\n`
      }
      code += '\t},\n'
    }
    code += '}'
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'shops.lua'; a.click()
    URL.revokeObjectURL(url)
  }, [shops])

  useEffect(() => {
    const handleExport = () => generateExportCode()
    document.addEventListener('export-data', handleExport)
    return () => document.removeEventListener('export-data', handleExport)
  }, [generateExportCode])

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = (e.target?.result as string).trim().replace(/\r\n/g, '\n')
        if (!content.toLowerCase().startsWith('return {') || !content.endsWith('}'))
          throw new Error('File must start with "return {" and end with "}"')
        const imported = extractShopData(content)
        if (Object.keys(imported).length === 0) throw new Error('No shops found in file')
        const valid: Record<string, Shop> = {}
        let invalidCount = 0
        for (const [id, shop] of Object.entries(imported)) {
          if (!shop.name || !Array.isArray(shop.inventory) || !Array.isArray(shop.locations)) { invalidCount++; continue }
          valid[id] = shop
        }
        if (Object.keys(valid).length === 0) throw new Error('No valid shops found')
        if (invalidCount > 0) setError(`Warning: ${invalidCount} invalid shops skipped`)
        else setError(null)
        setShops(valid)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }
    reader.readAsText(file)
  }

  const validSelectedShop = selectedShop ?? ''

  return (
    <div>
      <input id="fileInput" type="file" onChange={handleImport} accept=".lua" className="hidden" />
      <ErrorToast message={error || ''} isVisible={!!error} onClose={() => setError(null)} />

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
              <button
                onClick={() => document.getElementById('fileInput')?.click()}
                className="px-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all"
              >
                Import
              </button>
              <button
                onClick={generateExportCode}
                className="px-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all"
              >
                Export
              </button>
            </div>
          </div>
          <div className="flex gap-6 px-6 md:px-8 pb-4">
            <Link to="/inventory/shop" className="text-sm font-medium text-zinc-100 relative">
              Shop
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-zinc-100 rounded-full" />
            </Link>
            <Link to="/inventory/crafting" className="text-sm font-medium text-zinc-400 hover:text-zinc-300">
              Crafting
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Shop list */}
            <div className="col-span-3">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-medium text-zinc-400">Shops</h2>
                  <button onClick={() => setShowNewShopForm(true)} className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-all hover:ring-1 hover:ring-zinc-700/50">
                    <Plus size={14} />
                  </button>
                </div>

                {showNewShopForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 rounded-lg border border-zinc-800/50 backdrop-blur-sm">
                    <input
                      type="text"
                      value={newShopName}
                      onChange={e => setNewShopName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addNewShop()}
                      placeholder="Shop name"
                      className="w-full px-2 py-1.5 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50 placeholder-zinc-500"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setShowNewShopForm(false)} className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300">Cancel</button>
                      <button onClick={addNewShop} className="px-2 py-1 text-xs bg-zinc-800/50 hover:bg-zinc-700/50 rounded-md transition-all hover:ring-1 hover:ring-zinc-600/50">Add Shop</button>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-1">
                  {Object.entries(shops)
                    .filter(([id]) => !['blip', 'inventory', 'locations', 'targets'].includes(id.toLowerCase()))
                    .map(([id, shop]) => (
                    <motion.button
                      key={id}
                      onClick={() => { setSelectedShop(id); setEditMode(false) }}
                      className={`w-full p-2 text-left rounded-md transition-all group ${selectedShop === id ? 'bg-zinc-800/50 text-zinc-100 ring-1 ring-zinc-700/50' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-300 hover:ring-1 hover:ring-zinc-800/50'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{shop.name}</span>
                        <span onClick={e => { e.stopPropagation(); deleteShop(id) }} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 rounded">
                          <Trash2 className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="text-xs mt-0.5 text-zinc-500">{shop.inventory.length} items</div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Shop details */}
            <div className="col-span-9">
              {selectedShop ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-medium tracking-tight">{shops[selectedShop].name}</h2>
                    <button
                      onClick={() => setEditMode(!editMode)}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all ${editMode ? 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50 ring-1 ring-zinc-700/50' : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 hover:ring-1 hover:ring-zinc-700/50'}`}
                    >
                      {editMode ? <><Check size={14} />Done</> : <><Edit size={14} />Edit</>}
                    </button>
                  </div>

                  {/* Groups */}
                  <div className="rounded-lg border border-zinc-800/50 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium text-zinc-400">Job Requirements</h3>
                      {editMode && (
                        <button onClick={() => updateGroups(selectedShop, { ...((shops[selectedShop].groups as Record<string,number>) || {}), newjob: 0 })} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-all">
                          <Plus size={12} />Add Job
                        </button>
                      )}
                    </div>
                    {editMode ? (
                      <div className="space-y-2">
                        {shops[selectedShop].groups && !Array.isArray(shops[selectedShop].groups) &&
                          Object.entries(shops[selectedShop].groups as Record<string, number>).map(([job, grade]) => (
                            <div key={job} className="flex items-center gap-2 group">
                              <input type="text" value={job} onChange={e => { const g = { ...(shops[selectedShop].groups as Record<string,number>) }; const old = g[job]; delete g[job]; g[e.target.value] = old; updateGroups(selectedShop, g) }} className="bg-zinc-900 text-sm px-2 py-1 rounded w-32 border border-zinc-700/50" />
                              <input type="number" value={grade} onChange={e => { const g = { ...(shops[selectedShop].groups as Record<string,number>) }; g[job] = parseInt(e.target.value)||0; updateGroups(selectedShop, g) }} className="bg-zinc-900 text-sm px-2 py-1 rounded w-20 ml-2 border border-zinc-700/50" />
                              <button onClick={() => { const g = { ...(shops[selectedShop].groups as Record<string,number>) }; delete g[job]; updateGroups(selectedShop, g) }} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {shops[selectedShop].groups
                          ? Array.isArray(shops[selectedShop].groups)
                            ? <div className="text-sm text-zinc-400">{(shops[selectedShop].groups as string[]).join(', ')}</div>
                            : Object.entries(shops[selectedShop].groups as Record<string,number>).map(([job, grade]) => (
                                <div key={job} className="text-sm text-zinc-400">{job} (Grade {grade}+)</div>
                              ))
                          : <div className="text-sm text-zinc-500 italic">No job requirements</div>
                        }
                      </div>
                    )}
                  </div>

                  {/* Inventory */}
                  <div className="rounded-lg border border-zinc-800/50 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center">
                      <h3 className="text-sm font-medium text-zinc-400">Inventory</h3>
                      {editMode && (
                        <button onClick={() => addItemToShop(selectedShop)} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-all">
                          <Plus size={12} />Add Item
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-zinc-800/50">
                            <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Item</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Price</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Currency</th>
                            {shops[selectedShop]?.groups && <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Grade</th>}
                            <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Metadata</th>
                            {editMode && <th className="px-4 py-2 w-10"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {shops[selectedShop].inventory.map((item, index) => (
                            <tr key={index} className="group">
                              <td className="px-4 py-2">
                                {editMode ? <input type="text" value={item.name} onChange={e => updateStringField(selectedShop, index, 'name', e.target.value)} className="w-full px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50" /> : <span className="text-sm">{item.name}</span>}
                              </td>
                              <td className="px-4 py-2">
                                {editMode ? <input type="number" value={item.price} onChange={e => updateNumberField(selectedShop, index, 'price', parseInt(e.target.value))} className="w-24 px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50" /> : <span className="text-sm">{item.price}</span>}
                              </td>
                              <td className="px-4 py-2">
                                {editMode ? <input type="text" value={item.currency || ''} onChange={e => updateStringField(selectedShop, index, 'currency', e.target.value)} placeholder="money" className="w-24 px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50" /> : <span className="text-sm">{item.currency || 'money'}</span>}
                              </td>
                              {shops[selectedShop]?.groups && (
                                <td className="px-4 py-2">
                                  {editMode ? <input type="number" value={item.grade || ''} onChange={e => updateNumberField(selectedShop, index, 'grade', parseInt(e.target.value))} placeholder="0" className="w-24 px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50" /> : <span className="text-sm">{item.grade ?? '-'}</span>}
                                </td>
                              )}
                              <td className="px-4 py-2">
                                <div className="space-y-2">
                                  {item.metadata && Object.entries(item.metadata).map(([key, value], mi) => (
                                    <div key={`${index}-${mi}`} className="flex items-center gap-2">
                                      {editMode ? (
                                        <>
                                          <input type="text" value={key} onChange={e => {
                                            setShops(prev => {
                                              const updated = { ...prev }
                                              const inv = [...updated[shopId].inventory]
                                              const itm = { ...inv[index] }
                                              const oldMeta = { ...itm.metadata! }
                                              const newMeta: Record<string, MetadataValue> = {}
                                              for (const [k, v] of Object.entries(oldMeta)) newMeta[k === key ? e.target.value : k] = v
                                              itm.metadata = newMeta
                                              inv[index] = itm
                                              updated[shopId] = { ...updated[shopId], inventory: inv }
                                              return updated
                                            })
                                          }} className="w-1/2 px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50" />
                                          <input type="text" value={typeof value === 'boolean' ? value.toString() : value} onChange={e => {
                                            const shopId = selectedShop
                                            setShops(prev => {
                                              const updated = { ...prev }
                                              const inv = [...updated[shopId].inventory]
                                              const itm = { ...inv[index] }
                                              const meta = { ...(itm.metadata || {}) }
                                              let parsed: MetadataValue = e.target.value
                                              if (parsed === 'true') parsed = true
                                              else if (parsed === 'false') parsed = false
                                              else if (!isNaN(Number(parsed)) && parsed !== '') parsed = Number(parsed)
                                              meta[key] = parsed
                                              itm.metadata = meta
                                              inv[index] = itm
                                              updated[shopId] = { ...updated[shopId], inventory: inv }
                                              return updated
                                            })
                                          }} className="w-1/2 px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50" />
                                          <button onClick={() => removeMetadata(selectedShop, index, key)} className="p-1 text-zinc-500 hover:text-red-400"><X size={14} /></button>
                                        </>
                                      ) : (
                                        <span className="text-sm text-zinc-400"><span className="text-zinc-500">{key}:</span> {String(value)}</span>
                                      )}
                                    </div>
                                  ))}
                                  {editMode && (
                                    <button onClick={() => addMetadata(selectedShop, index)} className="inline-flex items-center text-xs text-zinc-500 hover:text-zinc-400">
                                      <Plus size={12} className="mr-1" />Add Metadata
                                    </button>
                                  )}
                                </div>
                              </td>
                              {editMode && (
                                <td className="px-4 py-2">
                                  <button onClick={() => removeItem(selectedShop, index)} className="p-1 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 rounded transition-all">
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="rounded-lg border border-zinc-800/50 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium text-zinc-400">Locations</h3>
                      {editMode && <button onClick={() => addLocation(selectedShop)} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-all"><Plus size={12} />Add Location</button>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {shops[selectedShop].locations.map((location, index) => (
                        <motion.div key={index} layout className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30 group hover:border-zinc-700/50 transition-colors">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-medium text-zinc-500">Location #{index + 1}</span>
                            {editMode && <button onClick={() => removeLocation(selectedShop, index)} className="p-1 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 rounded transition-all"><Trash2 size={14} /></button>}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {(['x', 'y', 'z'] as (keyof Vec3)[]).map(coord => (
                              <div key={coord}>
                                <label className="block text-xs text-zinc-500 mb-1">{coord.toUpperCase()}</label>
                                {editMode
                                  ? <input type="number" step="0.01" value={location[coord]} onChange={e => updateLocation(selectedShop, index, coord, parseFloat(e.target.value))} className="w-full px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50" />
                                  : <div className="px-2 py-1 text-sm bg-zinc-800/30 rounded-md">{location[coord]}</div>
                                }
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Targets */}
                  <div className="rounded-lg border border-zinc-800/50 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium text-zinc-400">Targets</h3>
                      {editMode && <button onClick={() => addTarget(selectedShop)} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-all"><Plus size={12} />Add Target</button>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {shops[selectedShop].targets?.map((target, index) => (
                        <motion.div key={index} layout className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30 group hover:border-zinc-700/50 transition-colors">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-medium text-zinc-500">Target #{index + 1}</span>
                            {editMode && <button onClick={() => removeTarget(selectedShop, index)} className="p-1 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 rounded transition-all"><Trash2 size={14} /></button>}
                          </div>
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              {(['x', 'y', 'z'] as (keyof Vec3)[]).map(coord => (
                                <div key={coord}>
                                  <label className="block text-xs text-zinc-500 mb-1">{coord.toUpperCase()}</label>
                                  {editMode ? <input type="number" step="0.01" value={target.loc[coord]} onChange={e => updateTarget(selectedShop, index, coord, parseFloat(e.target.value))} className="w-full px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50" /> : <div className="px-2 py-1 text-sm bg-zinc-800/30 rounded-md">{target.loc[coord]}</div>}
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {(['length','width','heading','distance','minZ','maxZ'] as const).map(key => (
                                <div key={key}>
                                  <label className="block text-xs text-zinc-500 mb-1">{key.charAt(0).toUpperCase()+key.slice(1)}</label>
                                  {editMode ? <input type="number" step="0.1" value={target[key]} onChange={e => updateTarget(selectedShop, index, key, parseFloat(e.target.value))} className="w-full px-2 py-1 text-sm bg-zinc-800/50 rounded-md border border-zinc-700/50 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50" /> : <div className="px-2 py-1 text-sm bg-zinc-800/30 rounded-md">{target[key]}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Blip */}
                  <div className="p-2 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 rounded-lg border border-zinc-800/50 backdrop-blur-sm">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Blip Settings</h3>
                    <div className="flex items-center gap-3">
                      {editMode ? (
                        <button onClick={() => setShowBlipSelector(true)} className="px-2 py-1 text-sm bg-zinc-800/50 hover:bg-zinc-700/50 rounded-md border border-zinc-700/50 transition-all">
                          Blip ID: {shops[selectedShop]?.blip?.id ?? 'N/A'}, Color: {shops[selectedShop]?.blip?.colour ?? '0'}
                        </button>
                      ) : (
                        <div className="text-sm text-zinc-300">Blip ID: {shops[selectedShop]?.blip?.id ?? 'N/A'}, Color: {shops[selectedShop]?.blip?.colour ?? '0'}</div>
                      )}
                      <span className="text-sm text-zinc-500">Scale:</span>
                      {editMode ? (
                        <input type="number" value={shops[selectedShop]?.blip?.scale || 1.0} onChange={e => setShops(prev => { const u = {...prev}; if (!u[selectedShop].blip) u[selectedShop].blip = {id:0,colour:0,scale:1}; u[selectedShop] = {...u[selectedShop], blip: {...u[selectedShop].blip!, scale: parseFloat(e.target.value)}}; return u })} className="w-20 bg-zinc-800/50 px-2 py-1 text-sm rounded-md border border-zinc-700/50" step="0.1" />
                      ) : (
                        <span className="text-sm text-zinc-300">{shops[selectedShop]?.blip?.scale?.toFixed(1) || '1.0'}</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center">
                  <Package size={32} className="text-zinc-700 mb-4" />
                  <h3 className="text-lg font-medium text-zinc-400 mb-2">No Shop Selected</h3>
                  <p className="text-sm text-zinc-500">Select a shop from the list or create a new one to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BlipSelector
        isOpen={showBlipSelector}
        onClose={() => setShowBlipSelector(false)}
        initialId={shops[validSelectedShop]?.blip?.id}
        initialColour={shops[validSelectedShop]?.blip?.colour}
        onSelect={({ id, colour }) => {
          setShops(prev => {
            const u = { ...prev }
            u[validSelectedShop] = { ...u[validSelectedShop], blip: { id, colour, scale: u[validSelectedShop].blip?.scale || 1 } }
            return u
          })
        }}
      />
    </div>
  )
}
