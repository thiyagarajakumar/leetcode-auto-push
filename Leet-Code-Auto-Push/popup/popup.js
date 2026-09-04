/**
 * popup.js  —  LeetCode Auto Push  v3.1
 *
 * Capabilities:
 *  - Tab navigation (scrollable 6 tabs)
 *  - GitHub wizard: onboarding vs connected dashboard
 *  - Live filename preview with editable custom format, case style, separator, padding
 *  - Common Repository README Management:
 *    * Multiple templates (Topic Table, Language Category, Difficulty, Language, Custom)
 *    * Custom Structure Visual Builder (Level 1 → Level 2 → Level 3)
 *    * Section Manager (Add, Move Up, Move Down, Delete)
 *    * Table columns customization
 *    * Live README Markdown Preview (real vs example data indicator)
 *  - Save/load all settings persistently
 */

import {
  generateFilename,
  generateCommitMessage,
  formatProblemNumber,
  formatProblemName
} from "../utils/filenameUtils.js";

import {
  generateReadmeContent,
  generateExampleProblems
} from "../utils/readmeGenerator.js";

"use strict";

// ─── Preview Problem Dummy ───────────────────────────────────────────────────
const SAMPLE_PROBLEM = {
  problemId: "3",
  problemName: "Longest Palindromic Substring",
  difficulty: "Medium",
  language: "Java",
  topics: ["String", "Dynamic Programming"]
};

// ─── Folder Previews ─────────────────────────────────────────────────────────
const FOLDER_PREVIEWS = {
  topic: `your-repo/\n├── Array/\n│   └── 0001-Two-Sum.java\n├── String/\n│   └── 0003-Longest-Palindromic-Substring.java\n└── Tree/`,
  difficulty: `your-repo/\n├── Easy/\n├── Medium/\n│   └── 0003-Longest-Palindromic-Substring.java\n└── Hard/`,
  language: `your-repo/\n├── Java/\n│   └── 0003-Longest-Palindromic-Substring.java\n├── Python/\n└── JavaScript/`,
  root: `your-repo/\n└── 0003-Longest-Palindromic-Substring.java\n    (all solution files at root level)`,
  custom: `your-repo/\n└── {your-custom-folder}/`
};

// ─── Default Custom Sections ─────────────────────────────────────────────────
let currentSections = ["Array", "String", "Hash Table", "Dynamic Programming", "Tree", "Graph Theory"];

// ─── DOM References ───────────────────────────────────────────────────────────
const tabBtns        = document.querySelectorAll(".tab-btn");
const tabPanels      = document.querySelectorAll(".tab-panel");

// GitHub Wizard
const ghWizard       = document.getElementById("gh-wizard");
const ghForm         = document.getElementById("gh-form");
const wizardConnectBtn = document.getElementById("wizard-connect-btn");
const wizardBackBtn  = document.getElementById("wizard-back-btn");
const ghConnectedBadge = document.getElementById("gh-connected-badge");
const ghSignupLink   = document.getElementById("gh-signup-link");

// GitHub Credentials
const tokenInput     = document.getElementById("token");
const tokenToggle    = document.getElementById("token-toggle");
const ownerInput     = document.getElementById("owner");
const repoInput      = document.getElementById("repo");
const branchInput    = document.getElementById("branch");
const tokenLink      = document.getElementById("token-link");

// Solution Content Checkboxes
const incNumber      = document.getElementById("inc-number");
const incName        = document.getElementById("inc-name");
const incDiff        = document.getElementById("inc-diff");
const incTopic       = document.getElementById("inc-topic");
const incLink        = document.getElementById("inc-link");
const incTime        = document.getElementById("inc-time");
const incSpace       = document.getElementById("inc-space");
const incCode        = document.getElementById("inc-code");
const createReadme   = document.getElementById("create-readme");

// Folder & Commits
const folderMode           = document.getElementById("folder-mode");
const customFolderGroup    = document.getElementById("custom-folder-group");
const customFolderTemplate = document.getElementById("custom-folder-template");
const folderPreviewText    = document.getElementById("folder-preview-text");

const problemNumberFormat  = document.getElementById("problem-number-format");
const problemNameCase      = document.getElementById("problem-name-case");
const problemNameSeparator = document.getElementById("problem-name-separator");
const customFilenameTemplate = document.getElementById("custom-filename-template");
const filenamePreviewText  = document.getElementById("filename-preview-text");

const topicStrategy        = document.getElementById("topic-strategy");
const preferredTopicGroup  = document.getElementById("preferred-topic-group");
const userPreferredTopic   = document.getElementById("user-preferred-topic");
const duplicateHandling    = document.getElementById("duplicate-handling");



