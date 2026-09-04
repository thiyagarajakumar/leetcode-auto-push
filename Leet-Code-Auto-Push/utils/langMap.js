/**
 * langMap.js
 * Maps LeetCode language names to extensions, comment prefixes, and formats file contents safely.
 */

const LANG_MAP = new Map([
  ["python",     { ext: "py",    commentStyle: "hash" }],
  ["python3",    { ext: "py",    commentStyle: "hash" }],
  ["python 3",   { ext: "py",    commentStyle: "hash" }],
  ["java",       { ext: "java",  commentStyle: "double_slash" }],
  ["c",          { ext: "c",     commentStyle: "double_slash" }],
  ["c++",        { ext: "cpp",   commentStyle: "double_slash" }],
  ["cpp",        { ext: "cpp",   commentStyle: "double_slash" }],
  ["c++17",      { ext: "cpp",   commentStyle: "double_slash" }],
  ["c++20",      { ext: "cpp",   commentStyle: "double_slash" }],
  ["javascript", { ext: "js",    commentStyle: "double_slash" }],
  ["js",         { ext: "js",    commentStyle: "double_slash" }],
  ["node.js",    { ext: "js",    commentStyle: "double_slash" }],
  ["typescript", { ext: "ts",    commentStyle: "double_slash" }],
  ["ts",         { ext: "ts",    commentStyle: "double_slash" }],
  ["go",         { ext: "go",    commentStyle: "double_slash" }],
  ["golang",     { ext: "go",    commentStyle: "double_slash" }],
  ["rust",       { ext: "rs",    commentStyle: "double_slash" }],
  ["c#",         { ext: "cs",    commentStyle: "double_slash" }],
  ["csharp",     { ext: "cs",    commentStyle: "double_slash" }],
  ["swift",      { ext: "swift", commentStyle: "double_slash" }],
  ["kotlin",     { ext: "kt",    commentStyle: "double_slash" }],
  ["ruby",       { ext: "rb",    commentStyle: "hash" }],
  ["scala",      { ext: "scala", commentStyle: "double_slash" }],
  ["php",        { ext: "php",   commentStyle: "double_slash" }],
  ["racket",     { ext: "rkt",   commentStyle: "semicolon" }],
  ["erlang",     { ext: "erl",   commentStyle: "percent" }],
  ["elixir",     { ext: "ex",    commentStyle: "hash" }],
  ["dart",       { ext: "dart",  commentStyle: "double_slash" }],
  ["bash",       { ext: "sh",    commentStyle: "hash" }],
  ["shell",      { ext: "sh",    commentStyle: "hash" }],
  ["mysql",      { ext: "sql",   commentStyle: "sql_dash" }],
  ["postgresql", { ext: "sql",   commentStyle: "sql_dash" }],
  ["sql",        { ext: "sql",   commentStyle: "sql_dash" }],
  ["pandas",     { ext: "py",    commentStyle: "hash" }],
]);

export function getLanguageInfo(language) {
  if (!language || typeof language !== "string") {
    return { ext: "java", commentStyle: "double_slash" };
  }
  const key = language.toLowerCase().trim();
  if (LANG_MAP.has(key)) return LANG_MAP.get(key);

  for (const [alias, info] of LANG_MAP) {
    if (key.startsWith(alias)) return info;
  }
  return { ext: "java", commentStyle: "double_slash" };
}

export function getExtension(language) {
  return getLanguageInfo(language).ext;
}

export function getCommentPrefix(language) {
  const { commentStyle } = getLanguageInfo(language);
  switch (commentStyle) {
    case "hash":
      return "#";
    case "double_slash":
      return "//";
    case "sql_dash":
      return "--";
    case "semicolon":
      return ";";
    case "percent":
      return "%";
    default:
      return "//";
  }
}

export function normalizeLanguageName(language) {
  if (!language) return "Unknown";
  const trimmed = language.trim();
  const lower = trimmed.toLowerCase();

  const DISPLAY = {
    python: "Python",
    python3: "Python3",
    "python 3": "Python3",
    java: "Java",
    "c++": "C++",
    cpp: "C++",
    c: "C",
    javascript: "JavaScript",
    typescript: "TypeScript",
    go: "Go",
    rust: "Rust",
    "c#": "C#",
    swift: "Swift",
    kotlin: "Kotlin",
    ruby: "Ruby",
    scala: "Scala",
    php: "PHP",
    dart: "Dart",
    sql: "SQL",
    mysql: "MySQL",
    postgresql: "PostgreSQL"
  };

  return DISPLAY[lower] || trimmed;
}

/**
 * Builds solution file content by generating metadata comment header and appending the 100% UNMODIFIED complete code.
 */
