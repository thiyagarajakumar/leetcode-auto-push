/**
 * service-worker.js  —  Background Service Worker  (v10)
 *
 * Uses:
 *  - filenameUtils.js for single source of truth filename & path generation
 *  - readmeGenerator.js for common repository README.md management
 *  - github.js for API interactions
 */

import {
  resolvePushPaths,
  generateFilename,
  generateCommitMessage,
  getExt,
  getPrimaryTopic,
  formatProblemNumber
} from "../utils/filenameUtils.js";
import { formatSolutionContent, formatReadmeContent } from "../utils/langMap.js";
import { pushSolution, putFile, getFile } from "../utils/github.js";
import { updateRepoReadme } from "../utils/readmeGenerator.js";

const LOG  = (...a) => console.log("[LeetCode → GitHub]", ...a);
const WARN = (...a) => console.warn("[LeetCode → GitHub]", ...a);
const ERR  = (...a) => console.error("[LeetCode → GitHub]", ...a);

LOG("Service worker started (v10)");

// Active push concurrency lock to prevent duplicate simultaneous pushes
const activePushLocks = new Map();

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "LEETCODE_ACCEPTED") return false;

  LOG("Received LEETCODE_ACCEPTED message");

  (async () => {
    try {
      const result = await handleAcceptedSubmission(message.payload, sender);

      sendResponse({
        ok: result.action !== "error",
        action: result.action,
        filePath: result.filePath,
        filename: result.filename,
        error: result.error
      });

      // Broadcast to tab and popup
      if (sender?.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { type: "PUSH_RESULT", ...result }).catch(() => {});
      }
      chrome.runtime.sendMessage({ type: "PUSH_RESULT", ...result }).catch(() => {});

    } catch (err) {
      ERR("Background handler error:", err?.message || err);
      const errorResult = { action: "error", filePath: "", filename: "", error: err?.message || "Unexpected error" };
      sendResponse({ ok: false, ...errorResult });

      if (sender?.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { type: "PUSH_RESULT", ...errorResult }).catch(() => {});
      }
      chrome.runtime.sendMessage({ type: "PUSH_RESULT", ...errorResult }).catch(() => {});
    }
  })();

  return true; // Keep channel open
});

// ─── Core handler ─────────────────────────────────────────────────────────────

async function handleAcceptedSubmission(payload, sender) {
  const {
    problemId    = "",
    problemName  = "Unknown",
    topics       = [],
    language     = "Java",
    code         = "",
    difficulty   = "Easy",
    link         = "",
    slug         = "",
    timeComplexity  = "",
    spaceComplexity = "",
    overrideFolder       = "",
    overrideFilename     = "",
    overrideCommitMessage = ""
  } = payload || {};

  const lockKey = `${problemId || slug}_${language}_${overrideFilename || ""}`;
  if (activePushLocks.has(lockKey)) {
    LOG("Duplicate push in flight for", lockKey, "— joining existing operation");
    return await activePushLocks.get(lockKey);
  }

  const pushPromise = (async () => {
    return await executePushWorkflow(payload, sender);
  })();

  activePushLocks.set(lockKey, pushPromise);
  try {
    return await pushPromise;
  } finally {
    activePushLocks.delete(lockKey);
  }
}

