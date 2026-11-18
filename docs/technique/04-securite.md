# 4. Sécurité

Détail des mécanismes : [`docs/authentification-et-formulaires.md`](../authentification-et-formulaires.md) et [`docs/conception/CO-06-couches-securite.md`](../conception/CO-06-couches-securite.md). Tests qui prouvent chaque mesure : §5 de [`docs/tests/plan-de-tests.md`](../tests/plan-de-tests.md). Contrôles en production : section 8 du même plan (S1 à S5).

## 4.1 Mesures par risque (référence OWASP Top 10)

| Risque | Mesures |
|---|---|
| Contrôle d'accès défaillant (A01) | Rôle, statut du compte et propriété de la ressource vérifiés par l'API sur chaque route, à partir de la base et non de la session seule ; ressource d'un autre client en 404 ; matrice d'accès de toutes les routes testée pour les quatre rôles ; un compte suspendu ou supprimé perd ses sessions |
| Défaillances cryptographiques (A02) | Mots de passe hachés avec Argon2id (64 Mio, 3 passes) ; HTTPS de bout en bout en production (navigateur → Render, nginx → API, API → Neon, Atlas et Brevo) ; aucun secret dans le dépôt ni dans le code des interfaces |
| Injection (A03) | Requêtes SQL paramétrées uniquement ; champs inconnus refusés ; rôle et statut jamais lus depuis la requête ; affichage par Angular, qui échappe le texte ; e-mails en texte brut ; politique de sécurité du contenu (CSP) stricte posée par nginx (`script-src 'self'`) |
| Conception non sécurisée (A04) | Mot de passe temporaire à usage unique, stocké à part, limité dans le temps, changement imposé ; adresses e-mail non vérifiées jamais utilisées seules pour désigner les données d'une autre entreprise (rattachement d'une demande confirmé par l'administratrice) ; contrôles de concurrence (verrous, vérification de la session dans la même instruction SQL) |
| Mauvaise configuration (A05) | En-têtes de sécurité (helmet côté API ; `X-Content-Type-Options`, `Referrer-Policy`, CSP côté nginx) ; `Cache-Control: no-store` sur l'API ; erreurs sans détail technique ; démarrage refusé si une variable obligatoire manque ou est invalide ; ports locaux liés à `127.0.0.1` |
| Composants vulnérables (A06) | `npm audit --omit=dev --audit-level=high` à chaque exécution de la CI ; versions figées par les fichiers de verrouillage ; veille (chapitre 8) |
| Authentification (A07) | Limitation de débit par adresse IP réelle : 10 connexions, 5 inscriptions, 5 demandes de devis, 5 messages de contact par 15 minutes ; 5 demandes de mot de passe oublié par heure ; limite globale de 1 000 requêtes par 15 minutes ; même réponse que le compte existe ou non ; session régénérée à la connexion |
| Intégrité (A08) | Jeton CSRF obligatoire sur toute écriture (`GET /api/csrf`, puis en-tête `X-CSRF-Token`) ; images d'événement limitées à des URL `https` |
| Journalisation (A09) | Connexions réussies et échouées, actions de gestion des clients, devis et changements de statut journalisés dans MongoDB, avec l'IP réelle pour les connexions ; aucun secret journalisé |
| Requêtes forgées côté serveur (A10) | L'API ne télécharge aucune ressource désignée par l'utilisateur (les images sont affichées par le navigateur) |

## 4.2 Sessions

Cookie `innov.sid` : `HttpOnly`, `SameSite=Lax`, `Secure` en production, durée de 8 heures. Sessions stockées dans PostgreSQL, jamais dans le stockage local du navigateur. Chaque contrôle de propriété vérifie que le compte est actif et que son mot de passe est encore celui qui a ouvert la session : un changement ou une réinitialisation du mot de passe rend les anciennes sessions inutilisables. La session obtenue avec un mot de passe temporaire ne sert qu'à choisir un nouveau mot de passe (environ 15 minutes).

## 4.3 Accès à l'API et adresse IP réelle

Render ne fournit pas de réseau privé sur l'offre gratuite : l'API a une adresse publique. Elle refuse donc toute requête qui ne porte pas le secret `X-Innov-Proxy-Secret`, posé par les deux nginx (403), sauf `GET /api/sante` pour les sondes de l'hébergeur. Les nginx écrasent aussi l'en-tête `X-Innov-Client-Ip` avec l'adresse réelle du visiteur ; l'API ne lit que cet en-tête et ignore `X-Forwarded-For` ou `CF-Connecting-IP` envoyés par le client. Testé avec un nginx réel dans la CI et vérifié en production (S3 : appel direct refusé en 403).

## 4.4 Secrets

- Local : fichier `.env`, non versionné ; modèle sans valeur dans `.env.example`.
- Production : variables d'environnement des services Render ; chaînes de connexion et clé Brevo saisies dans les consoles, jamais écrites dans un fichier du dépôt ni affichées dans un journal.
- Scripts du poste (création de l'administrateur, sauvegarde) : saisie masquée (`Read-Host -AsSecureString`), variable effacée après usage.
- Clé Brevo restreinte aux e-mails transactionnels ; utilisateur Atlas limité à la base des journaux ; accès réseau d'Atlas limité aux adresses de sortie de Render.

## 4.5 Données personnelles

Politique de confidentialité accessible depuis le pied de page (`/confidentialite`) : finalités, sous-traitants (Render, Neon, MongoDB Atlas, Brevo) et leurs régions, durées de conservation, droits. Minimisation : pas de description du besoin affichée dans les listes, pas de prix sur la page publique, avis publiés sans nom. Effacement du compte par le client depuis « Mon profil ». Purges automatiques (chapitre 3). Les données utilisées en démonstration sont fictives.

## 4.6 Limites connues

- Le sujet impose l'envoi d'un mot de passe par e-mail (compte créé à l'envoi d'un devis, oubli) : il est temporaire, à usage unique et impose le changement. Un lien de réinitialisation à usage unique serait préférable pour un produit réel.
- L'adresse e-mail de connexion n'est pas vérifiée et reste modifiable avec le mot de passe actuel : elle ne désigne aucune demande ni aucune fiche. Une personne inscrite avant son premier devis reçoit un mot de passe temporaire à l'envoi de ce devis.
- Les compteurs de limitation de débit sont en mémoire : ils repartent de zéro au redémarrage de l'API (une seule instance).
- En production, la protection placée par l'hébergeur devant les services refuse les textes qui ressemblent à une commande SQL (403) : une saisie légitime de ce type serait refusée. L'application, elle, enregistre ces textes tels quels (vérifié sur une copie isolée).
- La conformité RGPD d'une exploitation réelle (contrats, transferts, registre) n'est pas couverte : le projet ne traite que des données de démonstration.
