export interface MapTileOption {
  key: string
  label: string
  url: string
  dark: boolean
}

export const MAP_TILE_OPTIONS: MapTileOption[] = [
  {
    key: 'osm-standard',
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark: false,
  },
  {
    key: 'carto-voyager',
    label: 'CartoDB Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    dark: false,
  },
  {
    key: 'carto-light',
    label: 'CartoDB Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    dark: false,
  },
  {
    key: 'carto-dark',
    label: 'CartoDB Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    dark: true,
  },
  {
    key: 'stadia-dark',
    label: 'Stadia Dark',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    dark: true,
  },
]

const tileMap = new Map(MAP_TILE_OPTIONS.map((t) => [t.key, t]))

export function getTileUrl(key: string): string {
  return tileMap.get(key)?.url ?? MAP_TILE_OPTIONS[0].url
}

export function isTileDark(key: string): boolean {
  return tileMap.get(key)?.dark ?? false
}