async function executePushWorkflow(payload, sender) {
  const settings = await loadSettings();

  // ── Validate credentials ────────────────────────────────────────────────────
  if (!settings.token || !settings.owner || !settings.repo) {
    const missing = !settings.token ? "GitHub token" : !settings.owner ? "GitHub username" : "repository name";
    await setBadge("!", "#cf222e");
    return { action: "error", filePath: "", filename: "", error: `${missing} not configured. Open extension settings.` };
  }

  const {
    problemId    = "",
    problemName  = "Unknown",
    topics       = [],
    language     = "Java",
    code         = "",
    difficulty   = "Easy",
    link         = "",
    slug         = "",
    timeComplexity  = "",
    spaceComplexity = "",
    overrideFolder       = "",
    overrideFilename     = "",
    overrideCommitMessage = ""
  } = payload || {};

  if (!code || code.trim().length === 0) {
    return { action: "error", filePath: "", filename: "", error: "Captured code is empty. Please re-submit on LeetCode." };
  }

  const githubCfg = {
    token:  settings.token,
    owner:  settings.owner,
    repo:   settings.repo,
    branch: settings.branch || "main"
  };

  const problemData = { problemId, problemName, language, topics, difficulty };

  // ── Step 1: Resolve final push paths using SINGLE source of truth ───────────
  let versionSuffix = "";
  let paths = resolvePushPaths(problemData, settings);

  // Apply overrides from Ask Before Push modal
  if (overrideFolder) {
    paths.folder = overrideFolder.replace(/^\/+|\/+$/g, "");
    paths.fullPath = paths.folder ? `${paths.folder}/${paths.filename}` : paths.filename;
    paths.readmePath = paths.folder ? `${paths.folder}/README.md` : "README.md";
  }
  if (overrideFilename) {
    paths.filename = overrideFilename;
    paths.fullPath = paths.folder ? `${paths.folder}/${overrideFilename}` : overrideFilename;
  }

  // Handle versioning mode
  if (settings.duplicateHandling === "version") {
    for (let v = 1; v <= 15; v++) {
      const suffix = v === 1 ? "" : `-v${v}`;
      const candidate = resolvePushPaths(problemData, settings, suffix);
      const check = await getFile({ ...githubCfg, path: candidate.fullPath });
      if (!check.ok) break;
      if (check.data === null) {
        paths = candidate;
        versionSuffix = suffix;
        break;
      }
      const existing = decodeBase64(check.data.content);
      const formatted = formatSolutionContent({
        code, language, problemId, problemName, difficulty,
        topics, link, timeComplexity, spaceComplexity,
        include: settings.solutionContent
      });
      if (normalise(existing) === normalise(formatted)) {
        paths = candidate;
        await recordHistory({
          problemId, problemName, language, difficulty,
          topic: candidate.topic,
          folder: candidate.folder,
          filename: candidate.filename,
          filePath: candidate.fullPath,
          commitMessage: "",
          timeComplexity, spaceComplexity,
          link, timestamp: new Date().toISOString(),
          action: "Already Up To Date", error: null
        });
        await clearBadge();
        return { action: "skipped", filePath: candidate.fullPath, filename: candidate.filename };
      }
    }
  }

  const { folder, filename, fullPath, readmePath, topic } = paths;

  // ── Step 2: Format solution file content ────────────────────────────────────
  const formattedCode = formatSolutionContent({
    code, language, problemId, problemName, difficulty,
    topics, link, timeComplexity, spaceComplexity,
    include: settings.solutionContent
  });

  // ── Step 3: Commit message ───────────────────────────────────────────────────
  const commitMsg = overrideCommitMessage || generateCommitMessage(problemData, settings);

  LOG(`Final push target: [${fullPath}]  Commit: "${commitMsg}"`);

  // ── Step 4: Push solution file ───────────────────────────────────────────────
  let pushResult;
  try {
    pushResult = await pushSolution(githubCfg, fullPath, formattedCode, commitMsg);
  } catch (err) {
    ERR("Push error:", err.message);
    pushResult = { ok: false, error: err?.message || "GitHub push failed" };
  }

  // ── Step 5: Determine action and record history ──────────────────────────────
  let historyAction = "Failed";
  let historyError = null;

  if (!pushResult.ok) {
    ERR("Push failed:", pushResult.error);
    historyError = pushResult.error;
  } else if (pushResult.action === "skipped") {
    historyAction = "Already Up To Date";
  } else if (pushResult.action === "updated") {
    historyAction = "Updated";
  } else {
    historyAction = "Created";
  }

  await recordHistory({
    problemId, problemName, language, difficulty,
    topic, folder, filename, filePath: fullPath,
    commitMessage: commitMsg,
    timeComplexity, spaceComplexity,
    link, timestamp: new Date().toISOString(),
    action: historyAction, error: historyError
  });

  // ── Step 6: Maintain Common Repository README.md ─────────────────────────────
  if (pushResult.ok && settings.autoReadme) {
    try {
      const problemRecord = {
        problemId: String(problemId || ""),
        problemNumber: formatProblemNumber(problemId, settings.problemNumberFormat || "0001"),
        problemName,
        difficulty,
        language,
        topics: Array.isArray(topics) && topics.length > 0 ? topics : [topic],
        category: topic,
        filePath: fullPath,
        link,
        timeComplexity,
        spaceComplexity,
        timestamp: new Date().toISOString()
      };

      const autoAdd = settings.autoAddSections !== false;
      if (autoAdd && Array.isArray(settings.readmeSections)) {
        let updatedSections = [...settings.readmeSections];
        let hasNew = false;
        for (const t of problemRecord.topics) {
          if (t && !updatedSections.includes(t)) {
            updatedSections.push(t);
            hasNew = true;
          }
        }
        if (hasNew) {
          settings.readmeSections = updatedSections;
          chrome.storage.sync.set({ readmeSections: updatedSections });
        }
      }

      const pushedProblems = await savePushedProblem(problemRecord);
      const readmeRes = await updateRepoReadme(githubCfg, pushedProblems, settings);

      if (readmeRes.ok) {
        if (readmeRes.action !== "skipped") {
          LOG("Common README.md updated successfully");
          await recordHistory({
            problemId,
            problemName: `README.md (${problemName})`,
            language: "Markdown",
            difficulty,
            topic: "Documentation",
            folder: "",
            filename: "README.md",
            filePath: "README.md",
            commitMessage: "docs: update solutions in README.md",
            timeComplexity: "",
            spaceComplexity: "",
            link,
            timestamp: new Date().toISOString(),
            action: "README Updated",
            error: null
          });
        } else {
          LOG("Common README.md is already up to date");
        }
      } else if (!readmeRes.skipped) {
        WARN("README.md update failed:", readmeRes.error);
        await recordHistory({
          problemId,
          problemName: "README.md Update",
          language: "Markdown",
          difficulty,
          topic: "Documentation",
          folder: "",
          filename: "README.md",
          filePath: "README.md",
          commitMessage: "docs: update solutions in README.md",
          timeComplexity: "",
          spaceComplexity: "",
          link,
          timestamp: new Date().toISOString(),
          action: "Failed",
          error: `README update failed: ${readmeRes.error || "Unknown error"}`
        });
      }
    } catch (e) {
      WARN("Non-fatal error updating common README:", e?.message);
    }
  }

  // ── Step 7: Optional problem-specific README ─────────────────────────────────
  if (settings.createReadme && pushResult.ok && pushResult.action !== "skipped") {
    try {
      const readmeContent = formatReadmeContent({
        problemId, problemName, difficulty, topics, link,
        timeComplexity, spaceComplexity, solutionCode: code, language,
        readmeOptions: settings.readmeOptions
      });
      const existingReadme = await getFile({ ...githubCfg, path: readmePath });
      const readmeSha = existingReadme?.ok && existingReadme.data ? existingReadme.data.sha : null;
      await putFile({
        ...githubCfg,
        path: readmePath,
        content: readmeContent,
        sha: readmeSha,
        message: `docs: README for #${problemId} ${problemName}`
      });
    } catch (e) {
      WARN("Non-fatal: per-problem README push failed:", e.message);
    }
  }

  // ── Step 8: Badge and return ─────────────────────────────────────────────────
  if (!pushResult.ok) {
    await setBadge("!", "#cf222e");
    return { action: "error", filePath: fullPath, filename, error: pushResult.error };
  }

  if (pushResult.action === "skipped") {
    await clearBadge();
    return { action: "skipped", filePath: fullPath, filename };
  }

  await setBadge("✓", "#1a7f37");
  setTimeout(() => clearBadge(), 5000);
  return { action: historyAction.toLowerCase(), filePath: fullPath, filename };
}

