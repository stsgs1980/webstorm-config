import process from "node:process";

// Git exports GIT_DIR (absolute inside a linked worktree) to hook processes.
// A fixture test that spawns `git init` in a temp directory inherits it, and
// every later `git add` or `git commit` targets the repository being pushed
// instead of the fixture: commits land on the wrong branch and `core.bare`
// can flip on the real repository. Strip every variable that redirects git, so
// fixture commands always start from the directory they were given.
const GIT_REDIRECTS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
];

/**
 * Process environment for fixture git commands and for scripts under test.
 * @param {Record<string, string | undefined>} [base] - source environment
 * @returns {Record<string, string | undefined>} copy without git redirects
 */
export function gitEnv(base = process.env) {
  const env = { ...base };

  for (const name of GIT_REDIRECTS) {
    delete env[name];
  }

  return env;
}
