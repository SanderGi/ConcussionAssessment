export const TEST_TYPE = Object.freeze({
  IMMEDIATE: "IMMEDIATE",
  BASELINE: "BASELINE",
  POST_INJURY: "POST-INJURY",
  NO_TEST: "NO-TEST",
});

export function normalizeTestType(testType) {
  if (
    testType === "SUSPECTED/POST" ||
    testType === "SUSPECTED" ||
    testType === TEST_TYPE.POST_INJURY
  ) {
    return TEST_TYPE.POST_INJURY;
  }
  return testType;
}

export function isPostInjuryTestType(testType) {
  return normalizeTestType(testType) === TEST_TYPE.POST_INJURY;
}

export function testTypeLabel(testType, translate) {
  const normalized = normalizeTestType(testType);
  if (normalized === TEST_TYPE.IMMEDIATE) {
    return translate("runtime.test_type.immediate", "Immediate");
  }
  if (normalized === TEST_TYPE.BASELINE) {
    return translate("runtime.test_type.baseline", "Baseline");
  }
  if (normalized === TEST_TYPE.POST_INJURY) {
    return translate("runtime.test_type.post_injury", "Post-Injury");
  }
  if (normalized === TEST_TYPE.NO_TEST) {
    return translate("runtime.test_type.no_test", "No Test");
  }
  return testType;
}

export function toPdfTestType(testType) {
  const normalized = normalizeTestType(testType);
  if (normalized === TEST_TYPE.BASELINE) return "BASELINE";
  if (normalized === TEST_TYPE.POST_INJURY) return "SUSPECTED";
  return undefined;
}
