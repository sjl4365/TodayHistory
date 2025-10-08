// lib/worker-utils.js
import { NativeModules } from 'react-native';
// Thread import는 유지해도 되지만, 생성은 네이티브 체크 뒤에만!
import { Thread } from 'react-native-threads';

/**
 * @param {string} rawJson
 * @param {{ timeoutMs?: number }} opts
 * @returns {Promise<any>}
 */
export function parseJsonInWorker(rawJson, opts = {}) {
  const { timeoutMs = 30000 } = opts;

  const hasNativeThreads = !!NativeModules?.Threads?.startThread;
  if (!hasNativeThreads) {
    // 안전 폴백: 이벤트 루프에 양보 후 메인 스레드에서 파싱
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(JSON.parse(rawJson));
        } catch (e) {
          reject(e);
        }
      }, 0);
    });
  }

  // 여기부터는 네이티브 있을 때만 실행
  return new Promise((resolve, reject) => {
    const t = new Thread('workers/parser.thread.js');
    let settled = false;
    let timer;

    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { t.terminate(); } catch {}
      fn(arg);
    };

    t.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data?.ok) return done(resolve, data.result);
        return done(reject, new Error(data?.error || 'Worker error'));
      } catch (e) {
        return done(reject, e);
      }
    };

    t.onerror = (err) => done(reject, err);

    timer = setTimeout(() => done(reject, new Error('Worker timed out')), timeoutMs);

    t.postMessage(rawJson);
  });
}
