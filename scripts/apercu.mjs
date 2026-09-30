// Assemble l'aperçu de démonstration en UN seul fichier HTML autonome (CSS, JS, polices et
// images intégrés) : dist-apercu/linkimmo-apercu.html
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dossier = 'dist-apercu'
let html = readFileSync(join(dossier, 'index.html'), 'utf8')

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g, (_, fichier) => {
  return `<style>${readFileSync(join(dossier, fichier), 'utf8')}</style>`
})
html = html.replace(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g, (_, fichier) => {
  const js = readFileSync(join(dossier, fichier), 'utf8').replace(/<\/script/gi, '<\\/script')
  return `<script type="module">${js}</script>`
})
// Les liens vers des fichiers séparés (icônes du navigateur) ne sont pas publiés : on les retire.
html = html.replace(/<link rel="(icon|apple-touch-icon|manifest)"[^>]*>\n?/g, '')

// La plateforme d'aperçu fournit elle-même <!doctype>, <html>, <head> et <body> : on garde le contenu.
const tete = html.match(/<head>([\s\S]*?)<\/head>/)[1]
const corps = html.match(/<body>([\s\S]*?)<\/body>/)[1]
const titre = tete.match(/<title>.*?<\/title>/)[0]
html = [titre, tete.replace(titre, '').replace(/<meta (charset|name="viewport")[^>]*>\n?/g, ''), corps].join('\n')

const restants = html.match(/(src|href)="\.\/[^"]+"/g)
if (restants) throw new Error(`Ressources non intégrées : ${restants.join(', ')}`)

writeFileSync(join(dossier, 'linkimmo-apercu.html'), html)
console.log(`Aperçu : ${join(dossier, 'linkimmo-apercu.html')} (${Math.round(html.length / 1024)} Ko)`)
