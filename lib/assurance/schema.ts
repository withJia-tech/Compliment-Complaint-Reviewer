// Minimal strict validators. Zero dependencies on purpose: the contract
// rules (reject unknown fields, no coercion, no defaults) are simple enough
// that a library would add more surface than it removes.

export interface Issue {
  path: string;
  code:
    | "wrong_type"
    | "unknown_field"
    | "missing_field"
    | "out_of_enum"
    | "out_of_range"
    | "too_long"
    | "empty"
    // Semantic codes, raised by handoffs.ts once the shape is valid.
    | "evidence_mismatch"
    | "span_out_of_bounds"
    | "unsupported_claim"
    | "policy_violation"
    | "byte_cap_exceeded";
  message: string;
}

export type Validator = (value: unknown, path: string, issues: Issue[]) => void;

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function str(opts: { maxLength?: number; nonEmpty?: boolean } = {}): Validator {
  return (value, path, issues) => {
    if (typeof value !== "string") {
      issues.push({ path, code: "wrong_type", message: `expected string, got ${typeName(value)}` });
      return;
    }
    if (opts.nonEmpty && value.length === 0) {
      issues.push({ path, code: "empty", message: "must not be empty" });
    }
    if (opts.maxLength !== undefined && value.length > opts.maxLength) {
      issues.push({ path, code: "too_long", message: `length ${value.length} > ${opts.maxLength}` });
    }
  };
}

export function int(min?: number, max?: number): Validator {
  return (value, path, issues) => {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      issues.push({ path, code: "wrong_type", message: `expected integer, got ${typeName(value)}` });
      return;
    }
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
      issues.push({ path, code: "out_of_range", message: `${value} outside [${min ?? "-∞"}, ${max ?? "∞"}]` });
    }
  };
}

export function bool(): Validator {
  return (value, path, issues) => {
    if (typeof value !== "boolean") {
      issues.push({ path, code: "wrong_type", message: `expected boolean, got ${typeName(value)}` });
    }
  };
}

export function oneOf(values: readonly string[]): Validator {
  return (value, path, issues) => {
    if (typeof value !== "string" || !values.includes(value)) {
      issues.push({
        path,
        code: "out_of_enum",
        message: `expected one of ${values.join(", ")}, got ${JSON.stringify(value)}`,
      });
    }
  };
}

export function nullable(inner: Validator): Validator {
  return (value, path, issues) => {
    if (value === null) return;
    inner(value, path, issues);
  };
}

export function arr(inner: Validator, opts: { maxItems?: number } = {}): Validator {
  return (value, path, issues) => {
    if (!Array.isArray(value)) {
      issues.push({ path, code: "wrong_type", message: `expected array, got ${typeName(value)}` });
      return;
    }
    if (opts.maxItems !== undefined && value.length > opts.maxItems) {
      issues.push({ path, code: "too_long", message: `${value.length} items > ${opts.maxItems}` });
    }
    value.forEach((item, index) => inner(item, `${path}[${index}]`, issues));
  };
}

/** Exact-key object: every listed key is required, any other key is rejected. */
export function obj(shape: Record<string, Validator>): Validator {
  return (value, path, issues) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      issues.push({ path, code: "wrong_type", message: `expected object, got ${typeName(value)}` });
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(key in shape)) {
        issues.push({ path: join(path, key), code: "unknown_field", message: "field not in contract" });
      }
    }
    for (const [key, validator] of Object.entries(shape)) {
      if (!(key in record) || record[key] === undefined) {
        issues.push({ path: join(path, key), code: "missing_field", message: "required field missing" });
        continue;
      }
      validator(record[key], join(path, key), issues);
    }
  };
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

export function validate(value: unknown, validator: Validator, path = ""): Issue[] {
  const issues: Issue[] = [];
  validator(value, path, issues);
  return issues;
}
