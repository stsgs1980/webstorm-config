# Добавить рекомендации стиля (вариант B, без ссылок на Google)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Применить правила стиля из Google Style Guide к шаблону `webstorm-config` без ссылок на Google.

**Architecture:** 4 файла: `.editorconfig`, `docs/webstorm.md`, `.aiassistant/rules/AI Rules.md`, `README.template.md`.

**Tech Stack:** Markdown, XML, Plain text.

## Global Constraints

- Без ссылок на `google.github.io/styleguide`.
- Сохранять `RIGHT_MARGIN=120` в `webstorm-codestyle.xml`.
- Язык документации — русский.
- Без emoji и Unicode-графики.

---

### Task 1: `.editorconfig`

**Files:**

- Modify: `.editorconfig`

**Interfaces:**

- Consumes: текущий `.editorconfig`
- Produces: уточнённая `max_line_length`

- [ ] **Step 1: Добавить `max_line_length = 120` для `[*]`**

```ini
[*]
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
charset = utf-8
indent_style = space
indent_size = 2
max_line_length = 120
```

- [ ] **Step 2: Проверить файл**

Run: `cat .editorconfig`
Expected: строка `max_line_length = 120` присутствует в секции `[*]`.

- [ ] **Step 3: Commit**

```bash
git add .editorconfig
git commit -m "style: add max_line_length 120 to .editorconfig"
```

### Task 2: `docs/webstorm.md`

**Files:**

- Modify: `docs/webstorm.md`

**Interfaces:**

- Consumes: текущий `docs/webstorm.md`
- Produces: раздел "Конвенции стиля"

- [ ] **Step 1: Добавить раздел после "## 6. Markdown"**

```markdown
## 6.5. Конвенции стиля

- 2 пробела, точка с запятой, двойные кавычки.
- `const`/`let` по умолчанию; `var` запрещён.
- JSDoc (`@param`, `@return`) для функций и компонентов.
- Trailing commas в объектах и массивах (`Always`).
- Максимальная длина строки — 120 символов (`RIGHT_MARGIN` в `webstorm-codestyle.xml`).
```

- [ ] **Step 2: Проверить файл**

Run: `cat docs/webstorm.md | grep -A 6 "Конвенции стиля"`
Expected: раздел присутствует.

- [ ] **Step 3: Commit**

```bash
git add docs/webstorm.md
git commit -m "docs: add style conventions to webstorm setup"
```

### Task 3: `.aiassistant/rules/AI Rules.md`

**Files:**

- Modify: `.aiassistant/rules/AI Rules.md`

**Interfaces:**

- Consumes: текущий `AI Rules.md`
- Produces: пункты о JSDoc, `const`, trailing comma

- [ ] **Step 1: Добавить пункты в раздел "## 3. Code Style & Formatting"**

```markdown
- JSDoc с `@param` и `@return` обязателен для каждой функции.
- `const` по умолчанию; `var` запрещён.
- Trailing commas (`Always`) в объектах и массивах.
```

- [ ] **Step 2: Проверить отсутствие ссылок на Google**

Run: `grep -i "google" .aiassistant/rules/AI Rules.md || echo "OK: no google links"`
Expected: OK: no google links.

- [ ] **Step 3: Commit**

```bash
git add .aiassistant/rules/AI\ Rules.md
git commit -m "docs: add style rules to AI Rules without google links"
```

### Task 4: `README.template.md`

**Files:**

- Modify: `README.template.md`

**Interfaces:**

- Consumes: текущий `README.template.md`
- Produces: строка о стиле кода

- [ ] **Step 1: Добавить в раздел "Conventions" или таблицу**

```markdown
## Conventions

Стиль кода: 2 пробела, точка с запятой, двойные кавычки, trailing commas, JSDoc (`@param`, `@return`), `const`/`let`.
```

- [ ] **Step 2: Проверить файл**

Run: `cat README.template.md | grep -A 2 "Conventions"`
Expected: строка присутствует.

- [ ] **Step 3: Commit**

```bash
git add README.template.md
git commit -m "docs: add code style line to README template"
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-03-google-style-templates.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - dispatch fresh subagent per task
**2. Inline Execution** - execute tasks in this session

Which approach?
