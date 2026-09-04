/**
 * filenameUtils.js  — SINGLE SOURCE OF TRUTH for filename & path generation
 *
 * Supports:
 *  - Problem number padding (raw "1", "01", "001", "0001")
 *  - Problem name case styles (Title Case, lowercase, UPPERCASE, Original)
 *  - Problem name separators (hyphen -, underscore _, space, none)
 *  - Real editable custom filename format with placeholders:
 *    {problemNumber}, {problemName}, {language}, {difficulty}, {topic}
 *  - Canonical folder & push path resolution
 */

export const LEETCODE_TOPICS = [
  "Array","String","Hash Table","Math","Dynamic Programming","Sorting",
  "Greedy","Depth-First Search","Binary Search","Database","Bit Manipulation",
  "Matrix","Prefix Sum","Tree","Two Pointers","Breadth-First Search",
  "Heap (Priority Queue)","Simulation","Counting","Graph Theory","Binary Tree",
  "Stack","Sliding Window","Enumeration","Design","Backtracking",
  "Number Theory","Union-Find","Segment Tree","Linked List","Ordered Set",
  "Monotonic Stack","Divide and Conquer","Combinatorics","Trie","Queue",
  "Bitmask","Recursion","Binary Indexed Tree","Geometry","Hash Function",
  "Memoization","Binary Search Tree","Shortest Path","Topological Sort",
  "String Matching","Rolling Hash","Game Theory","Monotonic Queue","Data Stream",
  "Brain Teaser","Merge Sort","Minimax","Doubly-Linked List","Randomized",
  "Counting Sort","Iterator","Concurrency","Suffix Array","Quickselect",
  "Sweep Line","Probability and Statistics","Minimum Spanning Tree","Bucket Sort",
  "Radix Sort","Strongly Connected Component","Rejection Sampling","Biconnected Component"
];

export const LANG_EXT_MAP = {
  java:"java", python:"py", python3:"py",
  "c++":"cpp", cpp:"cpp", c:"c",
  javascript:"js", js:"js",
  typescript:"ts", ts:"ts",
  go:"go", golang:"go", rust:"rs",
  "c#":"cs", csharp:"cs",
  swift:"swift", kotlin:"kt", ruby:"rb", sql:"sql",
  scala:"scala", php:"php", dart:"dart", r:"r"
};

/**
 * Format problem number with chosen padding.
 * @param {string|number} rawId
 * @param {string} format 'raw' | '01' | '001' | '0001'
 * @returns {string}
 */
export function formatProblemNumber(rawId, format = "raw") {
  const match = String(rawId || "").match(/\d+/);
  if (!match) return String(rawId || "");
  const num = match[0];
  switch (format) {
    case "01":   return num.padStart(2, "0");
    case "001":  return num.padStart(3, "0");
    case "0001": return num.padStart(4, "0");
    case "raw":
    default:     return num;
  }
}

/**
 * Clean & format the problem title according to case style and separator.
 * @param {string} name
 * @param {string} caseStyle 'title' | 'lower' | 'upper' | 'original'
 * @param {string} separator 'hyphen' | 'underscore' | 'space' | 'none'
 * @returns {string}
 */
