// lib/bus.js
import { unstable_batchedUpdates } from 'react-native';

/** 초경량 이벤트 버스
 *  - emit() 동기 호출 + batchedUpdates로 리스너들의 setState를 1회 렌더로 합침
 *  - 구독 해제 O(1) (swap-pop)
 *  - emit 동안 리스너 배열 스냅샷 사용 → 순회 중 on/off 안전
 *  - (옵션) 동일 틱 내 중복 emit을 키별로 병합(coalesce)해 한 번만 실행
 */
function makeBus() {
  const map = new Map();

  function on(name, fn) {
    let arr = map.get(name);
    if (!arr) {
      arr = [];
      map.set(name, arr);
    }
    arr.push(fn);

    let alive = true;
    return () => {
      if (!alive) return;
      alive = false;
      const a = map.get(name);
      if (!a) return;
      const idx = a.indexOf(fn);
      if (idx === -1) return;
      const last = a.length - 1;
      if (idx !== last) {
        const tmp = a[last];
        a[last] = a[idx];
        a[idx] = tmp;
      }
      a.pop();
      if (a.length === 0) map.delete(name);
    };
  }

  function emitSync(name, payload) {
    const arr = map.get(name);
    if (!arr || arr.length === 0) return;

    const snapshot = arr.slice(0);
    unstable_batchedUpdates(() => {
      for (let i = 0; i < snapshot.length; i++) {
        const fn = snapshot[i];
        try {
          fn(payload);
        } catch {}
      }
    });
  }

  const pending = new Map();
  let scheduled = false;

  function emit(name, payload, opts) {
    const key = opts?.coalesceKey;
    if (!key) {
      emitSync(name, payload);
      return;
    }

    pending.set(key, { name, payload });
    if (scheduled) return;
    scheduled = true;

    Promise.resolve().then(() => {
      scheduled = false;
      const batch = Array.from(pending.values());
      pending.clear();

      unstable_batchedUpdates(() => {
        for (let i = 0; i < batch.length; i++) {
          const { name: n, payload: p } = batch[i];
          const arr = map.get(n);
          if (!arr || arr.length === 0) continue;
          const snapshot = arr.slice(0);
          for (let j = 0; j < snapshot.length; j++) {
            try {
              snapshot[j](p);
            } catch {}
          }
        }
      });
    });
  }

  return { on, emit, emitSync };
}

const bus = globalThis.__APP_BUS__ ?? (globalThis.__APP_BUS__ = makeBus());

export const onRefresh = (fn) => bus.on("refresh", fn);
export const emitRefresh = () => bus.emit("refresh");

export const onGoPrevDay = (fn) => bus.on("goPrev", fn);
export const emitGoPrevDay = () => bus.emit("goPrev");

export const onGoNextDay = (fn) => bus.on("goNext", fn);
export const emitGoNextDay = () => bus.emit("goNext");

export const onShareAttach = (fn) => bus.on("shareAttach", fn);
export const emitShareAttach = () => bus.emit("shareAttach");

export const onUiLangChanged = (fn) => bus.on("uiLangChanged", fn);
export const emitUiLangChanged = (lang) =>
  bus.emit("uiLangChanged", lang, { coalesceKey: "uiLang" });

export const onCountriesChanged = (fn) => bus.on("countriesChanged", fn);
export const emitCountriesChanged = (arr) =>
  bus.emit("countriesChanged", arr, { coalesceKey: "countries" });

export const emitSync = bus.emitSync;