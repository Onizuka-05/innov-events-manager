import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavigationEquipe } from './navigation-equipe';
import { AuthentificationService } from '../../core/authentification.service';

function creer(role: string) {
  TestBed.configureTestingModule({
    imports: [NavigationEquipe],
    providers: [
      provideRouter([]),
      { provide: AuthentificationService, useValue: { utilisateur: () => ({ role }) } },
    ],
  });
  return TestBed.createComponent(NavigationEquipe);
}

describe('Menu equipe', () => {
  it.each([
    ['admin', 10],
    ['employe', 4],
    ['client', 0],
  ] as const)('affiche %s : %i liens', async (role, nombre) => {
    const f = creer(role);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('a')).toHaveLength(nombre);
  });
  it('n’a plus de bouton de menu propre : le menu compact est celui de l’en-tete', async () => {
    const f = creer('admin');
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('button')).toHaveLength(0);
    expect(f.nativeElement.querySelector('nav[aria-label="Espace équipe"]')).not.toBeNull();
  });
});
