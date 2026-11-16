import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavigationEquipe } from './navigation-equipe';
import { AuthentificationService } from '../../core/authentification.service';

describe('Menu equipe', () => {
  it.each([
    ['admin', 10],
    ['employe', 4],
    ['client', 0],
  ] as const)('affiche %i liens pour %s', async (role, nombre) => {
    TestBed.configureTestingModule({
      imports: [NavigationEquipe],
      providers: [
        provideRouter([]),
        { provide: AuthentificationService, useValue: { utilisateur: () => ({ role }) } },
      ],
    });
    const f = TestBed.createComponent(NavigationEquipe);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('a')).toHaveLength(nombre);
  });
  it('annonce le menu compact et rend le focus avec Echap', async () => {
    TestBed.configureTestingModule({
      imports: [NavigationEquipe],
      providers: [
        provideRouter([]),
        { provide: AuthentificationService, useValue: { utilisateur: () => ({ role: 'admin' }) } },
      ],
    });
    const f = TestBed.createComponent(NavigationEquipe);
    await f.whenStable();
    f.detectChanges();
    const b = f.nativeElement.querySelector('button') as HTMLButtonElement;
    b.style.display = 'block';
    expect(b.getAttribute('aria-expanded')).toBe('false');
    b.click();
    f.detectChanges();
    expect(b.getAttribute('aria-expanded')).toBe('true');
    const a = f.nativeElement.querySelector('a') as HTMLAnchorElement;
    a.focus();
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(b);
  });
});