// Commit message
const commitRadios         = document.querySelectorAll("input[name='commit-mode']");
const customCommitGroup    = document.getElementById("custom-commit-group");
const commitTemplate       = document.getElementById("commit-template");
const commitPreviewText    = document.getElementById("commit-preview-text");

// README Tab Elements
const autoReadme           = document.getElementById("auto-readme");
const readmeContainer      = document.getElementById("readme-settings-container");
const readmeTitle          = document.getElementById("readme-title");
const readmeDesc           = document.getElementById("readme-desc");
const readmeTemplate       = document.getElementById("readme-template");
const customStructGroup    = document.getElementById("readme-custom-struct-group");
const structLevel1         = document.getElementById("struct-level-1");
const structLevel2         = document.getElementById("struct-level-2");
const structLevel3Row      = document.getElementById("struct-level-3-row");

const readmeSectionList    = document.getElementById("readme-section-list");
const readmeAddSectionBtn  = document.getElementById("readme-add-section-btn");
const autoAddSections      = document.getElementById("auto-add-sections");

const readmeTopicStrategy  = document.getElementById("readme-topic-strategy");
const readmePreferredTopicGroup = document.getElementById("readme-preferred-topic-group");
const readmeUserPreferredTopic  = document.getElementById("readme-user-preferred-topic");

const readmeDisplayStyle   = document.getElementById("readme-display-style");
const readmeColumnsGroup   = document.getElementById("readme-columns-group");
const colCheckboxes        = {
  number: document.getElementById("col-number"),
  name: document.getElementById("col-name"),
  difficulty: document.getElementById("col-diff"),
  language: document.getElementById("col-lang"),
  topic: document.getElementById("col-topic"),
  timeComplexity: document.getElementById("col-time"),
  spaceComplexity: document.getElementById("col-space"),
  problemLink: document.getElementById("col-problem-link"),
  solutionLink: document.getElementById("col-solution-link")
};

const readmeSortBy         = document.getElementById("readme-sort-by");
const readmeSectionSort    = document.getElementById("readme-section-sort");
const readmeExistingHandling = document.getElementById("readme-existing-handling");
const readmeLivePreview    = document.getElementById("readme-live-preview");
const readmePreviewBadge   = document.getElementById("readme-preview-badge");

// Ask Before Push
const askReadmeTopics = document.getElementById("ask-readme-topics");
const askTopic     = document.getElementById("ask-topic");
const askFolder    = document.getElementById("ask-folder");

const askFilename  = document.getElementById("ask-filename");
const askTime      = document.getElementById("ask-time");
const askSpace     = document.getElementById("ask-space");
const askCommit    = document.getElementById("ask-commit");

// Actions & Status
const saveBtn       = document.getElementById("save-btn");
const saveBtnText   = document.getElementById("save-btn-text");
const saveSpinner   = document.getElementById("save-spinner");
const testBtn       = document.getElementById("test-btn");
const formError     = document.getElementById("form-error");
const formSuccess   = document.getElementById("form-success");
const statusBanner  = document.getElementById("status-banner");
const statusIcon    = document.getElementById("status-icon");
const statusText    = document.getElementById("status-text");
const historyList   = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");

// ─── Initialise ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupGitHubWizard();
  setupDynamicVisibility();
  setupChipInserts();
  setupLivePreviews();
  setupSectionManager();

  await loadAndPopulateForm();
  await renderHistory();
  await showLastPushStatus();
  updateLiveReadmePreview();

  tokenLink?.addEventListener("click", e => {
    e.preventDefault();
    chrome.tabs.create({ url: tokenLink.href });
  });

  ghSignupLink?.addEventListener("click", e => {
    e.preventDefault();
    chrome.tabs.create({ url: ghSignupLink.href });
  });
});

// ─── Tab Navigation ──────────────────────────────────────────────────────────

function setupTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      tabPanels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById(btn.dataset.tab)?.classList.add("active");

      btn.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });

      if (btn.dataset.tab === "tab-readme") {
        updateLiveReadmePreview();
      }
    });
  });
}

// ─── GitHub Wizard ───────────────────────────────────────────────────────────

function setupGitHubWizard() {
  wizardConnectBtn?.addEventListener("click", () => {
    showGhForm();
    tokenInput?.focus();
  });

  wizardBackBtn?.addEventListener("click", () => {
    showGhWizard();
  });
}

function showGhForm() {
  ghWizard?.classList.add("hidden");
  ghForm?.classList.remove("hidden");
}

function showGhWizard() {
  ghForm?.classList.add("hidden");
  ghWizard?.classList.remove("hidden");
}

function updateGhConnectionState(token, owner, repo) {
  const isConnected = !!(token && owner && repo);
  if (isConnected) {
    showGhForm();
    ghConnectedBadge?.classList.remove("hidden");
  } else {
    showGhWizard();
    ghConnectedBadge?.classList.add("hidden");
  }
}