export function formatSolutionContent({
  code = "",
  language = "Java",
  problemId = "1",
  problemName = "Unknown",
  difficulty = "Easy",
  topics = [],
  link = "",
  timeComplexity = "",
  spaceComplexity = "",
  include = {
    problemNumber: true,
    problemName: true,
    difficulty: true,
    topic: true,
    problemLink: true,
    timeComplexity: false,
    spaceComplexity: false,
    solutionCode: true
  }
}) {
  const prefix = getCommentPrefix(language);
  const headerLines = [];

  const topicsStr = Array.isArray(topics) && topics.length > 0 ? topics.join(", ") : "";

  // Clean problem ID - pure number
  const cleanIdMatch = String(problemId || "1").match(/\d+/);
  const rawNum = cleanIdMatch ? cleanIdMatch[0] : "1";

  // Clean problem name
  const cleanName = String(problemName || "").replace(/^\d+\.\s*-*\s*/, "").trim();

  if (include.problemNumber) {
    headerLines.push(`${prefix} Problem Number: ${rawNum}`);
  }
  if (include.problemName) {
    headerLines.push(`${prefix} Problem Name: ${cleanName}`);
  }
  if (include.difficulty) {
    headerLines.push(`${prefix} Difficulty: ${difficulty}`);
  }
  if (include.topic && topicsStr) {
    headerLines.push(`${prefix} Topic: ${topicsStr}`);
  }
  if (include.problemLink && link) {
    headerLines.push(`${prefix} Problem Link: ${link}`);
  }
  if (include.timeComplexity && timeComplexity) {
    headerLines.push(`${prefix} Time Complexity: ${timeComplexity}`);
  }
  if (include.spaceComplexity && spaceComplexity) {
    headerLines.push(`${prefix} Space Complexity: ${spaceComplexity}`);
  }

  let finalContent = "";
  if (headerLines.length > 0) {
    finalContent = headerLines.join("\n") + "\n\n";
  }

  // Always append the complete original code safely without string modification
  finalContent += (code || "");

  return finalContent;
}

/**
 * Formats commit message from user template
 */
export function formatCommitMessage({
  templateMode = "default",
  customTemplate = "Solved LeetCode #{problemNumber}: {problemName}",
  problemId = "1",
  problemName = "Unknown",
  difficulty = "Easy",
  topics = [],
  language = "Java"
}) {
  const topicsStr = Array.isArray(topics) && topics.length > 0 ? topics[0] : "Algorithms";
  const langName = normalizeLanguageName(language);

  const cleanIdMatch = String(problemId || "1").match(/\d+/);
  const rawNum = cleanIdMatch ? cleanIdMatch[0] : "1";
  const cleanName = String(problemName || "").replace(/^\d+\.\s*-*\s*/, "").trim();

  if (templateMode === "custom" && customTemplate) {
    return customTemplate
      .replace(/\{problemNumber\}/g, rawNum)
      .replace(/\{problemName\}/g, cleanName)
      .replace(/\{topic\}/g, topicsStr)
      .replace(/\{difficulty\}/g, difficulty)
      .replace(/\{language\}/g, langName);
  }

  return `Solved LeetCode #${rawNum}: ${cleanName} [${langName}]`;
}

/**
 * Generates README Markdown content
 */
export function formatReadmeContent({
  problemId = "1",
  problemName = "Unknown",
  difficulty = "Easy",
  topics = [],
  link = "",
  timeComplexity = "",
  spaceComplexity = "",
  solutionCode = "",
  language = "Java",
  readmeOptions = {
    includeTitle: true,
    includeDifficulty: true,
    includeTopics: true,
    includeLink: true,
    includeComplexity: true,
    includeCodeBlock: true
  }
}) {
  const lines = [];
  const langName = normalizeLanguageName(language).toLowerCase();
  const topicsStr = Array.isArray(topics) && topics.length > 0 ? topics.join(", ") : "N/A";

  const cleanIdMatch = String(problemId || "1").match(/\d+/);
  const rawNum = cleanIdMatch ? cleanIdMatch[0] : "1";
  const cleanName = String(problemName || "").replace(/^\d+\.\s*-*\s*/, "").trim();

  if (readmeOptions.includeTitle !== false) {
    lines.push(`# ${rawNum}. ${cleanName}\n`);
  }

  if (readmeOptions.includeDifficulty !== false) {
    lines.push(`**Difficulty:** ${difficulty}  `);
  }

  if (readmeOptions.includeTopics !== false) {
    lines.push(`**Topics:** ${topicsStr}  `);
  }

  if (readmeOptions.includeLink !== false && link) {
    lines.push(`**Problem Link:** [LeetCode](${link})  `);
  }

  if (readmeOptions.includeComplexity !== false && (timeComplexity || spaceComplexity)) {
    lines.push(`\n## Complexity Analysis\n`);
    if (timeComplexity) lines.push(`- **Time Complexity:** \`${timeComplexity}\``);
    if (spaceComplexity) lines.push(`- **Space Complexity:** \`${spaceComplexity}\``);
  }

  if (readmeOptions.includeCodeBlock !== false && solutionCode) {
    lines.push(`\n## Solution (${normalizeLanguageName(language)})\n`);
    lines.push("```" + langName);
    lines.push(solutionCode);
    lines.push("```\n");
  }

  return lines.join("\n");
}
