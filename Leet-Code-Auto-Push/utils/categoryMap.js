/**
 * categoryMap.js
 * Maps LeetCode topic tags to clean GitHub folders and handles naming templates.
 */

// List of real LeetCode topic tags
export const LEETCODE_TOPICS = [
  "Array", "String", "Hash Table", "Math", "Dynamic Programming", "Sorting",
  "Greedy", "Depth-First Search", "Binary Search", "Database", "Bit Manipulation",
  "Matrix", "Prefix Sum", "Tree", "Two Pointers", "Breadth-First Search",
  "Heap (Priority Queue)", "Simulation", "Counting", "Graph Theory", "Binary Tree",
  "Stack", "Sliding Window", "Enumeration", "Design", "Backtracking",
  "Number Theory", "Union-Find", "Segment Tree", "Linked List", "Ordered Set",
  "Monotonic Stack", "Divide and Conquer", "Combinatorics", "Trie", "Queue",
  "Bitmask", "Recursion", "Binary Indexed Tree", "Geometry", "Hash Function",
  "Memoization", "Binary Search Tree", "Shortest Path", "Topological Sort",
  "String Matching", "Rolling Hash", "Game Theory", "Monotonic Queue", "Data Stream",
  "Brain Teaser", "Merge Sort", "Minimax", "Doubly-Linked List", "Randomized",
  "Counting Sort", "Iterator", "Concurrency", "Suffix Array", "Quickselect",
  "Sweep Line", "Probability and Statistics", "Minimum Spanning Tree", "Bucket Sort",
  "Shell Sort", "Meet in the Middle", "Reservoir Sampling", "Eulerian Circuit",
  "Radix Sort", "Strongly Connected Component", "Rejection Sampling", "Biconnected Component"
];

/**
 * Determines primary topic from topic list based on strategy
 */
export function getPrimaryTopic(topics, strategy = "first", userPreferred = "") {
  if (!Array.isArray(topics) || topics.length === 0) {
    return userPreferred || "Algorithms";
  }

  // 1. User Preferred Topic
  if (strategy === "user_preferred" && userPreferred) {
    const match = topics.find(t => t.toLowerCase() === userPreferred.toLowerCase());
    if (match) return sanitisePathSegment(match);
  }

  // 2. All Topics (Hyphen-separated)
  if (strategy === "all") {
    return sanitisePathSegment(topics.map(t => sanitisePathSegment(t)).join("-"));
  }

  // 3. Default & First: Clean name of first LeetCode topic
  return sanitisePathSegment(topics[0]) || "Algorithms";
}

/**
 * Resolves full directory/file path according to user's folder mode & filename settings
 */
export function resolveFolderPath({
  folderMode = "topic",
  customFolderTemplate = "{topic}",
  filenameFormat = "dot-hyphen", // dot-hyphen | space-hyphen | dot-only | hyphen-only | name-only | custom
  customFilenameTemplate = "{problemNumber}.-{problemName}",
  topicStrategy = "first",
  userPreferredTopic = "",
  topics = [],
  difficulty = "Easy",
  problemId = "1",
  problemName = "Unknown",
  fileExt = "java",
  language = "Java",
  versionNumber = 1 // 1 -> normal, 2 -> -v2, 3 -> -v3
}) {
  const primaryTopic = getPrimaryTopic(topics, topicStrategy, userPreferredTopic);
  const diff = difficulty || "Easy";

  // Clean pure numeric problem ID - ensure NO prefixes or non-digit chars
  const cleanIdMatch = String(problemId || "1").match(/\d+/);
  const rawNum = cleanIdMatch ? cleanIdMatch[0] : "1";
  const paddedNum = rawNum.padStart(3, "0");
  const safeName = sanitisePathSegment(problemName);

  // 1. Resolve Parent Folder Path (No subfolder per problem!)
  let parentFolder = "";

  switch (folderMode) {
    case "topic":
      parentFolder = primaryTopic;
      break;

    case "difficulty":
      parentFolder = diff;
      break;

    case "root":
      parentFolder = "";
      break;

    case "custom":
      if (customFolderTemplate) {
        parentFolder = customFolderTemplate
          .replace(/\{topic\}/g, primaryTopic)
          .replace(/\{difficulty\}/g, diff)
          .replace(/\{problemNumber\}/g, rawNum)
          .replace(/\{paddedProblemNumber\}/g, paddedNum)
          .replace(/\{problemName\}/g, safeName)
          .replace(/\{language\}/g, language);
      } else {
        parentFolder = primaryTopic;
      }
      break;

    default:
      parentFolder = primaryTopic;
      break;
  }

  parentFolder = parentFolder.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");

  // 2. Resolve Base Filename from User's chosen template (EXACT replacement without arbitrary prefixes)
  let baseFilename = "";

  switch (filenameFormat) {
    case "dot-hyphen":
      // Template: {problemNumber}.-{problemName} -> 219.-Contains-Duplicate-II
      baseFilename = `${rawNum}.-${safeName}`;
      break;

    case "space-hyphen":
      // Template: {problemNumber} - {problemName} -> 219 - Contains-Duplicate-II
      baseFilename = `${rawNum} - ${safeName}`;
      break;

    case "dot-only":
      // Template: {problemNumber}.{problemName} -> 219.Contains-Duplicate-II
      baseFilename = `${rawNum}.${safeName}`;
      break;

    case "hyphen-only":
    case "number-name":
      // Template: {problemNumber}-{problemName} -> 219-Contains-Duplicate-II
      baseFilename = `${rawNum}-${safeName}`;
      break;

    case "name-only":
    case "name":
      // Template: {problemName} -> Contains-Duplicate-II
      baseFilename = safeName;
      break;

    case "custom":
      if (customFilenameTemplate) {
        baseFilename = customFilenameTemplate
          .replace(/\{problemNumber\}/g, rawNum)
          .replace(/\{paddedProblemNumber\}/g, paddedNum)
          .replace(/\{problemName\}/g, safeName)
          .replace(/\{language\}/g, language);
      } else {
        baseFilename = `${rawNum}.-${safeName}`;
      }
      break;

    default:
      baseFilename = `${rawNum}.-${safeName}`;
      break;
  }

  // Version suffix if multiple solutions mode is active
  if (versionNumber > 1) {
    baseFilename += `-v${versionNumber}`;
  }

  const solutionFilename = `${baseFilename}.${fileExt}`;
  const solutionFilePath = parentFolder ? `${parentFolder}/${solutionFilename}` : solutionFilename;
  const readmeFilePath = parentFolder ? `${parentFolder}/README.md` : `README.md`;

  return {
    folderPath: parentFolder,
    solutionFilename,
    solutionFilePath,
    readmeFilePath,
    primaryTopic
  };
}

export function sanitisePathSegment(name) {
  return String(name || "")
    // Remove any leading numbers with dot like "219. " or "219.-" if already present in name
    .replace(/^\d+\.\s*-*\s*/, "")
    .replace(/[^a-zA-Z0-9\s-_.]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-");
}
