import L from 'leaflet'

export const DIR_COLORS_DARK: Record<string, string> = {
  '0': '#00E676',
  '1': '#A78BFA',
  'both': '#8892B0',
}

export const DIR_COLORS_LIGHT: Record<string, string> = {
  '0': '#00913D',
  '1': '#6D28D9',
  'both': '#64748B',
}

export function getDirColors(dark: boolean) {
  return dark ? DIR_COLORS_DARK : DIR_COLORS_LIGHT
}

export function busIcon(bearing?: number, selected = false, dirColor = '#00E676', dark = true) {
  const color = selected ? '#FF9100' : dirColor
  const glow = selected ? 'rgba(255,145,0,0.5)' : `${dirColor}55`
  const rotation = bearing ?? 0
  const windowFill = dark ? 'rgba(10,14,23,0.45)' : 'rgba(255,255,255,0.6)'
  const wheelFill = dark ? 'rgba(10,14,23,0.55)' : 'rgba(255,255,255,0.7)'
  return L.divIcon({
    className: '',
    html: `<svg width="22" height="28" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg"
      style="transform:rotate(${rotation}deg);filter:drop-shadow(0 2px 5px ${glow});overflow:visible;display:block">
      <polygon points="11,0 18,9 4,9" fill="${color}"/>
      <rect x="2" y="8" width="18" height="16" rx="3" fill="${color}"/>
      <rect x="4" y="10" width="14" height="6" rx="1.5" fill="${windowFill}"/>
      <circle cx="7" cy="24" r="2.5" fill="${wheelFill}"/>
      <circle cx="15" cy="24" r="2.5" fill="${wheelFill}"/>
    </svg>`,
    iconSize: [22, 28],
    iconAnchor: [11, 14],
  })
}

export function stopMarkerIcon(color: string, selected = false, dark = true) {
  const bg = selected ? (dark ? '#FFFFFF' : '#000000') : color
  const borderColor = dark ? '#0A0E17' : '#FFFFFF'
  const shadow = selected
    ? (dark ? '0 0 6px rgba(255,255,255,0.7)' : '0 0 6px rgba(0,0,0,0.4)')
    : '0 1px 4px rgba(0,0,0,0.4)'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:10px;height:10px;
      background:${bg};
      border:1.5px solid ${borderColor};
      border-radius:2px;
      box-shadow:${shadow};
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })
}
