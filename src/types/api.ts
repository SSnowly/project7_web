export interface Item {
  id: string
  name: string
  label: string
  categories: string[]
  game: 'fivem' | 'redm'
  image: string
}

export interface HashResult {
  input: string
  hash: number
  matches: string[]
}
