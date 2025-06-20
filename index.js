const WHITESPACE_REGEX = /(?:[ ]+\n?|\n)/y;

Object.defineProperty(Array.prototype, "binarySearch", {
  value: function (callback) {
    let low = 0;
    let high = this.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const comparison = callback(this[mid]);

      if (comparison === 0) return mid; // Correctly found the element
      else if (comparison < 0) high = mid - 1; // Search in the left half
      else low = mid + 1; // Search in the right half
    }

    return -1; // Element not found
  },
  enumerable: false,
});

export class ASTError {
  constructor(line, col, message) {
    this.line = line;
    this.col = col;
    this.message = message;
  }
}

export class $AST {
  static AST = true;
  static fallbackToFirstExp = true;
  static allowIncompleteParse = false;
  static incompleteParseThreshold = 1;
  static s = ``;

  constructor({ exps = [], ...rest } = {}) {
    Object.assign(this, rest);

    this._exps = exps;
    this._tokens = [];
    this.exps.forEach((exp, i) => {
      if (exp.TOKEN) this._tokens.push(exp);
      else if (exp.AST) this._tokens.push(...exp.tokens);
    });

    this._text = this.tokens.map((t) => t.value).join("");

    this.s = this.constructor.s;
    this.name = this.constructor.name;
    this.AST = true;
  }
  get exps() {
    return this._exps;
  }
  get contentExps() {
    return this.exps.filter(
      (e) => e instanceof $AST || (e instanceof Token && !e.isWhiteSpace)
    );
  }
  get tokens() {
    return this._tokens;
  }
  get contentTokens() {
    return this.tokens.filter((t) => !t.isWhiteSpace);
  }
  get whiteSpaceTokens() {
    return this.tokens.filter((t) => t.isWhiteSpace);
  }
  get text() {
    return this._text;
  }
  get lineStart() {
    return this.exps[0] ? this.exps[0].lineStart : 0;
  }
  get lineEnd() {
    return this.exps.at(-1) ? this.exps.at(-1).lineEnd : 0;
  }
  get line() {
    return this.tokens[0].line;
  }
  get col() {
    return this.tokens[0].col;
  }
  toSimpleObj(lineStart = 0, lineEnd = Infinity, offset = 0) {
    return {
      exps: this.exps
        .filter((e) => {
          // console.log(e, e.lineStart, e.lineEnd, lineStart, lineEnd);
          return (
            e.lineStart <= lineEnd + offset && e.lineEnd >= lineStart - offset
          );
        })
        .map((e) => e.toSimpleObj(lineStart, lineEnd, offset)),
      name: this.name,
      lineStart: this.lineStart,
      lineEnd: this.lineEnd,
      s: this.s,
    };
  }

  getVisibleTokens(lineStart = 0, lineEnd = Infinity) {
    const tokens = [];

    this.exps.forEach((exp) => {
      if (exp.AST) tokens.push(...exp.getVisibleTokens(lineStart, lineEnd));
      else if (
        exp.TOKEN &&
        exp.lineStart <= lineEnd &&
        exp.lineEnd >= lineStart
      )
        tokens.push({
          value: exp.value,
          s: exp.s,
          line: exp.line,
          col: exp.col,
          indent: exp.indent,
          astName: this.name.slice(1),
        });
    });
    return tokens;
  }

  static parse(_ = new Lexer()) {
    const startCursor = _.cursor;
    let firstExpCursor = _.cursor;
    let firstExp = null;
    const exps = [];

    for (let shapeIndex = 0; shapeIndex < this.SHAPE.length; shapeIndex++) {
      let shapeExp = this.SHAPE[shapeIndex];

      let results = shapeExp.parse(_);

      const isFirstAST = results && !shapeExp.TEXT_EXP && shapeIndex === 0;
      if (isFirstAST) {
        firstExp = results[0];
        firstExpCursor = _.cursor;
      }

      if (results) {
        exps.push(...results);
      } else if (
        this.allowIncompleteParse &&
        exps.filter((e) => e.AST || e.value.trim().length).length >=
          this.incompleteParseThreshold
      ) {
        const token = new Token(_.eat(new RegExp()));
        token.isMissing = true;
        token.shapeExp = shapeExp;
        exps.push(token);
      } else if (this.fallbackToFirstExp) {
        _.cursor = firstExpCursor;
        return firstExp;
      } else {
        _.cursor = startCursor;
        return null;
      }
    }

    return new this({ exps });
  }

