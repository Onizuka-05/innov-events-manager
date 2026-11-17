import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/** Boite de reception de la pile locale et adresse de contact de l'API (docker-compose.yml). */
const MAILPIT = 'http://localhost:8025';
const ADRESSE_CONTACT = 'contact@innov-events.invalid';

interface Adresse {
  Address: string;
}
interface MessageMailpit {
  ID: string;
  Subject: string;
  To: Adresse[];
  ReplyTo: Adresse[];
}

/** Adresse unique par execution : retrouve sans ambiguite l'e-mail de cette demande. */
function emailUnique(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.org`;
}

/** Date future au format des champs de date (AAAA-MM-JJ). */
function dateFuture(jours: number): string {
  return new Date(Date.now() + jours * 86_400_000).toISOString().slice(0, 10);
}

/** Notifications recues dans Mailpit pour une demande, reconnue par son adresse de reponse. */
async function notifications(api: APIRequestContext, email: string): Promise<MessageMailpit[]> {
  const reponse = await api.get(`${MAILPIT}/api/v1/messages?limit=200`);
  expect(reponse.ok(), 'Mailpit doit repondre sur le port 8025').toBe(true);
  const { messages } = (await reponse.json()) as { messages: MessageMailpit[] };
  return messages.filter((m) => m.ReplyTo?.some((a) => a.Address === email));
}

/** Ouvre le formulaire depuis le bouton de l'accueil et attend les types d'evenement. */
async function ouvrirFormulaire(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Demander un devis' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Donnons forme à votre événement' }),
  ).toBeVisible();
  await expect(page.locator('#id_type_evenement option')).not.toHaveCount(1);
}

/** Remplit les champs obligatoires, sauf celui dont l'etiquette est indiquee. */
async function remplir(page: Page, email: string, sauf?: string): Promise<void> {
  const champs: [string, string][] = [
    ['Entreprise *', 'Société Essai Bout en Bout'],
    ['Nom *', 'Martin'],
    ['Prénom *', 'Camille'],
    ['E-mail *', email],
    ['Téléphone *', '0600000000'],
    ['Lieu souhaité *', 'Lyon, salle à définir'],
    ['Date souhaitée *', dateFuture(90)],
    ['Nombre de participants *', '40'],
    ['Description du besoin *', 'Séminaire d’une journée avec ateliers et déjeuner.'],
  ];
  for (const [etiquette, valeur] of champs)
    if (etiquette !== sauf) await page.getByLabel(etiquette, { exact: true }).fill(valeur);
  if (sauf !== 'Type d’événement *')
    await page.getByLabel('Type d’événement *', { exact: true }).selectOption({ index: 1 });
}

test.describe('TST-02 : demande de devis de bout en bout (pile Docker Compose)', () => {
  test('envoie la demande, affiche le remerciement et notifie l’adresse de contact', async ({
    page,
    request,
  }) => {
    const email = emailUnique();
    await ouvrirFormulaire(page);
    await remplir(page, email);
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();

    const confirmation = page.getByRole('status').filter({
      has: page.getByRole('heading', { name: 'Votre demande a été enregistrée' }),
    });
    await expect(confirmation).toBeVisible();
    // Texte de remerciement defini par l'administratrice : present, quel que soit son contenu.
    await expect(confirmation.locator('p').first()).not.toBeEmpty();
    await expect(page.getByText('La notification à l’équipe n’a pas pu être envoyée')).toHaveCount(
      0,
    );

    await expect
      .poll(async () => (await notifications(request, email)).length, { timeout: 15_000 })
      .toBe(1);
    const [message] = await notifications(request, email);
    expect(message!.Subject).toBe('Nouvelle demande de devis');
    expect(message!.To.map((a) => a.Address)).toEqual([ADRESSE_CONTACT]);
    // Le contenu de l'e-mail reprend la demande saisie.
    const detail = await request.get(`${MAILPIT}/api/v1/message/${message!.ID}`);
    const { Text } = (await detail.json()) as { Text: string };
    expect(Text).toContain(`email : ${email}`);
    expect(Text).toContain('entreprise : Société Essai Bout en Bout');
  });

  test('refuse une demande incomplete : message d’erreur, aucun envoi, aucun e-mail', async ({
    page,
    request,
  }) => {
    const email = emailUnique();
    const envois: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/api/prospects')) envois.push(r.url());
    });
    await ouvrirFormulaire(page);
    await remplir(page, email, 'Lieu souhaité *');
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();

    await expect(page.getByRole('alert')).toHaveText('Vérifiez tous les champs obligatoires.');
    const lieu = page.getByLabel('Lieu souhaité *', { exact: true });
    await expect(lieu).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#lieu_souhaite-erreur')).toHaveText('Vérifiez ce champ.');
    await expect(
      page.getByRole('heading', { name: 'Votre demande a été enregistrée' }),
    ).toHaveCount(0);
    // Delai laisse a un eventuel envoi pour prouver qu'il n'a pas eu lieu.
    await page.waitForTimeout(2_000);
    expect(envois).toEqual([]);
    expect(await notifications(request, email)).toEqual([]);
  });
});
