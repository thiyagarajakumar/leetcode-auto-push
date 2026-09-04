/**
 * leetcode.js  —  Content Script  (v10)
 *
 * Capabilities:
 *  - Accurate problem number detection (never defaults to 1)
 *  - Supports problem number padding, name case styles, separators
 *  - Editable custom format box & pre-filled Ask Before Push modal
 *  - User can manually edit problem number / filename if needed
 */

(function () {
  "use strict";

  const LOG  = (...a) => console.log("[LeetCode Auto Push]", ...a);
  const WARN = (...a) => console.warn("[LeetCode Auto Push]", ...a);
  const ERR  = (...a) => console.error("[LeetCode Auto Push]", ...a);

  const WIDGET_ID      = "leetcode-github-push-widget";
  const PUSH_TIMEOUT   = 30000;

  let acceptedSubmission   = null;
  let currentState         = "idle";
  let pushTimeout          = null;
  let isDragging           = false;
  let isPushInProgress     = false;
  let statusObserver       = null;
  let lastHandledId        = null;
  let metaCache            = null;

  // ─────────────────────────────────────────────────────────────────────
  // INLINE FILENAME & FORMATTING HELPERS (mirrors filenameUtils.js)
  // ─────────────────────────────────────────────────────────────────────

  const LANG_EXT = {
    java:"java", python:"py", python3:"py",
    "c++":"cpp", cpp:"cpp", c:"c",
    javascript:"js", js:"js", typescript:"ts", ts:"ts",
    go:"go", golang:"go", rust:"rs",
    "c#":"cs", csharp:"cs",
    swift:"swift", kotlin:"kt", ruby:"rb", sql:"sql", scala:"scala",
    php:"php", dart:"dart", r:"r"
  };

  function getExt(lang) {
    return LANG_EXT[(lang || "").toLowerCase().trim()] || "java";
  }

  function formatProblemNumber(rawId, format = "raw") {
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

  function formatProblemName(name, caseStyle = "title", separator = "hyphen") {
    let cleaned = String(name || "")
      .replace(/^\d+[\s.\-_]+/, "")
      .replace(/[^a-zA-Z0-9\s\-_]/g, " ")
      .trim();

    const words = cleaned.split(/[\s\-_]+/).filter(Boolean);
    if (words.length === 0) return "Solution";

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

    switch (separator) {
      case "underscore": return styledWords.join("_");
      case "space":      return styledWords.join(" ");
      case "none":       return styledWords.join("");
      case "hyphen":
      default:           return styledWords.join("-");
    }
  }

  function getPrimaryTopic(topics, strategy, preferred) {
    const list = Array.isArray(topics) ? topics : [];
    if (!list.length) return preferred || "Algorithms";
    if (strategy === "user_preferred" && preferred) {
      const m = list.find(t => t.toLowerCase() === preferred.toLowerCase());
      if (m) return m;
    }
    if (strategy === "all") return list.join("-");
    return list[0] || "Algorithms";
  }

  function generateBasename(problemData, settings = {}) {
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

  function generateFilename(problemData, settings) {
    return `${generateBasename(problemData, settings)}.${getExt(problemData.language)}`;
  }

  function resolveFolder(settings, topic, difficulty, language) {
    const safeTopic = (topic || "Algorithms").replace(/[/\\]+/g, "-");
    switch (settings.folderMode) {
      case "topic":      return safeTopic;
      case "difficulty": return difficulty || "Easy";
      case "language":   return language   || "Java";
      case "root":       return "";
      case "custom":
        return (settings.customFolderTemplate || "{topic}")
          .replace(/\{topic\}/g, safeTopic)
          .replace(/\{difficulty\}/g, difficulty || "Easy")
          .replace(/\{language\}/g, language || "Java")
          .replace(/^\/+|\/+$/g, "");
      default:           return safeTopic;
    }
  }

  function generateCommitMessage(problemData, settings) {
    const num = formatProblemNumber(problemData.problemId, settings.problemNumberFormat || "raw");
    const topic = getPrimaryTopic(problemData.topics, settings.topicStrategy, settings.userPreferredTopic);

    if (settings.commitMode === "short") {
      return `Add solution for ${problemData.problemName}`;
    }
    if (settings.commitMode === "custom" && settings.commitTemplate) {
      return settings.commitTemplate
        .replace(/\{problemNumber\}/g, num)
        .replace(/\{problemName\}/g, problemData.problemName || "")
        .replace(/\{topic\}/g, topic)
        .replace(/\{difficulty\}/g, problemData.difficulty || "")
        .replace(/\{language\}/g, problemData.language || "");
    }
    return num
      ? `Solved LeetCode #${num}: ${problemData.problemName} [${problemData.language}]`
      : `Solved LeetCode: ${problemData.problemName} [${problemData.language}]`;
  }

  function estimateComplexity(code) {
    const lower = (code || "").toLowerCase();
    const hasNested = /(for|while)[\s\S]{0,200}(for|while)/.test(lower);
    const hasLoop   = /\bfor\b|\bwhile\b/.test(lower);
    const hasMap    = /\bmap\b|\bset\b|\bdict\b|\bhashmap\b/.test(lower);
    return {
      time:  hasNested ? "O(n²)" : hasLoop ? "O(n)" : "O(1)",
      space: hasMap || lower.includes("new ") ? "O(n)" : "O(1)"
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // WIDGET INJECTION
  // ─────────────────────────────────────────────────────────────────────

  function injectWidget() {
    if (document.getElementById(WIDGET_ID)) return;
    if (!location.pathname.includes("/problems/")) return;

    injectStyles();
    const w = document.createElement("div");
    w.id = WIDGET_ID;
    w.setAttribute("role", "region");
    w.setAttribute("aria-label", "LeetCode Auto Push");
    w.innerHTML = `
      <div class="lcgh-handle" title="Drag">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </div>
      <button type="button" id="lcgh-btn" class="lcgh-btn idle">
        <span id="lcgh-icon">⚪</span><span id="lcgh-label">Push to GitHub</span>
      </button>`;

    document.body.appendChild(w);
    restorePos(w);
    makeDraggable(w);
    w.querySelector("#lcgh-btn").addEventListener("click", handleManualPush);
  }

  function injectStyles() {
    if (document.getElementById("lcgh-styles")) return;
    const s = document.createElement("style");
    s.id = "lcgh-styles";
    s.textContent = `
      #${WIDGET_ID}{position:fixed;bottom:24px;right:24px;z-index:999990;
        display:inline-flex;align-items:center;background:#fff;
        border:1.5px solid #d0d7de;border-radius:8px;
        box-shadow:0 4px 16px rgba(0,0,0,.12);padding:3px;
        user-select:none;transition:box-shadow .2s,border-color .2s}
      #${WIDGET_ID}:hover{border-color:#0969da;box-shadow:0 6px 20px rgba(0,0,0,.18)}
      .lcgh-handle{display:flex;align-items:center;justify-content:center;
        width:18px;height:28px;cursor:grab;color:#8c959f;padding-left:3px}
      .lcgh-handle:active{cursor:grabbing}
      .lcgh-btn{display:inline-flex;align-items:center;gap:6px;padding:0 10px;
        height:28px;border-radius:6px;border:1px solid transparent;
        font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        transition:all .2s;background:#fff;color:#24292f}
      .lcgh-btn.idle:hover{background:#f6f8fa;color:#0969da}
      .lcgh-btn.submitting{background:#fff8c5;border-color:#d4a72c;color:#9a6700;cursor:default}
      .lcgh-btn.pushing{background:#ddf4ff;border-color:#54aeff;color:#0969da;cursor:default}
      .lcgh-btn.success{background:#2da44e;color:#fff;border-color:#2da44e}
      .lcgh-btn.failed{background:#ffebe9;border-color:#ff8182;color:#cf222e}
      .lcgh-btn.skipped{background:#f6f8fa;border-color:#d0d7de;color:#57606a}
      .lcgh-spin{width:12px;height:12px;border:2px solid currentColor;
        border-top-color:transparent;border-radius:50%;animation:lcgh-r .7s linear infinite;display:inline-block}
      @keyframes lcgh-r{to{transform:rotate(360deg)}}
      @keyframes lcgh-in{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
      #lcgh-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);
        z-index:9999990;display:flex;align-items:center;justify-content:center}
      .lcgh-modal{background:#fff;border-radius:10px;
        box-shadow:0 12px 32px rgba(0,0,0,.25);width:380px;max-width:92vw;
        padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
      .lcgh-modal h3{font-size:14px;font-weight:700;color:#1f2328;margin:0 0 14px}
      .lcgh-field{margin-bottom:12px}
      .lcgh-field label{display:block;font-size:11px;font-weight:700;color:#57606a;
        text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px}
      .lcgh-field input,.lcgh-field select{width:100%;box-sizing:border-box;
        border:1.5px solid #d0d7de;border-radius:6px;padding:7px 10px;
        font-size:12px;outline:none;font-family:inherit}
      .lcgh-field input:focus,.lcgh-field select:focus{border-color:#0969da}
      .lcgh-desc-hint{font-size:11px;color:#57606a;margin-bottom:6px}
      .lcgh-topic-checklist{display:flex;flex-direction:column;gap:6px;max-height:130px;overflow-y:auto;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:8px}
      .lcgh-topic-item{display:flex;align-items:center;gap:8px;font-size:12px;color:#24292f;cursor:pointer}
      .lcgh-topic-item input[type="checkbox"]{width:14px;height:14px;accent-color:#0969da;cursor:pointer}
      .lcgh-alert{font-size:11px;color:#cf222e;background:#ffebe9;border:1px solid #ff8182;border-radius:5px;padding:6px 10px;margin-bottom:10px}

      .lcgh-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
      .lcgh-actions button{border:none;border-radius:6px;padding:7px 16px;
        font-size:12px;font-weight:600;cursor:pointer}
      .lcgh-cancel{background:#f6f8fa;color:#24292f;border:1px solid #d0d7de!important}
      .lcgh-confirm{background:#0969da;color:#fff}
    `;
    document.head.appendChild(s);
  }

  function setState(state, label) {
    currentState = state;
    const btn = document.querySelector("#lcgh-btn");
    if (!btn) return;
    btn.className = `lcgh-btn ${state}`;

    const icons  = { idle:"⚪", submitting:"🟡", pushing:"🚀", success:"✅", failed:"❌", skipped:"📋" };
    const labels = {
      idle:       "Push to GitHub",
      submitting: "Submitting...",
      pushing:    "Pushing to GitHub...",
      success:    "Pushed to GitHub",
      failed:     label || "Push Failed — Retry",
      skipped:    "Already on GitHub"
    };

    const isSpinner = state === "pushing" || state === "submitting";
    btn.innerHTML = isSpinner
      ? `<span class="lcgh-spin"></span><span>${labels[state]}</span>`
      : `<span>${icons[state] || "⚪"}</span><span>${label || labels[state]}</span>`;
  }

  function makeDraggable(el) {
    const handle = el.querySelector(".lcgh-handle");
    let sx = 0, sy = 0, il = 0, it = 0;

    handle.addEventListener("mousedown", e => {
      e.preventDefault();
      isDragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      il = r.left; it = r.top;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    function onMove(e) {
      if (!isDragging) return;
      const newL = Math.max(10, Math.min(il + e.clientX - sx, window.innerWidth  - el.offsetWidth  - 10));
      const newT = Math.max(10, Math.min(it + e.clientY - sy, window.innerHeight - el.offsetHeight - 10));
      el.style.left = newL + "px"; el.style.top = newT + "px";
      el.style.right = "auto"; el.style.bottom = "auto";
    }

    function onUp() {
      isDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const r = el.getBoundingClientRect();
      chrome.storage.local.set({ widgetPos: { x: r.left, y: r.top } });
    }
  }

  function restorePos(el) {
    chrome.storage.local.get({ widgetPos: null }, ({ widgetPos }) => {
      if (!widgetPos) return;
      const left = Math.max(10, Math.min(widgetPos.x, window.innerWidth  - el.offsetWidth  - 10));
      const top  = Math.max(10, Math.min(widgetPos.y, window.innerHeight - el.offsetHeight - 10));
      el.style.left = left + "px"; el.style.top = top + "px";
      el.style.right = "auto"; el.style.bottom = "auto";
    });
  }

  function startTimeout() {
    clearTimeout(pushTimeout);
    pushTimeout = setTimeout(() => {
      if (["pushing","submitting","accepted"].includes(currentState)) {
        setState("failed", "Timed out");
        showToast("error", "", "Push timed out — check network & GitHub settings.");
        isPushInProgress = false;
      }
    }, PUSH_TIMEOUT);
  }

  // ─────────────────────────────────────────────────────────────────────
  // OFFICIAL ACCEPTED DETECTION
  // ─────────────────────────────────────────────────────────────────────

  window.addEventListener("message", async event => {
    if (!event.data || event.data.type !== "LEETCODE_OFFICIAL_ACCEPTED") return;
    const { payload } = event.data;
    await handleAcceptedEvent(payload, "GraphQL");
  });

  async function handleAcceptedEvent(payload, source) {
    if (isPushInProgress) return;
    const sid = String(payload?.submissionId || Date.now());
    if (sid === lastHandledId) return;

    LOG(`Accepted detected via ${source}. Submission: ${sid}`);
    isPushInProgress = true;
    lastHandledId = sid;
    disconnectObserver();

    const meta = getMeta(payload);
    const code = payload?.code || (await requestEditorCode()) || scrapeCode();

    if (!code || !code.trim()) {
      WARN("Empty code — aborting"); isPushInProgress = false; return;
    }

    const problemId   = meta.problemId || "";
    const problemName = meta.problemName || "Unknown";
    const difficulty  = meta.difficulty || "Easy";
    const topics      = meta.topics || [];
    const language    = payload?.lang || meta.language || "Java";
    const slug        = meta.slug || getSlug();

    acceptedSubmission = {
      submissionId: sid,
      problemId,
      problemName,
      difficulty,
      topics,
      language,
      code,
      link: `https://leetcode.com/problems/${slug}/`,
      slug
    };

    setState("accepted");
    proceedToPush(acceptedSubmission);
  }

  async function requestEditorCode() {
    return new Promise(resolve => {
      const reqId = Date.now();
      const fn = e => {
        if (e.data?.type === "RESPONSE_MONACO_CODE" && e.data.requestId === reqId) {
          window.removeEventListener("message", fn);
          resolve(e.data.code || "");
        }
      };
      window.addEventListener("message", fn);
      window.postMessage({ type: "REQUEST_MONACO_CODE", requestId: reqId }, "*");
      setTimeout(() => resolve(""), 800);
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // MAIN PUSH WORKFLOW
  // ─────────────────────────────────────────────────────────────────────

  async function proceedToPush(subData, isManual = false) {
    const settings = await loadSettings();
    const { problemId, problemName, language, topics, difficulty, code } = subData;

    // Complexity
    const est = estimateComplexity(code);
    const timeComplexity  = est.time  || "";
    const spaceComplexity = est.space || "";

    // Topic + folder
    const topic  = getPrimaryTopic(topics, settings.topicStrategy, settings.userPreferredTopic);
    const folder = resolveFolder(settings, topic, difficulty, language);

    // Filename & commit
    const filename  = generateFilename({ problemId, problemName, language, difficulty, topics }, settings);
    const fullPath  = folder ? `${folder}/${filename}` : filename;
    const commitMsg = generateCommitMessage({ problemId, problemName, language, topics, difficulty }, settings);

    const ctx = {
      topic, folder, filename, fullPath, commitMsg,
      timeComplexity, spaceComplexity, settings, subData, isManual
    };

    // Ask Before Push modal
    const ask = settings.askBeforePush || {};
    const askReadmeTopics = Boolean(ask.readmeTopics || settings.askReadmeTopics || settings.askTopicOnPush);
    const askTopic = Boolean(ask.topic || askReadmeTopics);
    const needsCx = settings.solutionContent?.timeComplexity || settings.solutionContent?.spaceComplexity;

    // Show modal if user asked OR if problemId could not be detected automatically!
    const missingId = !problemId || problemId.trim() === "";
    const showModal = missingId || askTopic || ask.folder || ask.filename || ask.commitMessage
      || (needsCx && (ask.timeComplexity || ask.spaceComplexity));

    if (showModal) {
      openAskModal(ctx, needsCx, ask, missingId, askTopic);
    } else {
      doDispatch(ctx);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // ASK BEFORE PUSH MODAL
  // ─────────────────────────────────────────────────────────────────────

  function openAskModal(ctx, needsCx, ask, missingId = false, askTopic = false) {
    document.getElementById("lcgh-modal-bg")?.remove();

    const bg = document.createElement("div");
    bg.id = "lcgh-modal-bg";

    let fields = "";

    if (missingId) {
      fields += `
        <div class="lcgh-alert">⚠️ Unable to detect problem number automatically. Please verify below.</div>
        <div class="lcgh-field">
          <label>Problem Number <span style="color:#cf222e">*</span></label>
          <input id="abp-problemid" type="text" value="${esc(ctx.subData.problemId || '')}" placeholder="e.g. 3 or 0003" />
        </div>
      `;
    }

    const autoAddDisabled = ctx.settings.autoAddSections === false && ctx.settings.readmeSectionSort === "custom" && Array.isArray(ctx.settings.readmeSections);
    let missingTopic = "";
    if (autoAddDisabled && ctx.topic && !ctx.settings.readmeSections.includes(ctx.topic)) {
      missingTopic = ctx.topic;
      fields += `
        <div class="lcgh-alert" id="abp-missing-topic-alert" style="background:#fff8c5;border-color:#d4a72c;color:#7d4e00;">
          The selected topic "<strong>${esc(missingTopic)}</strong>" is not currently in your README sections.
          <div style="margin-top:6px;display:flex;gap:6px;">
            <button type="button" id="abp-add-missing-topic-btn" style="background:#0969da;color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;">+ Add "${esc(missingTopic)}"</button>
          </div>
        </div>
      `;
    }


    if (askTopic) {
      const availableTopics = Array.isArray(ctx.subData.topics) && ctx.subData.topics.length > 0
        ? ctx.subData.topics
        : [ctx.topic || "Algorithms"];

      let defaultChecked = [];
      if (ctx.settings.topicStrategy === "all") {
        defaultChecked = availableTopics;
      } else if (ctx.settings.topicStrategy === "user_preferred" && ctx.settings.userPreferredTopic) {
        const match = availableTopics.find(t => t.toLowerCase() === ctx.settings.userPreferredTopic.toLowerCase());
        defaultChecked = match ? [match] : [availableTopics[0]];
      } else {
        defaultChecked = [availableTopics[0]];
      }

      const topicItems = availableTopics.map(t => {
        const checked = defaultChecked.includes(t) ? "checked" : "";
        return `
          <label class="lcgh-topic-item">
            <input type="checkbox" name="abp-topic-item" value="${esc(t)}" ${checked} />
            <span>${esc(t)}</span>
          </label>
        `;
      }).join("");

      fields += `
        <div class="lcgh-field">
          <label>README Topics</label>
          <div class="lcgh-desc-hint">Select the topic(s) to include in Common README.md:</div>
          <div class="lcgh-topic-checklist" id="abp-topic-checklist">
            ${topicItems}
          </div>
        </div>
      `;
    }


    if (ask.folder) {
      fields += `<div class="lcgh-field"><label>Folder</label><input id="abp-folder" type="text" value="${esc(ctx.folder)}" /></div>`;
    }

    if (ask.filename || missingId) {
      fields += `<div class="lcgh-field"><label>File Name</label><input id="abp-filename" type="text" value="${esc(ctx.filename)}" /></div>`;
    }

    if (needsCx && ask.timeComplexity) {
      fields += `<div class="lcgh-field"><label>Time Complexity</label><input id="abp-time" type="text" value="${esc(ctx.timeComplexity)}" /></div>`;
    }

    if (needsCx && ask.spaceComplexity) {
      fields += `<div class="lcgh-field"><label>Space Complexity</label><input id="abp-space" type="text" value="${esc(ctx.spaceComplexity)}" /></div>`;
    }

    if (ask.commitMessage) {
      fields += `<div class="lcgh-field"><label>Commit Message</label><input id="abp-commit" type="text" value="${esc(ctx.commitMsg)}" /></div>`;
    }

    bg.innerHTML = `<div class="lcgh-modal">
      <h3>🚀 Push to GitHub</h3>
      ${fields}
      <div class="lcgh-actions">
        <button class="lcgh-cancel" id="abp-cancel">Cancel</button>
        <button class="lcgh-confirm" id="abp-ok">Push to GitHub</button>
      </div>
    </div>`;

    document.body.appendChild(bg);

    // Live update filename in modal if user changes problem number
    const idInput = bg.querySelector("#abp-problemid");
    const fnInput = bg.querySelector("#abp-filename");

    if (idInput && fnInput) {
      idInput.addEventListener("input", () => {
        ctx.subData.problemId = idInput.value.trim();
        const updatedFn = generateFilename(ctx.subData, ctx.settings);
        fnInput.value = updatedFn;
      });
    }

    const addMissingBtn = bg.querySelector("#abp-add-missing-topic-btn");
    if (addMissingBtn) {
      addMissingBtn.onclick = () => {
        if (!ctx.settings.readmeSections.includes(missingTopic)) {
          ctx.settings.readmeSections.push(missingTopic);
          chrome.storage.sync.set({ readmeSections: ctx.settings.readmeSections });
        }
        bg.querySelector("#abp-missing-topic-alert")?.remove();
      };
    }

    bg.querySelector("#abp-cancel").onclick = () => {
      bg.remove(); setState("idle"); isPushInProgress = false;
    };


    const okBtn = bg.querySelector("#abp-ok");
    okBtn.onclick = () => {
      if (okBtn.disabled) return;
      if (idInput) {
        const val = idInput.value.trim();
        if (!val) {
          idInput.focus();
          return;
        }
        ctx.subData.problemId = val;
      }

      okBtn.disabled = true;
      okBtn.style.opacity = "0.7";
      okBtn.style.cursor = "not-allowed";
      okBtn.textContent = "Pushing...";

      if (askTopic) {
        const checkedEls = bg.querySelectorAll("#abp-topic-checklist input[type='checkbox']:checked");
        const selectedTopics = Array.from(checkedEls).map(el => el.value);
        if (selectedTopics.length > 0) {
          ctx.subData.topics = selectedTopics;
          ctx.topic = selectedTopics[0];
          if (ctx.settings.folderMode === "topic") {
            ctx.folder = resolveFolder(ctx.settings, ctx.topic, ctx.subData.difficulty, ctx.subData.language);
          }
        }
      }
      if (ask.folder) {
        ctx.folder = bg.querySelector("#abp-folder")?.value.trim() || ctx.folder;
      }
      if (fnInput) {
        ctx.filename = fnInput.value.trim() || ctx.filename;
      }
      if (bg.querySelector("#abp-time"))   ctx.timeComplexity  = bg.querySelector("#abp-time").value.trim();
      if (bg.querySelector("#abp-space"))  ctx.spaceComplexity = bg.querySelector("#abp-space").value.trim();
      if (ask.commitMessage) {
        ctx.commitMsg = bg.querySelector("#abp-commit")?.value.trim() || ctx.commitMsg;
      }

      ctx.fullPath = ctx.folder ? `${ctx.folder}/${ctx.filename}` : ctx.filename;

      bg.remove();
      doDispatch(ctx);
    };
  }


  // ─────────────────────────────────────────────────────────────────────
  // DISPATCH TO BACKGROUND
  // ─────────────────────────────────────────────────────────────────────

  function doDispatch(ctx) {
    const { subData, folder, filename, commitMsg, timeComplexity, spaceComplexity } = ctx;

    setState("pushing");
    startTimeout();
    showToast("preparing", subData.problemName, null);

    const msg = {
      type: "LEETCODE_ACCEPTED",
      payload: {
        ...subData,
        timeComplexity,
        spaceComplexity,
        overrideFolder:        folder        || "",
        overrideFilename:      filename      || "",
        overrideCommitMessage: commitMsg     || "",
        detectedAt: new Date().toISOString(),
        pageUrl: location.href
      }
    };

    chrome.runtime.sendMessage(msg, response => {
      clearTimeout(pushTimeout);
      isPushInProgress = false;

      if (chrome.runtime.lastError) {
        ERR("BG error:", chrome.runtime.lastError.message);
        setState("failed", "Extension Error");
        showToast("error", "", chrome.runtime.lastError.message);
        return;
      }

      if (!response?.ok || response.action === "error") {
        setState("failed", "Push Failed");
        showToast("error", response?.filePath, response?.error || "Unknown error");
      } else if (response.action === "skipped") {
        setState("skipped");
        showToast("skipped", response.filePath, null);
      } else {
        setState("success");
        showToast("success", subData.problemName, response.filePath);
      }
    });
  }

  let lastManualPushTime = 0;
  async function handleManualPush() {
    const now = Date.now();
    if (now - lastManualPushTime < 1500) {
      LOG("Manual push ignored — debounced");
      return;
    }
    if (["pushing","submitting"].includes(currentState) || isPushInProgress) return;
    lastManualPushTime = now;

    if (!acceptedSubmission) {
      const code = await requestEditorCode() || scrapeCode();
      if (!code?.trim()) {
        showToast("error", "", "No code found. Submit on LeetCode first."); return;
      }
      const meta = getMeta();
      acceptedSubmission = {
        submissionId: `manual-${Date.now()}`,
        ...meta, code,
        link: `https://leetcode.com/problems/${getSlug()}/`,
        slug: getSlug()
      };
    }
    isPushInProgress = true;
    proceedToPush(acceptedSubmission, true);
  }

  // ─────────────────────────────────────────────────────────────────────
  // DOM OBSERVATION FALLBACK
  // ─────────────────────────────────────────────────────────────────────

  function attachSubmitListener() {
    const sels = ['[data-e2e-locator="console-submit-button"]', 'button[class*="submit"]'];
    sels.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        if (btn.closest(`#${WIDGET_ID}`) || btn.dataset.lcghBound) return;
        btn.dataset.lcghBound = "1";
        btn.addEventListener("click", () => {
          if (btn.textContent.trim().toLowerCase().includes("submit")) {
            setState("submitting");
            startDomObserver();
            setTimeout(() => { if (currentState === "submitting") setState("idle"); }, 30000);
          }
        });
      });
    });
  }

  function startDomObserver() {
    disconnectObserver();
    statusObserver = new MutationObserver(async () => {
      const el = document.querySelector('[data-e2e-locator="submission-result"],[class*="accepted"],[class*="Accepted"]');
      if (el && el.textContent.toLowerCase().includes("accepted") && !isPushInProgress) {
        disconnectObserver();
        setTimeout(async () => {
          if (isPushInProgress) return;
          const code = await requestEditorCode() || scrapeCode();
          if (code) {
            handleAcceptedEvent({
              submissionId: `dom-${Date.now()}`,
              code, lang: getMeta().language, question: null
            }, "DOM fallback");
          }
        }, 500);
      }
    });
    statusObserver.observe(document.body, { childList: true, subtree: true });
  }

  function disconnectObserver() {
    if (statusObserver) { statusObserver.disconnect(); statusObserver = null; }
  }

  // ─────────────────────────────────────────────────────────────────────
  // ACCURATE METADATA DETECTION
  // ─────────────────────────────────────────────────────────────────────

  function getMeta(payload = null) {
    const slug = getSlug();

    // 1. Check if GraphQL payload has frontend ID and title
    if (payload?.question) {
      const q = payload.question;
      const qNum = String(q.questionFrontendId || q.questionId || "").match(/\d+/)?.[0] || "";
      const qTitle = q.title || "";
      if (qNum || qTitle) {
        metaCache = {
          slug: q.titleSlug || slug,
          problemId: qNum,
          problemName: qTitle || formatSlugTitle(slug),
          difficulty: q.difficulty || scrapeDiff(),
          topics: extractTopics(q) || scrapeTopics(),
          language: payload?.lang || scrapeLang()
        };
        return metaCache;
      }
    }

    if (metaCache && metaCache.slug === slug && metaCache.problemId) return metaCache;

    // 2. Extract from DOM question title elements
    let detectedId = "";
    let detectedTitle = "";

    const titleSelectors = [
      '[data-cy="question-title"]',
      'div[class*="text-title-large"]',
      'div[class*="question-title"]',
      'a[href^="/problems/"][class*="title"]',
      'h4[data-cy="question-title"]',
      'div[class*="title__"]'
    ];

    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = el.textContent.trim();
        const m = txt.match(/^(\d+)[\.\s\-]+(.*)/);
        if (m) {
          detectedId = m[1];
          detectedTitle = m[2].trim();
          break;
        }
      }
    }

    // 3. Extract from document.title
    if (!detectedId) {
      const docTitle = document.title || "";
      const m = docTitle.match(/^(\d+)[\.\s\-]+(.+?)\s*-\s*LeetCode/i) || docTitle.match(/^(\d+)[\.\s\-]+(.+)/);
      if (m) {
        detectedId = m[1];
        detectedTitle = m[2].trim();
      }
    }

    // 4. Extract from slug if slug has leading digits e.g. "0003-longest-substring"
    if (!detectedId && slug) {
      const m = slug.match(/^(\d+)[\-_]+(.*)/);
      if (m) {
        detectedId = m[1];
        detectedTitle = formatSlugTitle(m[2]);
      }
    }

    if (!detectedTitle) {
      detectedTitle = formatSlugTitle(slug);
    }

    metaCache = {
      slug,
      problemId:   detectedId, // Empty string if truly unknown — never fake default to 1!
      problemName: detectedTitle,
      difficulty:  scrapeDiff(),
      topics:      scrapeTopics(),
      language:    scrapeLang()
    };

    return metaCache;
  }

  function getSlug() {
    return location.pathname.match(/\/problems\/([^/]+)/)?.[1] || "";
  }

  function formatSlugTitle(slug) {
    if (!slug) return "Problem";
    return slug
      .replace(/^\d+[\-_]+/, "")
      .split("-")
      .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "")
      .join(" ");
  }

  function scrapeDiff() {
    for (const s of ["[diff]","[class*='difficulty']","[class*='Difficulty']"]) {
      for (const el of document.querySelectorAll(s) || []) {
        const t = el.textContent.trim();
        if (["Easy","Medium","Hard"].includes(t)) return t;
      }
    }
    return "Easy";
  }

  function scrapeTopics() {
    const topics = [];
    ["a[href*='/tag/']","[class*='topic-tag']","[class*='TopicTag']"].forEach(s => {
      document.querySelectorAll(s).forEach(el => {
        const t = el.textContent.trim();
        if (t && !topics.includes(t)) topics.push(t);
      });
    });
    return topics;
  }

  function scrapeLang() {
    for (const s of ["[id*='headlessui-listbox-button']","button[class*='lang']"]) {
      const el = document.querySelector(s);
      if (el?.textContent.trim()) return el.textContent.trim().replace(/\s*\(.*?\)/g, "");
    }
    return "Java";
  }

  function extractTopics(q) {
    if (!q) return [];
    return (q.topicTags || q.tags || []).map(t => t.name || t.slug || "").filter(Boolean);
  }

  function scrapeCode() {
    try {
      const m = window.monaco?.editor?.getModels();
      if (m?.length) { const v = m[0].getValue(); if (v?.trim()) return v; }
    } catch {}
    const lines = Array.from(document.querySelectorAll(".view-line"));
    return lines.map(l => l.textContent).join("\n");
  }

  async function loadSettings() {
    return new Promise(r => chrome.storage.sync.get({
      filenameFormat: "custom",
      customFilenameTemplate: "{problemNumber}-{problemName}",
      problemNumberFormat: "raw",
      problemNameCase: "title",
      problemNameSeparator: "hyphen",
      folderMode: "topic",

      customFolderTemplate: "{topic}",
      topicStrategy: "first",
      userPreferredTopic: "",
      commitMode: "default",
      commitTemplate: "Solved LeetCode #{problemNumber}: {problemName}",
      solutionContent: { timeComplexity: false, spaceComplexity: false },
      autoAddSections: true,
      readmeSections: [],
      readmeSectionSort: "alphabetical",
      askBeforePush: { readmeTopics: false, topic: false, folder: false, filename: false, timeComplexity: false, spaceComplexity: false, commitMessage: false }
    }, r));


  }

  // ─────────────────────────────────────────────────────────────────────
  // TOAST NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────

  function showToast(type, name, extra) {
    document.getElementById("lcgh-toast")?.remove();
    const t = document.createElement("div");
    t.id = "lcgh-toast";

    let emoji = "✅", msg = "", bg = "#fff", border = "#2da44e", titleClr = "#1a7f37";

    if (type === "preparing") {
      emoji = "🚀"; border = "#54aeff"; titleClr = "#0969da";
      msg = `Preparing push for <strong>${esc(name)}</strong>...`;
    } else if (type === "success") {
      emoji = "✅";
      msg = `Pushed <strong>${esc(name)}</strong> ✓<br>
        <code style="font-size:11px;background:#f6f8fa;color:#0969da;border:1px solid #d0d7de;
          padding:2px 6px;border-radius:4px;margin-top:4px;display:inline-block">${esc(extra||"")}</code>`;
    } else if (type === "skipped") {
      emoji = "📋"; border = "#d0d7de"; titleClr = "#57606a";
      msg = "Solution is <strong>already up to date</strong> on GitHub.";
    } else {
      emoji = "❌"; bg = "#fff8f8"; border = "#cf222e"; titleClr = "#cf222e";
      msg = `Push failed: ${esc(extra || name || "Unknown error")}`;
    }

    t.innerHTML = `<div style="display:flex;align-items:flex-start;gap:12px">
      <span style="font-size:22px;flex-shrink:0">${emoji}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:${titleClr};margin-bottom:3px">LeetCode Auto Push</div>
        <div style="font-size:12px;color:#24292f;line-height:1.4">${msg}</div>
      </div>
      <button onclick="document.getElementById('lcgh-toast').remove()"
        style="background:none;border:none;color:#57606a;font-size:18px;cursor:pointer;padding:0;flex-shrink:0">×</button>
    </div>`;

    Object.assign(t.style, {
      position:"fixed", bottom:"24px", right:"24px", zIndex:"9999995",
      background:bg, border:`1.5px solid ${border}`, borderRadius:"10px",
      padding:"14px 16px", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      boxShadow:"0 8px 24px rgba(140,149,159,.2)", maxWidth:"380px", minWidth:"280px",
      animation:"lcgh-in .25s ease-out"
    });
    document.body.appendChild(t);
    setTimeout(() => t?.remove(), 6000);
  }

  function esc(s) {
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ─────────────────────────────────────────────────────────────────────
  // BOOTSTRAP
  // ─────────────────────────────────────────────────────────────────────

  function reset() {
    metaCache = null; acceptedSubmission = null;
    isPushInProgress = false; lastHandledId = null;
    disconnectObserver(); setState("idle");
  }

  function boot() { injectWidget(); attachSubmitListener(); }

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; reset(); boot(); }
  }, 1000);

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();

})();