  getType(env) {
    return new TypeUnknown();
  }
  validate(env) {
    const results = [];
    this.tokens.forEach((t) => {
      if (t.isMissing && t.shapeExp.e)
        results.push(new ASTError(t.line, t.col, t.shapeExp.e));
    });

    // this.contentExps
    //   .filter((exp) => exp.AST && !(exp instanceof $INDENT_BLOCK))
    //   .forEach((exp) => {
    //     results.push(...exp.validate(env));
    //   });

    return results;
  }

  static test(control, fn = () => {}, testJS = true) {
    it(`${control}${this.name}`, () => {
      this.SAMPLES.forEach((sample) => {
        const ast = this.parse(new Lexer(sample));
        assert(
          ast instanceof this && ast.text.trim() === sample.trim(),
          sample
        );

        // if (testJS && ast) {
        //   const js = ast.toJS();
        //   try {
        //     new Function(js);
        //     assert(true, `${sample}\n\n---- JS ----\n\n${js}`);
        //   } catch {
        //     assert(false, `${sample}\n---- JS ----\n\n${js}`);
        //   }
        // }
        if (fn) fn(ast);
      });
    });
  }

  static testInvalid(control, fn = () => {}) {
    useTests(`${control}${this.name} Invalid`, () => {
      this.SAMPLES_INVALID.forEach(({ source, errors: expectedASTErrors }) => {
        const ast = $CODE_AST.parse(new Lexer(source));

        it(`${source}`, () => {
          const env = new TypeEnv();
          const actualErrors = [];
          ast.contentExps
            .filter((exp) => exp.AST)
            .forEach((exp) => actualErrors.push(...exp.validate(env)));

          const unmatchedActual = [...actualErrors];
          const matchedFlags = new Array(actualErrors.length).fill(false);

          // Match expected errors
          for (const expected of expectedASTErrors) {
            const matchIndex = unmatchedActual.findIndex(
              (actual) =>
                expected.line === actual.line &&
                expected.col === actual.col &&
                expected.message === actual.message
            );

            if (matchIndex !== -1) {
              matchedFlags[matchIndex] = true;
              assert(
                true,
                `${expected.line}:${expected.col} ${expected.message}`
              );
            } else {
              assert(
                false,
                `Expected: ${expected.line}:${expected.col} ${expected.message}`
              );
            }
          }

          // Report unmatched actual errors
          for (let i = 0; i < unmatchedActual.length; i++) {
            if (!matchedFlags[i]) {
              const actual = unmatchedActual[i];
              assert(
                false,
                `Unexpected: ${actual.line}:${actual.col} ${actual.message}`
              );
            }
          }

          if (fn) fn(ast, actualErrors);
        });
      });
    });
  }

  toJS() {
    return `${this.constructor.name}`;
  }
}

export class Token {
  constructor({
    type = T.UNKNOWN,
    value = "",
    start = 0,
    end = 0,
    line = 0,
    col = undefined,
    indent = 0,
    ...rest
  } = {}) {
    this.type = type;
    this.value = value;
    this.start = start;
    this.indent = indent;
    this._line = line;
    this.col = col ?? start;
    this.end = end;

    Object.assign(this, rest);
    this.TOKEN = true;
  }

  get text() {
    return this.value;
  }
  get line() {
    return this._line; //+ this.value.count("\n");
  }
  get lineStart() {
    return this.line;
  }
  get lineEnd() {
    return this.line;
  }
  get isWhiteSpace() {
    return !this.text.trim().length;
  }
  toSimpleObj() {
    return {
      value: this.value,
      line: this.line,
      col: this.col,
      s: this.s,
    };
  }

  get s() {
    return this.shapeExp ? this.shapeExp.s || "" : "";
  }
}

