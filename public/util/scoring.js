function finiteScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function scat6DomainTotals(test) {
  const cognitiveComponents = [
    test?.orientation,
    test?.immediate_memory,
    test?.concentration,
    test?.delayed_recall,
  ].map(finiteScore);
  const calculatedCognitiveTotal = cognitiveComponents.every(
    (value) => value !== null
  )
    ? cognitiveComponents.reduce((sum, value) => sum + value, 0)
    : null;

  return {
    // Older saved assessments may contain only the previously calculated total.
    cognitiveTotal:
      calculatedCognitiveTotal ?? finiteScore(test?.cognitive_total),
    mbessTotalErrors: finiteScore(test?.mBESS_total_errors),
  };
}
