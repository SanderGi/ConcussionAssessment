/**
 * Calculates the similatity between two strings.
 * @param {string} str1 the first sctring to compare
 * @param {string} str2 the second string to compare
 * @returns the negated Levenshtein Distance between the two strings but normalized for the string lengths.
 */
export function calcSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  return -LevenshteinDistance(str1, str2) / Math.max(str1.length, str2.length);
}

/**
 * Calculates the Levenshtein Distance between two strings using the iterative matrix algorithm.
 * @param {string} str1 the first sctring to compare
 * @param {string} str2 the second string to compare
 * @returns the Levenshtein Distance between the two strings.
 */
function LevenshteinDistance(str1, str2) {
  let matrix = Array(str1.length + 1)
    .fill()
    .map(() => Array(str2.length + 1).fill(0));

  for (let i = 1; i <= str1.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 1; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      let subcost = str1.charAt(i) === str2.charAt(j) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + subcost
      );
    }
  }

  return matrix[str1.length][str2.length];
}