// ─── Settings Helper ──────────────────────────────────────────────────────────

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get({
      token: "", owner: "", repo: "", branch: "main",
      solutionContent: {
        problemNumber: true, problemName: true, difficulty: true, topic: true,
        problemLink: true, timeComplexity: false, spaceComplexity: false, solutionCode: true
      },
      createReadme: false,
      readmeOptions: { includeTitle: true, includeDifficulty: true, includeTopics: true, includeLink: true, includeComplexity: true, includeCodeBlock: true },
      commitMode: "default",
      commitTemplate: "Solved LeetCode #{problemNumber}: {problemName}",
      folderMode: "topic",
      customFolderTemplate: "{topic}",
      filenameFormat: "custom",
      customFilenameTemplate: "{problemNumber}-{problemName}",
      problemNumberFormat: "raw",
      problemNameCase: "title",
      problemNameSeparator: "hyphen",
      topicStrategy: "first",
      userPreferredTopic: "",
      duplicateHandling: "replace",

      askBeforePush: { readmeTopics: false, topic: false, folder: false, filename: false, timeComplexity: false, spaceComplexity: false, commitMessage: false },


      // README Management System Defaults
      autoReadme: true,
      readmeTitle: "LeetCode Solutions",
      readmeDescription: "A collection of my coding solutions and problem-solving practice.",
      readmeTemplate: "topic-table",
      readmeStructure: { level1: "Topic", level2: "Problems" },
      readmeTopicStrategy: "first",
      readmeUserPreferredTopic: "",
      readmeSections: [],
      autoAddSections: true,
      readmeDisplayStyle: "table",

      readmeTableColumns: {
        number: true,
        name: true,
        difficulty: true,
        language: true,
        topic: false,
        problemLink: false,
        solutionLink: false,
        timeComplexity: false,
        spaceComplexity: false
      },
      readmeSortBy: "number-asc",
      readmeSectionSort: "alphabetical",
      readmeExistingHandling: "section-markers"
    }, resolve);
  });
}

