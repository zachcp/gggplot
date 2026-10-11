// The JSX printer (gggplot-vnh.11, ADR-007 decision 3): prints a component
// element tree as the JSX a user would write. Data passes by reference — a
// frame, array or function prints as the name it is bound to, never as an
// inlined literal — so the output is an editable starting point and can say
// anything the components can, GPU-resident products included.
//
// It replaces emitSource's frozen-literal emitter, whose input was a GGSpec
// compiled to a RenderTree. The printer's input is the element tree itself.
import type { LiveElement } from "@use-gpu/live";
import * as Core from "../mod.ts";
import { Fragment } from "../runtime/usegpu_compat.ts";

export interface PrintJsxOptions {
  /**
   * Names for values passed by reference (data frames, arrays, loaders,
   * shader sources), by identity. A value with no name prints as the prop it
   * was passed to and is listed in `PrintedJsx.references`.
   */
  refs?: ReadonlyMap<unknown, string>;
  /**
   * Names for components, by identity, ahead of the built-in table: a host's
   * wrapper can print as the component it wraps (the doc site's <SitePlot>
   * as <GGPlot>).
   */
  names?: ReadonlyMap<unknown, string>;
  /** Column budget before an element breaks its props over lines. */
  width?: number;
}

export interface PrintedJsx {
  source: string;
  /** Component names the source uses, in first-use order. */
  components: string[];
  /** Names the source reads that the caller must bind, in first-use order. */
  references: string[];
}

type Element = { f: unknown; args?: unknown[]; arg?: unknown; key?: unknown };

let coreNames: Map<unknown, string> | null = null;

/**
 * Every component the package exports, by identity. The named geoms and plot
 * parts are built by factories, so their functions carry no useful name of
 * their own; the export name is the one a user writes. Read lazily: this
 * module and the barrel import each other.
 */
function builtinNames(): Map<unknown, string> {
  if (coreNames) return coreNames;
  coreNames = new Map();
  for (const [name, value] of Object.entries(Core)) {
    if (typeof value === "function" && /^[A-Z]/.test(name)) {
      if (!coreNames.has(value)) coreNames.set(value, name);
    }
  }
  return coreNames;
}

const isElement = (value: unknown): value is Element =>
  !!value && typeof value === "object" && "f" in value &&
  ("args" in value || "arg" in value);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Props that hold data: always passed by reference. */
const DATA_PROPS = new Set(["data"]);

const byName = (a: string, b: string) => a.localeCompare(b);

