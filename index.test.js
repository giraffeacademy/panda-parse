import "t-rex-test";
import { Lexer, $AST, Shape } from "./index.js";

useTests("Lexer", () => {
  useTests("taste", () => {
    it("falsey", () => {
      const a = new Lexer("abcd");
      [null, undefined, false, 4].forEach((e) => {
        assert(a.taste(e) === null);
      });
    });
    it("string", () => {
      const a = new Lexer("abcd");

      assert(a.taste("xy") === null);

      assert(a.taste("ab").matches({ value: "ab" }));
      assert(a.cursor === 0);
    });
    it("regex", () => {
      const a = new Lexer("abcd");

      assert(a.taste(/xy/) === null);

      assert(a.taste(/ab/).matches({ value: "ab" }));
      assert(a.cursor === 0);
    });
    it("moving cursor", () => {
      const a = new Lexer("abcd");

      a.cursor = 2;
      assert(a.taste("ab") === null);

      assert(a.taste(/cd/).matches({ value: "cd" }));
    });
    it("whitespace", () => {
      const a = new Lexer(" abcd");
      assert(a.taste("a") === null);
    });
  });
  useTests("eat", () => {
    it("falsey", () => {
      const a = new Lexer("abcd");
      [null, undefined, false, 4].forEach((e) => {
        assert(a.eat(e) === null);
      });
    });
    it("string", () => {
      const a = new Lexer("abcd");

      assert(a.eat("xy") === null);

      const token = a.eat("ab");
      assert(token.value === "ab");

      assert(token.start === 0);
      assert(token.end === 2);
    });
    it("regex", () => {
      const a = new Lexer("abcd");

      assert(a.eat(/xy/) === null);

      const token = a.eat(/ab/);
      assert(token.value === "ab");
      assert(token.start === 0);
      assert(token.end === 2);
    });
    it("moving cursor", () => {
      const a = new Lexer("\n  abcd");
      a.cursor = 4;
      assert(a.eat(/xy/) === null);

      const token = a.eat(/bc/);
      assert(token.value === "bc");
      assert(token.start === 4);
      assert(token.end === 6);
      assert(token.indent === 2);
      assert(token.line === 1);
    });
    it("whitespace", () => {
      const a = new Lexer(" abcd");
      assert(a.eat("a") === null);
    });
    it("col", () => {
      const a = new Lexer(`abc\ndef\nghi`);
      a.cursor = 4;
      assert(a.eat("de").col === 0);

      a.cursor = 5;
      assert(a.eat("ef").col === 1);
    });
  });
  useTests("methods", () => {
    it("lineIndent", () => {
      const a = new Lexer(" a\n  b\n    c");
      assert(a.lineIndent(0) === 1);
      assert(a.lineIndent(1) === 2);
      assert(a.lineIndent(2) === 4);
    });
    it("lineStart", () => {
      const a = new Lexer(" a\n  b\n    c");
      assert(a.lineStart(0) === 0);
      assert(a.lineStart(1) === 3);
      assert(a.lineStart(2) === 7);
    });
    it("lineEnd", () => {
      const a = new Lexer(" a\n  b\n    c");
      assert(a.lineEnd(0) === 2);
      assert(a.lineEnd(1) === 6);
      assert(a.lineEnd(2) === 12);
    });
    it("lineContentStart", () => {
      const a = new Lexer(" a\n  b\n    c");
      assert(a.lineContentStart(0) === 1);
      assert(a.lineContentStart(1) === 5);
      assert(a.lineContentStart(2) === 11);
    });
    it("lineContentEnd", () => {
      const a = new Lexer("a \nb  \nc  ");
      assert(a.lineContentEnd(0) === 1);
      assert(a.lineContentEnd(1) === 4);
      assert(a.lineContentEnd(2) === 8);
    });
    it("linesInRange", () => {
      const a = new Lexer("ab\ncd\nef");

      assert(a.linesInRange(0, 1).matches([0]));
      assert(a.linesInRange(0, 4).matches([0, 1]));
      assert(a.linesInRange(3, 7).matches([1, 2]));
    });
    it("linesInRange", () => {
      const a = new Lexer("abc");

      assert(a.isLexable("abc") === true);
      assert(a.isLexable(/abc/) === true);
      assert(a.isLexable(4) === false);
      assert(a.isLexable(true) === false);
    });
  });
  useTests("getters", () => {
    it("hasMoreToLex", () => {
      const a = new Lexer("abc");
      assert(a.hasMoreToLex);

      a.cursor = 1;
      assert(a.hasMoreToLex);

      a.cursor = 3;
      assert(!a.hasMoreToLex);
    });
    it("currentLine", () => {
      const a = new Lexer("ab\ncd\nef");
      assert(a.currentLine === 0);

      a.cursor = 2;
      assert(a.currentLine === 0);

      a.cursor = 3;
      assert(a.currentLine === 1);

      a.cursor = 5;
      assert(a.currentLine === 1);

      a.cursor = 6;
      assert(a.currentLine === 2);
    });
    it("currentLineStart", () => {
      const a = new Lexer("ab\n cd\n ef");
      assert(a.currentLineStart === 0);

      a.cursor = 5;
      assert(a.currentLineStart === 3);

      a.cursor = 9;
      assert(a.currentLineStart === 7);
    });
    it("currentLineEnd", () => {
      const a = new Lexer("ab\n cd\n ef");
      assert(a.currentLineEnd === 2);

      a.cursor = 5;
      assert(a.currentLineEnd === 6);

      a.cursor = 7;
      assert(a.currentLineEnd === 10);
    });
    it("currentLineContentStart", () => {
      const a = new Lexer("  ab\n  cd\n  ef");
      assert(a.currentLineContentStart === 2);

      a.cursor = 6;
      assert(a.currentLineContentStart === 7);

      a.cursor = 10;
      assert(a.currentLineContentStart === 12);
    });
    it("currentLineContentEnd", () => {
      const a = new Lexer("  ab\n  cd\n  ef");
      assert(a.currentLineContentEnd === 4);

      a.cursor = 6;
      assert(a.currentLineContentEnd === 9);

      a.cursor = 10;
      assert(a.currentLineContentEnd === 14);
    });
    it("currentCol", () => {
      const a = new Lexer("ab\n  cd");
      assert(a.currentCol === 0);

      a.cursor = 4;
      assert(a.currentCol === 1);
    });
    it("currentIndent", () => {
      const a = new Lexer("ab\n   cd");
      assert(a.currentIndent === 0);

      a.cursor = 4;
      assert(a.currentIndent === 3);
    });
    it("parsedStr", () => {
      const a = new Lexer("ab\n   cd");
      assert(a.parsedStr === "");

      a.cursor = 2;
      assert(a.parsedStr === "ab");

      a.cursor = 6;
      assert(a.parsedStr === "ab\n   ");
    });
    it("unparsedStr", () => {
      const a = new Lexer("ab\n   cd");
      assert(a.unparsedStr === "ab\n   cd");

      a.cursor = 2;
      assert(a.unparsedStr === "\n   cd");

      a.cursor = 6;
      assert(a.unparsedStr === "cd");
    });
    it("push/pop cursor", () => {
      const a = new Lexer("ab\n   cd");
      a.cursor = 1;
      a.pushCursor();

      a.cursor = 5;
      a.pushCursor();

      a.cursor = 7;

      a.popCursor();
      assert(a.cursor === 5);

      a.popCursor();
      assert(a.cursor === 1);
    });
  });
});

