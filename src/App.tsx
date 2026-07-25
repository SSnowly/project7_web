import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Hash from './pages/Hash'
import Items from './pages/Items'
import Shop from './pages/Shop'
import Crafting from './pages/Crafting'
import Inventory from './pages/Inventory'
import Database from './pages/Database'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/hash" element={<Hash />} />
      <Route path="/items" element={<Items />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/inventory/shop" element={<Shop />} />
      <Route path="/inventory/crafting" element={<Crafting />} />
      <Route path="/inventory/database" element={<Database />} />
    </Routes>
  )
}
