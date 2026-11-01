// Verbatim data tables for check-templates: sample variable values, per
// template overrides and ambient declarations for the shared tsc program.

/** Sample values for template variables; same var renders the same everywhere. */
export const VAR_SAMPLES: Record<string, string> = {
  NAME: "Templ",
  STATE: "state",
  INIT: "0",
  DEPS: "",
  PARAMS: "templateParam: string",
  CONTEXT: "TEMPLATE_CONTEXT",
  REDUCER: "templateReducer",
  END: "",
  I: "index",
  LENGTH: "templateLength",
  ARRAY: "templateItems",
  ITEM: "templateItem",
  ERROR: "templateError",
  CATCH: "",
  METHOD: "toBe",
  VALUE: "0",
  EXPECTED: "1",
  DESC: "behave correctly",
  UNKNOWN: "0",
};

/** Per-template overrides: fragments render valid TS for their shape. */
export const VAR_OVERRIDES: Record<string, string> = {
  "typescript::interface::END": "name: string",
  "typescript::type::END": "unknown",
  "typescript::enum::END": "Value",
  "testing::describe::NAME": "some case",
  "testing::it::DESC": "behave correctly",
  "testing::test::NAME": "some case",
};

/** Ambient declarations so snippets compile without extra setup. */
export const AMBIENT_DECLARATIONS = [
  "declare function useState<T>(initial: T | (() => T)): [T, (v: T) => void];",
  "declare function useEffect(fn: () => void | (() => void), deps: readonly unknown[]): void;",
  "declare function useCallback<T extends (...args: readonly never[]) => unknown>(fn: T, deps: readonly unknown[]): T;",
  "declare function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;",
  "declare function useRef<T>(initial: T): { current: T };",
  "declare function useContext<T>(context: T): T;",
  "declare function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, (a: A) => void];",
  "declare const TEMPLATE_CONTEXT: unknown;",
  "declare const templateReducer: (state: number, action: number) => number;",
  "declare function describe(name: string, fn: () => void): void;",
  "declare function it(name: string, fn: () => void): void;",
  "declare function test(name: string, fn: () => void): void;",
  "declare function expect(value: unknown): { toBe(expected: unknown): void };",
  "declare const templateLength: number;",
  "declare const templateItems: readonly number[];",
];
