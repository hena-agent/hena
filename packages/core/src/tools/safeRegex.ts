const escapedCharacter = /\\./gs;
const characterClass = /\[(?:\\.|[^\\\]])*\]/gs;
const nestedQuantifiedGroup =
  /\((?:\\.|[^\\()[\]])*[+*{](?:\\.|[^\\()[\]])*\)[+*{]/s;

const maskLiteralSections = (pattern: string): string =>
  pattern.replace(escapedCharacter, "_").replace(characterClass, "_");

export const isSafeRegexPattern = (pattern: string): boolean =>
  !nestedQuantifiedGroup.test(maskLiteralSections(pattern));
