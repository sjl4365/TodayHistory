// lib/idle.js
import { InteractionManager } from "react-native";

/** requestIdleCallback-ish (RN엔 없으므로 대체) */
export function requestIdle(fn, timeout = 0) {
  let didTimeout = false;
  const t = timeout
    ? setTimeout(() => {
        didTimeout = true;
        fn({ didTimeout, timeRemaining: () => 0 });
      }, timeout)
    : null;

  InteractionManager.runAfterInteractions(() => {
    if (t) clearTimeout(t);
    setTimeout(() => fn({ didTimeout, timeRemaining: () => Math.max(0, 50) }), 0);
  });
}

/** 3~6ms 조각으로 끊어서 실행 (JS 프리즈 방지) */
export function runChunked(items, each, sliceMs = 6, onDone) {
  let i = 0;
  function step() {
    const start = Date.now();
    while (i < items.length && Date.now() - start < sliceMs) {
      each(items[i], i);
      i++;
    }
    if (i < items.length) {
      setTimeout(step, 0); // 프레임 양보
    } else {
      onDone && onDone();
    }
  }
  setTimeout(step, 0);
}

/** 사용자 입력 우선 게이트 */
let firstInputAt = 0;
export function markUserInteracted() {
  if (!firstInputAt) firstInputAt = Date.now();
}

/** 첫 입력 이후(또는 1.5s 경과) 유휴시에 실행 */
export function afterFirstInput(task) {
  if (firstInputAt) {
    requestIdle(task);
  } else {
    setTimeout(() => requestIdle(task), 1500);
  }
}
