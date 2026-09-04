# Design: Добавить рекомендации стиля к шаблону (вариант B, без ссылок на Google)

## Цель

Применить полезные правила из Google Style Guide к шаблону `webstorm-config` без прямых ссылок или привязок к Google.

## Что меняется

### 1. `.editorconfig`

- Уточнить `max_line_length = 120` для `*` (уже есть для `.md`).

### 2. `docs/webstorm.md`

- Новый раздел "Конвенции стиля" с правилами:
  - 2 пробела, точка с запятой, двойные кавычки (`USE_DOUBLE_QUOTES` в `webstorm-codestyle.xml`).
  - `const`/`let`, запрет `var`.
  - JSDoc для типов (`@param`, `@return`).
  - Trailing commas (`ENFORCE_TRAILING_COMMA` = Always).

### 3. `.aiassistant/rules/AI Rules.md`

- Добавить пункты: JSDoc обязателен, `const` по умолчанию, trailing comma, без ссылок на Google.

### 4. `README.template.md`

- Добавить строку в таблицу или в раздел "Conventions" о стиле кода (без ссылок).

## Что не меняется

- Нет ссылок на `google.github.io/styleguide`.
- Нет изменения `RIGHT_MARGIN` с 120 на 80 (осознанное отклонение, не упоминаем).
- Нет новых файлов типа `docs/google-style.md`.

## Успех

Шаблон содержит актуальные правила стиля в документации и правилах AI, без внешних ссылок.