/** Prints `element` as JSX. */
export function printJsx(
  element: LiveElement,
  options: PrintJsxOptions = {},
): PrintedJsx {
  const width = options.width ?? 80;
  const components: string[] = [];
  const references: string[] = [];
  const note = (list: string[], name: string) => {
    if (!list.includes(name)) list.push(name);
  };

  const componentName = (type: unknown): string => {
    if (type === Fragment) return "";
    const fn = type as { displayName?: string; name?: string };
    const name = options.names?.get(type) ?? builtinNames().get(type) ??
      fn.displayName ?? fn.name;
    if (!name) {
      throw new Error("printJsx: an anonymous component has no name to print");
    }
    return name;
  };

  /** A value as a JS expression, or null when it must be passed by name. */
  const literal = (value: unknown, seen: Set<unknown>): string | null => {
    const ref = options.refs?.get(value);
    if (ref) {
      note(references, ref);
      return ref;
    }
    if (value === null) return "null";
    switch (typeof value) {
      case "string":
        return JSON.stringify(value);
      case "number":
        return Number.isFinite(value) ? String(value) : null;
      case "boolean":
        return String(value);
      case "undefined":
        return "undefined";
      case "function": {
        // An inline function prints as itself; anything else by its name.
        // (A prop's inline arrow takes the prop's name by inference, so the
        // source text is checked first.)
        const text = String(value);
        if (
          text.length <= 80 && !text.includes("\n") &&
          !/^(async\s+)?function\b|^class\b|\[native code\]/.test(text)
        ) {
          return text;
        }
        const name = (value as { name?: string }).name;
        if (name && IDENTIFIER.test(name)) {
          note(references, name);
          return name;
        }
        return null;
      }
    }
    if (typeof value !== "object" || seen.has(value)) return null;
    // A typed array or a long array is data: it travels by reference.
    if (ArrayBuffer.isView(value)) return null;
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        if (value.length > 16) return null;
        const items = value.map((item) => literal(item, seen));
        return items.some((item) => item === null)
          ? null
          : `[${items.join(", ")}]`;
      }
      if (Object.getPrototypeOf(value) !== Object.prototype) return null;
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > 16) return null;
      const parts: string[] = [];
      for (const [key, item] of entries) {
        if (item === undefined) continue;
        const printed = literal(item, seen);
        if (printed === null) return null;
        parts.push(
          `${IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${printed}`,
        );
      }
      return parts.length ? `{ ${parts.join(", ")} }` : "{}";
    } finally {
      seen.delete(value);
    }
  };

  const attribute = (key: string, value: unknown): string | null => {
    if (value === undefined) return null;
    if (value === true) return key;
    if (typeof value === "string" && !/["\\\n{}<>]/.test(value)) {
      return `${key}=${JSON.stringify(value)}`;
    }
    // Data never prints inline, whatever its size: that is the point.
    let expr = DATA_PROPS.has(key)
      ? options.refs?.get(value) ?? null
      : literal(value, new Set());
    if (expr !== null && DATA_PROPS.has(key)) note(references, expr);
    if (expr === null) {
      // Data with no name: passed by reference under the prop's own name.
      expr = IDENTIFIER.test(key) ? key : "value";
      note(references, expr);
    }
    return `${key}={${expr}}`;
  };

  /**
   * An attribute on its own line; one whose object literal still overflows
   * puts each entry on a line of its own, as deno fmt does.
   */
  const broken = (attr: string, indent: string): string[] => {
    const object = /^(\w+)=\{\{ (.*) \}\}$/.exec(attr);
    if (`${indent}${attr}`.length <= width || !object) return [indent + attr];
    const entries = splitTopLevel(object[2]);
    return [
      `${indent}${object[1]}={{`,
      ...entries.map((entry) => `${indent}  ${entry},`),
      `${indent}}}`,
    ];
  };

  const print = (node: unknown, indent: string): string[] => {
    if (node === null || node === undefined || node === false) return [];
    if (Array.isArray(node)) return node.flatMap((n) => print(n, indent));
    if (typeof node === "string" || typeof node === "number") {
      return [`${indent}{${JSON.stringify(node)}}`];
    }
    if (!isElement(node)) {
      throw new Error("printJsx: a child is neither an element nor text");
    }
    const props = (node.args?.[0] ?? node.arg ?? {}) as Record<
      string,
      unknown
    >;
    const name = componentName(node.f);
    if (name) note(components, name);
    const attrs = Object.entries(props)
      .filter(([key]) => key !== "children")
      .map(([key, value]) => attribute(key, value))
      .filter((attr): attr is string => attr !== null);
    const children = print(props.children, indent + "  ");
    const inline = attrs.length ? ` ${attrs.join(" ")}` : "";
    const open = (close: string) =>
      `${indent}<${name}${inline}${close}`.length <= width
        ? [`${indent}<${name}${inline}${close}`]
        : [
          `${indent}<${name}`,
          ...attrs.flatMap((attr) => broken(attr, `${indent}  `)),
          `${indent}${close.trim()}`,
        ];
    if (!children.length) return open(name ? " />" : "></>");
    return [...open(">"), ...children, `${indent}</${name}>`];
  };

  return {
    source: print(element, "").join("\n"),
    components,
    references,
  };
}

/** Splits `a: 1, b: [2, 3]` at its top-level commas. */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = "", start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"') quote = c;
    else if ("[{(".includes(c)) depth++;
    else if ("]})".includes(c)) depth--;
    else if (c === "," && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out;
}

export interface PrintModuleOptions extends PrintJsxOptions {
  /** The exported component's name. */
  name: string;
  /**
   * The specifier every reference and non-gggplot component is imported
   * from: the module the tree was built in.
   */
  from: string;
}

/**
 * A whole .tsx module around the printed tree: the Live JSX pragma,
 * gggplot's components from "@gggplot/core", and every other name from
 * `from`, exported as a component. A reference with no name is an error:
 * data travels by reference, so it must be exported where the tree was
 * built.
 */
export function printModule(
  element: LiveElement,
  options: PrintModuleOptions,
): string {
  const printed = printJsx(element, options);
  const named = new Set(options.refs?.values() ?? []);
  const local = new Set(options.names?.values() ?? []);
  const core = new Set(builtinNames().values());
  const unbound = printed.references.filter((ref) => !named.has(ref));
  if (unbound.length) {
    throw new Error(
      `printModule: ${
        unbound.join(", ")
      } must be exported from ${options.from}` +
        " (data is passed by reference, never inlined)",
    );
  }
  const fromCore = printed.components.filter((name) =>
    core.has(name) && !local.has(name)
  );
  const fromSource = [
    ...printed.components.filter((name) => !fromCore.includes(name)),
    ...printed.references,
  ];
  const body = printed.source.split("\n").map((line) => `  ${line}`).join(
    "\n",
  );
  return [
    "/** @jsxRuntime classic */",
    "/** @jsx Jsx.createElement */",
    "/** @jsxFrag Jsx.Fragment */",
    "// Printed by gggplot (printJsx): data is passed by reference.",
    'import * as Jsx from "@gggplot/core/jsx";',
    'import type { LiveElement } from "@use-gpu/live";',
    ...(fromCore.length
      ? [`import { ${fromCore.sort(byName).join(", ")} } from "@gggplot/core";`]
      : []),
    ...(fromSource.length
      ? [
        `import { ${[...new Set(fromSource)].sort(byName).join(", ")} } from ${
          JSON.stringify(options.from)
        };`,
      ]
      : []),
    "",
    `export const ${options.name} = (): LiveElement => (`,
    body,
    ");",
    "",
  ].join("\n");
}
