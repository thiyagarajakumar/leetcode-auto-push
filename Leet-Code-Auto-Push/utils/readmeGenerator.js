/**
 * readmeGenerator.js  —  Common Repository README.md Management System
 *
 * Capabilities:
 *  - Fully independent README organization (independent of folder structure)
 *  - Supports multiple templates (Topic Table, Language Category List, Difficulty Based, Language Based, Custom)
 *  - Supports multiple topics per problem (appears in all relevant topic sections)
 *  - Safe section markers: <!-- CODING-PLATFORM-START --> ... <!-- CODING-PLATFORM-END -->
 *  - Markdown Table, Bullet List, Numbered List with custom columns
 *  - Problem & section sorting, hiding empty automatic sections
 *  - Robust URI-encoded relative markdown links (e.g. [Add Two Numbers](./Linked%20List/2-Add-Two-Numbers.java))
 */

import { getFile, putFile } from "./github.js";

export const START_MARKER = "<!-- CODING-PLATFORM-START -->";
export const END_MARKER   = "<!-- CODING-PLATFORM-END -->";

/**
 * Format relative markdown link path, encoding spaces and special characters
 * so links render reliably on GitHub (e.g. "Linked List/2.java" -> "./Linked%20List/2.java").
 */
export function formatMarkdownPath(filePath) {
  if (!filePath) return "#";
  const cleanPath = String(filePath).replace(/^(\.\/|\/)+/, "");
  const encodedSegments = cleanPath.split("/").map(seg => encodeURIComponent(seg));
  return `./${encodedSegments.join("/")}`;
}

/**
 * Format clean markdown link.
 */
export function formatMarkdownLink(displayName, filePath) {
  const safeName = String(displayName || "Solution").replace(/[\[\]]/g, "").trim();
  const safePath = formatMarkdownPath(filePath);
  return `[${safeName}](${safePath})`;
}

/**
 * Example problems for live preview when user has no real pushed problems yet.
 */
export function generateExampleProblems() {
  return [
    {
      problemId: "1",
      problemNumber: "0001",
      problemName: "Two Sum",
      difficulty: "Easy",
      language: "Java",
      topics: ["Array", "Hash Table"],
      category: "Array",
      filePath: "Array/0001-two-sum.java",
      link: "https://leetcode.com/problems/two-sum/",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
      timestamp: new Date().toISOString()
    },
    {
      problemId: "11",
      problemNumber: "0011",
      problemName: "Container With Most Water",
      difficulty: "Medium",
      language: "Java",
      topics: ["Array", "Two Pointers", "Greedy"],
      category: "Array",
      filePath: "Array/0011-container-with-most-water.java",
      link: "https://leetcode.com/problems/container-with-most-water/",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      problemId: "3",
      problemNumber: "0003",
      problemName: "Longest Substring Without Repeating Characters",
      difficulty: "Medium",
      language: "Python",
      topics: ["Hash Table", "String", "Sliding Window"],
      category: "String",
      filePath: "Python/0003-longest-substring.py",
      link: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
      timeComplexity: "O(n)",
      spaceComplexity: "O(min(m,n))",
      timestamp: new Date(Date.now() - 7200000).toISOString()
    },
    {
      problemId: "206",
      problemNumber: "0206",
      problemName: "Reverse Linked List",
      difficulty: "Easy",
      language: "Java",
      topics: ["Linked List", "Recursion"],
      category: "Linked List",
      filePath: "Linked List/0206-reverse-linked-list.java",
      link: "https://leetcode.com/problems/reverse-linked-list/",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      timestamp: new Date(Date.now() - 86400000).toISOString()
    },
    {
      problemId: "42",
      problemNumber: "0042",
      problemName: "Trapping Rain Water",
      difficulty: "Hard",
      language: "C++",
      topics: ["Array", "Two Pointers", "Dynamic Programming", "Stack"],
      category: "Dynamic Programming",
      filePath: "Array/0042-trapping-rain-water.cpp",
      link: "https://leetcode.com/problems/trapping-rain-water/",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      timestamp: new Date(Date.now() - 172800000).toISOString()
    }
  ];
}

/**
 * Sort problems by specified criteria.
 */
