"""Planche contact : assemble des images PNG en grille (avec numéro d'image, temps et zone sûre TikTok en option)."""
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
def planche(fichiers, sortie, colonnes=6, largeur=270, zone=False):
    hauteur = largeur * 16 // 9
    lignes = (len(fichiers) + colonnes - 1) // colonnes
    marge = 26
    im = Image.new('RGB', (colonnes * largeur, lignes * (hauteur + marge)), (16, 16, 24))
    d = ImageDraw.Draw(im)
    try:
        police = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
    except Exception:
        police = ImageFont.load_default()
    k = largeur / 1080
    for i, f in enumerate(fichiers):
        x, y = (i % colonnes) * largeur, (i // colonnes) * (hauteur + marge)
        img = Image.open(f).convert('RGB').resize((largeur, hauteur), Image.LANCZOS)
        if zone:
            o = Image.new('RGBA', img.size, (0, 0, 0, 0))
            od = ImageDraw.Draw(o)
            od.rectangle([0, 0, largeur, 250 * k], fill=(255, 40, 40, 70))           # onglets du haut
            od.rectangle([940 * k, 250 * k, largeur, 1460 * k], fill=(255, 40, 40, 70))  # boutons de droite
            od.rectangle([0, 1460 * k, largeur, hauteur], fill=(255, 40, 40, 70))     # légende du bas
            img = Image.alpha_composite(img.convert('RGBA'), o).convert('RGB')
        im.paste(img, (x, y + marge))
        nom = os.path.basename(f).split('-')[-1].split('.')[0]
        try:
            n = int(nom)
            etiquette = f'{n} · {n / 60:.2f} s · t {n / 60 / 0.46875:.2f}'
        except ValueError:
            etiquette = nom
        d.text((x + 6, y + 5), etiquette, fill=(220, 220, 240), font=police)
    im.save(sortie)
if __name__ == '__main__':
    dossier, sortie = sys.argv[1], sys.argv[2]
    zone = '--zone' in sys.argv
    planche(sorted(glob.glob(os.path.join(dossier, '*.png'))), sortie, zone=zone)
