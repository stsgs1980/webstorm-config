# webstorm-config: итоговый отчёт и план работ

Дата: 2026-11-02, статусы сверены по коммиту `da9d648`.
База проверки: `main` @ `da9d648`; все правки предыдущих сеансов закоммичены,
рабочее дерево чистое. Закрытые пункты помечены `[CLOSED]`, открытые - `[OPEN]`.

Методика: каждое положение двухагентного аудита перепроверено против фактического
состояния репо (чтение конфигов, `grep`, прогоны ворот), состояние машины - по
`product-info.json` каталога установки и баннеру `idea.log`; имя каталога установки
после обновления на месте не меняется и версией не является. Выводы "на слух" из
старого корпуса аудитов не принимались.

## 1. Вердикт

- [OK] Тулчейн и ворота живы: 87 тестов в 8 файлах зелёные при изолированном
  прогоне; `lint`, `lint:md`, `lint:css`, `format:check`, `check:docs`,
  `check:file-length`, `check:templates`, `typecheck` проходят.
- [CLOSED] Красный CI на `check:docs`: путь, который git игнорирует, признан
  легитимной ссылкой (коммит `3ba78a3`); прогон сейчас - 13 документов `[OK]`.
- [CLOSED] `AGENTS.md` канонизирован (коммит `3226106`): 147 строк правил в корне,
  `.aiassistant/rules/AI Rules.md` - указатель из 13 строк, `check-docs` сканирует
  AGENTS.md.
- [OPEN] Хвост канонизации: `README.md:108` всё ещё отправляет за конвенциями в
  `.aiassistant/rules/AI Rules.md`, где теперь указатель.
- [CLOSED] `.env.example` создан: плейсхолдеры и шапка "copy to .env, never
  commit .env" - P1-4.
- [CLOSED] IDE-профиль синхронизирован с metrics: `OverlyLongFunctionJS` 60,
  `ParametersPerFunction` 4 - P1-5.
- [CLOSED] Статусы `docs/webstorm-settings.md` сверены 02.11: п. 3 закрыт,
  п. 7 решён - P1-6.
- [CLOSED] Roadmap-гигиена: `docs/architecture.md`, `docs/security.md`,
  `docs/api.md` созданы, whitelist будущих путей удалён из `check-docs` - P1-7.
- [CLOSED] Coverage-гейт: принято 80% строк на изменённый файл (не глобально);
  схема записана в `docs/testing.md`, реализация - отдельная задача - P1-8.
- [CLOSED] P2-9: Playwright-план в `docs/testing.md`, `test:e2e` в таблице
  скриптов `README.template.md`; `check-docs` знает имя с цифрой.
- [CLOSED] P2-10: `react`/`react-dom` в devDependencies (prod-дерево пустое),
  `.opencode/**`/`.agents/**` в игнорах ESLint, exempt печатается при провале.
- [CLOSED] P2-11: раздел "Версии IDE" в `docs/webstorm.md` - Vitest 5, TS 7 LSP,
  Chrome Connect, Git Worktree.
- [CLOSED] P2-12: `docs/webstorm-settings.md` переписан в runbook синхронизации,
  открытая задача Save Actions - GitHub issue #19.
- [CLOSED] P2-13: пути `%APPDATA%` версия-независимы (`WebStorm<версия>`),
  пояснение добавлено в `docs/settings-levels.md`.
- [CLOSED] P2-14: пакет правок по аудиту 31.10 - миграция, Vue/Next, Analyze code,
  плейсхолдеры, `workspace.xml`, словарь, watchers, указатель в `README.md`.
- [CLOSED] P3: сноски и низкие находки закрыты; скрипт копирования шаблонов и
  `check:settings-drift` отклонены как хрупкие и машинно-специфичные.
- [CLOSED] WebStorm на машине 2026.2.4 (build WS-262.11879.105): минимум по
  бюллетеню eMudhra выполнен; остаётся ручная проверка IJPL-101766 в редакторе -
  P0-2.
- [CLOSED] Генератор changelog (N1): чанк читается из `-u --stdout`, прошлый блок
  заменяется, заголовок стабилен; `CHANGELOG.md` пересобран, повторный прогон даёт
  "up to date" - `ff87744`.
- [CLOSED] Тесты чувствительны к нагрузке: `testTimeout` поднят до 30 000 мс в
  `vitest.config.ts`; 87/87 изолированно, pre-push больше не падает на спавнах -
  N2.
- [CLOSED] `typecheck` подхватывал `dev/templates-check-<pid>`: `dev` исключён в
  `tsconfig.base.json`, а рендер и eslint-фикстуры получили собственный
  `tsconfig.json` рядом с файлами - N3.
