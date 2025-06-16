# 🐼 Panda Parse

**Panda Parse** is a general-purpose parser library that helps you convert text into structured meaning — known as an **Abstract Syntax Tree (AST)**. It’s designed for building custom languages, expression evaluators, config parsers, style DSLs, and more.

---

## What is an AST?

An **AST (Abstract Syntax Tree)** is a structured representation of your input — like a nested object that reflects the grammar of the language you're parsing.

For example, parsing this expression:

```
2 + 3
```

...might produce this AST:

```js
{
  type: "Add",
  left: { type: "Number", value: 2 },
  right: { type: "Number", value: 3 }
}
```

Once you have an AST, you can:

- Compile it into another language
- Evaluate it directly
- Transform it into another format

**Panda Parse** makes it easy to build these kinds of trees, using simple class definitions and grammar rules.

---

## Installing Panda Parse

You can install Panda Parse via npm:

```bash
npm install panda-parse
```

---

## Importing Core Components

To start using Panda Parse in your project, import the core classes:

```js
import { $AST, Lexer, Shape } from "panda-parse";
```

These are the three essential pieces:

- `Lexer` — splits the input into a stream of tokens
- `$AST` — base class for your custom syntax tree nodes
- `Shape` — defines the grammar pattern for each AST node

Note that in panda parse the `$NAME` convention is used for all ASTs.

---

## Lexing and Parsing — Your First Example

Let’s build a simple parser that recognizes whole numbers.

### 1. Define a number node

```js
class $NUMBER extends $AST {
  static SHAPE = new Shape(/^\d+/); // Match one or more digits
}
```

This creates an AST class that matches numeric strings like `"42"` or `"123"`. Notice the use of a regular expression here, you can also use plain strings.

### 2. Parse a string

```js
const lexer = new Lexer("42");
const ast = $NUMBER.parse(lexer);

console.log(ast.text); // Output: "42"
```

Here’s what’s happening:

- `Lexer("42")` creates a stream of tokens starting at the beginning of the input
- `$NUMBER.parse(...)` tries to match the shape from the current lexer position
- The result is an AST node with the `.text` value `"42"`

---

## Building Binary Expressions

Now that you've built a basic number parser, let’s expand our grammar to support **binary expressions** like `2 + 3`.

---

### Step 1: Define an Addition Expression

We’ll define an AST node for `a + b` where both sides are numbers.

```js
class $ADD extends $AST {
  static SHAPE = new Shape($NUMBER, "+", $NUMBER);
}
```

This shape matches:

- a `$NUMBER`
- the `"+"` symbol
- another `$NUMBER`

You can now parse:

```js
const ast = $ADD.parse(new Lexer("2+3"));
console.log(ast.contentExps.map((e) => e.text)); // ["2", "+", "3"]
```

In the example above we map the `contentExps`, those are all the sub-expressions in the AST (See $AST api documentation below for more info).

---

### How It Works

Each part of the shape corresponds to a token or sub-expression:

- `contentExps[0]` → left-hand number
- `contentExps[1]` → the `"+"` operator
- `contentExps[2]` → right-hand number

---

### Adding a Custom Method (Optional)

You can optionally give your AST nodes a method to evaluate or transform the tree:

```js
class $ADD extends $AST {
  static SHAPE = new Shape($NUMBER, "+", $NUMBER);

  toJS() {
    const [left, , right] = this.contentExps;
    return Number(left.text) + Number(right.text);
  }
}

console.log($ADD.parse(new Lexer("10+20")).toJS()); // 30
```

This is useful for compiling, interpreting, or transforming your language.

---

### Step 2: Add Multiplication Support

Let’s define a similar node for multiplication:

```js
class $MULTIPLY extends $AST {
  static SHAPE = new Shape($NUMBER, "*", $NUMBER);
}
```

You can now parse:

```js
const ast = $MULTIPLY.parse(new Lexer("4*5"));
console.log(ast.contentExps.map((e) => e.text)); // ["4", "*", "5"]
```