// ─── Dynamic Visibility & Variable Chips ──────────────────────────────────────

function setupDynamicVisibility() {
  folderMode?.addEventListener("change", () => {
    customFolderGroup?.classList.toggle("hidden", folderMode.value !== "custom");
    updateFolderPreview();
  });

  topicStrategy?.addEventListener("change", () => {
    preferredTopicGroup?.classList.toggle("hidden", topicStrategy.value !== "user_preferred");
  });

  commitRadios?.forEach(radio => {
    radio.addEventListener("change", () => {
      const isCustom = radio.value === "custom" && radio.checked;
      customCommitGroup?.classList.toggle("hidden", !isCustom);
      updateCommitPreview();
    });
  });

  autoReadme?.addEventListener("change", () => {
    readmeContainer?.classList.toggle("hidden", !autoReadme.checked);
  });

  readmeTemplate?.addEventListener("change", () => {
    const isCustom = readmeTemplate.value === "custom";
    customStructGroup?.classList.toggle("hidden", !isCustom);
    updateLiveReadmePreview();
  });

  structLevel2?.addEventListener("change", () => {
    const isProblems = structLevel2.value === "Problems" || structLevel2.value === "None";
    structLevel3Row?.classList.toggle("hidden", isProblems);
    updateLiveReadmePreview();
  });

  readmeDisplayStyle?.addEventListener("change", () => {
    readmeColumnsGroup?.classList.toggle("hidden", readmeDisplayStyle.value !== "table");
    updateLiveReadmePreview();
  });

  readmeTopicStrategy?.addEventListener("change", () => {
    readmePreferredTopicGroup?.classList.toggle("hidden", readmeTopicStrategy.value !== "user_preferred");
    updateLiveReadmePreview();
  });
}

function setupChipInserts() {
  document.querySelectorAll(".var-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const textToInsert = chip.dataset.insert || chip.textContent.trim();
      const parentGroup = chip.closest(".field-group");
      const targetInput = parentGroup?.querySelector("input[type='text']");
      if (targetInput) {
        insertTextAtCursor(targetInput, textToInsert);
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });
}

function insertTextAtCursor(input, text) {
  const start = input.selectionStart || input.value.length;
  const end   = input.selectionEnd || input.value.length;
  const val   = input.value;
  input.value = val.substring(0, start) + text + val.substring(end);
  input.selectionStart = input.selectionEnd = start + text.length;
  input.focus();
}

// ─── Live Previews ────────────────────────────────────────────────────────────

function setupLivePreviews() {
  // Folder preview
  customFolderTemplate?.addEventListener("input", updateFolderPreview);

  // Filename preview triggers
  problemNumberFormat?.addEventListener("change", updateFilenamePreview);
  problemNameCase?.addEventListener("change", updateFilenamePreview);
  problemNameSeparator?.addEventListener("change", updateFilenamePreview);
  customFilenameTemplate?.addEventListener("input", updateFilenamePreview);

  // Commit preview triggers
  commitTemplate?.addEventListener("input", updateCommitPreview);

  // README preview triggers
  readmeTitle?.addEventListener("input", updateLiveReadmePreview);
  readmeDesc?.addEventListener("input", updateLiveReadmePreview);
  structLevel1?.addEventListener("change", updateLiveReadmePreview);
  structLevel2?.addEventListener("change", updateLiveReadmePreview);
  readmeTopicStrategy?.addEventListener("change", updateLiveReadmePreview);
  readmeUserPreferredTopic?.addEventListener("input", updateLiveReadmePreview);
  readmeSortBy?.addEventListener("change", updateLiveReadmePreview);
  readmeSectionSort?.addEventListener("change", updateLiveReadmePreview);

  Object.values(colCheckboxes).forEach(cb => {
    cb?.addEventListener("change", updateLiveReadmePreview);
  });
}

function updateFolderPreview() {
  if (!folderPreviewText) return;
  const mode = folderMode?.value || "topic";
  if (mode === "custom") {
    const tpl = customFolderTemplate?.value?.trim() || "{topic}";
    const resolved = tpl
      .replace(/\{topic\}/g, "String")
      .replace(/\{difficulty\}/g, "Medium")
      .replace(/\{language\}/g, "Java");
    folderPreviewText.textContent = `your-repo/\n└── ${resolved}/\n    └── 0003-Longest-Palindromic-Substring.java`;
  } else {
    folderPreviewText.textContent = FOLDER_PREVIEWS[mode] || FOLDER_PREVIEWS.topic;
  }
}