useTests("binarySearch", () => {
  it("finds the correct index of an element", () => {
    const arr = [1, 2, 3, 4, 5];
    const index = arr.binarySearch((x) => x - 3); // Looking for 3
    assert(index === 2);
  });
  it("returns -1 if element is not found", () => {
    const arr = [1, 2, 4, 5];
    const index = arr.binarySearch((x) => x - 3); // Looking for 3
    assert(index === -1);
  });
  it("can find elements in a large array", () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i + 1);
    const target = 999;
    const index = arr.binarySearch((x) => target - x);
    assert(index === 998, `Expected 998, but got ${index}`);
  });
  it("handles an array with one element", () => {
    const arr = [1];
    const index = arr.binarySearch((x) => x - 1);
    assert(index === 0);
  });
  it("handles an empty array", () => {
    const arr = [];
    const index = arr.binarySearch((x) => x);
    assert(index === -1);
  });
});

useTests("$AST", () => {
  it(" README Examples", () => {
    class $NUMBER extends $AST {
      static SHAPE = new Shape(/^\d+/); // Match one or more digits
    }

    const lexer = new Lexer("42");
    let ast = $NUMBER.parse(lexer);

    assert(ast.text === "42");

    class $ADD extends $AST {
      static SHAPE = new Shape($NUMBER, "+", $NUMBER);
    }
    ast = $ADD.parse(new Lexer("2+3"));
    assert(ast.text === "2+3");

    class $MULTIPLY extends $AST {
      static SHAPE = new Shape($NUMBER, "*", $NUMBER);
    }

    ast = $MULTIPLY.parse(new Lexer("4*5"));
    assert(ast.text === "4*5");

    class $GROUP extends $AST {
      static SHAPE = new Shape("(", () => $EXPR, ")");
    }

    class $EXPR extends $AST {
      static SHAPE = new Shape([$GROUP, $ADD, $MULTIPLY, $NUMBER]);
    }

    $EXPR.parse(new Lexer("3 + 4")); // Addition
    $EXPR.parse(new Lexer("2 * 5")); // Multiplication
    $EXPR.parse(new Lexer("(1 + 2)")); // Grouped expression
    $EXPR.parse(new Lexer("(1 + 2) * 3")); // But wait... what about this?
  });
});
