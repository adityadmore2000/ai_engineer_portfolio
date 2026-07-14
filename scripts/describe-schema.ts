/**
 * Schema discovery bridge for the publishing agent.
 *
 * Imports the `project` document schema from the local Sanity Studio codebase
 * (the single source of truth), executes each field's `validation` function
 * against a chainable MockRule that records method calls, and prints a
 * normalized JSON description of the schema to stdout.
 *
 * The agent caches this output in-process and refreshes it only when
 * `sanity/schemaTypes/project.ts` changes (mtime-keyed). Add, rename, remove,
 * or require a field in the Sanity schema and the agent adapts automatically
 * — no prompt, parser, or validation edits required.
 *
 * Usage:
 *   npx tsx scripts/describe-schema.ts [project]
 *
 * The optional document-type argument defaults to `project`.
 */

import { project } from "../sanity/schemaTypes/project";

type AnyField = Record<string, unknown> & {
  name?: string;
  title?: string;
  type?: string;
  options?: Record<string, unknown>;
  initialValue?: unknown;
  description?: string;
  validation?: (rule: unknown) => unknown;
  fields?: AnyField[];
  of?: AnyField[];
};

type Constraint = { method: string; args: unknown[] };

/**
 * Build a chainable mock of Sanity's `Rule` API. Any method call records
 * itself and returns the same proxy, so arbitrary validation chains like
 * `Rule.required().integer().min(0)` can be executed and inspected.
 */
function createMockRule(): { rule: unknown; constraints: Constraint[] } {
  const constraints: Constraint[] = [];
  const rule = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "__recorded") return constraints;
        return (...args: unknown[]) => {
          constraints.push({ method: String(prop), args });
          return rule;
        };
      },
    }
  );
  return { rule, constraints };
}

/**
 * Run a field's validation function against the mock Rule and return the
 * recorded method calls. Validation functions sometimes inspect properties
 * of the Rule beyond chained methods; the proxy returns a callable for any
 * property access, so it never throws on unknown access. Errors are swallowed
 * so a single misbehaving validation never breaks discovery of the others.
 */
function runValidation(
  validationFn: (rule: unknown) => unknown
): Constraint[] {
  try {
    const { rule, constraints } = createMockRule();
    validationFn(rule);
    return constraints;
  } catch {
    return [];
  }
}

type InterpretedConstraints = {
  required?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
  length?: number;
  email?: boolean;
  uri?: { scheme?: string[] };
  regex?: string;
  custom?: boolean;
  severity?: "warning" | "error";
};

function interpretConstraints(constraints: Constraint[]): InterpretedConstraints {
  const out: InterpretedConstraints = {};
  for (const c of constraints) {
    switch (c.method) {
      case "required":
        out.required = true;
        break;
      case "optional":
        out.required = false;
        break;
      case "integer":
        out.integer = true;
        break;
      case "min":
        out.min = c.args[0] as number;
        break;
      case "max":
        out.max = c.args[0] as number;
        break;
      case "length":
        out.length = c.args[0] as number;
        break;
      case "email":
        out.email = true;
        break;
      case "uri":
        out.uri = (c.args[0] as { scheme?: string[] }) || {};
        break;
      case "regex":
        out.regex = c.args[0] as string;
        break;
      case "custom":
        out.custom = true;
        break;
      case "warning":
        out.severity = "warning";
        break;
      case "error":
        out.severity = "error";
        break;
      default:
        break;
    }
  }
  return out;
}

type ExtractedField = {
  name: string;
  title?: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
  initialValue?: unknown;
  required?: boolean;
  constraints?: InterpretedConstraints;
  childFields?: ExtractedField[];
  of?: Array<Partial<ExtractedField> & { options?: Record<string, unknown> }>;
};

function extractField(field: AnyField): ExtractedField {
  const out: ExtractedField = {
    name: field.name ?? "",
    title: field.title,
    type: field.type ?? "string",
  };
  if (field.description) out.description = field.description;
  if (field.options) out.options = field.options;
  if (field.initialValue !== undefined) out.initialValue = field.initialValue;

  if (typeof field.validation === "function") {
    const constraints = runValidation(field.validation);
    if (constraints.length) {
      const interpreted = interpretConstraints(constraints);
      if (Object.keys(interpreted).length) out.constraints = interpreted;
      if (interpreted.required) out.required = true;
    }
  }

  if (Array.isArray(field.fields)) {
    out.childFields = field.fields.map(extractField);
  }

  if (Array.isArray(field.of)) {
    out.of = field.of.map((item) => {
      const itemOut: ExtractedField["of"] extends Array<infer U> ? U : never =
        {
          type: item.type ?? "string",
        } as ExtractedField["of"] extends Array<infer U> ? U : never;
      if (item.options) (itemOut as Record<string, unknown>).options = item.options;
      if (Array.isArray(item.fields)) {
        (itemOut as Record<string, unknown>).childFields = item.fields.map(
          extractField
        );
      }
      if (item.title) (itemOut as Record<string, unknown>).title = item.title;
      return itemOut;
    });
  }

  return out;
}

function describeSchema(typeDef: AnyField): {
  type: string;
  name: string;
  title?: string;
  fields: ExtractedField[];
} {
  return {
    type: typeDef.type ?? "document",
    name: typeDef.name ?? "",
    title: typeDef.title,
    fields: (typeDef.fields ?? []).map(extractField),
  };
}

async function main() {
  const documentType = process.argv[2] || "project";
  let typeDef: AnyField;

  if (documentType === "project") {
    typeDef = project as unknown as AnyField;
  } else {
    console.error(
      `Unsupported document type: ${documentType}. Only "project" is discoverable.`
    );
    process.exit(1);
  }

  const schema = describeSchema(typeDef);
  console.log(JSON.stringify(schema, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});