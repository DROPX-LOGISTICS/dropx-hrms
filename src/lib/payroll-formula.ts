export type PayrollCalculationType = "input" | "fixed" | "formula";

export type PayrollFormulaLine = {
  code: string;
  calculationType: PayrollCalculationType;
  formula?: string | null;
  fixedAmount?: number | null;
};

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "%" }
  | { type: "left" }
  | { type: "right" };

export function normalizePayrollCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function tokenize(formula: string): Token[] {
  if (!formula.trim()) throw new Error("Equation is required.");
  if (formula.length > 250) throw new Error("Equation cannot exceed 250 characters.");
  const tokens: Token[] = [];
  let index = 0;
  while (index < formula.length) {
    const rest = formula.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { index += whitespace[0].length; continue; }
    const bracketed = rest.match(/^\[([A-Za-z][A-Za-z0-9_]*)\]/);
    if (bracketed) {
      tokens.push({ type: "identifier", value: normalizePayrollCode(bracketed[1]) });
      index += bracketed[0].length;
      continue;
    }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw new Error("Equation contains an invalid number.");
      tokens.push({ type: "number", value });
      index += number[0].length;
      continue;
    }
    const identifier = rest.match(/^[A-Za-z][A-Za-z0-9_]*/);
    if (identifier) {
      tokens.push({ type: "identifier", value: normalizePayrollCode(identifier[0]) });
      index += identifier[0].length;
      continue;
    }
    const character = formula[index];
    if (["+", "-", "*", "/", "%"].includes(character)) tokens.push({ type: "operator", value: character as "+" | "-" | "*" | "/" | "%" });
    else if (character === "(") tokens.push({ type: "left" });
    else if (character === ")") tokens.push({ type: "right" });
    else throw new Error(`Equation contains unsupported character “${character}”.`);
    index += 1;
  }
  return tokens;
}

function parseFormula(formula: string, resolver: (code: string) => number) {
  const tokens = tokenize(formula);
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  function primary(): number {
    const token = take();
    if (!token) throw new Error("Equation ends unexpectedly.");
    let result: number;
    if (token.type === "number") result = token.value;
    else if (token.type === "identifier") result = resolver(token.value);
    else if (token.type === "left") {
      result = expression();
      if (take()?.type !== "right") throw new Error("Equation has an unmatched parenthesis.");
    } else throw new Error("Equation has an unexpected value.");
    while (true) {
      const next = peek();
      if (next?.type !== "operator" || next.value !== "%") break;
      take(); result /= 100;
    }
    return result;
  }

  function unary(): number {
    const token = peek();
    if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
      take();
      const result = unary();
      return token.value === "-" ? -result : result;
    }
    return primary();
  }

  function term(): number {
    let result = unary();
    while (true) {
      const next = peek();
      if (next?.type !== "operator" || (next.value !== "*" && next.value !== "/")) break;
      const operator = take() as Extract<Token, { type: "operator" }>;
      const right = unary();
      if (operator.value === "/" && right === 0) throw new Error("Equation cannot divide by zero.");
      result = operator.value === "*" ? result * right : result / right;
    }
    return result;
  }

  function expression(): number {
    let result = term();
    while (true) {
      const next = peek();
      if (next?.type !== "operator" || (next.value !== "+" && next.value !== "-")) break;
      const operator = take() as Extract<Token, { type: "operator" }>;
      const right = term();
      result = operator.value === "+" ? result + right : result - right;
    }
    return result;
  }

  const result = expression();
  if (index !== tokens.length) throw new Error("Equation contains an unexpected value.");
  if (!Number.isFinite(result)) throw new Error("Equation result must be a finite number.");
  return result;
}

export function payrollFormulaReferences(formula: string) {
  return [...new Set(tokenize(formula).filter((token): token is Extract<Token, { type: "identifier" }> => token.type === "identifier").map((token) => token.value))];
}

export function evaluatePayrollFormula(formula: string, values: Record<string, number>) {
  const normalized = Object.fromEntries(Object.entries(values).map(([code, value]) => [normalizePayrollCode(code), value]));
  return parseFormula(formula, (code) => {
    const value = normalized[code];
    if (value === undefined) throw new Error(`Equation references unknown pay head ${code}.`);
    if (!Number.isFinite(value)) throw new Error(`Pay head ${code} does not have a valid amount.`);
    return value;
  });
}

export function validatePayrollConfiguration(lines: PayrollFormulaLine[]) {
  const normalized = lines.map((line) => ({ ...line, code: normalizePayrollCode(line.code) }));
  const codes = new Set(normalized.map((line) => line.code));
  if (codes.size !== normalized.length || codes.has("")) throw new Error("Every configured pay head must have a unique code.");
  const ctc = normalized.find((line) => line.code === "CTC");
  if (!ctc || ctc.calculationType !== "input") throw new Error("CTC must remain the salary input pay head.");
  const graph = new Map<string, string[]>();
  for (const line of normalized) {
    if (line.calculationType === "fixed") {
      if (!Number.isFinite(line.fixedAmount) || Number(line.fixedAmount) < 0) throw new Error(`${line.code} requires a valid fixed amount.`);
      graph.set(line.code, []);
      continue;
    }
    if (line.calculationType === "input") { graph.set(line.code, []); continue; }
    const references = payrollFormulaReferences(line.formula ?? "");
    const unknown = references.find((code) => !codes.has(code));
    if (unknown) throw new Error(`${line.code} references unknown pay head ${unknown}.`);
    graph.set(line.code, references);
  }
  const state = new Map<string, "visiting" | "done">();
  function visit(code: string) {
    if (state.get(code) === "visiting") throw new Error(`Circular pay head equation detected at ${code}.`);
    if (state.get(code) === "done") return;
    state.set(code, "visiting");
    for (const dependency of graph.get(code) ?? []) visit(dependency);
    state.set(code, "done");
  }
  for (const code of graph.keys()) visit(code);
  return normalized;
}

export function calculatePayrollConfiguration(lines: PayrollFormulaLine[], inputs: Record<string, number>) {
  const normalized = validatePayrollConfiguration(lines);
  const byCode = new Map(normalized.map((line) => [line.code, line]));
  const calculated: Record<string, number> = {};
  const calculate = (code: string): number => {
    if (calculated[code] !== undefined) return calculated[code];
    const line = byCode.get(code);
    if (!line) throw new Error(`Unknown pay head ${code}.`);
    let amount: number;
    if (line.calculationType === "input") amount = Number(inputs[code]);
    else if (line.calculationType === "fixed") amount = Number(line.fixedAmount);
    else {
      const dependencies = payrollFormulaReferences(line.formula ?? "");
      amount = parseFormula(line.formula ?? "", (dependency) => calculate(dependency));
      for (const dependency of dependencies) calculate(dependency);
    }
    if (!Number.isFinite(amount)) throw new Error(`${code} requires a valid input amount.`);
    calculated[code] = Math.round((amount + Number.EPSILON) * 100) / 100;
    return calculated[code];
  };
  for (const code of byCode.keys()) calculate(code);
  return calculated;
}
