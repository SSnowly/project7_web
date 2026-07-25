import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import { X, Search } from 'lucide-react'
import blipIds from '../data/blip-ids.json'
import colors from '../data/colors.json'

interface BlipSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (value: { id: number; colour: number }) => void
  initialId?: number
  initialColour?: number
}

const COMMON_BLIPS = [
  { id: 110, name: 'Gun Shop' },
  { id: 313, name: 'Shooting Range' },
  { id: 374, name: 'Business' },
  { id: 375, name: 'Business For Sale' },
  { id: 402, name: 'Repair' },
  { id: 446, name: "Benny's" },
  { id: 473, name: 'Warehouse' },
  { id: 474, name: 'Warehouse For Sale' },
  { id: 475, name: 'Office' },
  { id: 476, name: 'Office For Sale' },
  { id: 477, name: 'Truck' },
  { id: 478, name: 'Contraband' },
  { id: 480, name: 'VIP' },
  { id: 492, name: 'Clubhouse' },
  { id: 521, name: 'Laptop' },
  { id: 524, name: 'Warehouse Vehicle' },
  { id: 566, name: 'Package' },
  { id: 569, name: 'Garage' },
  { id: 570, name: 'Garage For Sale' },
  { id: 614, name: 'Safe' },
  { id: 619, name: 'Business' }
]

const COMMON_COLORS = [
  { id: 0, name: 'White', color: '#fefefe' },
  { id: 1, name: 'Red', color: '#e03232' },
  { id: 2, name: 'Green', color: '#71cb71' },
  { id: 3, name: 'Blue', color: '#5db6e5' },
  { id: 5, name: 'Yellow', color: '#eec64e' },
  { id: 27, name: 'Bright Purple', color: '#ab3ce6' },
  { id: 46, name: 'Gold', color: '#ECF029' },
  { id: 52, name: 'Dark Green', color: '#416C41' },
  { id: 53, name: 'Blizzard Blue', color: '#B3DDF3' },
  { id: 64, name: 'Dark Orange', color: '#D87B1B' },
  { id: 81, name: 'Orange', color: '#F2A40C' },
  { id: 82, name: 'Light Green', color: '#A4CCAA' }
]

export default function BlipSelector({ isOpen, onClose, onSelect, initialId = 566, initialColour = 31 }: BlipSelectorProps) {
  const [selectedId, setSelectedId] = useState(initialId)
  const [selectedColour, setSelectedColour] = useState(initialColour)
  const [showAllBlips, setShowAllBlips] = useState(false)
  const [showAllColors, setShowAllColors] = useState(false)
  const [searchBlip, setSearchBlip] = useState('')
  const [searchColor, setSearchColor] = useState('')

  const handleSelect = () => {
    onSelect({ id: selectedId, colour: selectedColour })
    onClose()
  }

  const getBlipFilename = (id: number): string => {
    const blip = (blipIds as { id: string; name: string }[]).find(b => b.id === id.toString())
    return blip ? blip.name + '.png' : 'radar_package.png'
  }

  const getColorStyle = (colorId: number): { filter?: string } => {
    const color = (colors as { id: string; color: string; name: string }[]).find(c => parseInt(c.id) === colorId)
    return color ? { filter: `drop-shadow(0 0 2px ${color.color})` } : {}
  }

  const filteredBlips = (showAllBlips
    ? (blipIds as { id: string; name: string }[]).map(blip => ({
        id: parseInt(blip.id),
        name: blip.name.replace('radar_', '').replace(/_/g, ' ').toUpperCase()
      }))
    : COMMON_BLIPS
  ).filter(blip =>
    blip.name.toLowerCase().includes(searchBlip.toLowerCase()) ||
    blip.id.toString().includes(searchBlip)
  )

  const filteredColors = (showAllColors
    ? (colors as { id: string; color: string; name: string }[])
    : COMMON_COLORS
  ).filter(color =>
    color.name.toLowerCase().includes(searchColor.toLowerCase()) ||
    color.id.toString().includes(searchColor)
  )

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-3xl w-full bg-zinc-900 rounded-lg shadow-xl">
          <div className="flex justify-between items-center p-4 border-b border-zinc-800">
            <Dialog.Title className="text-lg font-medium">Select Blip</Dialog.Title>
            <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-300 rounded-md">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Blip Style</h3>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={searchBlip}
                      onChange={e => setSearchBlip(e.target.value)}
                      placeholder="Search blips..."
                      className="pl-8 pr-4 py-1 text-sm bg-zinc-800 rounded-md border border-zinc-700 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                  <button onClick={() => setShowAllBlips(!showAllBlips)} className="text-xs text-zinc-500 hover:text-zinc-400">
                    {showAllBlips ? 'Show Common' : 'Show All'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-8 gap-2 max-h-[300px] overflow-y-auto pr-2">
                {filteredBlips.map(blip => (
                  <button
                    key={blip.id}
                    onClick={() => setSelectedId(blip.id)}
                    className={`p-2 text-center rounded-md border ${
                      selectedId === blip.id
                        ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                        : 'border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    <div className="w-8 h-8 mx-auto mb-1 relative">
                      <img
                        src={`/blips/${getBlipFilename(blip.id)}`}
                        alt={blip.name}
                        className="w-full h-full object-contain"
                        style={getColorStyle(selectedColour)}
                      />
                    </div>
                    <div className="text-xs">Id: {blip.id}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Blip Color</h3>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={searchColor}
                      onChange={e => setSearchColor(e.target.value)}
                      placeholder="Search colors..."
                      className="pl-8 pr-4 py-1 text-sm bg-zinc-800 rounded-md border border-zinc-700 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                  <button onClick={() => setShowAllColors(!showAllColors)} className="text-xs text-zinc-500 hover:text-zinc-400">
                    {showAllColors ? 'Show Common' : 'Show All'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-8 gap-2 max-h-[300px] overflow-y-auto pr-2">
                {filteredColors.map(color => {
                  const colorId = typeof color.id === 'string' ? parseInt(color.id) : color.id
                  return (
                    <button
                      key={color.id}
                      onClick={() => setSelectedColour(colorId)}
                      className={`p-2 text-center rounded-md border ${
                        selectedColour === colorId
                          ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                          : 'border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      <div className="w-8 h-8 mx-auto mb-1 relative">
                        <img
                          src={`/blips/${getBlipFilename(selectedId)}`}
                          alt={`Color ${color.id}`}
                          className="w-full h-full object-contain"
                          style={{ backgroundColor: color.color }}
                        />
                      </div>
                      <div className="text-xs">Color: {color.id}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300">
              Cancel
            </button>
            <button onClick={handleSelect} className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md">
              Select
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
