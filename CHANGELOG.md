<!-- markdownlint-disable -->

# 1.0.0 (2026-09-04)

### Bug Fixes

- add passWithNoTests to vitest config for CI ([b83d3a2](https://github.com/stsgs1980/webstorm-config/commit/b83d3a2e3e1055d4e8418d895c9c47a6af22140e))
- convert asterisk to dash in changelog generation ([56aa7a8](https://github.com/stsgs1980/webstorm-config/commit/56aa7a86b8d826ef86096dd309c552553c056540))
- convert markdown-snippets.js to .ts with proper types ([ba7ad1f](https://github.com/stsgs1980/webstorm-config/commit/ba7ad1f0eedbca84707bf681d783d5543ec05363))
- explicit String type in check-file-length.mjs ([0241e01](https://github.com/stsgs1980/webstorm-config/commit/0241e01b69c94a5abad18f48f87e5c4f63f51393))
- extract functions before export to satisfy WebStorm static analysis ([dfc76dd](https://github.com/stsgs1980/webstorm-config/commit/dfc76ddfb59b24f70b810ded69cd74f7f330b2c7))
- fix long lines and structure in eslint-rules files ([ac522be](https://github.com/stsgs1980/webstorm-config/commit/ac522beb42faac080a55e3b38bcd6a932c16b18f))
- format changelog with prettier ([82120fd](https://github.com/stsgs1980/webstorm-config/commit/82120fdbc7a1ae64166fa547d1574d3f78704032))
- normalize blank lines in changelog ([5a87010](https://github.com/stsgs1980/webstorm-config/commit/5a87010ba6740de49161639da5cdc8dea55bab33))
- prevent CHANGELOG duplication and add pre-push comment ([2b0ea36](https://github.com/stsgs1980/webstorm-config/commit/2b0ea366ac9664a5fd6203897a3ebb5327bef3ba))
- remove broken sed normalization ([8cadfca](https://github.com/stsgs1980/webstorm-config/commit/8cadfca1a4a87ee1abe93922ff9e585b8002ed85))
- remove CHANGELOG.md exclusions, add markdownlint-disable comment ([ef6a671](https://github.com/stsgs1980/webstorm-config/commit/ef6a671b147cb3c4bdc30d7bf194d906ced45bc6))
- rename TMPFILE to TEMP_FILE for clarity ([3ccc4b5](https://github.com/stsgs1980/webstorm-config/commit/3ccc4b51bd66f8a01dbc52027cf73e834f913303))
- restore .js with proper JSDoc, remove broken .d.ts ([7b02afd](https://github.com/stsgs1980/webstorm-config/commit/7b02afd8ec8c3e889a02c084f7f7b05b601b06d9))
- set MD013 line_length=120 per AI Rules.md ([64000b8](https://github.com/stsgs1980/webstorm-config/commit/64000b89adf32024d6319743a001857b4208d0bb))
- suppress WebStorm false positive for @eslint/markdown import ([d7d237a](https://github.com/stsgs1980/webstorm-config/commit/d7d237ab7141c674c1da118c50ec506aada94189))
- suppress WebStorm false positives in markdown-snippets.js ([ab1f233](https://github.com/stsgs1980/webstorm-config/commit/ab1f233243a9db655603591eae25b7e45c08c76e))
- sync .markdownlint-cli.json with .markdownlint.json, document markdown rules ([afb2f04](https://github.com/stsgs1980/webstorm-config/commit/afb2f0424d51e4aaf9edd229544adb9fc1bf4b32))
- typo 'codestyle' -> 'code style' in docs/webstorm.md and AI Rules ([1528049](https://github.com/stsgs1980/webstorm-config/commit/1528049bbc17e11bf796a7162acbf391f0141018))

### Features

- add anti-monolith script ([4b31ecf](https://github.com/stsgs1980/webstorm-config/commit/4b31ecf6e7a01e1e12d467a7b2b025b604ed1e04))
- add pre-push changelog guard hook ([29c6898](https://github.com/stsgs1980/webstorm-config/commit/29c689866fa356bcead688e030d763022617c53b))
- add project AI rules and cleanup ([7cafc36](https://github.com/stsgs1980/webstorm-config/commit/7cafc365bac4d16d968b5e78f025964b33c05056))
- add test variable ([a21dd4f](https://github.com/stsgs1980/webstorm-config/commit/a21dd4f85aab5986116f3ba5c9cdbdb2797440a3))
- add Vitest, fix dependency versions, update docs ([a5851ef](https://github.com/stsgs1980/webstorm-config/commit/a5851ef87f55e1cc8902e4e1f477b8ea269ffbb1))
- make linters Tailwind v4-aware and document setup ([0f067a7](https://github.com/stsgs1980/webstorm-config/commit/0f067a71af84e0c9338f47918f3120b57b5f2ee6))