function updateFilenamePreview() {
  if (!filenamePreviewText) return;

  const settings = {
    filenameFormat: "custom",
    customFilenameTemplate: customFilenameTemplate?.value || "{problemNumber}-{problemName}",
    problemNumberFormat: problemNumberFormat?.value || "raw",
    problemNameCase: problemNameCase?.value || "title",
    problemNameSeparator: problemNameSeparator?.value || "hyphen"
  };

  const sampleProblem = {
    problemId: "3",
    problemName: "Longest Palindromic Substring",
    language: "Java",
    difficulty: "Medium",
    topics: ["String", "Dynamic Programming"]
  };

  const filename = generateFilename(sampleProblem, settings);
  filenamePreviewText.textContent = filename;
}

function getCheckedCommitMode() {
  for (const r of commitRadios || []) {
    if (r.checked) return r.value;
  }
  return "default";
}

function updateCommitPreview() {
  if (!commitPreviewText) return;
  const mode = getCheckedCommitMode();
  const num = formatProblemNumber("3", problemNumberFormat?.value || "raw");

  let msg = "";
  if (mode === "default") {
    msg = `Solved LeetCode #${num}: Longest Palindromic Substring [Java]`;
  } else if (mode === "short") {
    msg = `Add solution for Longest Palindromic Substring`;
  } else if (mode === "custom") {
    const tpl = (commitTemplate?.value || "Solved LeetCode #{problemNumber}: {problemName}").trim();
    msg = tpl
      .replace(/\{problemNumber\}/g, num)
      .replace(/\{problemName\}/g, "Longest Palindromic Substring")
      .replace(/\{topic\}/g, "String")
      .replace(/\{difficulty\}/g, "Medium")
      .replace(/\{language\}/g, "Java");
  }
  commitPreviewText.textContent = msg;
}

// ─── Section Manager ──────────────────────────────────────────────────────────

function setupSectionManager() {
  readmeAddSectionBtn?.addEventListener("click", () => {
    const name = prompt("Enter section name (e.g. Dynamic Programming, Trees):");
    if (name && name.trim()) {
      const trimmed = name.trim();
      if (!currentSections.includes(trimmed)) {
        currentSections.push(trimmed);
        renderSectionManagerList();
        updateLiveReadmePreview();
      }
    }
  });
}

function renderSectionManagerList() {
  if (!readmeSectionList) return;
  readmeSectionList.innerHTML = "";

  currentSections.forEach((sec, idx) => {
    const item = document.createElement("div");
    item.className = "section-item";
    item.innerHTML = `
      <span class="section-title-text">${escapeHtml(sec)}</span>
      <div class="section-actions">
        <button type="button" class="btn-icon" data-action="up" data-idx="${idx}" title="Move Up" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="btn-icon" data-action="down" data-idx="${idx}" title="Move Down" ${idx === currentSections.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="btn-icon btn-icon-del" data-action="del" data-idx="${idx}" title="Delete">✕</button>
      </div>
    `;

    item.querySelectorAll(".btn-icon").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const i = parseInt(btn.dataset.idx, 10);
        if (action === "up" && i > 0) {
          const temp = currentSections[i];
          currentSections[i] = currentSections[i - 1];
          currentSections[i - 1] = temp;
        } else if (action === "down" && i < currentSections.length - 1) {
          const temp = currentSections[i];
          currentSections[i] = currentSections[i + 1];
          currentSections[i + 1] = temp;
        } else if (action === "del") {
          currentSections.splice(i, 1);
        }
        renderSectionManagerList();
        updateLiveReadmePreview();
      });
    });

    readmeSectionList.appendChild(item);
  });
}

// ─── Live README Preview ──────────────────────────────────────────────────────

async function updateLiveReadmePreview() {
  if (!readmeLivePreview) return;

  const { pushedProblems = [] } = await storageGet({ pushedProblems: [] }, "local");
  const hasRealData = pushedProblems && pushedProblems.length > 0;

  if (readmePreviewBadge) {
    readmePreviewBadge.textContent = hasRealData ? "Real Data Preview" : "Example Preview";
    readmePreviewBadge.style.background = hasRealData ? "#ecfdf5" : "#fef3c7";
    readmePreviewBadge.style.color = hasRealData ? "#047857" : "#92400e";
    readmePreviewBadge.style.borderColor = hasRealData ? "#a7f3d0" : "#fde68a";
  }

  const problemsToUse = hasRealData ? pushedProblems : generateExampleProblems();

  const cols = {};
  Object.keys(colCheckboxes).forEach(k => {
    cols[k] = colCheckboxes[k]?.checked ?? true;
  });

  const settings = {
    readmeTitle: readmeTitle?.value || "LeetCode Solutions",
    readmeDescription: readmeDesc?.value || "",
    readmeTemplate: readmeTemplate?.value || "topic-table",
    readmeStructure: {
      level1: structLevel1?.value || "Topic",
      level2: structLevel2?.value || "Problems"
    },
    readmeTopicStrategy: readmeTopicStrategy?.value || "first",
    readmeUserPreferredTopic: readmeUserPreferredTopic?.value?.trim() || "",
    readmeSections: currentSections,
    readmeDisplayStyle: readmeDisplayStyle?.value || "table",
    readmeTableColumns: cols,
    readmeSortBy: readmeSortBy?.value || "number-asc",
    readmeSectionSort: readmeSectionSort?.value || "alphabetical"
  };

  const md = generateReadmeContent(problemsToUse, settings);
  readmeLivePreview.textContent = md;
}