function sortProblems(list, sortBy = "number-asc") {
  const diffOrder = { "Easy": 1, "Medium": 2, "Hard": 3 };
  const arr = [...list];

  arr.sort((a, b) => {
    const numA = parseInt(String(a.problemId || a.problemNumber || "").replace(/\D+/g, "") || "0", 10);
    const numB = parseInt(String(b.problemId || b.problemNumber || "").replace(/\D+/g, "") || "0", 10);
    const nameA = String(a.problemName || "").toLowerCase();
    const nameB = String(b.problemName || "").toLowerCase();

    switch (sortBy) {
      case "number-desc":
        return numB - numA;
      case "name-asc":
        return nameA.localeCompare(nameB);
      case "name-desc":
        return nameB.localeCompare(nameA);
      case "difficulty":
        return (diffOrder[a.difficulty] || 2) - (diffOrder[b.difficulty] || 2);
      case "recent":
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      case "number-asc":
      default:
        return numA - numB;
    }
  });

  return arr;
}

/**
 * Render a list of problems in chosen display style (table, bullet, numbered).
 */
function renderProblemGroup(problems, settings) {
  if (!problems || problems.length === 0) return "";

  const style = settings.readmeDisplayStyle || "table";
  const cols = settings.readmeTableColumns || {
    number: true,
    name: true,
    difficulty: true,
    language: true,
    topic: false,
    problemLink: false,
    solutionLink: false,
    timeComplexity: false,
    spaceComplexity: false
  };

  const sorted = sortProblems(problems, settings.readmeSortBy || "number-asc");

  if (style === "bullet" || style === "numbered") {
    return sorted.map((p, idx) => {
      const prefix = style === "numbered" ? `${idx + 1}.` : "-";
      const numStr = p.problemNumber || p.problemId || "";
      const displayTitle = numStr ? `${numStr} - ${p.problemName}` : p.problemName;
      const link = formatMarkdownLink(displayTitle, p.filePath);
      const meta = [];
      if (p.difficulty) meta.push(p.difficulty);
      if (p.language) meta.push(p.language);
      if (p.timeComplexity) meta.push(`⏱ ${p.timeComplexity}`);
      if (p.spaceComplexity) meta.push(`💾 ${p.spaceComplexity}`);

      const metaStr = meta.length > 0 ? ` _(${meta.join(" · ")})_` : "";
      return `${prefix} ${link}${metaStr}`;
    }).join("\n");
  }

  // Markdown Table
  const headers = [];
  const keys = [];

  if (cols.number)      { headers.push("Number");         keys.push("number"); }
  if (cols.name)        { headers.push("Problem Name");   keys.push("name"); }
  if (cols.difficulty)  { headers.push("Difficulty");     keys.push("difficulty"); }
  if (cols.language)    { headers.push("Language");       keys.push("language"); }
  if (cols.topic)       { headers.push("Topic");          keys.push("topic"); }
  if (cols.timeComplexity)  { headers.push("Time");       keys.push("time"); }
  if (cols.spaceComplexity) { headers.push("Space");      keys.push("space"); }
  if (cols.problemLink) { headers.push("LeetCode");       keys.push("problemLink"); }
  if (cols.solutionLink){ headers.push("Solution File");  keys.push("solutionLink"); }

  if (headers.length === 0) {
    headers.push("Problem Name", "Difficulty");
    keys.push("name", "difficulty");
  }

  const headerRow = `| ${headers.join(" | ")} |`;
  const sepRow    = `| ${headers.map(() => "---").join(" | ")} |`;

  const rows = sorted.map(p => {
    const numStr = p.problemNumber || p.problemId || "";

    const cells = keys.map(k => {
      switch (k) {
        case "number":
          return numStr || "—";
        case "name":
          return formatMarkdownLink(p.problemName, p.filePath);
        case "difficulty":
          return p.difficulty || "—";
        case "language":
          return p.language || "—";
        case "topic":
          return Array.isArray(p.topics) ? p.topics.join(", ") : (p.topic || "—");
        case "time":
          return p.timeComplexity || "—";
        case "space":
          return p.spaceComplexity || "—";
        case "problemLink":
          return p.link ? `[LeetCode ↗](${p.link})` : "—";
        case "solutionLink":
          return formatMarkdownLink("Code", p.filePath);
        default:
          return "—";
      }
    });

    return `| ${cells.join(" | ")} |`;
  });

  return [headerRow, sepRow, ...rows].join("\n");
}

export function getProblemReadmeTopics(p, settings = {}) {
  const strat = settings.readmeTopicStrategy || settings.topicStrategy || "first";
  const pref = settings.readmeUserPreferredTopic || settings.userPreferredTopic || "";
  const rawList = Array.isArray(p.topics) && p.topics.length > 0 ? p.topics : [p.category || p.topic || "Algorithms"];

  if (strat === "first") {
    return [rawList[0] || "Algorithms"];
  }
  if (strat === "user_preferred" && pref) {
    const match = rawList.find(t => t.toLowerCase() === pref.toLowerCase());
    return [match || rawList[0] || "Algorithms"];
  }
  if (strat === "all") {
    return [rawList.join("-")];
  }
  return rawList;
}

