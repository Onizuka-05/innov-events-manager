import { expect, test } from '@playwright/test';

test('protege la liste et permet connexion puis deconnexion de l’employe', async ({ page }) => {
  let connecte = false;
  const utilisateur = {
    id_utilisateur: '2',
    role: 'employe',
    prenom: 'Jose',
    nom: 'Test',
    email_connexion: 'jose@example.org',
    nom_utilisateur: 'jose',
  };
  await page.route('**/api/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/api/csrf') return route.fulfill({ json: { jeton_csrf: 'test' } });
    if (p === '/api/sessions/courante')
      return route.fulfill({
        status: connecte ? 200 : 401,
        json: connecte ? { utilisateur } : { erreur: 'Connexion requise.' },
      });
    if (p === '/api/sessions' && route.request().method() === 'POST') {
      connecte = true;
      return route.fulfill({ json: { utilisateur, changement_mdp_requis: false } });
    }
    if (p === '/api/sessions' && route.request().method() === 'DELETE') {
      connecte = false;
      return route.fulfill({ status: 204 });
    }
    if (p === '/api/evenements')
      return route.fulfill({
        json: [
          {
            id_evenement: '3',
            nom: 'Salon de test',
            entreprise: 'Test SAS',
            date_debut: '2027-01-20T09:00:00+00:00',
            date_fin: '2027-01-20T18:00:00+00:00',
            lieu: 'Lyon',
            statut_evenement: 'accepte',
          },
        ],
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connexion de l’équipe' })).toBeVisible();
  await page.getByLabel('E-mail').fill('jose@example.org');
  await page.getByLabel('Mot de passe', { exact: true }).fill('Valide1!');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Événements à venir' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Salon de test' })).toBeVisible();
  await expect(page.getByText('Test SAS', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Salon de test' })).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion de l’équipe' })).toBeVisible();
});
