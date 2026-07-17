import type {
  Expression,
  ExtensionDefinition,
  MappingExpr,
  ProductPlan,
} from "./types.ts";

const EXTENSION_ID =
  /^(?:@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*:)?[a-z0-9][a-z0-9_-]*@[1-9][0-9]*$/;

export function validateExpression(expression: Expression): string[] {
  if (expression.kind !== "call") return [];
  const arity = expression.op === "negate" ? 1 : 2;
  const errors = expression.args.length === arity
    ? []
    : [`${expression.op} requires ${arity} argument(s)`];
  return [...errors, ...expression.args.flatMap(validateExpression)];
}

export function validateMapping(mapping: MappingExpr): string[] {
  if (mapping.kind === "column" && mapping.column.length === 0) {
    return ["column mapping requires a column name"];
  }
  if (mapping.kind === "afterStat" && mapping.field.length === 0) {
    return ["afterStat mapping requires an output field"];
  }
  return mapping.kind === "afterScale"
    ? validateExpression(mapping.expression)
    : [];
}

export function validateProductPlan(plan: ProductPlan): string[] {
  const names = new Set<string>();
  const errors: string[] = [];
  for (const field of plan.outputs) {
    if (!field.name) errors.push("output fields require a name");
    if (names.has(field.name)) {
      errors.push(`duplicate output field: ${field.name}`);
    }
    names.add(field.name);
    if (field.dimensions.length === 0 && field.shape !== "scalar") {
      errors.push(`non-scalar field ${field.name} requires dimensions`);
    }
  }
  for (const input of plan.inputs) {
    if (!input.field) errors.push("input ports require a field name");
  }
  return errors;
}

export function validateExtension(definition: ExtensionDefinition): string[] {
  const errors = EXTENSION_ID.test(definition.id)
    ? []
    : ["extension id must be versioned, for example @scope/pkg:stat_bin@1"];
  const names = new Set<string>();
  for (const field of definition.outputFields ?? []) {
    if (names.has(field.name)) {
      errors.push(`duplicate output field: ${field.name}`);
    }
    names.add(field.name);
  }
  for (const mapping of Object.values(definition.computedAes ?? {})) {
    errors.push(...validateMapping(mapping));
  }
  return errors;
}

/** Validate a concrete parameter bag against a declarative extension schema. */
export function validateParameters(
  definition: ExtensionDefinition,
  parameters: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  for (const [name, value] of Object.entries(parameters)) {
    const schema = definition.parameters?.[name];
    if (!schema) {
      errors.push(`unknown parameter: ${name}`);
      continue;
    }
    if (schema.type !== "enum" && typeof value !== schema.type) {
      errors.push(`parameter ${name} must be ${schema.type}`);
    }
    if (schema.type === "enum" && !schema.values?.includes(value as never)) {
      errors.push(`parameter ${name} must be one of its declared values`);
    }
  }
  for (const [name, schema] of Object.entries(definition.parameters ?? {})) {
    if (
      schema.required && !(name in parameters) && schema.default === undefined
    ) {
      errors.push(`missing required parameter: ${name}`);
    }
  }
  return errors;
}
