const SCRIPT_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/;
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const filenameBase = (filename) => {
  const name = filename.split(/[\\/]/).at(-1) ?? filename;
  return name.replace(SCRIPT_EXTENSIONS, "");
};

const normalizedName = (name) => name.replaceAll("-", "").toLowerCase();

const report = (context, node, message) => {
  context.report({ node, message });
};

const isArrowConstDeclaration = (declaration) =>
  declaration.type === "VariableDeclaration" &&
  declaration.kind === "const" &&
  declaration.declarations.length === 1 &&
  declaration.declarations[0]?.id.type === "Identifier" &&
  declaration.declarations[0]?.init?.type === "ArrowFunctionExpression";

const arrowConstName = (declaration) => declaration.declarations[0].id.name;

const rootArrowConstDeclarations = (program) => {
  const declarations = [];
  for (const statement of program.body) {
    if (isArrowConstDeclaration(statement)) {
      declarations.push(statement);
      continue;
    }
    if (
      statement.type === "ExportNamedDeclaration" &&
      statement.declaration !== null &&
      isArrowConstDeclaration(statement.declaration)
    ) {
      declarations.push(statement.declaration);
    }
  }
  return declarations;
};

const noFunctionKeyword = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow non-generator function syntax; use const arrow functions instead.",
    },
  },
  create(context) {
    const check = (node) => {
      if (node.generator === true) {
        return;
      }
      report(
        context,
        node,
        "Do not use the function keyword. Use a const arrow function instead.",
      );
    };
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
    };
  },
};

const atMostOneRootFunction = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Allow at most one top-level const arrow function and match it to the kebab-case filename.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const declarations = rootArrowConstDeclarations(program);
        if (declarations.length > 1) {
          report(
            context,
            declarations[1],
            `Expected at most one root function per file, found ${declarations.length}.`,
          );
          return;
        }
        if (declarations.length === 0) {
          return;
        }

        const base = filenameBase(context.filename ?? context.getFilename?.());
        const declaration = declarations[0];
        const functionName = arrowConstName(declaration);
        if (!KEBAB_CASE.test(base)) {
          report(
            context,
            declaration,
            `File name "${base}" must be kebab-case when it declares a root function.`,
          );
          return;
        }
        if (normalizedName(base) !== normalizedName(functionName)) {
          report(
            context,
            declaration.declarations[0].id,
            `Root function "${functionName}" must match file name "${base}".`,
          );
        }
      },
    };
  },
};

export default {
  meta: {
    name: "local",
  },
  rules: {
    "at-most-one-root-function": atMostOneRootFunction,
    "no-function-keyword": noFunctionKeyword,
  },
};
