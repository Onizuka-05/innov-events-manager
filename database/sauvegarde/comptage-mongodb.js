// Nombre de documents de chaque collection de la base indiquee par INNOV_BASE,
// une ligne "collection;nombre" par collection. Lecture seule.
// Utilise par Sauvegarder-Bases.ps1 et Restaurer-Bases.ps1.
const base = db.getSiblingDB(process.env.INNOV_BASE);
base
  .getCollectionNames()
  .filter((nom) => !nom.startsWith('system.'))
  .sort()
  .forEach((nom) => print(`${nom};${base.getCollection(nom).countDocuments({})}`));
