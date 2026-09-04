# LeetCode → GitHub Auto-Push Extension

A **Chrome Extension (Manifest V3)** that automatically detects when you get an **Accepted ✅** submission on LeetCode and instantly pushes your solution to GitHub — organized by topic, zero manual steps.

## How it works

```
Solve LeetCode Problem → Submit → Accepted ✅
         ↓
  Extension detects acceptance
         ↓
  Extracts:  Problem Number · Name · Code · Language · Topics · Difficulty · Link
         ↓
  Determines category folder from topics
    e.g. "Two Pointers" → Two-Pointers/
         ↓
  Builds file path
    e.g.  Two-Pointers/167-Two-Sum-II.java
         ↓
  Checks GitHub → folder/file doesn't exist?
    → Creates it automatically
    → Commits + Pushes 🚀
```

## Folder structure generated in your repo

```
leetcode-solutions/
├── Arrays-Hashing/
│   └── 1-Two-Sum.py
├── Two-Pointers/
│   └── 167-Two-Sum-II.java
├── Binary-Search/
│   └── 704-Binary-Search.cpp
├── Dynamic-Programming/
│   └── 70-Climbing-Stairs.js
├── Trees/
│   └── 104-Maximum-Depth-of-Binary-Tree.py
└── Graphs/
    └── 200-Number-of-Islands.cpp
```

## Each file includes a metadata header

```python
# ═══════════════════════════════════════════════════════
# Problem   : 1. Two Sum
# Difficulty: Easy
# Topics    : Array, Hash Table
# Category  : Arrays-Hashing
# Link      : https://leetcode.com/problems/two-sum/
# ═══════════════════════════════════════════════════════

class Solution:
    def twoSum(self, nums, target):
        ...
```

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. Click the extension icon → fill in your GitHub settings

## Setup (one-time)

| Field | Value |
|---|---|
| **GitHub Token** | [Generate here](https://github.com/settings/tokens/new?scopes=repo&description=LeetCode+AutoPush) — needs `repo` scope |
| **GitHub Username** | Your GitHub username |
| **Repository Name** | Target repo (must exist, e.g. `leetcode-solutions`) |
| **Branch** | Default: `main` |

## Supported languages

Python · Java · C++ · C · JavaScript · TypeScript · Go · Rust · C# · Swift · Kotlin · Ruby · Scala · PHP · SQL · Dart · Bash

## Folder categories

| Folder | Topics matched |
|---|---|
| `Dynamic-Programming/` | Dynamic Programming, Memoization |
| `Backtracking/` | Backtracking |
| `Graphs/` | Graph, BFS, DFS, Topological Sort, Dijkstra |
| `Binary-Search/` | Binary Search |
| `Divide-and-Conquer/` | Divide and Conquer |
| `Trie/` | Trie, Prefix Tree |
| `Segment-Tree/` | Segment Tree, Fenwick Tree |
| `Stack/` | Stack, Monotonic Stack |
| `Heap-Priority-Queue/` | Heap, Priority Queue |
| `Queue/` | Queue, Deque |
| `Trees/` | Tree, Binary Tree, BST |
| `Linked-List/` | Linked List |
| `Two-Pointers/` | Two Pointers, Sliding Window |
| `Bit-Manipulation/` | Bit Manipulation |
| `Math/` | Math, Number Theory |
| `Greedy/` | Greedy |
| `Sorting/` | Sorting |
| `Strings/` | String, String Matching |
| `Matrix/` | Matrix |
| `Intervals/` | Interval |
| `Arrays-Hashing/` | Array, Hash Table |
| `Miscellaneous/` | Everything else |

## Error handling

| Situation | What happens |
|---|---|
| No token configured | Badge shows `!`, popup explains |
| Invalid/expired token | Friendly message: "Invalid GitHub token" |
| No `repo` write scope | Friendly message: "Token lacks repo scope" |
| Repo not found | Friendly message with fix instructions |
| Same solution submitted twice | "Already up to date" — no duplicate commit |
| LeetCode DOM changed | Falls back to GraphQL fetch intercept |
| Network offline | Friendly error in toast and popup |

## Files

```
extension/
├── manifest.json                ← Manifest V3
├── background/
│   └── service-worker.js        ← GitHub push orchestration
├── content/
│   └── leetcode.js              ← LeetCode detection (fetch intercept + DOM)
├── popup/
│   ├── popup.html               ← Settings UI
│   ├── popup.js                 ← Form logic, history, connection test
│   └── popup.css                ← Dark theme styles
├── utils/
│   ├── github.js                ← GitHub REST API (get/put/push)
│   ├── categoryMap.js           ← Topic → folder mapping
│   └── langMap.js               ← Language → file extension mapping
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```
