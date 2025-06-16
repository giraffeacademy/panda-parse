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

Now that you've built a basic number parser, let’s expand our grammar to support binary expressions like `2 + 3`.

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

If you want to support chained expressions like `1 + 2 + 3`, you can make your class recursive by referencing `this` in its own shape:

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

In the next section, you’ll learn how to build grouped expressions like `(1 + 2)` and how to compose a full grammar that supports all operations.

---

## Grouping and Composing Expressions

In this final section of the beginner tutorial, you’ll build support for parentheses, then tie everything together into a complete expression parser that can handle numbers, operators, and groups like `(1 + 2) * 3`.

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

Notice also the use of an arrow function `() => $EXPR`, because we haven't defined $EXPR yet (we will in the next section), we can lazily access it with the arrow function. This helps when you have interdependent expressions like in the case of `$GROUP`and`$EXPR`.

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

Panda Parse parses expressions in the order you define them — so if `$ADD` comes before `$MULTIPLY`, it will match that first. It doesn’t handle operator precedence unless you design it to.

To handle real operator precedence (like `*` before `+`), you’ll need to:

- Create multiple expression layers (e.g. `$TERM`, `$FACTOR`)
- Parse based on priority

That’s a more advanced topic and not covered in this documentation.

---

### Summary

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
