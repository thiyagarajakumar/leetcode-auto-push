/**
 * github.js
 * Safe GitHub REST API v3 helper with comprehensive debugging logs.
 * All functions return { ok: true, data } or { ok: false, error, status }.
 * Nothing here ever throws — callers can always check .ok.
 */

const GITHUB_API = "https://api.github.com";

const LOG  = (...a) => console.log("[GitHub]", ...a);
const WARN = (...a) => console.warn("[GitHub]", ...a);
const ERR  = (...a) => console.error("[GitHub]", ...a);

/**
 * Builds the standard request headers.
 * @param {string} token - GitHub Personal Access Token
 * @returns {HeadersInit}
 */
function makeHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

/**
 * GET the contents of a file in a GitHub repo.
 * Returns null in data when the file does not exist (404).
 */
export async function getFile({ token, owner, repo, branch, path }) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeFilePath(path)}?ref=${encodeURIComponent(branch)}`;
    LOG("Preparing API request: GET", path, "on branch", branch);
    LOG("Sending request to:", url);

    const res = await fetch(url, { headers: makeHeaders(token) });
    LOG("Response status for GET:", res.status);

    if (res.status === 404) {
      LOG("File does not exist yet on GitHub (404)");
      return { ok: true, data: null };
    }
    if (!res.ok) {
      const body = await safeJson(res);
      const errMsg = body?.message || `HTTP ${res.status}`;
      ERR("GET request failed:", errMsg, "Status:", res.status);
      return { ok: false, error: errMsg, status: res.status };
    }

    const body = await res.json();
    return {
      ok: true,
      data: {
        sha: body.sha,
        content: body.content
      }
    };
  } catch (err) {
    ERR("GET network/unexpected error:", err.message);
    return { ok: false, error: err.message || "Network error", status: 0 };
  }
}

/**
 * PUT (create or update) a file in a GitHub repo.
 * Includes automatic retry on HTTP 409 Conflict (e.g. branch ref or SHA latency).
 */
export async function putFile({ token, owner, repo, branch, path, content, sha, message }, isRetry = false) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeFilePath(path)}`;
    LOG("Preparing API request: PUT", path, sha ? "(Update existing)" : "(Create new)", isRetry ? "[Retry]" : "");
    LOG("Sending request to:", url);

    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))), // UTF-8 safe base64
      branch
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: "PUT",
      headers: makeHeaders(token),
      body: JSON.stringify(body)
    });

    LOG("Response status for PUT:", res.status);

    if (!res.ok) {
      // Automatic retry on 409 Conflict (e.g. SHA changed or fast concurrent commit)
      if (res.status === 409 && !isRetry) {
        WARN("409 Conflict detected for", path, "— fetching latest SHA and retrying in 500ms...");
        await new Promise(r => setTimeout(r, 500));
        const fresh = await getFile({ token, owner, repo, branch, path });
        const freshSha = fresh.ok && fresh.data ? fresh.data.sha : null;
        return await putFile({ token, owner, repo, branch, path, content, sha: freshSha, message }, true);
      }

      const errBody = await safeJson(res);
      const errMsg = errBody?.message || `HTTP ${res.status}`;
      ERR("PUT request failed:", errMsg, "Status:", res.status);
      return { ok: false, error: errMsg, status: res.status };
    }

    const data = await res.json();
    LOG("Push successful. Commit SHA:", data?.commit?.sha || "ok");
    return { ok: true, data };
  } catch (err) {
    ERR("PUT network/unexpected error:", err.message);
    return { ok: false, error: err.message || "Network error", status: 0 };
  }
}

/**
 * High-level function: push a solution file to GitHub.
 */
export async function pushSolution(cfg, filePath, content, commitMsg) {
  LOG("Starting pushSolution for:", filePath);

  // Step 1: check if file exists
  const existing = await getFile({ ...cfg, path: filePath });
  if (!existing.ok) {
    ERR("Failed to check existing file:", existing.error);
    return { ok: false, error: friendlyError(existing.error, existing.status), status: existing.status };
  }

  const existingFile = existing.data;

  // Step 2: compare content if existing
  if (existingFile) {
    const existingContent = decodeBase64Content(existingFile.content);
    const normalised = normalise(content);
    if (normalise(existingContent) === normalised) {
      LOG("Content identical to GitHub repository version. Skipping commit.");
      return { ok: true, action: "skipped" };
    }
  }

  // Step 3: create or update
  const result = await putFile({
    ...cfg,
    path: filePath,
    content,
    sha: existingFile ? existingFile.sha : null,
    message: commitMsg
  });

  if (!result.ok) {
    ERR("Failed to putFile:", result.error);
    return { ok: false, error: friendlyError(result.error, result.status), status: result.status };
  }

  LOG("pushSolution completed with action:", existingFile ? "updated" : "created");
  return { ok: true, action: existingFile ? "updated" : "created" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encodeFilePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

function decodeBase64Content(b64) {
  try {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  } catch {
    return "";
  }
}

function normalise(str) {
  return (str || "").replace(/\r\n/g, "\n").trim();
}

function friendlyError(message, status) {
  if (status === 401) return "Invalid GitHub token. Please update it in the extension popup.";
  if (status === 403) return "Token lacks 'repo' write permission. Generate a new token with repo scope.";
  if (status === 404) return "Repository or branch not found. Check your username, repository, and branch settings.";
  if (status === 409) return "Conflict: the file was modified externally. Try again.";
  if (status === 422) return "GitHub rejected the request (422). Check your branch name and repo settings.";
  if (status === 429) return "GitHub rate limit exceeded. Please wait a minute and try again.";
  if (status === 0)   return "Network error — check your internet connection.";
  return message || "Unknown GitHub error.";
}