/**
 * Generate complete README Markdown string from problem collection and settings.
 *
 * @param {Array} rawProblems
 * @param {Object} settings
 * @returns {string} Complete markdown content
 */
export function generateReadmeContent(rawProblems = [], settings = {}) {
  const problems = Array.isArray(rawProblems) ? rawProblems : [];
  const title = settings.readmeTitle || "LeetCode Solutions";
  const desc = settings.readmeDescription !== undefined
    ? settings.readmeDescription
    : "A collection of my coding solutions and problem-solving practice.";

  const template = settings.readmeTemplate || "topic-table";
  const sections = [];

  // 1. Header
  sections.push(`# ${title}`);
  if (desc && desc.trim().length > 0) {
    sections.push(`\n${desc.trim()}\n`);
  } else {
    sections.push("");
  }

  if (problems.length === 0) {
    sections.push("No solutions tracked yet. Solved problems will appear here automatically.");
    return sections.join("\n").trim();
  }

  // 2. Template Generation
  if (template === "topic-table" || template === "topic") {
    sections.push("## LeetCode Topics\n");

    // Group by topic using Topic Strategy
    const topicMap = new Map();
    for (const p of problems) {
      const topList = getProblemReadmeTopics(p, settings);
      for (const t of topList) {
        if (!topicMap.has(t)) topicMap.set(t, []);
        topicMap.get(t).push(p);
      }
    }

    // Sort topics: preserve user custom sections first, then remaining topics
    let topicKeys = Array.from(topicMap.keys());
    if (settings.readmeSectionSort === "custom" && Array.isArray(settings.readmeSections) && settings.readmeSections.length > 0) {
      topicKeys.sort((a, b) => {
        const idxA = settings.readmeSections.indexOf(a);
        const idxB = settings.readmeSections.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
    } else {
      topicKeys.sort((a, b) => a.localeCompare(b));
    }

    for (const topic of topicKeys) {
      const list = topicMap.get(topic);
      if (list && list.length > 0) {
        sections.push(`### ${topic}\n`);
        sections.push(renderProblemGroup(list, settings));
        sections.push("");
      }
    }

  } else if (template === "lang-category-list" || template === "language-category") {
    // Language -> Category -> Problems
    const langMap = new Map();
    for (const p of problems) {
      const lang = p.language || "Java";
      if (!langMap.has(lang)) langMap.set(lang, new Map());
      const catMap = langMap.get(lang);

      const topList = getProblemReadmeTopics(p, settings);
      for (const cat of topList) {
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat).push(p);
      }
    }

    for (const [lang, catMap] of langMap.entries()) {
      sections.push(`## ${lang}\n`);
      for (const [cat, list] of catMap.entries()) {
        if (list.length > 0) {
          sections.push(`### ${cat}\n`);
          sections.push(renderProblemGroup(list, settings));
          sections.push("");
        }
      }
    }

  } else if (template === "difficulty") {
    const diffOrder = ["Easy", "Medium", "Hard"];
    const diffMap = { "Easy": [], "Medium": [], "Hard": [] };
    for (const p of problems) {
      const d = p.difficulty || "Easy";
      if (!diffMap[d]) diffMap[d] = [];
      diffMap[d].push(p);
    }

    for (const d of diffOrder) {
      const list = diffMap[d];
      if (list && list.length > 0) {
        sections.push(`## ${d}\n`);
        sections.push(renderProblemGroup(list, settings));
        sections.push("");
      }
    }

  } else if (template === "language") {
    const langMap = new Map();
    for (const p of problems) {
      const lang = p.language || "Java";
      if (!langMap.has(lang)) langMap.set(lang, []);
      langMap.get(lang).push(p);
    }

    for (const [lang, list] of langMap.entries()) {
      if (list.length > 0) {
        sections.push(`## ${lang}\n`);
        sections.push(renderProblemGroup(list, settings));
        sections.push("");
      }
    }

  } else if (template === "custom") {
    // Visual structure builder: Level 1 -> Level 2 -> Problems
    const struct = settings.readmeStructure || { level1: "Topic", level2: "Problems" };
    const l1 = struct.level1 || "Topic";
    const l2 = struct.level2 || "Problems";

    if (l2 === "Problems" || l2 === "None") {
      // 1-Level grouping
      const groupMap = new Map();
      for (const p of problems) {
        let keys = [];
        if (l1 === "Language") keys = [p.language || "Java"];
        else if (l1 === "Difficulty") keys = [p.difficulty || "Easy"];
        else keys = getProblemReadmeTopics(p, settings);

        for (const k of keys) {
          if (!groupMap.has(k)) groupMap.set(k, []);
          groupMap.get(k).push(p);
        }
      }

      for (const [key, list] of groupMap.entries()) {
        if (list.length > 0) {
          sections.push(`## ${key}\n`);
          sections.push(renderProblemGroup(list, settings));
          sections.push("");
        }
      }
    } else {
      // 2-Level grouping
      const nestedMap = new Map();
      for (const p of problems) {
        let k1List = (l1 === "Language") ? [p.language || "Java"]
                   : (l1 === "Difficulty") ? [p.difficulty || "Easy"]
                   : getProblemReadmeTopics(p, settings);

        let k2List = (l2 === "Language") ? [p.language || "Java"]
                   : (l2 === "Difficulty") ? [p.difficulty || "Easy"]
                   : getProblemReadmeTopics(p, settings);

        for (const k1 of k1List) {
          if (!nestedMap.has(k1)) nestedMap.set(k1, new Map());
          const subMap = nestedMap.get(k1);
          for (const k2 of k2List) {
            if (!subMap.has(k2)) subMap.set(k2, []);
            subMap.get(k2).push(p);
          }
        }
      }

      for (const [k1, subMap] of nestedMap.entries()) {
        sections.push(`## ${k1}\n`);
        for (const [k2, list] of subMap.entries()) {
          if (list.length > 0) {
            sections.push(`### ${k2}\n`);
            sections.push(renderProblemGroup(list, settings));
            sections.push("");
          }
        }
      }
    }
  }

  return sections.join("\n").trim();
}

/**
 * Apply safe section markers or full replacement to an existing README.
 *
 * @param {string} existingContent
 * @param {string} generatedContent
 * @param {string} handlingMode 'section-markers' | 'replace' | 'keep'
 * @returns {string} Final updated content
 */
export function mergeReadmeContent(existingContent = "", generatedContent = "", handlingMode = "section-markers") {
  if (handlingMode === "keep" && existingContent && existingContent.trim().length > 0) {
    return existingContent;
  }

  if (handlingMode === "replace" || !existingContent || existingContent.trim().length === 0) {
    return `${START_MARKER}\n${generatedContent}\n${END_MARKER}`;
  }

  // Section markers handling
  const startIdx = existingContent.indexOf(START_MARKER);
  const endIdx   = existingContent.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existingContent.substring(0, startIdx).trimEnd();
    const after  = existingContent.substring(endIdx + END_MARKER.length).trimStart();
    return `${before}\n\n${START_MARKER}\n${generatedContent}\n${END_MARKER}\n\n${after}`.trim();
  }

  // Markers not present yet in existing README: append safely at the end
  return `${existingContent.trim()}\n\n${START_MARKER}\n${generatedContent}\n${END_MARKER}`;
}

