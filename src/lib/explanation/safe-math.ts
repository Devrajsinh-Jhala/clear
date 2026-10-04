const NUMBER = /^(?:\d+\.\d+|\d+)/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;

type Token =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "paren"; value: "(" | ")" };

export function evaluateSafeMath(
  expression: string,
  variables: Record<string, number>,
): number | null {
  try {
    const tokens = tokenize(expression);
    let index = 0;

    function peek(): Token | undefined {
      return tokens[index];
    }

    function take(): Token {
      const token = tokens[index];
      if (!token) throw new Error("Unexpected end of formula.");
      index += 1;
      return token;
    }

    function parseExpression(): number {
      let value = parseTerm();
      while (peek()?.kind === "op" && (peek()?.value === "+" || peek()?.value === "-")) {
        const operator = take().value;
        const right = parseTerm();
        value = operator === "+" ? value + right : value - right;
      }
      return value;
    }

    function parseTerm(): number {
      let value = parseFactor();
      while (peek()?.kind === "op" && (peek()?.value === "*" || peek()?.value === "/")) {
        const operator = take().value;
        const right = parseFactor();
        if (operator === "/" && right === 0) throw new Error("Division by zero.");
        value = operator === "*" ? value * right : value / right;
      }
      return value;
    }

    function parseFactor(): number {
      const token = peek();
      if (token?.kind === "op" && token.value === "-") {
        take();
        return -parseFactor();
      }
      if (token?.kind === "paren" && token.value === "(") {
        take();
        const value = parseExpression();
        const closing = take();
        if (closing.kind !== "paren" || closing.value !== ")") throw new Error("Missing parenthesis.");
        return value;
      }
      if (token?.kind === "number") {
        take();
        return token.value;
      }
      if (token?.kind === "name") {
        take();
        if (!(token.value in variables)) throw new Error("Unknown name.");
        return variables[token.value];
      }
      throw new Error("Unexpected token.");
    }

    const value = parseExpression();
    if (index !== tokens.length || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let rest = expression.trim();
  while (rest.length > 0) {
    if (rest[0] === " ") {
      rest = rest.slice(1);
      continue;
    }
    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({ kind: "number", value: Number(number[0]) });
      rest = rest.slice(number[0].length);
      continue;
    }
    const name = IDENT.exec(rest);
    if (name) {
      tokens.push({ kind: "name", value: name[0] });
      rest = rest.slice(name[0].length);
      continue;
    }
    const symbol = rest[0];
    if (symbol === "+" || symbol === "-" || symbol === "*" || symbol === "/") {
      tokens.push({ kind: "op", value: symbol });
      rest = rest.slice(1);
      continue;
    }
    if (symbol === "(" || symbol === ")") {
      tokens.push({ kind: "paren", value: symbol });
      rest = rest.slice(1);
      continue;
    }
    throw new Error("Unsupported formula character.");
  }
  return tokens;
}