export class Lexer {
  constructor(str = "") {
    this.str = str;
    this.cursor = 0;
    this.tasteCursor = 0;
    this.tokenCache = {};
    this.cache = {};
    this.cursorStack = [];
    this.useCache = false;

    this.lines = this.str.split("\n");

    this.lineOffsets = (() => {
      let offsets = []; // The first line starts at index 0

      let cursor = 0;
      for (const line of this.lines) {
        offsets.push([cursor, cursor + line.length]);
        cursor += line.length + 1;
      }
      return offsets;
    })();
    this.lineIndents = this.lines.map((l) => l.length - l.trimStart().length);
  }

  get hasMoreToLex() {
    return this.cursor < this.str.length;
  }
  get currentLine() {
    // let _cursor = 0;
    // for (let line = 0; line < this.lines.length; line++)
    //   if ((_cursor += this.lines[line].length + 1) > this.cursor) return line;
    // return -1;
    return this.lineOffsets.binarySearch(([start, end]) => {
      if (this.cursor < start) return -1;
      else if (this.cursor > end) return 1;
      else return 0;
    });
  }
  get currentLineStart() {
    return this.lineStart(this.currentLine);
  }
  get currentLineEnd() {
    return this.lineEnd(this.currentLine);
  }
  get currentLineContentStart() {
    return this.lineContentStart(this.currentLine);
  }
  get currentLineContentEnd() {
    return this.lineContentEnd(this.currentLine);
  }
  get currentCol() {
    let _cursor = 0;
    for (let line = 0; line < this.lines.length; line++)
      if (_cursor + this.lines[line].length + 1 > this.cursor)
        return this.cursor - _cursor;
      else _cursor += this.lines[line].length + 1;

    return -1;
  }
  get currentIndent() {
    return this.lineIndent(this.currentLine);
  }
  get parsedStr() {
    return this.str.slice(0, this.cursor);
  }
  get unparsedStr() {
    return this.str.slice(this.cursor);
  }

  pushCursor() {
    this.cursorStack.push(this.cursor);
  }
  popCursor() {
    if (this.cursorStack.length) this.cursor = this.cursorStack.pop();
  }

  lineIndent(line) {
    return this.lineIndents[line];
  }
  lineStart(line) {
    if (line >= this.lines.length) line = this.lines.length - 1;
    return this.lineOffsets[line][0];
  }
  lineEnd(line) {
    if (line >= this.lines.length) line = this.lines.length - 1;
    return this.lineOffsets[line][1];
  }
  lineContentStart(line) {
    return this.lineStart(line) + this.lineIndent(line);
  }
  lineContentEnd(line) {
    return this.lineStart(line) + this.lines[line].trimEnd().length;
  }
  linesInRange(start, end) {
    const result = [];

    for (let i = 0; i < this.lineOffsets.length; i++) {
      const [lineStart, lineEnd] = this.lineOffsets[i];
      if (lineStart <= end && lineEnd >= start) result.push(i);
    }
    return result;
  }

  isLexable(x) {
    return typeof x === "string" || x instanceof RegExp;
  }

  cacheGet(cursor = 0, name = "") {
    return this.cache[`${cursor}-${name}`];
  }
  cacheSet(item, cursor = 0, name = "") {
    return (this.cache[`${cursor}-${name}`] = {
      ast: item,
      cursorOnSave: this.cursor,
    });
  }

  taste(regex) {
    // const start = performance.now();
    if (!regex) return null;
    this.tasteCursor = this.cursor;

    const eatLeadingWhitespace = () => {
      while (
        this.str[this.tasteCursor] === " " ||
        this.str[this.tasteCursor] === "\n"
      ) {
        this.tasteCursor++;
      }
    };

    let match;
    if (typeof regex === "string") {
      let failedMatch = false;
      for (let i = 0; i < regex.length && !failedMatch; i++)
        failedMatch = regex[i] !== this.str[this.tasteCursor + i];
      // tasteTime += performance.now() - start;
      if (!failedMatch) {
        this.tasteCursor += regex.length;
        return { value: regex };
      }
    } else if (regex instanceof RegExp) {
      regex.lastIndex = this.tasteCursor;

      // Regexes must have 'y' or 'g' flag and not start with '^' for this to work
      match = regex.exec(this.str);

      if (match) this.tasteCursor += match[0].length;
      // tasteTime += performance.now() - start;
      return match && { value: match[0] };
    }
    return null;
  }
  eat(regex) {
    if (!regex) return null;

    const result = this.taste(regex);

    if (result) {
      const { value } = result;

      this.cursor = this.tasteCursor - value.length;

      let col = this.cursor - this.str.lastIndexOf("\n", this.cursor - 1) - 1;
      if (col < 0) col = 0;

      const line = this.currentLine;

      const token = new Token({
        type: regex,
        value,
        start: this.cursor,
        indent: this.lineIndents[line],
        line,
        end: this.cursor + value.length,
        col, //: this.currentCol,
        paddingRight: "",
        paddingLeft: "",
      });

      this.cursor += value.length;

      return token;
    } else return null;
  }
}