// ─── Load Settings ────────────────────────────────────────────────────────────

async function loadAndPopulateForm() {
  const defaults = {
    token: "",
    owner: "",
    repo: "",
    branch: "main",
    solutionContent: {
      problemNumber: true,
      problemName:   true,
      difficulty:    true,
      topic:         true,
      problemLink:   true,
      timeComplexity: false,
      spaceComplexity: false,
      solutionCode:  true
    },
    createReadme: false,
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

    commitMode: "default",
    commitTemplate: "Solved LeetCode #{problemNumber}: {problemName}",
    askBeforePush: {
      readmeTopics: false,
      topic: false, folder: false, filename: false,
      timeComplexity: false, spaceComplexity: false, commitMessage: false
    },

    // README defaults
    autoReadme: true,
    readmeTitle: "LeetCode Solutions",
    readmeDescription: "A collection of my coding solutions and problem-solving practice.",
    readmeTemplate: "topic-table",
    readmeStructure: { level1: "Topic", level2: "Problems" },
    readmeSections: ["Array", "String", "Hash Table", "Dynamic Programming", "Tree", "Graph Theory"],
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
  };

  const cfg = await storageGet(defaults);

  // Tab 1: GitHub
  tokenInput.value  = cfg.token  || "";
  ownerInput.value  = cfg.owner  || "";
  repoInput.value   = cfg.repo   || "";
  branchInput.value = cfg.branch || "main";
  updateGhConnectionState(cfg.token, cfg.owner, cfg.repo);

  // Tab 2: Solution Content
  const sc = cfg.solutionContent || defaults.solutionContent;
  incNumber.checked = sc.problemNumber  ?? true;
  incName.checked   = sc.problemName    ?? true;
  incDiff.checked   = sc.difficulty     ?? true;
  incTopic.checked  = sc.topic          ?? true;
  incLink.checked   = sc.problemLink    ?? true;
  incTime.checked   = sc.timeComplexity ?? false;
  incSpace.checked  = sc.spaceComplexity ?? false;
  createReadme.checked = cfg.createReadme ?? false;

  // Tab 3: Folder & Commits
  folderMode.value  = cfg.folderMode || "topic";
  customFolderTemplate.value = cfg.customFolderTemplate || "{topic}";
  customFolderGroup?.classList.toggle("hidden", folderMode.value !== "custom");
  updateFolderPreview();

  problemNumberFormat.value = cfg.problemNumberFormat || "raw";
  problemNameCase.value = cfg.problemNameCase || "title";
  problemNameSeparator.value = cfg.problemNameSeparator || "hyphen";
  customFilenameTemplate.value = cfg.customFilenameTemplate || "{problemNumber}-{problemName}";
  updateFilenamePreview();

  topicStrategy.value  = cfg.topicStrategy || "first";
  userPreferredTopic.value = cfg.userPreferredTopic || "";
  preferredTopicGroup?.classList.toggle("hidden", topicStrategy.value !== "user_preferred");

  duplicateHandling.value = cfg.duplicateHandling || "replace";


  const savedCommitMode = cfg.commitMode || "default";
  commitRadios?.forEach(r => { r.checked = (r.value === savedCommitMode); });
  commitTemplate.value = cfg.commitTemplate || "Solved LeetCode #{problemNumber}: {problemName}";
  customCommitGroup?.classList.toggle("hidden", savedCommitMode !== "custom");
  updateCommitPreview();

  // Tab 4: README
  autoReadme.checked = cfg.autoReadme ?? true;
  readmeContainer?.classList.toggle("hidden", !autoReadme.checked);
  readmeTitle.value = cfg.readmeTitle || "LeetCode Solutions";
  readmeDesc.value  = cfg.readmeDescription !== undefined ? cfg.readmeDescription : "A collection of my coding solutions and problem-solving practice.";
  readmeTemplate.value = cfg.readmeTemplate || "topic-table";

  customStructGroup?.classList.toggle("hidden", readmeTemplate.value !== "custom");
  if (cfg.readmeStructure) {
    structLevel1.value = cfg.readmeStructure.level1 || "Topic";
    structLevel2.value = cfg.readmeStructure.level2 || "Problems";
    structLevel3Row?.classList.toggle("hidden", structLevel2.value === "Problems" || structLevel2.value === "None");
  }

  currentSections = Array.isArray(cfg.readmeSections) && cfg.readmeSections.length > 0
    ? [...cfg.readmeSections]
    : ["Array", "String", "Hash Table", "Dynamic Programming", "Tree", "Graph Theory"];
  if (autoAddSections) autoAddSections.checked = cfg.autoAddSections ?? true;
  renderSectionManagerList();

  if (readmeTopicStrategy) {
    readmeTopicStrategy.value = cfg.readmeTopicStrategy || "first";
  }
  if (readmeUserPreferredTopic) {
    readmeUserPreferredTopic.value = cfg.readmeUserPreferredTopic || "";
  }
  readmePreferredTopicGroup?.classList.toggle("hidden", (readmeTopicStrategy?.value || "first") !== "user_preferred");

  readmeDisplayStyle.value = cfg.readmeDisplayStyle || "table";
  readmeColumnsGroup?.classList.toggle("hidden", readmeDisplayStyle.value !== "table");

  const cols = cfg.readmeTableColumns || defaults.readmeTableColumns;
  Object.keys(colCheckboxes).forEach(k => {
    if (colCheckboxes[k]) colCheckboxes[k].checked = cols[k] ?? false;
  });

  readmeSortBy.value = cfg.readmeSortBy || "number-asc";
  readmeSectionSort.value = cfg.readmeSectionSort || "alphabetical";
  readmeExistingHandling.value = cfg.readmeExistingHandling || "section-markers";

  // Tab 5: Ask Before Push
  const ask = cfg.askBeforePush || defaults.askBeforePush;
  if (askReadmeTopics) askReadmeTopics.checked = ask.readmeTopics ?? cfg.askReadmeTopics ?? cfg.askTopicOnPush ?? false;
  askTopic.checked    = ask.topic          ?? false;
  askFolder.checked   = ask.folder         ?? false;
  askFilename.checked = ask.filename       ?? false;
  askTime.checked     = ask.timeComplexity ?? false;
  askSpace.checked    = ask.spaceComplexity ?? false;
  askCommit.checked   = ask.commitMessage  ?? false;
}

