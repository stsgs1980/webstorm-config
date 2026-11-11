# Security Policy

## Поддерживаемые версии

Шаблон развивается в ветке `main`, исправления выходят в последней версии.
Форки поддерживают себя самостоятельно.

## Как сообщить об уязвимости

Публичные issue для уязвимостей не используйте. Приватный канал:

1. Откройте вкладку `Security` в репозитории.
2. Нажмите `Report a vulnerability` (GitHub Private Vulnerability Reporting).
3. Опишите шаги воспроизведения, влияние и, если есть, предложение по исправлению.

Первый ответ — в течение 7 дней. После исправления информация попадает в `CHANGELOG.md`.

## Что относится к политике безопасности

- Конфигурация инструментов: ESLint (включая `eslint-rules/`), Prettier, Stylelint,
  markdownlint, Vitest, Husky.
- Git-хуки и скрипты: `.husky/`, `scripts/`.
- Шаблоны IDE в `.idea/`, если они генерируют небезопасный или падающий код.
- Workflow `.github/workflows/ci.yml`: утечки секретов, избыточные права.

## Что не относится

- Уязвимости npm-пакетов: сообщайте разработчикам пакета, обновления приходят
  через Dependabot (`.github/dependabot.yml`).
- Настройки форков и приложений, собранных на базе шаблона.

## npm audit

Снимок на 2026-11-09. Воспроизведение:

```bash
npm audit --omit=dev --audit-level=high   # production-дерево: 0 уязвимостей
npm audit                                 # полное дерево: 0 уязвимостей
```

`npm audit --omit=dev` чист: production-зависимостей с известными уязвимостями
нет, и CI блокирует high/critical именно на этом дереве. У шаблона нет
production-зависимостей: React и react-dom нужны только для линтинга и типов и
стоят в `devDependencies`.

Полное дерево тоже чистое: 0 уязвимостей всех уровней. Цепочка
`minimatch < 11.0.1` (GHSA-g3hv-75wg-m249, CVE-2026-118764) закрыта override
`minimatch: ">=11.0.1"`; `npm ls minimatch` показывает `11.0.5` во всех ветвях
(ESLint-плагины, `typescript-eslint`, `markdownlint-cli`). `npm audit fix --force`
не нужен и может сломать линтеры.

## Overrides

`overrides` в `package.json` фиксируют транзитивные версии:

- `katex`, `smol-toml`, `js-yaml` - вывод из уязвимых диапазонов (история в `CHANGELOG.md`);
- `minimatch: ">=11.0.1"` - вывод из GHSA-g3hv-75wg-m249 (CVE-2026-118764);
  в дереве `11.0.5`. Override закрывает все транзитивные ветви без `--force`.
- `re2js: 2.10.0` - pin выше GHSA-gg6h-894w-4m9c (high, quadratic-time
  lookbehind). `markdownlint 0.42` пинит уязвимый 2.8.6; патч - 2.8.7.
  Исходный точный pin `2.8.7` поднят до `2.9.1` коммитом `f163b4b`,
  затем до `2.10.0` (минорные обновления, полный прогон гейтов зелёный).
  При обновлении `markdownlint` pin пересматривается.

## Меры в репозитории

- Включены secret scanning и push protection.
- В CI минимальные права (`contents: read`) и `HUSKY: 0` для чистой установки.
- Dependabot следит за npm-пакетами и GitHub Actions; открытые алерты
  разбираются, история обновлений - в `CHANGELOG.md`.