export class ShapeExp {
  constructor({ value, rightDelimeter, min = 1, max = 1, domProps = {} } = {}) {
    this.value = value;
    this.rightDelimeter = rightDelimeter;
    this.min = min;
    this.max = max;
    this.domProps = domProps;

    this.TEXT_EXP =
      typeof this.value === "string" || this.value instanceof RegExp;
    this.AST_EXP =
      typeof this.value === "function" &&
      !!this.value.name &&
      this.value.name[0] === "$";
    this.SUB_SHAPE_EXP = this.value instanceof Shape;
    this.OPTION_EXP = Array.isArray(this.value) && !this.SUB_SHAPE_EXP;
    this.LAZY_EXP = typeof this.value === "function" && !this.AST_EXP;

    if (this.value instanceof RegExp)
      this.value = ShapeExp.formatRegex(this.value);
    if (this.rightDelimeter instanceof RegExp)
      this.rightDelimeter = ShapeExp.formatRegex(this.rightDelimeter);

    this.name = `${this.value}`;
    if (this.AST_EXP) this.name = this.value.name;
    else if (this.OPTION_EXP) {
      // console.log(this.value);

      this.value = new Shape(...this.value);

      this.name = this.value.map((o) => o.name || `${o}`).join("-");
    } else if (this.SUB_SHAPE_EXP) this.name = Date.now();
  }

  static formatRegex(regex) {
    let source = regex.source;
    if (source[0] === "^") source = source.slice(1);
    let flags = regex.flags;
    if (!flags.includes("y")) flags += "y";
    return new RegExp(source, flags);
  }

  parse(_ = new Lexer()) {
    const results = [];
    const startCursor = _.cursor;
    for (
      let expIndex = 0;
      expIndex < this.max && (!_.taste(this.rightDelimeter) || expIndex === 0);
      expIndex++
    ) {
      while (_.taste(WHITESPACE_REGEX)) results.push(_.eat(WHITESPACE_REGEX));
      let result = null;
      if (this.LAZY_EXP) {
        Object.assign(
          this,
          new ShapeExp({
            ...this,
            value: this.value(),
          })
        );
      }

      if (this.TEXT_EXP) result = _.eat(this.value);
      else if (this.AST_EXP) {
        const firstShapeExp = this.value.SHAPE[0];
        if (
          firstShapeExp &&
          typeof firstShapeExp === "object" &&
          firstShapeExp.TEXT_EXP &&
          !_.taste(firstShapeExp.value)
        )
          result = null;
        else result = this.value.parse(_);
      } else if (this.OPTION_EXP) {
        for (let i = 0; i < this.value.length && !result; i++) {
          if (_.isLexable(this.value[i])) result = _.eat(this.value);
          else result = this.value[i].parse(_);
        }
      } else if (this.SUB_SHAPE_EXP) {
        const firstShapeExp = this[0];
        if (
          firstShapeExp &&
          typeof firstShapeExp === "object" &&
          firstShapeExp.TEXT_EXP &&
          !_.taste(firstShapeExp.value)
        )
          result = null;
        else {
          const $SUB_SHAPE_AST = class extends $AST {};
          $SUB_SHAPE_AST.SHAPE = this.value;
          const ast = $SUB_SHAPE_AST.parse(_);
          if (ast) result = ast.exps;
        }
      }

      if (result) {
        result.shapeExp = {};
        Object.assign(result.shapeExp, this);
        Object.setPrototypeOf(result.shapeExp, Object.getPrototypeOf(this));
        if (Array.isArray(result)) results.push(...result);
        else results.push(result);
      } else if (expIndex >= this.min) break;
      else {
        _.cursor = startCursor;
        return null;
      }
    }

    return results;
  }
}