// ─── Save Settings ───────────────────────────────────────────────────────────

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();

  if (ghForm?.classList.contains("hidden")) {
    showGhForm();
    tokenInput?.focus();
    return;
  }

  const token  = tokenInput.value.trim();
  const owner  = ownerInput.value.trim();
  const repo   = repoInput.value.trim();
  const branch = branchInput.value.trim() || "main";

  const errors = validateConfig({ token, owner, repo });
  if (errors.length > 0) { showError(errors.join(" · ")); return; }

  const cols = {};
  Object.keys(colCheckboxes).forEach(k => {
    cols[k] = colCheckboxes[k]?.checked ?? false;
  });

  const newSettings = {
    token, owner, repo, branch,
    solutionContent: {
      problemNumber: incNumber.checked,
      problemName:   incName.checked,
      difficulty:    incDiff.checked,
      topic:         incTopic.checked,
      problemLink:   incLink.checked,
      timeComplexity: incTime.checked,
      spaceComplexity: incSpace.checked,
      solutionCode:  true
    },
    createReadme: createReadme.checked,
    folderMode: folderMode.value,
    customFolderTemplate: customFolderTemplate.value.trim(),
    filenameFormat: "custom",
    customFilenameTemplate: customFilenameTemplate.value.trim() || "{problemNumber}-{problemName}",
    problemNumberFormat: problemNumberFormat.value,
    problemNameCase: problemNameCase.value,
    problemNameSeparator: problemNameSeparator.value,
    topicStrategy: topicStrategy.value,
    userPreferredTopic: userPreferredTopic.value.trim(),
    duplicateHandling: duplicateHandling.value,

    commitMode: getCheckedCommitMode(),
    commitTemplate: commitTemplate.value.trim(),
    askBeforePush: {
      readmeTopics: askReadmeTopics ? askReadmeTopics.checked : false,
      topic:        askTopic.checked,
      folder:       askFolder.checked,
      filename:     askFilename.checked,
      timeComplexity: askTime.checked,
      spaceComplexity: askSpace.checked,
      commitMessage: askCommit.checked
    },

    // README Settings
    autoReadme: autoReadme.checked,
    readmeTitle: readmeTitle.value.trim() || "LeetCode Solutions",
    readmeDescription: readmeDesc.value.trim(),
    readmeTemplate: readmeTemplate.value,
    readmeStructure: {
      level1: structLevel1.value,
      level2: structLevel2.value
    },
    readmeTopicStrategy: readmeTopicStrategy ? readmeTopicStrategy.value : "first",
    readmeUserPreferredTopic: readmeUserPreferredTopic ? readmeUserPreferredTopic.value.trim() : "",
    readmeSections: currentSections,
    autoAddSections: autoAddSections?.checked ?? true,
    readmeDisplayStyle: readmeDisplayStyle.value,

    readmeTableColumns: cols,
    readmeSortBy: readmeSortBy.value,
    readmeSectionSort: readmeSectionSort.value,
    readmeExistingHandling: readmeExistingHandling.value
  };

  setSaving(true);
  try {
    await storageSet(newSettings);
    showSuccess("Settings saved successfully! Extension is ready.");
    setStatusBanner("idle", "⬜", "All preferences saved permanently.");
    updateGhConnectionState(token, owner, repo);
    updateLiveReadmePreview();
  } catch (err) {
    showError("Failed to save: " + (err?.message || "unknown error"));
  } finally {
    setSaving(false);
  }
});

