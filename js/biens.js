/* =========================================================
   LISTE DES BIENS — à tenir à jour
   ---------------------------------------------------------
   Pour ajouter un bien : copiez un bloc { ... }, collez-le
   dans la liste et modifiez les valeurs.
   - transaction : "vente" ou "location"
   - type        : "Maison", "Appartement", "Terrain", "Garage", "Commerce", "Entrepôt"
   - prix        : nombre en euros (ex. 245000) ou null pour "Prix sur demande"
   - statut      : "" | "Nouveau" | "Sous option" | "Vendu" | "Loué"
   - image       : chemin vers la photo (ex. "images/biens/bayemont-1.jpg")
   - lien        : lien vers la fiche détaillée (ou Immoweb)
   Les valeurs null ne s'affichent pas.

   ⚠ Les biens ci-dessous reprennent les rues visibles sur
   immobiliervision.be. Prix, communes et caractéristiques
   sont À COMPLÉTER avec les vraies données.
   ========================================================= */
window.BIENS = [
  {
    id: "7698940",
    transaction: "vente",
    type: "Maison",
    titre: "Maison — Rue Armand Bocquet",
    commune: "Région de Charleroi",
    prix: null,
    chambres: null,
    sdb: null,
    surface: null,
    peb: null,
    statut: "Nouveau",
    image: "images/bien.svg",
    lien: "contact.html?sujet=visite&bien=7698940"
  },
  {
    id: "7082207",
    transaction: "vente",
    type: "Maison",
    titre: "Maison — Rue de Bayemont",
    commune: "Région de Charleroi",
    prix: null,
    chambres: null,
    sdb: null,
    surface: null,
    peb: null,
    statut: "",
    image: "images/bien.svg",
    lien: "contact.html?sujet=visite&bien=7082207"
  },
  {
    id: "6957786",
    transaction: "vente",
    type: "Maison",
    titre: "Maison — Rue de la Villette",
    commune: "Région de Charleroi",
    prix: null,
    chambres: null,
    sdb: null,
    surface: null,
    peb: null,
    statut: "",
    image: "images/bien.svg",
    lien: "contact.html?sujet=visite&bien=6957786"
  },
  {
    id: "6785506",
    transaction: "vente",
    type: "Maison",
    titre: "Maison — Rue de la Glacerie",
    commune: "Région de Charleroi",
    prix: null,
    chambres: null,
    sdb: null,
    surface: null,
    peb: null,
    statut: "",
    image: "images/bien.svg",
    lien: "contact.html?sujet=visite&bien=6785506"
  },
  {
    id: "6269036",
    transaction: "vente",
    type: "Maison",
    titre: "Maison — Rue des Hauchies",
    commune: "Région de Charleroi",
    prix: null,
    chambres: null,
    sdb: null,
    surface: null,
    peb: null,
    statut: "",
    image: "images/bien.svg",
    lien: "contact.html?sujet=visite&bien=6269036"
  }
  /* Exemple de bien en location :
  ,{
    id: "0000001",
    transaction: "location",
    type: "Appartement",
    titre: "Appartement 2 chambres avec terrasse",
    commune: "Montignies-sur-Sambre",
    prix: 850,
    chambres: 2, sdb: 1, surface: 85, peb: "C",
    statut: "",
    image: "images/biens/appartement-1.jpg",
    lien: "contact.html?sujet=visite&bien=0000001"
  }
  */
];