- [CLOSED] Изоляция git-фикстур: хук экспортирует `GIT_DIR`, и фикстурные
  `git init`/`commit` уходили в пушимый репозиторий. Теперь `tests/lib/git-env.mjs`
  вычищает все `GIT_*`-переменные; найденный на PR #18 инцидент закрыт.
- [DELAY] Находка "React Buddy не установлен" опровергнута: плагин `reactbuddy`
  стоит, `docs/webstorm.md` параграф 9 правдив.

## 2. Перепроверка находок

Формат: **находка** - факт перепроверки -> вердикт.

- **CI красный на `check:docs`, `settings-levels.md:76`** - воспроизведено; причина -
  белый список `.idea/` -> [CLOSED], коммит `3ba78a3`.
- **`AGENTS.md` нет в корне** - на `f7dd262` верно -> [CLOSED], коммит `3226106`.
- **`.env.example` нет** - [CLOSED]: файл создан с плейсхолдерами, P1-4.
- **Дрейф порогов IDE-профиля** - [CLOSED]: профиль 60/15/4/4 совпадает с
  metrics, P1-5.
- **`webstorm-settings.md` устарел** - [CLOSED]: статусы сверены 02.11, п. 3 и
  п. 7 закрыты, P1-6.
- **Roadmap-пути без файлов** - [CLOSED]: три документа созданы, whitelist
  `KNOWN_FUTURE_PATHS` удалён, проверка прозы оставлена ручной, P1-7.
- **WebStorm 2026.2.0.1** - имя каталога установки не обновляется; `product-info.json`
  и `idea.log` дают 2026.2.4 (build WS-262.11879.105) -> [CLOSED], P0-2.
- **`react` в dependencies** - [CLOSED]: перенесён в devDependencies, production
  дерево шаблона пустое, P2-10.
- **Игноры ESLint несимметричны** - [CLOSED]: `.opencode/**` и `.agents/**`
  добавлены в основной конфиг, P2-10.
- **`%APPDATA%` захардкожен** - 12 упоминаний в трёх документах `docs/` ->
  подтверждено, P2-13.
- **"Prettier on save" не настроен** - `.idea/prettier.xml`: `myRunOnSave=true` -
  находка снята.
- **Словарь в whitelist git** - `!.idea/dictionaries/` в `.gitignore` ->
  подтверждено: сознательное отклонение, P2-14.
- **React Buddy не установлен** - каталог плагинов: `reactbuddy`, `lsp4ij`,
  `intellij-plugin-save-actions` -> опровергнуто.
- **Save Actions конфликтует с Actions on Save** - плагин установлен и активен в
  `workspace.xml` -> подтверждено, машинная задача.
- **`revert` не в списке типов** - `config-conventional` пропускает `revert`
  штатно -> [OPEN], FIX-DOC.
- **Live templates не читаются проектно** - IDEABKL-5033; обходы: импорт 24.10 +
  `check:templates` -> подтверждено, ограничение платформы.
- **IJPL-101766 (подсветка в литералах)** - баг платформы, обход `String.raw` ->
  остаётся, перепроверить после обновления IDE.
- **TypeScript 7 сейчас** - peer `typescript-eslint` `<6.1.0`; dependabot
  блокирует мажоры -> решение верно: держать TS 5.9.
- **CHANGELOG свежий** - воспроизведено: пустой черновик и "up to date" ->
  [CLOSED], коммит `ff87744`; повторный прогон теперь идемпотентен.
- **Тесты и `GIT_DIR` из хука** - в linked worktree фикстуры коммитили в пушимую
  ветку, а `core.bare` переключался на true -> [CLOSED]: `tests/lib/git-env.mjs`,
  регрессионный тест с подставленным `GIT_DIR`.

## 3. Сделано и закоммичено

1. `check-docs` больше не режет пути из `.gitignore` (личные файлы по белому
   списку); тест-фикстура с настоящим `git init`, 8/8 проходят - `3ba78a3`.
2. Шаблон-чекер рендерит в pid-уникальный каталог `dev/templates-check-<pid>`:
   параллельные вызовы больше не затирают рендер друг друга; регрессионный тест -
   `45f242f`.
3. Черновая зона `drafts/` выведена из всех ворот: `.gitignore`, `.prettierignore`,
   игноры `eslint.config.js`, `--ignore drafts` в `lint:md` - `7fde789`.
4. Dependabot: `@eslint/js` добавлен в игнор мажоров; `npm audit fix` очистил
   `zod`/`fast-uri`; prod-зависимости - 0 уязвимостей - `f7dd262`.
5. `AGENTS.md` - канон, `AI Rules.md` - указатель, `check-docs` сканирует корень -
   `3226106`.
