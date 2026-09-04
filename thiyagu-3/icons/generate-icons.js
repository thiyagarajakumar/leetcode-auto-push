/**
 * generate-icons.js
 * Run once with Node.js to generate PNG icons from SVG using canvas.
 * This script is only needed during development — the generated PNGs
 * are committed to the repo and ship with the extension.
 *
 * Usage: node generate-icons.js
 * Requires: npm install canvas  (or use the online method below)
 *
 * ── ONLINE ALTERNATIVE ──────────────────────────────────────────────────────
 * If you don't want to install canvas, simply:
 * 1. Open https://www.svgviewer.dev/
 * 2. Paste the SVG below, export as PNG at 16/32/48/128px
 * 3. Save to extension/icons/
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SVG Source (the lightning bolt + "LG" icon):
 *
 * <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
 *   <rect width="128" height="128" rx="24" fill="#1a1d24"/>
 *   <path d="M72 16L32 72h36L60 112l56-56H80L72 16z"
 *         fill="#f0a500" stroke="#f0a500" stroke-width="1" stroke-linejoin="round"/>
 * </svg>
 */

// This file is a dev-only helper. The actual icons are pre-generated PNGs.