---

### Optional: Supporting Spacing

By default, whitespace is ignored between tokens. So all of these will work:

- `2+3`
- `2 + 3`
- `2  +     3`

No extra setup needed — Panda Parse handles this for you.

---

### Step 3: Recursion — Multiple Operations

If you want to support chained expressions like `1 + 2 + 3`, you can make your class **recursive** by referencing `this` in its own shape:

```js
class $ADD extends $AST {
  static SHAPE = new Shape($NUMBER, "+", this);
}
```

This allows inputs like:

```js
const ast = $ADD.parse(new Lexer("1+2+3"));
```

---

### Recap

You’ve now built:

- A number matcher
- An addition AST node
- A multiplication AST node
- A recursive version of addition

In the next section, you’ll learn how to build **grouped expressions** like `(1 + 2)` and how to compose a full grammar that supports all operations.

---

## Grouping and Composing Expressions

In this final section of the beginner tutorial, you’ll build support for **parentheses**, then tie everything together into a complete expression parser that can handle numbers, operators, and groups like `(1 + 2) * 3`.

---

### Step 1: Grouped Expressions

We want to support input like:

```
(1 + 2)
```

To do this, we create a new AST class that expects:

- a `"("`
- a full expression
- a `")"`

```js
class $GROUP extends $AST {
  static SHAPE = new Shape("(", () => $EXPR, ")");
}
```

This tells the parser: “wrap another expression inside parentheses.”

Notice also the use of an arrow function `() => $EXPR`, because we haven't defined $EXPR yet (we will in the next section), we can lazily access it witht the arrow function. This helps when you have interdependent expressions like in the case of `$GROUP`and`$EXPR`

---

### Step 2: Compose All the Pieces

We’ve built multiple AST node types: `$NUMBER`, `$ADD`, `$MULTIPLY`, and `$GROUP`. Now we create a top-level node that tries them all.

```js
class $EXPR extends $AST {
  static SHAPE = new Shape([$GROUP, $ADD, $MULTIPLY, $NUMBER]);
}
```

This means `$EXPR` will try matching:

1. A group like `(1 + 2)`
2. An addition like `1 + 2`
3. A multiplication like `2 * 3`
4. A plain number like `42`

Panda Parse will try each one in order and return the first successful match.

---

### Step 3: Parse Full Expressions

Now you can parse things like:

```js
$EXPR.parse(new Lexer("3 + 4")); // Addition
$EXPR.parse(new Lexer("2 * 5")); // Multiplication
$EXPR.parse(new Lexer("(1 + 2)")); // Grouped expression
$EXPR.parse(new Lexer("(1 + 2) * 3")); // But wait... what about this?
```

---

### Operator Precedence

Panda Parse parses expressions _in the order you define them_ — so if `$ADD` comes before `$MULTIPLY`, it will match that first. It doesn’t handle operator precedence unless you design it to.

To handle real operator precedence (like `*` before `+`), you’ll need to:

- Create multiple expression layers (e.g. `$TERM`, `$FACTOR`)
- Parse based on priority

## That’s a more advanced topic and not covered in this documentation.

### ✅ Summary

You now have a working expression parser that supports:

- Numbers: `42`
- Addition: `1 + 2`
- Multiplication: `3 * 4`
- Grouping: `(1 + 2)`
- Chaining: `1 + 2 + 3`

With this foundation, you can:

- Add new operators (`-`, `/`, `^`, `&&`, etc.)
- Add functions: `sum(1, 2)`
- Add variables or identifiers: `x + y * z`

---

## Incomplete Parsing Options

Panda Parse allows for **flexible matching**, especially useful in live coding environments, REPLs, or when building interactive tools like editors and validators.

These two static fields can be set on any `$AST` subclass to enable partial parsing:

---

### `allowIncompleteParse`

```js
static allowIncompleteParse = true;
```

If enabled, the parser will accept a partially matched node — even if **not all parts of the `SHAPE` succeed** — as long as the threshold (below) is met.

