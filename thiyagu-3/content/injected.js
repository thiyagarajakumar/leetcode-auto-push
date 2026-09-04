/**
 * injected.js — Runs in the MAIN world at document_start.
 * Intercepts LeetCode GraphQL fetch responses and directly extracts Monaco editor source code.
 * Includes deduplication to prevent duplicate triggers from multiple poll responses.
 */

(function () {
  "use strict";

  const LOG = (...a) => console.log("[LeetCode Auto Push Interceptor]", ...a);
  const handledSubmissions = new Map(); // submissionId -> { time, hasQuestion }

  function getMonacoCode() {
    try {
      if (window.monaco?.editor) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          for (const m of models) {
            const val = m.getValue();
            if (val && val.trim().length > 0 && !m.uri?.path?.includes("testcase")) {
              return val;
            }
          }
          return models[0].getValue() || "";
        }
      }
    } catch (e) {}
    return "";
  }

  function emitAccepted(payload) {
    const sid = String(payload.submissionId || Date.now());
    const now = Date.now();

    // Clean old entries older than 30s
    for (const [k, v] of handledSubmissions.entries()) {
      if (now - v.time > 30000) handledSubmissions.delete(k);
    }

    const existing = handledSubmissions.get(sid);
    if (existing) {
      // If we already emitted with full question metadata, skip duplicate
      if (existing.hasQuestion) return;
      // If recently emitted within 3s and no new question metadata, skip
      if (now - existing.time < 3000 && !payload.question) return;
    }

    handledSubmissions.set(sid, { time: now, hasQuestion: Boolean(payload.question) });
    LOG("Emitting official Accepted event for submission:", sid);
    window.postMessage({ type: "LEETCODE_OFFICIAL_ACCEPTED", payload }, "*");
  }

  // Intercept window.fetch to capture official submission results
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (...args) {
    const response = await originalFetch(...args);

    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

      if (url.includes("leetcode.com") && (url.includes("graphql") || url.includes("submissions"))) {
        const clone = response.clone();
        clone.json().then(data => {
          if (!data) return;

          // Case A: submissionDetails GraphQL response
          const details = data.data?.submissionDetails;
          if (details) {
            const status = details.statusDisplay || details.status?.description || details.status || "";
            if (status === "Accepted" || status.toLowerCase().includes("accepted")) {
              const code = details.code || getMonacoCode();
              emitAccepted({
                submissionId: String(details.id || details.submissionId || Date.now()),
                code: code,
                lang: details.lang?.name || details.lang || details.langName || "",
                question: details.question || null,
                runtime: details.runtime || "",
                memory: details.memory || ""
              });
            }
          }

          // Case B: submission check / status responses
          const state = data.state || data.status_display || data.data?.submissionStatus?.statusDisplay;
          if (state === "SUCCESS" || state === "Accepted" || data.status_display === "Accepted") {
            const code = data.code || getMonacoCode();
            emitAccepted({
              submissionId: String(data.submission_id || data.id || Date.now()),
              code: code,
              lang: data.lang || "",
              question: null,
              runtime: data.status_runtime || "",
              memory: data.status_memory || ""
            });
          }

          // Case C: submissionList items
          const list = data.data?.submissionList;
          if (list && Array.isArray(list.submissions)) {
            for (const sub of list.submissions) {
              if (sub.statusDisplay === "Accepted") {
                const code = sub.code || getMonacoCode();
                emitAccepted({
                  submissionId: String(sub.id || sub.submissionId || Date.now()),
                  code: code,
                  lang: sub.lang || sub.langName || "",
                  question: null,
                  runtime: sub.runtime || "",
                  memory: sub.memory || ""
                });
                break;
              }
            }
          }
        }).catch(() => {});
      }
    } catch (e) {}

    return response;
  };

  // Listen for requests from content script to read editor code
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "REQUEST_MONACO_CODE") {
      const code = getMonacoCode();
      window.postMessage({
        type: "RESPONSE_MONACO_CODE",
        code: code,
        requestId: event.data.requestId
      }, "*");
    }
  });

})();