// ─── Test Connection ──────────────────────────────────────────────────────────

testBtn?.addEventListener("click", async () => {
  hideMessages();
  const token = tokenInput.value.trim();
  const owner = ownerInput.value.trim();
  const repo  = repoInput.value.trim();

  if (!token || !owner || !repo) {
    showError("Fill in Token, Username, and Repository first.");
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = "Testing…";
  setStatusBanner("info", "🔄", "Testing GitHub connection…");

  try {
    const result = await testGitHubConnection(token, owner, repo);
    if (result.ok) {
      showSuccess(`✅ Connected! Repo: ${owner}/${repo} (${result.visibility})`);
      setStatusBanner("success", "✅", `Connected to ${owner}/${repo}`);
      ghConnectedBadge?.classList.remove("hidden");
    } else {
      showError(`❌ ${result.error}`);
      setStatusBanner("error", "❌", result.error);
    }
  } catch (err) {
    showError("Network error — check your internet connection.");
    setStatusBanner("error", "❌", "Network error");
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test Connection";
  }
});

async function testGitHubConnection(token, owner, repo) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (res.status === 200) {
      const data = await res.json();
      return { ok: true, visibility: data.private ? "private" : "public" };
    }
    if (res.status === 401) return { ok: false, error: "Invalid token. Generate one with 'repo' scope." };
    if (res.status === 403) return { ok: false, error: "Token lacks 'repo' write permission." };
    if (res.status === 404) return { ok: false, error: `Repository '${owner}/${repo}' not found.` };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.message || `GitHub returned HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: "Network error — " + (err?.message || "") };
  }
}

// ─── Token Show/Hide ──────────────────────────────────────────────────────────

tokenToggle?.addEventListener("click", () => {
  const isHidden = tokenInput.type === "password";
  tokenInput.type = isHidden ? "text" : "password";
  tokenToggle.setAttribute("aria-label", isHidden ? "Hide token" : "Show token");
  tokenToggle.innerHTML = isHidden
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>
       </svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>`;
});
document.addEventListener("DOMContentLoaded", () => {

    const splashScreen = document.getElementById("splashScreen");

    setTimeout(() => {

        splashScreen.style.opacity = "0";

        setTimeout(() => {

            splashScreen.style.display = "none";

        }, 500);

    }, 3000);

});
// ─── History ──────────────────────────────────────────────────────────────────

async function renderHistory() {
  const { history = [] } = await storageGet({ history: [] }, "local");

  if (history.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No activity yet. Solve a problem to get started!</p>';
    return;
  }

  historyList.innerHTML = "";
  for (const entry of history.slice(0, 15)) {
    historyList.appendChild(buildHistoryEntry(entry));
  }

}

