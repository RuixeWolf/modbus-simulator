<div align="center">

# Simulateur de périphérique Modbus

<p>
  <a href="../README.md">English</a> |
  <a href="README_CN.md">中文</a> |
  <a href="README_JA.md">日本語</a>
</p>

Un simulateur de périphérique Modbus TCP / RTU série gratuit avec un tableau de bord Web en temps réel.

> **Vibe Coding** — Ce projet est principalement construit grâce au développement rapide assisté par IA.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Aperçu

**Modbus Device Simulator** est un simulateur de périphérique Modbus full-stack construit avec des technologies Web modernes. Il exécute à la fois un **serveur Modbus TCP** et un **serveur série RTU**, pilotés par un moteur d'état singleton haute performance, et expose un tableau de bord Web en temps réel pour surveiller et contrôler les registres, consulter les journaux de communication et configurer les paramètres du serveur.

Que vous développiez des applications client Modbus, testiez des intégrations PLC ou appreniez le protocole Modbus, ce simulateur fournit une solution légère sans matériel.

## Fonctionnalités

- **Prise en charge double protocole**
  - **Serveur Modbus TCP** — Port configurable (par défaut 502) avec suivi des clients actifs
  - **Serveur série Modbus RTU** — Intégration port série réel avec débit en bauds, parité, bits de données et bits d'arrêt configurables
- **Couverture complète des registres**
  - 1 000 Coils (booléens lecture/écriture)
  - 1 000 Entrées discrètes (booléens lecture seule)
  - 10 000 Registres de maintien (16 bits lecture/écriture)
  - 10 000 Registres d'entrée (16 bits lecture seule)
- **Tableau de bord en temps réel**
  - Tables de registres en direct avec pagination et saut d'adresse
  - Basculer les coils et écrire les valeurs des registres de maintien/d'entrée directement depuis l'interface
  - **Écriture avancée de registres** — Écrire des valeurs multi-registres à l'aide de formats de données typés (UInt8, Int16BE, FloatBE, DoubleLE, etc.) ou de chaînes d'octets hexadécimales brutes
  - Journaux de communication en ordre chronologique inverse (le plus récent en premier)
  - Filtrage configurable des journaux (lecture / écriture / erreur / connexion)
  - État du serveur, clients TCP actifs et panneau de configuration
- **Journalisation des communications**
  - Tampon de journaux en mémoire avec nombre maximal configurable (100–10 000 entrées)
  - Suivi des requêtes, réponses, erreurs et connexions TCP
  - Annotation de la source pour chaque entrée de journal (TCP, série ou Web)
- **Internationalisation**
  - Anglais, Chinois (中文), Français et Japonais (日本語)
- **Prise en charge des thèmes**
  - Modes Clair / Sombre / Système
- **API REST**
  - API HTTP complète pour l'intégration externe et l'automatisation, incluant les écritures de registres par lots

### Tableau de bord Web

![Tableau de bord Web](./screenshots/web-dashboard.png)

## Stack technique

