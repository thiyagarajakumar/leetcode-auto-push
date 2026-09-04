/**
 * complexityDetector.js
 * Analyzes solution source code and estimates time & space complexity.
 */

export function estimateComplexity(code, language = "java") {
  if (!code || typeof code !== "string") {
    return { time: "O(n)", space: "O(1)" };
  }

  const clean = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*|#.*|--.*/g, ""); // remove comments
  const lower = clean.toLowerCase();

  let timeComplexity = "O(n)";
  let spaceComplexity = "O(1)";

  // ── Time Complexity Estimation ──
  const forLoops = (lower.match(/\bfor\s*\(/g) || []).length + (lower.match(/\bfor\s+\w+\s+in\b/g) || []).length;
  const whileLoops = (lower.match(/\bwhile\s*\(/g) || []).length + (lower.match(/\bwhile\s+/g) || []).length;
  const totalLoops = forLoops + whileLoops;

  const hasNestedLoops = /(for|while)[\s\S]*?(for|while)/.test(lower);
  const hasTripleNested = /(for|while)[\s\S]*?(for|while)[\s\S]*?(for|while)/.test(lower);
  const hasBinarySearch = lower.includes("mid =") || lower.includes("left < right") || lower.includes("low <= high") || lower.includes("binarysearch");
  const hasDivideAndConquer = lower.includes("mergesort") || lower.includes("quicksort") || lower.includes("divide");
  const hasRecursion = /\breturn\s+\w+\s*\(/.test(clean);

  if (hasTripleNested) {
    timeComplexity = "O(n³)";
  } else if (hasNestedLoops) {
    timeComplexity = "O(n²)";
  } else if (hasBinarySearch && totalLoops <= 1) {
    timeComplexity = "O(log n)";
  } else if (lower.includes("sort(") || lower.includes(".sort(") || hasDivideAndConquer) {
    timeComplexity = "O(n log n)";
  } else if (totalLoops === 1) {
    timeComplexity = "O(n)";
  } else if (totalLoops === 0 && !hasRecursion) {
    timeComplexity = "O(1)";
  } else {
    timeComplexity = "O(n)";
  }

  // ── Space Complexity Estimation ──
  const hasMapOrSet = lower.includes("hashmap") || lower.includes("hashset") || lower.includes("map<") || lower.includes("set<") || lower.includes("dict()") || lower.includes("set()") || lower.includes("new map") || lower.includes("new set");
  const hasArrayAlloc = lower.includes("new int[") || lower.includes("new array") || lower.includes("[] = new") || lower.includes("vector<") || lower.includes("list<") || lower.includes(".append(") || lower.includes("malloc(");
  const has2DArray = lower.includes("[][]") || lower.includes("vector<vector");

  if (has2DArray) {
    spaceComplexity = "O(n²)";
  } else if (hasMapOrSet || hasArrayAlloc || hasRecursion) {
    spaceComplexity = "O(n)";
  } else {
    spaceComplexity = "O(1)";
  }

  return { time: timeComplexity, space: spaceComplexity };
}
