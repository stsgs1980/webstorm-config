# Design: Pre-push hook для генерации CHANGELOG.md

## Цель

Автоматически генерировать CHANGELOG.md при пуше в main, блокируя пуш если файл изменился. Человек коммитит вручную — нет amend-сюрпризов, история не переписывается.

## Что меняется

### 1. `scripts/generate-changelog.sh` (новый файл)

Shell скрипт с логикой:

1. Проверяет текущую ветку: `git branch --show-current`
2. Если ветка не main — выход 0 (pass-through, генерация не нужна)
3. Запускает `npx conventional-changelog -p angular -i CHANGELOG.md -s`
4. Проверяет наличие изменений: `git diff --quiet CHANGELOG.md`
5. Если есть изменения — exit 1 + сообщение:
   ```
   CHANGELOG.md updated.
   Please commit: git add CHANGELOG.md && git commit -m "docs: update changelog"
   Then push again.
   ```
6. Если изменений нет — exit 0 (всё актуально)

### 2. `.husky/pre-push` (новый файл)

Вызывает скрипт:

```bash
bash scripts/generate-changelog.sh
```

### 3. `package.json`

Добавить в devDependencies:

- `conventional-changelog-cli`

Добавить в scripts:

- `"changelog": "conventional-changelog -p angular -i CHANGELOG.md -s"`

## Что не меняется

- Существующие хуки (commit-msg, pre-commit) остаются без изменений
- lint-staged конфигурация не меняется
- Нет изменений в Git history (никаких amend)

## Дизайн-решения

### Почему отдельный скрипт, а не инлайн в pre-push

- Единый паттерн с `scripts/check-file-length.ts` (вызывается из pre-commit)
- Можно запустить вручную: `bash scripts/generate-changelog.sh`
- Легче тестировать и поддерживать

### Почему только main ветка

- Changelog отражает релизы, а не WIP
- Предотвращает шумные обновления на feature ветках
- Align с release workflow: feature -> merge to main -> push

### Почему блокировка, а не warning

- Гарантирует что CHANGELOG всегда в коммите перед релизом
- Нет "забытых" обновлений
- Простая и понятная механика

### Почему перегенерация с нуля

- Консистентность формата при изменении конфига
- Маленький проект — millisecond regeneration
- Нет ручных правок в CHANGELOG

## Успех

1. `git push origin main` без CHANGELOG в коммите — блокируется с инструкцией
2. `git add CHANGELOG.md && git commit && git push origin main` — проходит
3. `git push origin feature/x` — проходит без генерации
4. `bash scripts/generate-changelog.sh` вручную — работает