This allows you to parse incomplete or in-progress code like:

```
1 +
```

or:

```
border:
```

without crashing or failing the parse.

---

### `incompleteParseThreshold`

```js
static incompleteParseThreshold = 2;
```

This defines the **minimum number of shape elements that must be matched** for the parse to be considered valid.

### Example:

```js
class $EXAMPLE extends $AST {
  static allowIncompleteParse = true;
  static incompleteParseThreshold = 2;
  static SHAPE = new Shape($A, $B, $C, $D);
}
```

- If `$A`, `$B`, `$C`, and `$D` all match: ✅ accepted
- If only `$A` and `$B` match: ✅ accepted
- If only `$A` matches: ❌ rejected (threshold not met)

This is especially useful for deeply nested or long shapes where partial progress is still meaningful.

---

### Why It's Useful

This system is great for:

- Live feedback while typing
- Graceful fallback on broken code
- Building resilient parsers for editors
- Supporting incomplete input without special cases

You can combine this with `.fallbackToFirstExp` for even more intelligent error handling or graceful degradation.

---

```js
static fallbackToFirstExp = true;
```

This tells Panda Parse:  
“If this node fails to match fully, return the first successfully parsed subcomponent instead.”

---

# $AST API Documentation

`$AST` is the base class for all syntax tree nodes in Panda Parse. You extend it to define new language constructs and parsing rules using declarative `SHAPE` definitions.

---

## Basic Usage

```js
class $NUMBER extends $AST {
  static SHAPE = new Shape(/^\d+/);
}
```

Then you can parse using:

```js
const ast = $NUMBER.parse(new Lexer("42"));
```

---

## Static Properties

### `static AST = true`

Identifies this class as a valid AST node.

### `static SHAPE`

Defines the grammar rule for this node using a `Shape` object.

### `static allowIncompleteParse = false`

Allows the node to match partially parsed inputs (see below).

### `static incompleteParseThreshold = 1`

Minimum number of successful components required when `allowIncompleteParse` is enabled.

### `static fallbackToFirstExp = true`

If the node fails to fully parse, fallback to the first successfully parsed expression.

---

## Constructor

```js
new MyAST({ exps, ...rest });
```

Called internally by `.parse()` to construct a node with child expressions.

### Parameters:

- `exps` – array of parsed sub-expressions (ASTs or Tokens)
- Any other fields passed via `...rest` are stored on the instance

---

## Instance Properties

### `.exps`

All expressions (both ASTs and Tokens) parsed by the shape.

### `.contentExps`

Filtered version of `exps` — includes only:

- AST nodes
- Tokens that are not whitespace

### `.tokens`

All tokens (flat array), including whitespace and those nested in child ASTs.

### `.contentTokens`

Only non-whitespace tokens.

### `.whiteSpaceTokens`

Only whitespace tokens.

### `.text`

The full matched text string from all tokens.

### `.lineStart`, `.lineEnd`

The absolute start and end character offsets of the AST on the original input line.

### `.line`

The zero-based line index of the first token.

### `.col`

The column position (in the line) of the first token.

---

## `.validate(env)`

Validates the AST node. Returns an array of `ASTError` instances based on:

- missing tokens
- shape expectation failures

### Example:

```js
const errors = ast.validate(new TypeEnv());
```

---

## `.toSimpleObj(lineStart = 0, lineEnd = Infinity, offset = 0)`

Returns a simplified object representation of the AST tree, suitable for visualization or debugging.

---

## `.getVisibleTokens(lineStart, lineEnd)`

Returns all visible tokens within a given line range, including metadata for highlighting.

---

## Static Method: `.parse(lexer)`

Parses a node from a given `Lexer` instance.

### Returns:

- An instance of the AST subclass
- `null` if parsing fails

Internally, it iterates over the class's `SHAPE`, collecting tokens or nested ASTs.

Handles:

- fallback to first expression (if enabled)
- incomplete parse tokens (when `allowIncompleteParse` is set)
- token-level caching and cursor restoration