function buildHistoryEntry(entry) {
  const div = document.createElement("div");
  div.className = "history-entry";

  const actionStr = entry.action || "Created";
  const actionIcon = actionStr === "Failed" || actionStr === "error" ? "❌"
                   : actionStr === "README Updated" ? "📄"
                   : actionStr === "Already Up To Date" || actionStr === "Skipped" ? "📋"
                   : actionStr === "Updated" ? "🔄"
                   : "✅";

  const actionClassKey = actionStr.toLowerCase().replace(/\s+/g, "-");
  const diffBadge  = entry.difficulty ? `<span class="badge badge-${entry.difficulty.toLowerCase()}">${escapeHtml(entry.difficulty)}</span>` : "";
  const langBadge  = entry.language   ? `<span class="badge badge-lang">${escapeHtml(entry.language)}</span>` : "";
  const topicBadge = entry.topic      ? `<span class="badge badge-topic">${escapeHtml(entry.topic)}</span>` : "";

  const timeStr     = formatTime(entry.timestamp);
  const displayPath = entry.filePath || (entry.error ? `Error: ${entry.error}` : "—");

  const hasComplexity = entry.timeComplexity || entry.spaceComplexity;
  const complexityRow = hasComplexity
    ? `<div class="hentry-row">
         <span class="hentry-label">⏱</span><span class="hentry-val">${escapeHtml(entry.timeComplexity || "—")}</span>
         <span class="hentry-sep">·</span>
         <span class="hentry-label">💾</span><span class="hentry-val">${escapeHtml(entry.spaceComplexity || "—")}</span>
       </div>` : "";

  const commitRow = entry.commitMessage
    ? `<div class="hentry-row hentry-commit" title="${escapeHtml(entry.commitMessage)}">
         <span class="hentry-label">💬</span>
         <span class="hentry-val hentry-truncate">${escapeHtml(entry.commitMessage)}</span>
       </div>` : "";

  const errorRow = (actionStr === "Failed" || actionStr === "error") && entry.error
    ? `<div class="hentry-row hentry-error">
         <span class="hentry-label">⚠</span>
         <span class="hentry-val">${escapeHtml(entry.error)}</span>
       </div>` : "";

  div.innerHTML = `
    <span class="history-entry-icon">${actionIcon}</span>
    <div class="history-entry-body">
      <span class="history-entry-path" title="${escapeHtml(entry.filePath || '')}">📄 ${escapeHtml(displayPath)}</span>
      <div class="history-entry-meta">
        <span class="badge badge-action-${actionClassKey}">${escapeHtml(actionStr)}</span>
        ${topicBadge}${diffBadge}${langBadge}
        <span class="history-entry-time">${timeStr}</span>
      </div>
      ${complexityRow}${commitRow}${errorRow}
    </div>`;

  return div;
}

clearHistoryBtn?.addEventListener("click", async () => {
  await storageSet({ history: [], lastPush: null, pushedProblems: [] }, "local");
  historyList.innerHTML = '<p class="history-empty">History cleared.</p>';
  updateLiveReadmePreview();
});

// ─── Status Banner ────────────────────────────────────────────────────────────

async function showLastPushStatus() {
  const { lastPush } = await storageGet({ lastPush: null }, "local");
  if (!lastPush) return;

  if (lastPush.action === "Failed" || lastPush.action === "error") {
    setStatusBanner("error", "❌", `Last push failed: ${lastPush.error || "Unknown error"}`);
  } else if (lastPush.action === "Already Up To Date" || lastPush.action === "Skipped") {
    setStatusBanner("skipped", "📋", `Already up to date: ${lastPush.filePath}`);
  } else if (lastPush.action === "README Updated") {
    setStatusBanner("success", "📄", `README.md updated on GitHub`);
  } else {
    setStatusBanner("success", "✅", `Last push: ${lastPush.filePath}`);
  }
}

function setStatusBanner(type, icon, text) {
  statusBanner.className = `status-banner status-${type}`;
  statusIcon.textContent = icon;
  statusText.textContent = text;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "PUSH_RESULT") return;
  if (msg.action === "error" || msg.action === "failed") {
    setStatusBanner("error", "❌", `Push failed: ${msg.error}`);
  } else if (msg.action === "skipped" || msg.action === "Already Up To Date") {
    setStatusBanner("skipped", "📋", `Already up to date: ${msg.filePath}`);
  } else {
    setStatusBanner("success", "✅", `Pushed: ${msg.filePath}`);
  }
  renderHistory();
  updateLiveReadmePreview();
});

// ─── Utilities ────────────────────────────────────────────────────────────────

function validateConfig({ token, owner, repo }) {
  const errors = [];
  if (!token) errors.push("GitHub token is required.");
  if (!owner) errors.push("GitHub username is required.");
  if (!repo)  errors.push("Repository name is required.");
  return errors;
}

function showError(msg) {
  formError.textContent = msg;
  formError.classList.remove("hidden");
  formSuccess.classList.add("hidden");
}

function showSuccess(msg) {
  formSuccess.textContent = msg;
  formSuccess.classList.remove("hidden");
  formError.classList.add("hidden");
}

function hideMessages() {
  formError.classList.add("hidden");
  formSuccess.classList.add("hidden");
}

function setSaving(saving) {
  saveBtn.disabled = saving;
  saveBtnText.textContent = saving ? "Saving…" : "Save All Settings";
  saveSpinner.classList.toggle("hidden", !saving);
}

function formatTime(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const diff = Date.now() - d.getTime();
    if (diff < 60000)   return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000)return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  } catch { return ""; }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function storageGet(defaults, area = "sync") {
  return new Promise(resolve => chrome.storage[area].get(defaults, resolve));
}

function storageSet(data, area = "sync") {
  return new Promise((resolve, reject) => {
    chrome.storage[area].set(data, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}
