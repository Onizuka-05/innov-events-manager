import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout sur la pile Docker Compose locale, deja demarree
 * (docker compose up -d) : site web sur le port 8080, Mailpit sur le port 8025.
 * Lances a la main (npm run test:e2e) ; la CI ne demarre pas la pile complete.
 */
export default defineConfig({
  testDir: './e2e',
  // Un seul navigateur a la fois : les tests partagent la boite Mailpit et le quota d'envoi.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:8080',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'Chrome', use: { ...devices['Desktop Chrome'] } }],
});
