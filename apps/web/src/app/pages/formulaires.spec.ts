import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApiService } from '../core/api.service';
import { routes } from '../app.routes';

describe('Formulaires publics', () => {
  let modifier: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    modifier = vi.fn(async () => ({
      texte_remerciement: 'Merci personnalisé',
      notification_envoyee: true,
      message: 'Message envoyé',
    }));
    get = vi.fn(async () => [{ id_type_evenement: 1, libelle: 'Séminaire' }]);
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: ApiService, useValue: { get, modifier } }],
    });
  });

  async function ouvrir(url: string) {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl(url);
    await h.fixture.whenStable();
    return h;
  }
  function saisir(h: RouterTestingHarness, id: string, valeur: string) {
    const input = h.routeNativeElement!.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(`#${id}`)!;
    input.value = valeur;
    input.dispatchEvent(
      new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
    );
  }
  async function envoyer(h: RouterTestingHarness) {
    h.detectChanges();
    h.routeNativeElement!.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await h.fixture.whenStable();
    h.detectChanges();
  }

  it('reprend les champs, titres, etapes et libelles de W1', async () => {
    const h = await ouvrir('/demande-devis');
    const e = h.routeNativeElement!;
    expect(e.querySelector('h1')?.textContent).toBe('Donnons forme à votre événement');
    expect(e.querySelectorAll('input[required],select[required],textarea[required]')).toHaveLength(
      10,
    );
    for (const c of e.querySelectorAll('input,select,textarea'))
      expect(e.querySelector(`label[for="${c.id}"]`)).not.toBeNull();
    expect(e.querySelectorAll('aside li')).toHaveLength(3);
    expect(e.querySelector('.disposition-devis')).not.toBeNull();
  });
  it('n’envoie pas une demande incomplete et signale les champs invalides', async () => {
    const h = await ouvrir('/demande-devis');
    await envoyer(h);
    expect(modifier).not.toHaveBeenCalled();
    expect(h.routeNativeElement!.querySelector('[role=alert]')?.textContent).toContain(
      'champs obligatoires',
    );
    expect(h.routeNativeElement!.querySelector('#entreprise')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });
  it('envoie les types numeriques et affiche uniquement le message recu apres succes', async () => {
    const h = await ouvrir('/demande-devis');
    for (const [id, valeur] of Object.entries({
      entreprise: 'Aster',
      nom: 'Martin',
      prenom: 'Camille',
      email: 'client@example.org',
      telephone: '0000000000',
      lieu_souhaite: 'Paris',
      date_souhaitee: '2027-01-28',
      id_type_evenement: '1',
      nb_participants: '80',
      description_besoin: 'Un séminaire.',
    }))
      saisir(h, id, valeur);
    expect(h.routeNativeElement!.textContent).not.toContain('Merci personnalisé');
    await envoyer(h);
    expect(modifier).toHaveBeenCalledWith(
      'POST',
      '/prospects',
      expect.objectContaining({ id_type_evenement: 1, nb_participants: 80 }),
    );
    expect(h.routeNativeElement!.querySelector('[role=status]')?.textContent).toContain(
      'Merci personnalisé',
    );
  });
  it('conserve les saisies si l’enregistrement echoue', async () => {
    modifier.mockRejectedValue(
      new HttpErrorResponse({ status: 503, error: { erreur: 'Service indisponible' } }),
    );
    const h = await ouvrir('/contact');
    saisir(h, 'email', 'client@example.org');
    saisir(h, 'titre', 'Question');
    saisir(h, 'description', 'Bonjour');
    await envoyer(h);
    expect(h.routeNativeElement!.querySelector<HTMLInputElement>('#titre')?.value).toBe('Question');
    expect(h.routeNativeElement!.querySelector('[role=alert]')?.textContent).toContain(
      'Service indisponible',
    );
  });
  it('verifie l’e-mail conditionnel du contact', async () => {
    const h = await ouvrir('/contact');
    saisir(h, 'titre', 'Question');
    saisir(h, 'description', 'Bonjour');
    await envoyer(h);
    expect(modifier).not.toHaveBeenCalled();
    saisir(h, 'nom_utilisateur', 'camille');
    await envoyer(h);
    expect(modifier).toHaveBeenCalledOnce();
  });
  it('affiche un message comme texte, sans executer son contenu HTML', async () => {
    modifier.mockResolvedValue({ message: '<img src=x onerror=alert(1)>' });
    const h = await ouvrir('/contact');
    saisir(h, 'email', 'client@example.org');
    saisir(h, 'titre', 'Question');
    saisir(h, 'description', 'Bonjour');
    await envoyer(h);
    expect(h.routeNativeElement!.querySelector('[role=status]')?.textContent).toContain('<img');
    expect(h.routeNativeElement!.querySelector('img')).toBeNull();
  });
});