// ─── Pushed Problems Storage ──────────────────────────────────────────────────

async function savePushedProblem(record) {
  return new Promise(resolve => {
    chrome.storage.local.get({ pushedProblems: [], history: [] }, ({ pushedProblems, history }) => {
      const list = Array.isArray(pushedProblems) ? [...pushedProblems] : [];

      // Backfill valid solved problems from history if missing
      if (Array.isArray(history)) {
        for (const h of history) {
          if (h && h.problemName && !h.problemName.startsWith("README.md") && h.action !== "Failed" && h.filePath) {
            const num = formatProblemNumber(h.problemId, "0001");
            const exists = list.some(p =>
              String(p.problemId || p.problemNumber) === String(h.problemId || num) &&
              p.language === (h.language || "Java")
            );
            if (!exists) {
              list.push({
                problemId: String(h.problemId || ""),
                problemNumber: num,
                problemName: h.problemName,
                difficulty: h.difficulty || "Easy",
                language: h.language || "Java",
                topics: h.topic ? [h.topic] : ["Algorithms"],
                category: h.topic || "Algorithms",
                filePath: h.filePath,
                link: h.link || "",
                timeComplexity: h.timeComplexity || "",
                spaceComplexity: h.spaceComplexity || "",
                timestamp: h.timestamp || new Date().toISOString()
              });
            }
          }
        }
      }

      // Remove any existing entry with same problemId/number and language as new record
      const filtered = list.filter(p => !(
        String(p.problemId || p.problemNumber) === String(record.problemId || record.problemNumber) &&
        p.language === record.language
      ));
      const updated = [record, ...filtered];
      chrome.storage.local.set({ pushedProblems: updated }, () => resolve(updated));
    });
  });
}

// ─── History ──────────────────────────────────────────────────────────────────

async function recordHistory(entry) {
  return new Promise(resolve => {
    chrome.storage.local.get({ history: [] }, ({ history }) => {
      const updated = [entry, ...(history || [])].slice(0, 15);
      chrome.storage.local.set({ history: updated, lastPush: entry }, resolve);
    });
  });
}


// ─── Badge ────────────────────────────────────────────────────────────────────

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
  } catch {}
}

async function clearBadge() {
  try { await chrome.action.setBadgeText({ text: "" }); } catch {}
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function decodeBase64(b64) {
  try { return decodeURIComponent(escape(atob((b64 || "").replace(/\n/g, "")))); } catch { return ""; }
}

function normalise(str) {
  return (str || "").replace(/\r\n/g, "\n").trim();
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.notifications.create("welcome", {
      type: "basic",
      iconUrl: "../icons/icon48.png",
      title: "LeetCode Auto Push Installed!",
      message: "Configure your GitHub settings and start solving!"
    });
  }
  clearBadge();
});
