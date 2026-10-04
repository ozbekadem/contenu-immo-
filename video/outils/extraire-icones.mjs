// Extrait les icônes Lucide utilisées par l'application (mêmes tracés) vers src/icones.js.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const racine = new URL('../../node_modules/lucide-react/dist/esm/icons/', import.meta.url)
const noms = ['house', 'target', 'users', 'calendar-days', 'menu', 'phone', 'message-circle', 'message-square', 'mail', 'camera', 'map-pin', 'check', 'bell', 'trophy', 'trending-up', 'flame', 'x', 'chevron-right', 'chevron-left', 'plus', 'clock', 'wifi-off', 'calendar-check-2', 'circle-check', 'sparkles', 'image', 'search', 'building-2', 'line-chart', 'chart-line', 'inbox', 'zap', 'bell-ring', 'user-plus', 'phone-off', 'mic-off', 'volume-2', 'grid-3x3', 'arrow-up-right']
const sortie = {}
for (const nom of noms) {
  try {
    const m = await import(new URL(nom + '.mjs', racine).href)
    sortie[nom] = m.__iconData.node.map(([tag, attrs]) => { const { key, ...reste } = attrs; return [tag, reste] })
  } catch (e) { console.error('absente :', nom) }
}
writeFileSync(new URL('../src/icones.js', import.meta.url), '// Tracés des icônes Lucide (identiques à l’application), extraits par outils/extraire-icones.mjs.\nexport const ICONES = ' + JSON.stringify(sortie) + '\n')
console.log(Object.keys(sortie).length, 'icônes')
