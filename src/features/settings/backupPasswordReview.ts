export interface BackupPasswordReview {
  raw: string;
  visualized: string;
  characterCount: number;
  whitespaceCount: number;
  hasBoundaryWhitespace: boolean;
}

const WHITESPACE_MARKERS: Readonly<Record<string, string>> = {
  ' ': '·',
  '\t': '⇥',
  '\u00a0': '⍽',
};

/** Build a display-only password summary without normalizing or changing the saved value. */
export function reviewBackupPassword(password: string): BackupPasswordReview {
  const characters = Array.from(password);
  const whitespaceCount = characters.filter((character) => /\s/u.test(character)).length;
  return {
    raw: password,
    visualized: characters.map((character) => WHITESPACE_MARKERS[character] ?? character).join(''),
    characterCount: characters.length,
    whitespaceCount,
    hasBoundaryWhitespace:
      characters.length > 0 &&
      (/\s/u.test(characters[0]) || /\s/u.test(characters[characters.length - 1])),
  };
}