## `.toJS()`

Optional method to "compile" or transform the AST node. Override in subclasses as needed. This could also say `toC` or `toJava`, etc.

### Example:

```js
toJS() {
  return `${this.constructor.name}`;
}
```

---

## Lexer API Documentation

The `Lexer` is responsible for turning a raw string into a stream of tokens. It provides the foundational input mechanism for parsing in Panda Parse. Each AST node uses the lexer to inspect, match, and consume parts of the input string.

---

## Constructor

```js
const lexer = new Lexer(str);
```

### Parameters:

- `str` _(string)_ – the input string to tokenize and parse.

### Example:

```js
const lexer = new Lexer("42 + 7");
```

---

## Core Properties

### `lexer.str`

The full original input string.

### `lexer.cursor`

The current position (index) in the input string.

### `lexer.hasMoreToLex`

Returns `true` if there’s more text to parse (i.e. `cursor < str.length`).

### `lexer.parsedStr`

Returns everything that has been parsed so far:

```js
lexer.parsedStr; // str.slice(0, cursor)
```

### `lexer.unparsedStr`

Returns the remaining unparsed string:

```js
lexer.unparsedStr; // str.slice(cursor)
```

---

## Cursor Management

### `lexer.pushCursor()`

Saves the current cursor position to a stack.

### `lexer.popCursor()`

Restores the last saved cursor position from the stack.

Use this to backtrack safely during complex parsing logic.

---

## Line & Indentation Helpers

### `lexer.currentLine`

Returns the current line index (zero-based) based on cursor position.

### `lexer.currentCol`

Returns the column number (character offset in the current line).

### `lexer.lineStart(line)`

Returns the absolute start index of the given line.

### `lexer.lineEnd(line)`

Returns the absolute end index of the given line.

### `lexer.lineIndent(line)`

Returns the number of leading spaces in the given line.

### `lexer.currentIndent`

Returns indentation level of the current line.

### `lexer.currentLineStart`, `currentLineEnd`, `currentLineContentStart`, `currentLineContentEnd`

Convenient versions of the above, but for the current line.

---

## Caching

### `lexer.cacheGet(cursor = 0, name = "")`

Retrieves a previously stored cached result by key.

### `lexer.cacheSet(item, cursor = 0, name = "")`

Stores a result at a given position with a custom name.

Useful for memoizing results in recursive or repeated patterns.

---

## 🔍 Matching Input

### `lexer.taste(pattern)`

Simulates matching the given `pattern` **without consuming** it.

- `pattern` can be a string or RegExp.
- Advances an internal `tasteCursor` if matched.
- Returns: `{ value }` if successful, `null` if not.

### `lexer.eat(pattern)`

Attempts to match and **consume** the given pattern from the input.

- Returns a `Token` if successful.
- Advances the main `cursor`.
- Returns `null` if the pattern doesn't match.

### Example:

```js
const lexer = new Lexer("hello world");

lexer.eat("hello"); // ✅ matches
lexer.eat("world"); // ❌ fails — cursor is now after "hello"

lexer.eat(/\s+/); // ✅ matches the space
lexer.eat("world"); // ✅ now matches
```

---

## Utility

### `lexer.isLexable(x)`

Returns true if `x` is a valid lexing target (a string or RegExp).

### `lexer.linesInRange(start, end)`

Returns the line numbers that intersect with a character range.

---

## Token Structure

When `eat()` successfully matches, it returns a `Token` object with:

```js
{
  type, // the pattern used to match (string or RegExp)
    value, // the matched string
    start,
    end, // character positions
    line,
    col, // line/column position info
    indent, // indentation level of line
    paddingLeft,
    paddingRight; // reserved for future styling
}
```

---

## Summary

The `Lexer` provides:

- Cursor-based string scanning
- Line and column tracking
- RegExp and literal matching
- Optional lookahead (`taste`) and consumption (`eat`)
- Memoization through caching
- Precise token-level control for building ASTs

It’s the foundation for the Panda Parse parsing pipeline.