6. Генератор changelog: чанк из `-u --stdout`, замена своего блока, стабильный
   заголовок; три новых теста, включая прогон реального генератора - `ff87744`.

## 4. План работ

Порядок: P0 сегодня, P1 неделя, P2 две недели, P3 опционально; FIX-DOC - один PR
к тексту правил. Один пункт = один коммит. Пункты N1-N3 добавлены при сверке
02.11 и стоят в той же очереди.

### 4.1 P0

- **1.** [CLOSED] Закоммитить правки раздела 3 и убедиться, что CI на `main`
  зелёный. Где: репо. Коммиты `3ba78a3`, `7fde789`, `45f242f`, `bfe7e60`.
- **2.** [CLOSED] Обновить WebStorm на машине. Где: машина. Проверено:
  `product-info.json` - 2026.2.4, build WS-262.11879.105; `idea.log` - та же
  сборка от 29.10.2026. Осталась ручная проверка IJPL-101766.
- **3.** [CLOSED] Канонизировать `AGENTS.md`. Где: репо. Коммит `3226106`.
- **N1.** [CLOSED] Генератор changelog: чанк читается из `-u --stdout` без входного
  файла, прошлый блок заменяется вместо дублирования, заголовок `# Unreleased`
  стабилен; добавлены тесты на реальном генераторе. Где: `scripts/`, `tests/`.
  Коммит `ff87744`; `CHANGELOG.md` пересобран.

### 4.2 P1

- **4.** [CLOSED] `.env.example` создан: два плейсхолдера и шапка "copy to .env,
  never commit .env". Где: репо.
- **5.** [CLOSED] IDE-профиль синхронизирован с metrics: `OverlyLongFunctionJS`
  60, `ParametersPerFunction` 4; пороги внесены в таблицу "Где проверяется" в
  `docs/webstorm.md`. Где: `.idea/inspectionProfiles/`.
- **6.** [CLOSED] Статусы `docs/webstorm-settings.md` сверены 02.11.2026: п. 3
  закрыт, п. 7 решён; расформирование файла осталось в P2-12. Где: репо.
- **7.** [CLOSED] Roadmap-гигиена: `docs/architecture.md`, `docs/security.md` и
  `docs/api.md` написаны; whitelist будущих путей удалён из `scripts/check-docs.ts`,
  обещание скрипта проверки прозы снято и зафиксировано как ручная проверка.
  Где: репо.
- **8.** [CLOSED] Coverage-гейт: решение - 80% строк на изменённый файл через
  `vitest related --coverage`, не глобальный порог; схема и статус записаны в
  `docs/testing.md`, реализация - отдельная задача. Где: CI.
- **N2.** [CLOSED] `testTimeout` 30 000 мс задан в `vitest.config.ts`; отдельные
  спавны больше не упираются в 5 секунд. Где: тесты.

### 4.3 P2

- **9.** [CLOSED] Playwright: раздел в `docs/testing.md` и строка `test:e2e` в
  `README.template.md` как план; `check-docs` принимает имя скрипта с цифрой.
  Где: репо.
- **10.** [CLOSED] Мелкие правки: `react`/`react-dom` -> devDependencies (+ фраза
  в `SECURITY.md`, `README.md`); `.opencode/**` и `.agents/**` в игноры основного
  конфига; exempt-строки печатаются и при провале `check:file-length`. Где: репо.
- **11.** [CLOSED] Раздел "Версии IDE" в `docs/webstorm.md`: Vitest 5 (WEB-79586),
  TS 7 LSP, Chrome Connect, Git Worktree UX. Где: репо.
- **12.** [CLOSED] `docs/webstorm-settings.md` переписан в runbook без машинных
  путей; открытая задача Save Actions - GitHub issue #19. Где: репо.
- **13.** [CLOSED] Пути каталогов IDE версия-независимы: `WebStorm<версия>`, с
  пояснением в `docs/settings-levels.md`. Где: репо.
- **14.** [CLOSED] Документация от аудита 31.10: в миграцию добавлены `scripts/`
  и npm-скрипты, рецепты Vue/Next.js ставят рантайм-пакеты, Analyze code описан
  как post-commit, плейсхолдеры `README.template.md` отмечены, альтернатива
  `workspace.xml` убрана, словарь помечен как сознательное отклонение, watchers
  хранятся в `watcherTasks.xml` и не дублируют Stylelint, указатель в
  `README.md:108` переведён на `AGENTS.md`. Где: `docs/`.
- **N3.** [CLOSED] `dev` исключён в `tsconfig.base.json`; `check-templates` и
  eslint-фикстуры пишут рядом свой `tsconfig.json`, чтобы type-aware слой
  (`projectService`) по-прежнему видел их файлы. Где: репо.

### 4.4 P3

