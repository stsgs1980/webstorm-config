# WebStorm: синхронизация машинных настроек

Runbook: как перенести настройки из репозитория на машину за 15-20 минут.
Исторические статусы и аудит велись здесь до 02.11.2026; открытые задачи
переехали в GitHub issues (см. конец файла). Проектные настройки, которые
работают из клона, описаны в [webstorm.md](webstorm.md).

## Что где живёт

| Настройка         | Файл в репозитории                       | Из клона | Действие на машине    |
| ----------------- | ---------------------------------------- | -------- | --------------------- |
| Code Style        | `.idea/codeStyles/`                      | `[OK]`   | шаг 1: Save as Global |
| Профиль инспекций | `.idea/inspectionProfiles/`              | `[OK]`   | шаг 2: IDE Default    |
| ESLint и Prettier | `.idea/jsLinters/`, `.idea/prettier.xml` | `[OK]`   | шаг 5: для новых      |
| File templates    | `.idea/fileTemplates/`                   | `[OK]`   | шаг 3: Copy to IDE    |
| Live templates    | `.idea/liveTemplates/`                   | `[FAIL]` | шаг 4: импорт XML     |
| Словарь           | `.idea/dictionaries/`                    | `[OK]`   | шаг 7: Accepted Words |
| File Watchers     | нет                                      | -        | шаг 6: вручную        |

`%APPDATA%\JetBrains\WebStorm<версия>` - каталог конкретной установки; номер
версии меняется при обновлении IDE, поэтому в путях он не зашит.

## Проектный уровень и глобальный

Настройки живут на двух уровнях, и это главный источник путаницы. В выпадающих
списках IDE проектный уровень виден как `Project` / `Project Default`, а
глобальный - как `webstorm-config-ide`:

| Уровень    | Файл                                               | Кто применяет      |
| ---------- | -------------------------------------------------- | ------------------ |
| Проектный  | `.idea/codeStyles/Project.xml`                     | этот репозиторий   |
| Проектный  | `.idea/inspectionProfiles/Project_Default.xml`     | этот репозиторий   |
| Глобальный | `%APPDATA%\...\codestyles\webstorm-config-ide.xml` | все проекты машины |
| Глобальный | `%APPDATA%\...\inspection\webstorm-config-ide.xml` | все проекты машины |

В самом репозитории правильно оставить проектный уровень: переключение на
глобальную копию убирает из проверок scope `generated_changelog`, который
привязан к этому репозиторию.

Глобальные копии должны быть производными от репозитория, а не хранилищем:
`.idea/` - единственное место ручного редактирования,
`npm run gen:ide-reference` собирает из него `generated/ide-reference/`,
`npm run sync:ide` разворачивает его на машину вместе с указателями. Гейт
`npm run check:ide-state` проверяет свежесть эталона, байты копий, значения
указателей и неизменность проектных файлов в `.idea/` против HEAD. Он идёт в
pre-push, поэтому затирание WebStorm'ом обнаруживается локально. На машине
без WebStorm IDE-проверки пропускаются.

## Порядок синхронизации

1. **`Code Style -> Global`.** В `Settings -> Editor -> Code Style` выберите схему
   проекта и нажмите Save as Global. Глобальная копия - мягкая база для чужих проектов.
2. **Профиль инспекций.** IDE Default без FileLength 250 и без скоупа
   generated_changelog: лимит и скоуп привязаны к этому репозиторию.
3. **`File templates -> IDE`.** `File and Code Templates -> Copy to IDE`; шаблоны
   станут доступны во всех проектах машины.
4. **Live templates.** Скопировать XML из `.idea/liveTemplates/` и вставить в
   `Settings -> Editor -> Live Templates`; включить контексты TypeScript/TSX.
   Каталог проекта IDE не читает (IDEABKL-5033).
5. **Settings for New Projects.** Prettier и ESLint - Automatic + on save;
   Stylelint - on save, если проект с CSS.
6. **File Watchers.** Stylelint и markdownlint; вотчер длины файла не нужен -
   его проверяет pre-commit.
7. **Словарь.** `Spelling -> Accepted Words`: перенести слова проекта.
8. **Analyze code.** Включить в `Commit tool window -> Settings -> Commit Checks`.

## Проверка

- `rafce` + Tab в `.tsx`: компонент разворачивается, имя вычислено.
- Settings -> Editor -> Code Style: схема подписана "(Project)".
- Сохранение файла не даёт двойных правок (см. задачу про Save Actions).
- `npm run check:templates`, `npm run lint`, `npm run format:check` зелёные.

## Открытые задачи

- Save Actions против Actions on Save - GitHub issue #19 (машина, не репо).
- Остальные расхождения, найденные 29.10-02.11.2026, закрыты. Новые задачи
  заводить в issues, а не в этом файле: журнал статусов больше не ведётся.
