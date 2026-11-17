import { expect, test, type Page } from '@playwright/test';

const utilisateur = {
  id_utilisateur: '2',
  role: 'employe',
  prenom: 'Jose',
  nom: 'Test',
  email_connexion: 'jose@example.org',
  nom_utilisateur: 'jose',
};
const evenement = {
  id_evenement: '3',
  id_client: '9',
  nom: 'Salon de test',
  entreprise: 'Test SAS',
  date_debut: '2027-01-20T09:00:00+00:00',
  date_fin: '2027-01-20T18:00:00+00:00',
  lieu: 'Lyon',
  statut_evenement: 'accepte',
};
const autre = {
  ...evenement,
  id_evenement: '4',
  nom: 'Gala de printemps',
  entreprise: 'Société Équinoxe',
  lieu: 'Marseille',
  statut_evenement: 'brouillon',
};
const client = {
  id_client: '9',
  entreprise: 'Test SAS',
  prenom_contact: 'Camille',
  nom_contact: 'Martin',
  email_contact: 'camille@example.org',
  telephone: '06 12 34 56 78',
  adresse_postale: '1 rue du Test, Lyon',
  date_anonymisation: null,
};

/** API simulee : sessions, liste, fiches et notes, sans serveur reel. */
async function simulerApi(page: Page) {
  let connecte = false;
  const notes: {
    id_note: string;
    contenu: string;
    date_creation: string;
    prenom: string;
    nom: string;
  }[] = [];
  const envois: unknown[] = [];
  await page.route('**/api/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    const methode = route.request().method();
    if (p === '/api/csrf') return route.fulfill({ json: { jeton_csrf: 'test' } });
    if (p === '/api/sessions/courante')
      return route.fulfill({
        status: connecte ? 200 : 401,
        json: connecte ? { utilisateur } : { erreur: 'Connexion requise.' },
      });
    if (p === '/api/sessions' && methode === 'POST') {
      connecte = true;
      return route.fulfill({ json: { utilisateur, changement_mdp_requis: false } });
    }
    if (p === '/api/sessions' && methode === 'DELETE') {
      connecte = false;
      return route.fulfill({ status: 204 });
    }
    if (p === '/api/evenements') return route.fulfill({ json: [evenement, autre] });
    if (p === '/api/evenements/3')
      return route.fulfill({ json: { ...evenement, notes: [...notes], taches: [] } });
    if (p === '/api/clients/9') return route.fulfill({ json: { ...client, evenements: [] } });
    if (p === '/api/notes' && methode === 'POST') {
      const corps = route.request().postDataJSON() as { contenu: string };
      envois.push(corps);
      notes.unshift({
        id_note: String(notes.length + 1),
        contenu: corps.contenu,
        date_creation: '2027-01-19T10:00:00.000Z',
        prenom: 'Jose',
        nom: 'Test',
      });
      return route.fulfill({ status: 201, json: { id_note: String(notes.length) } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return { envois };
}

async function seConnecter(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connexion de l’équipe' })).toBeVisible();
  await page.getByLabel('E-mail').fill('jose@example.org');
  await page.getByLabel('Mot de passe', { exact: true }).fill('Valide1!');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Événements à venir' })).toBeVisible();
}

test('protege la liste et permet connexion puis deconnexion de l’employe', async ({ page }) => {
  await simulerApi(page);
  await seConnecter(page);
  await expect(page.getByRole('heading', { name: 'Salon de test' })).toBeVisible();
  await expect(page.getByText('Test SAS', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Salon de test' })).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion de l’équipe' })).toBeVisible();
});

test('recherche et filtre la liste en annoncant le nombre de resultats', async ({ page }) => {
  await simulerApi(page);
  await seConnecter(page);
  const resultats = page.locator('.resultats[role="status"]');
  await expect(resultats).toContainText('2 événements affichés sur 2');
  await page.getByLabel('Rechercher', { exact: true }).fill('equinoxe');
  await expect(resultats).toContainText('1 événement affiché sur 2');
  await expect(page.getByRole('heading', { name: 'Gala de printemps' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Salon de test' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await page.getByLabel('Statut').selectOption('accepte');
  await expect(resultats).toContainText('1 événement affiché sur 2');
  await expect(page.getByRole('heading', { name: 'Salon de test' })).toBeVisible();
});

test('liste, fiche, client, liens de contact, note puis CGU depuis la connexion', async ({
  page,
}) => {
  const { envois } = await simulerApi(page);
  await seConnecter(page);
  await page.getByRole('link', { name: 'Salon de test' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Salon de test' })).toBeVisible();
  const fiche = page.locator('app-evenement');
  await expect(fiche.getByText('Accepté', { exact: true })).toBeVisible();
  await expect(fiche.getByText('20/01/2027', { exact: false }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Voir la fiche client de Test SAS' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Test SAS' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Appeler Camille Martin' })).toHaveAttribute(
    'href',
    'tel:0612345678',
  );
  await expect(page.getByRole('link', { name: /Envoyer un e-mail/u })).toHaveAttribute(
    'href',
    'mailto:camille@example.org',
  );
  // Navigateur de test Android (Pixel 7) : itineraire Google Maps.
  await expect(page.getByRole('link', { name: /Ouvrir l’itinéraire/u })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/dir/?api=1&destination=1%20rue%20du%20Test%2C%20Lyon',
  );

  await page.getByRole('link', { name: 'Retour à l’événement' }).click();
  await page.getByRole('button', { name: 'Ajouter une note' }).click();
  await expect(page.getByLabel('Nouvelle note')).toBeFocused();
  await page.getByLabel('Nouvelle note').fill('Prévoir les badges des invités.');
  await page.getByRole('button', { name: 'Enregistrer la note' }).click();
  await expect(page.getByText('Note enregistrée et partagée avec l’équipe.')).toBeVisible();
  await expect(page.getByText('Prévoir les badges des invités.')).toBeVisible();
  expect(envois).toEqual([{ id_evenement: '3', contenu: 'Prévoir les badges des invités.' }]);

  await page.getByRole('link', { name: '‹ Retour aux événements' }).click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion de l’équipe' })).toBeVisible();
  // Ionic garde les pages precedentes dans le document : chaque action vise sa page.
  await page
    .locator('app-connexion')
    .getByRole('link', { name: 'Conditions générales d’utilisation' })
    .click();
  const cgu = page.locator('app-page-legale').filter({
    has: page.getByRole('heading', { level: 1, name: 'Conditions générales d’utilisation' }),
  });
  await expect(cgu).toBeVisible();
  await cgu.getByRole('link', { name: 'Conditions générales de vente' }).click();
  await expect(
    page
      .locator('app-page-legale')
      .getByRole('heading', { level: 1, name: 'Conditions générales de vente' }),
  ).toBeVisible();
});