- **15.** [WONTFIX] Node-скрипт копирования live-templates XML в глобальный
  каталог IDE: Windows-специфичные пути и номер версии каталога делают его
  хрупким; уже есть плагин Live Template Sharing (id 25007) и гейт
  `check:templates`. Решение: не делать.
- **16.** [CLOSED] Пример сносок добавлен в `docs/markdown.md`.
- **17.** [WONTFIX] Скрап `check:settings-drift`: машинный дрейф, Windows-специфика,
  в CI не воспроизводится; вместо скрипта - runbook `docs/webstorm-settings.md`.
  Решение: не делать.
- **18.** [CLOSED] Низкие находки: `bun.lock` в `README.md`, шаг установки React
  Buddy в параграфе 9, снимок npm audit уже датирован 02.11 (0 high, 15 moderate
  dev-only). Где: репо.

### 4.5 FIX-DOC - правки текста правил (один PR)

- [OPEN] Формулировка: ESLint проверяет типы возвращаемых значений; аннотации
  параметров - конвенция, а не проверка.
- [CLOSED] "exported and top-level" приведено к факту `allowExpressions: true` -
  сделано переписыванием `AGENTS.md` §3.
- [CLOSED] "Both are wired into .editorconfig" - фраза ушла из текста правил при
  канонизации.
- [OPEN] Добавить `revert` в список типов коммитов (git генерирует их сам).

## 5. Быстрые проверки

```bash
git status --short                        # ожидается пусто: раздел 3 закоммичен
npm run check:docs                        # [OK] 13 docs, AGENTS.md входит в скан
npm run changelog && git status --short   # N1: чистое дерево, "up to date"
npx vitest run                            # N2: 87/87 без параллельной нагрузки
npm run typecheck                         # N3: зелено и при непустом dev/
rg -n "OverlyLongFunctionJS" .idea/inspectionProfiles/   # после P1-5: лимит 60
```

## 6. Временная структура репо: что мета, что шаблон

Каталоги, которые не входят в шаблон и не отслеживаются git-ом - это рабочие
зоны инструментов; после финальной настройки их можно удалять без последствий
для шаблона:

| Путь            | Что это                                        | Судьба                     |
| --------------- | ---------------------------------------------- | -------------------------- |
| `node_modules/` | зависимости                                    | восстанавливается `npm ci` |
| `.opencode/`    | локальное состояние агента OpenCode            | мета, можно удалить        |
| `.superpowers/` | локальное состояние набора навыков агента      | мета, можно удалить        |
| `drafts/`       | черновая зона отчётов и заметок                | мета, удаляется по желанию |
| `dev/`          | временный рендер шаблонов + отладочные скрипты | техническая, чистится сама |
| `.git/`         | сам репозиторий                                | не трогать                 |

Файлы `docs/` - часть шаблона: они в git, их проверяют `check-docs` и
`lint:md`, и они переезжают в каждый форк. Журнал статусов `webstorm-settings.md`
превращён в runbook синхронизации (P2-12), новые задачи заводятся в issues, а
не в документе.

## 7. Журнал сверки

| Дата       | Ревизия   | Что изменилось                                             |
| ---------- | --------- | ---------------------------------------------------------- |
| 2026-11-02 | `3226106` | P0-1 и P0-3 закрыты, добавлены N1, N2, N3                  |
| 2026-11-02 | `ff87744` | N1 закрыт: генератор, тесты, пересборка `CHANGELOG.md`     |
| 2026-11-02 | `45a85b8` | P0-2 закрыт: WebStorm 2026.2.4 по `product-info.json`      |
| 2026-11-02 | `45a85b8` | SECURITY: снимок audit 02.11, alert `minimatch` разобран   |
| 2026-11-02 | `46f1bd1` | PR #18 влит: N2, N3 и изоляция git-фикстур закрыты         |
| 2026-11-02 | `251aa7d` | P1-4, P1-5, P1-6 закрыты: `.env.example`, профиль, статусы |
| 2026-11-02 | `4108b8a` | P1-7 закрыт: architecture/security/api, whitelist удалён   |
| 2026-11-02 | `bfe00c6` | P1-8 закрыт: решение по coverage-гейту зафиксировано       |
| 2026-11-02 | `0a7e85b` | P2-9, P2-10 закрыты: Playwright, react в devDeps, exempt   |
| 2026-11-02 | `39e87f9` | P2-11, P2-12, P2-13 закрыты: версии IDE, runbook, пути     |
| 2026-11-02 | `da9d648` | P2-14 закрыт: аудит документации 31.10                     |
| 2026-11-02 | `ec855f3` | P3 закрыт: сноски, bun.lock, React Buddy; 15/17 отклонены  |