export class Shape extends Array {
  constructor(...exps) {
    super();

    const isLimitExp = (expIndex) => {
      const exp = exps[expIndex];
      return (
        exp &&
        typeof exp === "object" &&
        (exp.hasOwnProperty("min") || exp.hasOwnProperty("max"))
      );
    };
    const parseLimitExp = (expIndex) => {
      const nextExp = exps[expIndex + 1];
      return isLimitExp(expIndex + 1) ? nextExp : {};
    };
    const parseRightDelimeter = (expIndex) => {
      let nextExp = exps[expIndex + (isLimitExp(expIndex + 1) ? 2 : 1)];
      if (nextExp && (typeof nextExp === "string" || nextExp instanceof RegExp))
        return nextExp;

      return null;
    };

    for (let i = 0; i < exps.length; i++) {
      const value = exps[i];
      if (value === null || isLimitExp(i)) continue;

      let shapeExp = new ShapeExp({
        value,
        rightDelimeter: parseRightDelimeter(i),
      });

      Object.assign(shapeExp, parseLimitExp(i));
      this.push(shapeExp);
    }

    // console.log();
    // this.push(new ShapeExp({ value: /\s+/y, min: 0 }));
  }
}

export class $AST_LEFT_RECURSIVE extends $AST {
  static parse(_ = new Lexer()) {
    const SHAPE = this.SHAPE;

    let leftCursor = _.cursor;
    let $left = this.SHAPE[0].parse(_);
    if (!$left) return null;
    else $left = $left[0];

    leftCursor = _.cursor;

    while (_.taste(this.SHAPE[0].rightDelimeter)) {
      const allowIncompleteParse = this.allowIncompleteParse;
      const $RIGHT = class extends $AST {
        static allowIncompleteParse = allowIncompleteParse;
        static SHAPE = (() => {
          const shape = new Shape();
          shape.push(...SHAPE.slice(1));

          return shape;
        })();
      };

      const $right = $RIGHT.parse(_);

      if (!$right) {
        _.cursor = leftCursor;
        return $left;
      }
      $left = new this({ exps: [$left, ...$right.exps] });
    }
    return $left;
  }
}

export class $INDENT_BLOCK extends $AST {
  static parse(_ = new Lexer()) {
    _.pushCursor();
    do _.cursor--;
    while (_.str[_.cursor] && !_.str[_.cursor].trim());
    const prevToken = _.eat(/\S/y);
    _.popCursor();
    const baseIndent = prevToken ? prevToken.indent : _.currentIndent;

    if (prevToken)
      if (prevToken.line === _.currentLine) {
        const $exp = $AST.parse.apply(this, [_]);
        if ($exp) return new this({ exps: [$exp] });
        return null;
      } else if (_.currentIndent <= prevToken.indent) return null;

    const isIndented = () => {
      _.pushCursor();
      while (_.taste(WHITESPACE_REGEX)) _.eat(WHITESPACE_REGEX);
      const nextToken = _.eat(/\S/y);
      _.popCursor();
      return nextToken && nextToken.indent > baseIndent;
    };

    const exps = [];
    while (_.hasMoreToLex && isIndented()) {
      const $exp = $AST.parse.apply(this, [_]);
      if ($exp) exps.push(...$exp.exps);
      else {
        break;
      }
    }
    if (!exps.length) return null;
    return new this({ exps });
  }
}

export class $EXP extends $AST {
  static parse(_ = new Lexer()) {
    let $exp = $AST.parse.apply(this, [_]);

    if ($exp) {
      const exps = $exp.exps;
      const indexOfAST = exps.findIndex((e) => e.AST);
      const ast = exps[indexOfAST];
      let leadingWhitespaceTokens = exps.slice(0, indexOfAST);
      let trailingWhitespaceTokens = exps.slice(indexOfAST + 1);
      $exp = new ast.constructor({
        exps: [
          ...leadingWhitespaceTokens,
          ...ast.exps,
          ...trailingWhitespaceTokens,
        ],
      });
    }

    return $exp;
  }
}

export class $UNKNOWN extends $AST {
  static SHAPE = new Shape(/^\S+/);
}

export class $UNKNOWN_BLOCK extends $AST {
  static SHAPE = new Shape(/^.*/);
}