export function formatProblemName(name, caseStyle = "title", separator = "hyphen") {
  let cleaned = String(name || "")
    .replace(/^\d+[\s.\-_]+/, "") // strip leading "0003." or "3-" or "0003 "
    .replace(/[^a-zA-Z0-9\s\-_]/g, " ")
    .trim();

  // Split into words by whitespace, underscores, hyphens
  const words = cleaned.split(/[\s\-_]+/).filter(Boolean);
  if (words.length === 0) return "Solution";

  // Apply case style to words
  let styledWords = words.map(w => {
    switch (caseStyle) {
      case "lower": return w.toLowerCase();
      case "upper": return w.toUpperCase();
      case "original": return w;
      case "title":
      default:
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
  });

  // Apply separator
  switch (separator) {
    case "underscore": return styledWords.join("_");
    case "space":      return styledWords.join(" ");
    case "none":       return styledWords.join("");
    case "hyphen":
    default:           return styledWords.join("-");
  }
}

/**
 * Backward-compatible sanitiseName for basic slug creation.
 */
export function sanitiseName(name) {
  return formatProblemName(name, "title", "hyphen");
}

/**
 * Get correct language file extension.
 */
export function getExt(lang) {
  return LANG_EXT_MAP[(lang || "").toLowerCase().trim()] || "java";
}

/**
 * Get primary topic from list.
 */
export function getPrimaryTopic(topics, strategy, userPreferred) {
  const list = Array.isArray(topics) ? topics : [];
  if (list.length === 0) return userPreferred || "Algorithms";
  if (strategy === "user_preferred" && userPreferred) {
    const match = list.find(t => t.toLowerCase() === userPreferred.toLowerCase());
    if (match) return match;
  }
  if (strategy === "all") return list.join("-");
  return list[0] || "Algorithms";
}

/**
 * THE SINGLE FILENAME GENERATION FUNCTION.
 *
 * @param {object} problemData { problemId, problemName, language, difficulty, topics }
 * @param {object} settings { filenameFormat, customFilenameTemplate, problemNumberFormat, problemNameCase, problemNameSeparator }
 * @returns {string} base filename without extension
 */
export function generateBasename(problemData, settings = {}) {
  const {
    problemId = "",
    problemName = "Unknown",
    language = "Java",
    difficulty = "Easy",
    topics = []
  } = problemData;

  const numFormat = settings.problemNumberFormat || "raw";
  const caseStyle = settings.problemNameCase || "title";
  const separator = settings.problemNameSeparator || "hyphen";

  const num = formatProblemNumber(problemId, numFormat);
  const formattedName = formatProblemName(problemName, caseStyle, separator);
  const topic = getPrimaryTopic(topics, settings.topicStrategy, settings.userPreferredTopic);

  const format = settings.filenameFormat || "custom";
  const customTpl = settings.customFilenameTemplate || "{problemNumber}-{problemName}";

  if (format === "custom") {
    return customTpl
      .replace(/\{problemNumber\}/g, num)
      .replace(/\{problemName\}/g, formattedName)
      .replace(/\{language\}/g, language)
      .replace(/\{difficulty\}/g, difficulty)
      .replace(/\{topic\}/g, topic)
      .replace(/\{paddedProblemNumber\}/g, formatProblemNumber(problemId, "001"));
  }

  switch (format) {
    case "hyphen-only":
      return num ? `${num}-${formattedName}` : formattedName;
    case "dot-hyphen":
      return num ? `${num}.-${formattedName}` : formattedName;
    case "space-hyphen":
      return num ? `${num} - ${formattedName}` : formattedName;
    case "dot-only":
      return num ? `${num}.${formattedName}` : formattedName;
    case "name-only":
      return formattedName;
    default:
      return num ? `${num}-${formattedName}` : formattedName;
  }
}

/**
 * Full filename with extension.
 * e.g. "0003-Longest-Palindromic-Substring.java"
 */
export function generateFilename(problemData, settings = {}, versionSuffix = "") {
  const base = generateBasename(problemData, settings);
  const ext = getExt(problemData.language);
  return `${base}${versionSuffix}.${ext}`;
}

/**
 * Resolve folder path from settings.
 */
export function resolveFolder(settings = {}, topic = "Algorithms", difficulty = "Easy", language = "Java") {
  const { folderMode = "topic", customFolderTemplate = "{topic}" } = settings;
  const safeTopic = topic.replace(/[/\\]+/g, "-");

  switch (folderMode) {
    case "topic":      return safeTopic;
    case "difficulty": return difficulty || "Easy";
    case "language":   return language   || "Java";
    case "root":       return "";
    case "custom": {
      return (customFolderTemplate || "{topic}")
        .replace(/\{topic\}/g, safeTopic)
        .replace(/\{difficulty\}/g, difficulty || "Easy")
        .replace(/\{language\}/g, language || "Java")
        .replace(/^\/+|\/+$/g, "");
    }
    default: return safeTopic;
  }
}

/**
 * Canonical push path resolution.
 */
export function resolvePushPaths(problemData, settings = {}, versionSuffix = "") {
  const { topics = [], difficulty = "Easy", language = "Java" } = problemData;
  const topic = getPrimaryTopic(topics, settings.topicStrategy, settings.userPreferredTopic);
  const folder = resolveFolder(settings, topic, difficulty, language)
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");

  const filename = generateFilename(problemData, settings, versionSuffix);
  const fullPath = folder ? `${folder}/${filename}` : filename;
  const readmePath = "README.md";

  return { folder, filename, fullPath, readmePath, topic };
}

/**
 * Generate commit message from saved settings.
 */
export function generateCommitMessage(problemData, settings = {}) {
  const {
    problemId = "",
    problemName = "Unknown",
    language = "Java",
    topics = [],
    difficulty = "Easy"
  } = problemData;

  const num = formatProblemNumber(problemId, settings.problemNumberFormat || "raw");
  const topic = getPrimaryTopic(topics, settings.topicStrategy, settings.userPreferredTopic);

  if (settings.commitMode === "short") {
    return `Add solution for ${problemName}`;
  }
  if (settings.commitMode === "custom" && settings.commitTemplate) {
    return settings.commitTemplate
      .replace(/\{problemNumber\}/g, num)
      .replace(/\{problemName\}/g, problemName)
      .replace(/\{topic\}/g, topic)
      .replace(/\{difficulty\}/g, difficulty)
      .replace(/\{language\}/g, language);
  }
  // default
  return num
    ? `Solved LeetCode #${num}: ${problemName} [${language}]`
    : `Solved LeetCode: ${problemName} [${language}]`;
}
