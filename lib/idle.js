// lib/idle.js — smarter idle + chunked scheduler for React Native
// Goals
// - Keep main thread responsive (avoid long JS tasks)
// - Provide a requestIdle-like API with timeout and cancellation
// - Adaptive chunking using rAF + time budget
// - First-input gate so heavy work waits until the user interacts (or a grace timeout)

import { InteractionManager, Platform } from "react-native";

// ────────────────────────────────────────────────────────────
// Low-level timing utils
// ────────────────────────────────────────────────────────────
const now = () => (global.performance?.now ? performance.now() : Date.now());
const HAS_RAF = typeof global.requestAnimationFrame === "function";
const HAS_IMM = typeof global.setImmediate === "function";

// Target frame budget. On 60Hz ~16.7ms, we spend ~6–8ms for JS to be safe.
// On 120Hz (~8.3ms), we reduce budget a bit. This is a heuristic.
function computeBudgetMs() {
  // RN doesn't expose refresh rate reliably. Use conservative default.
  return 6; // ms per slice
}

// ────────────────────────────────────────────────────────────
// requestIdle (RN polyfill with cancellation)
// ────────────────────────────────────────────────────────────
export function requestIdle(callback, { timeout = 0 } = {}) {
  let called = false;
  let timedOut = false;
  let timeoutId = null;
  let cancelled = false;

  const idleDeadline = () => ({
    didTimeout: timedOut,
    timeRemaining: () => Math.max(0, computeBudgetMs()),
  });

  const invoke = () => {
    if (called || cancelled) return;
    called = true;
    try { callback(idleDeadline()); } catch (e) { console.error("requestIdle callback error", e); }
  };

  // Timeout fallback
  if (timeout > 0) {
    timeoutId = setTimeout(() => { timedOut = true; invoke(); }, timeout);
  }

  // Run after interactions/animations to avoid jank
  const imsub = InteractionManager.runAfterInteractions(() => {
    if (cancelled) return;
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }

    // Schedule one more tick to be extra safe
    if (HAS_RAF) {
      requestAnimationFrame(() => { if (!cancelled) setTimeout(invoke, 0); });
    } else if (HAS_IMM) {
      setImmediate(invoke);
    } else {
      setTimeout(invoke, 0);
    }
  });

  // Return a cancel handle
  return () => {
    cancelled = true;
    try { imsub?.cancel?.(); } catch {}
    if (timeoutId) clearTimeout(timeoutId);
  };
}

// ────────────────────────────────────────────────────────────
// runChunked — adaptive sliced processing (sync each)
// ────────────────────────────────────────────────────────────
export function runChunked(items, each, { sliceMs = computeBudgetMs(), onDone, onError } = {}) {
  let i = 0;
  let cancelled = false;

  function tick() {
    if (cancelled) return;
    const start = now();
    let elapsed = 0;
    try {
      while (i < items.length) {
        each(items[i], i);
        i++;
        elapsed = now() - start;
        if (elapsed >= sliceMs) break; // yield
      }
    } catch (e) {
      onError?.(e);
      return;
    }

    if (i < items.length && !cancelled) {
      // Yield to next frame (rAF preferred, else timeout 0)
      if (HAS_RAF) requestAnimationFrame(() => setTimeout(tick, 0));
      else setTimeout(tick, 0);
    } else if (!cancelled) {
      onDone?.();
    }
  }

  // Kick off after a micro delay to avoid blocking current render
  HAS_IMM ? setImmediate(tick) : setTimeout(tick, 0);

  return () => { cancelled = true; };
}

// ────────────────────────────────────────────────────────────
// runChunkedAsync — supports async each() returning a Promise
// Processes one item per slice to keep scheduling simple and predictable.
// ────────────────────────────────────────────────────────────
export function runChunkedAsync(items, eachAsync, { sliceMs = computeBudgetMs(), onDone, onError } = {}) {
  let i = 0;
  let cancelled = false;

  async function step() {
    if (cancelled) return;
    const start = now();
    try {
      if (i < items.length) {
        await eachAsync(items[i], i);
        i++;
      }
    } catch (e) {
      onError?.(e);
      return;
    }
    const elapsed = now() - start;
    const delay = Math.max(0, sliceMs - elapsed);

    if (i < items.length && !cancelled) {
      if (HAS_RAF) requestAnimationFrame(() => setTimeout(step, delay));
      else setTimeout(step, delay);
    } else if (!cancelled) {
      onDone?.();
    }
  }

  HAS_IMM ? setImmediate(step) : setTimeout(step, 0);

  return () => { cancelled = true; };
}

// ────────────────────────────────────────────────────────────
// First-input gating
// ────────────────────────────────────────────────────────────
let firstInputAt = 0;
export function markUserInteracted() {
  if (!firstInputAt) firstInputAt = Date.now();
}

/**
 * afterFirstInput — run a task when the user interacted at least once,
 * or after a grace period (default 1500ms). Returns a cancel handle.
 */
export function afterFirstInput(task, { graceMs = 1500, timeout = 0 } = {}) {
  if (firstInputAt) {
    return requestIdle(task, { timeout });
  }
  const t = setTimeout(() => requestIdle(task, { timeout }), graceMs);
  return () => clearTimeout(t);
}

// ────────────────────────────────────────────────────────────
// Helpers for batched maps/arrays (optional sugar)
// ────────────────────────────────────────────────────────────
export function forEachChunked(arr, fn, opts) {
  return runChunked(arr, (v, i) => fn(v, i, arr), opts);
}
export async function mapChunked(arr, fnAsync, { sliceMs = computeBudgetMs() } = {}) {
  const out = new Array(arr.length);
  await new Promise((resolve, reject) => {
    runChunkedAsync(arr, async (v, i) => { out[i] = await fnAsync(v, i, arr); }, {
      sliceMs,
      onDone: resolve,
      onError: reject,
    });
  });
  return out;
}
