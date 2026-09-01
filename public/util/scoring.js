function finiteScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function clampBessError(value) {
  const number = finiteScore(value);
  return number === null ? null : Math.min(10, Math.max(0, Math.round(number)));
}

export function normalizeBessScores(test) {
  if (!test || typeof test !== "object") return test;
  const groups = [
    {
      fields: [
        "mBESS_double_errors",
        "mBESS_single_errors",
        "mBESS_tandem_errors",
      ],
      total: "mBESS_total_errors",
    },
    {
      fields: [
        "mBESS_foam_double_errors",
        "mBESS_foam_single_errors",
        "mBESS_foam_tandem_errors",
      ],
      total: "mBESS_foam_total_errors",
    },
  ];
  for (const group of groups) {
    const values = group.fields.map((field) => clampBessError(test[field]));
    for (let i = 0; i < group.fields.length; i += 1) {
      if (values[i] !== null) test[group.fields[i]] = values[i];
    }
    if (values.every((value) => value !== null)) {
      test[group.total] = values.reduce((sum, value) => sum + value, 0);
    } else {
      const total = finiteScore(test[group.total]);
      if (total !== null) {
        test[group.total] = Math.min(30, Math.max(0, Math.round(total)));
      }
    }
  }
  return test;
}

export function scat6DomainTotals(test) {
  const calculatedCognitiveTotal = calculateScat6CognitiveTotal(test);
  const normalized = normalizeBessScores({ ...(test ?? {}) });

  return {
    // Older saved assessments may contain only the previously calculated total.
    cognitiveTotal:
      calculatedCognitiveTotal ?? finiteScore(test?.cognitive_total),
    mbessTotalErrors: finiteScore(normalized.mBESS_total_errors),
  };
}

export function calculateScat6CognitiveTotal(test) {
  const components = [
    test?.orientation,
    test?.immediate_memory,
    test?.concentration,
    test?.delayed_recall,
  ].map(finiteScore);
  return components.every((value) => value !== null)
    ? components.reduce((sum, value) => sum + value, 0)
    : null;
}