/**
 * Updates repository common README.md on GitHub.
 *
 * @param {Object} githubCfg { token, owner, repo, branch }
 * @param {Array} problems All solved problems
 * @param {Object} settings README settings
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function updateRepoReadme(githubCfg, problems = [], settings = {}) {
  if (!settings.autoReadme) {
    return { ok: true, skipped: true };
  }

  try {
    const path = "README.md";
    const existing = await getFile({ ...githubCfg, path });
    let existingText = "";
    let sha = null;

    if (existing.ok && existing.data) {
      sha = existing.data.sha;
      try {
        existingText = decodeURIComponent(escape(atob((existing.data.content || "").replace(/\n/g, ""))));
      } catch {
        existingText = "";
      }
    }

    const handling = settings.readmeExistingHandling || "section-markers";
    if (handling === "keep" && existingText.trim().length > 0) {
      return { ok: true, skipped: true };
    }

    const generated = generateReadmeContent(problems, settings);
    const finalContent = mergeReadmeContent(existingText, generated, handling);

    // If existing README is already identical to final generated content, skip commit
    const normExisting = (existingText || "").replace(/\r\n/g, "\n").trim();
    const normFinal = (finalContent || "").replace(/\r\n/g, "\n").trim();
    if (normExisting === normFinal) {
      return { ok: true, action: "skipped", message: "README.md is already up to date" };
    }

    const pushRes = await putFile({
      ...githubCfg,
      path,
      content: finalContent,
      sha,
      message: "docs: update solutions in README.md"
    });

    if (pushRes.ok) {
      return { ok: true, action: sha ? "updated" : "created" };
    }
    return pushRes;
  } catch (err) {
    return { ok: false, error: err?.message || "Failed to update repository README.md" };
  }
}