| Couche          | Technologie                                                             |
| --------------- | ----------------------------------------------------------------------- |
| Framework       | [Next.js](https://nextjs.org/) 16 (App Router)                          |
| Bibliothèque UI | [React](https://react.dev/) 19                                          |
| Composants      | [HeroUI](https://www.heroui.com/) v3                                    |
| Style           | [Tailwind CSS](https://tailwindcss.com/) v4                             |
| Langage         | [TypeScript](https://www.typescriptlang.org/)                           |
| Modbus TCP      | [modbus-serial](https://github.com/yaacov/node-modbus-serial)           |
| Modbus RTU      | [serialport](https://serialport.io/) + analyseur de trames personnalisé |
| Tests           | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)   |
| Icônes          | [Iconify](https://iconify.design/) (Lucide)                             |
| Animation       | [Framer Motion](https://www.framer.com/motion/)                         |

## Démarrage rapide

### Exécution avec NPX (sans installation)

Le moyen le plus rapide de commencer — aucun clonage ni installation requis :

```bash
npx @ruixe/modbus-simulator@latest
```

Avec options :

```bash
npx @ruixe/modbus-simulator@latest -p 8080 -t 5020 -o
```

Voir toutes les options disponibles :

```bash
npx @ruixe/modbus-simulator@latest --help
```

### Prérequis

- [Node.js](https://nodejs.org/) 20.6 ou ultérieur
- [npm](https://www.npmjs.com/) ou [pnpm](https://pnpm.io/)

### Installation (Développement)

```bash
# Cloner le dépôt
git clone https://github.com/RuixeWolf/modbus-simulator.git
cd modbus-simulator

# Installer les dépendances
npm install
# ou
pnpm install
```

### Développement

```bash
# Démarrer le serveur de développement (port par défaut 5000)
npm run dev
```

Ouvrez [http://localhost:5000](http://localhost:5000) dans votre navigateur.

Le serveur Modbus TCP démarre automatiquement sur le port `502` (ou selon la configuration). Le serveur série RTU ne démarre que lorsqu'un chemin de port série est configuré.

### Build de production

```bash
# Build pour la production
npm run build

# Démarrer le serveur de production
npm start
```

## Configuration

Créez un fichier `.env.local` à la racine du projet pour personnaliser les paramètres :

```bash
# Port du serveur de développement Next.js (par défaut 5000)
PORT=5000

# Port Modbus TCP (utilisé en production ; le serveur de dev démarre toujours TCP sur 502)
MODBUS_TCP_PORT=502
```

Les paramètres du serveur (port TCP, ID esclave, chemin série RTU, débit en bauds, parité, filtre de journaux, nombre maximal de journaux, etc.) peuvent également être modifiés à l'exécution via le tableau de bord Web ou le point de terminaison `/api/config`.

## Utilisation

### Tableau de bord Web

1. Ouvrez le tableau de bord à l'adresse `http://localhost:5000`
2. **Registres** — Affichez tous les coils, entrées discrètes, registres de maintien et registres d'entrée. Basculez les coils ou modifiez les valeurs des registres directement. Utilisez **Écriture avancée** pour des valeurs multi-registres typées ou des octets hexadécimaux bruts.
3. **Journaux** — Surveillez toutes les communications Modbus en temps réel. Filtrez par type de journal et effacez les journaux selon les besoins.
4. **Paramètres** — Configurez le port TCP, l'ID esclave, le chemin du port série RTU, les paramètres série, le filtre de journaux et le nombre maximal de journaux. Les modifications prennent effet immédiatement après le redémarrage des serveurs.

### Connexion avec un client Modbus

**Modbus TCP (avec [modbus-serial](https://github.com/yaacov/node-modbus-serial)) :**

```javascript
const { ModbusTCP } = require('modbus-serial')
const client = new ModbusTCP()
await client.connectTCP('127.0.0.1', { port: 502 })

// Lire les registres de maintien
const data = await client.readHoldingRegisters(0, 10)
console.log(data.data)

// Écrire un coil
await client.writeCoil(0, true)

client.close()
```

**Modbus RTU (port série) :**

Configurez le chemin du port série RTU (par exemple `COM3` sur Windows, `/dev/ttyUSB0` sur Linux) dans les paramètres du tableau de bord, puis connectez-vous avec n'importe quel client Modbus RTU standard.

## Référence API

Toutes les routes API sont préfixées par `/api` et nécessitent que le serveur de développement soit en cours d'exécution.

| Méthode | Point de terminaison   | Description                                                                                                                                          |
| ------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/api/registers`       | Récupérer l'état complet du moteur Modbus                                                                                                            |
| POST    | `/api/registers`       | Écrire un coil ou un registre. Corps : `{ registerType, address, value }`                                                                            |
| POST    | `/api/registers/batch` | Écriture par lots de registres. Corps : `{ registerType, startAddress, mode, dataType, value }` ou `{ registerType, startAddress, mode, hexString }` |
| GET     | `/api/logs`            | Récupérer tous les journaux de communication                                                                                                         |
| DELETE  | `/api/logs`            | Effacer tous les journaux de communication                                                                                                           |
| GET     | `/api/status`          | État du serveur : `{ tcp: boolean, rtu: boolean }`                                                                                                   |
| GET     | `/api/config`          | Récupérer la configuration actuelle (inclut `logFilter` et `logMaxCount`)                                                                            |
| POST    | `/api/config`          | Mettre à jour la configuration et redémarrer les serveurs. Corps : objet de configuration partiel                                                    |
| GET     | `/api/serial-ports`    | Lister les ports série disponibles                                                                                                                   |
| GET     | `/api/tcp-clients`     | Lister les connexions client TCP actives                                                                                                             |
| GET     | `/api/tcp-clients/:id` | Récupérer les détails d'un client TCP spécifique                                                                                                     |

### API d'écriture par lots

Le point de terminaison d'écriture par lots prend en charge deux modes :

**Mode nombre** — Convertir une valeur numérique en registres à l'aide d'un format de données typé :

```bash
curl -X POST http://localhost:5000/api/registers/batch \
  -H "Content-Type: application/json" \
  -d '{
    "registerType": "holdingRegister",
    "startAddress": 0,
    "mode": "number",
    "dataType": "FloatBE",
    "value": 3.14
  }'
```

Types de données pris en charge : `UInt8`, `UInt16BE`, `UInt16LE`, `UInt32BE`, `UInt32LE`, `UIntBE`, `UIntLE`, `Int8`, `Int16BE`, `Int16LE`, `Int32BE`, `Int32LE`, `IntBE`, `IntLE`, `FloatBE`, `FloatLE`, `Float1234`, `Float2143`, `Float3412`, `Float4321`, `DoubleBE`, `DoubleLE`.

**Mode octets** — Écrire des octets bruts à partir d'une chaîne hexadécimale :

```bash
curl -X POST http://localhost:5000/api/registers/batch \
  -H "Content-Type: application/json" \
  -d '{
    "registerType": "holdingRegister",
    "startAddress": 10,
    "mode": "bytes",
    "hexString": "0A 45 B1 30"
  }'
```

## Structure du projet

```
modbus-simulator/
├── app/
│   ├── api/                    # Routes API Next.js
│   │   ├── config/route.ts
│   │   ├── logs/route.ts
│   │   ├── registers/route.ts
│   │   ├── registers/batch/route.ts
│   │   ├── serial-ports/route.ts
│   │   ├── status/route.ts
│   │   ├── tcp-clients/route.ts
│   │   └── tcp-clients/[id]/route.ts
│   ├── globals.css             # Entrée Tailwind CSS v4 + variables de thème
│   ├── layout.tsx              # Layout racine avec i18n & thème
│   └── page.tsx                # Page tableau de bord (composant client)
├── src/
│   ├── components/
│   │   ├── AdvancedWriteModal.tsx   # Modale d'écriture avancée multi-registres
│   │   ├── LanguageSwitcher.tsx     # Sélecteur de langue
│   │   ├── LogPanel.tsx             # Panneau de journaux de communication
│   │   ├── RegisterTable.tsx        # Table de registres paginée
│   │   ├── SettingsPanel.tsx        # Panneau de paramètres du serveur
│   │   ├── StatusIndicator.tsx      # Indicateur d'état du serveur
│   │   ├── TcpClientPanel.tsx       # Liste des clients TCP actifs
│   │   └── ThemeToggle.tsx          # Bascule de thème clair/sombre/système
│   ├── hooks/
│   │   ├── useModbusData.ts    # Hook React pour le polling des données Modbus
│   │   └── useTheme.ts         # Gestion du thème (clair/sombre/système)
│   ├── i18n/
│   │   └── index.ts            # Initialisation i18next (EN / CN / FR / JA)
│   ├── lib/
│   │   └── modbus/
│   │       ├── buffer-convert.ts     # Conversions type de données ↔ buffer
│   │       ├── engine.ts             # ModbusEngine singleton (état + événements)
│   │       ├── engine.test.ts        # Tests unitaires du moteur
│   │       ├── index.ts              # Gestionnaire de serveurs (démarrage/arrêt/config)
│   │       ├── log-context.ts        # AsyncLocalStorage pour le contexte de source de journal
│   │       ├── mock-client.ts        # Client simulé pour les tests E2E
│   │       ├── rtu-serial-server.ts  # Serveur série Modbus RTU
│   │       └── tcp-server.ts         # Serveur Modbus TCP
│   └── types/
│       └── modbus-serial.d.ts  # Déclarations de types personnalisées
├── docs/                       # Documentation et captures d'écran
├── e2e/                        # Tests E2E Playwright
├── public/locales/             # Fichiers JSON de traduction (en, zh, fr, ja)
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

## Tests

```bash
# Exécuter les tests unitaires (Vitest)
npm run test:unit

# Exécuter les tests E2E (Playwright)
npm run test:e2e

# Exécuter tous les tests
npm run test

# Exécuter un fichier de test unitaire spécifique
npx vitest run src/lib/modbus/engine.test.ts

# Exécuter un test E2E spécifique
npx playwright test e2e/modbus.spec.ts --grep "UI to Protocol"
```

## Scripts disponibles

| Script               | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Démarrer le serveur de développement (port par défaut 5000) |
| `npm run build`      | Build de production                                         |
| `npm run start`      | Démarrer le serveur de production                           |
| `npm run lint`       | Exécuter ESLint                                             |
| `npm run format`     | Formater tous les fichiers avec Prettier                    |
| `npm run type-check` | Exécuter le compilateur TypeScript (sans émission)          |
| `npm run test:unit`  | Exécuter les tests unitaires Vitest                         |
| `npm run test:e2e`   | Exécuter les tests E2E Playwright                           |
| `npm run test`       | Exécuter les tests unitaires puis les tests E2E             |

## Licence

[MIT](LICENSE)
