# Live Templates

Наборы шаблонов лежат в `.idea/liveTemplates/`. Каталог с project-level live templates
IDE **не читает**: такой возможности в IntelliJ/WebStorm нет (YouTrack IDEABKL-5033).
Файлы в репозитории — склад для ручного импорта, а не настройка «из коробки».

## Импорт

1. Откройте нужный XML из `.idea/liveTemplates/` любым редактором.
2. Скопируйте **всё содержимое** файла (включая `<templateSet ...>`).
3. В WebStorm: `Settings` → `Editor` → `Live Templates`.
4. Нажмите `Ctrl+V` — появится группа с шаблонами.
5. Контексты заданы в XML; после импорта проверьте их в `Change` и при необходимости
   включите нужные языки (`TypeScript`, `TSX`, `JavaScript`).

Проверка: в файле `.tsx` наберите `rafce` и нажмите `Tab` — развернётся компонент.

Альтернатива: плагин IntelliJ Live Template Sharing (id 25007) подхватывает
`.idea/liveTemplates/` без ручного копирования, но только кастомные группы.

## Группы шаблонов

| Файл             | Группа     | Сколько шаблонов |
| ---------------- | ---------- | ---------------- |
| `react.xml`      | React      | 8                |
| `testing.xml`    | Testing    | 4                |
| `typescript.xml` | TypeScript | 3                |
| `utilities.xml`  | Utilities  | 3                |

Состав групп:

- **React**: `rafce`, `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`,
  `useContext`, `useReducer`.
- **Testing**: `describe`, `it`, `test`, `expect`.
- **TypeScript**: `interface`, `type`, `enum`.
- **Utilities**: `try`, `for`, `forEach`.

## Почему `rafce` выглядит именно так

- Нет `import React` и нет `React.FC`: JSX-трансформ `react-jsx` их не требует,
  а `React.FC` не даёт ничего поверх обычной типизации пропсов.
- Props не пустые (`children?: ReactNode`): пустой интерфейс падает на
  `@typescript-eslint/no-empty-object-type`.
- JSDoc на компонент обязателен (публичное API, правило `jsdoc/require-jsdoc`);
  теги `@param props.children` и `@returns` шаблон добавляет сам — линтер в TS их не требует.
- Имя компонента не вводится вручную: `NAME` вычисляется как
  `capitalize(fileNameWithoutExtension())` (fallback `Component`) и
  подставляется во все четыре места — интерфейс, JSDoc, `export const`,
  `export default`.
- Возвращаемый тип `: ReactElement` записан явно вместе с импортом типа:
  правило `explicit-function-return-type` в этом репозитории включено.
- У `useReducer` начальное состояние по умолчанию `{}`, чтобы при пропуске переменной
  `$INIT$` код оставался синтаксически валидным.

Код, который генерируют `rafce` и `React Component.tsx`, проходит `eslint --max-warnings=0`
и `tsc --noEmit` без правок. Это проверено вручную: `check:templates` покрывает только
live-шаблоны, file templates автоматическим гейтом не проверяются.

Внутри live-шаблонов `check:templates` отключает `no-unused-vars` (шаблон - фрагмент,
а не модуль) и `no-empty` только для `try`/`for`.

## File templates

File templates из `.idea/fileTemplates/` работают иначе: WebStorm подхватывает их
автоматически, менять ничего не нужно.

| Шаблон                | Где доступен                       |
| --------------------- | ---------------------------------- |
| `React Component.tsx` | `File` → `New` → `React Component` |
| `Vitest Test.test.ts` | `File` → `New` → `Vitest Test`     |
| `Astro Page.astro`    | `File` → `New` → `Astro Page`      |

Автоматического гейта для file templates нет и в этом шаблоне не планируется: ими
пользуются люди в IDE (`File` → `New`), а не агенты, которые создают файлы кодом.
Содержимое проверяется вручную при изменении шаблона. Гейт имеет смысл только если
шаблон начнут использовать как продукт для ручной разработки; тогда его можно
добавить по образцу `check:templates`.

## Частые проблемы

| Симптом                         | Решение                                         |
| ------------------------------- | ----------------------------------------------- |
| Группы нет в Live Templates     | Импортировать XML вручную (см. выше)            |
| Шаблон не раскрывается          | Включить контекст `TypeScript`/`TSX` для группы |
| `.idea/` не применяется целиком | См. `docs/webstorm.md`, шаги 1–8                |
