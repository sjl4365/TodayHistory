// 전역 싱글톤 보장 (Fast Refresh 시에도 인스턴스 1개만 유지)
const bus =
  globalThis.__APP_EVENT_BUS__ ||
  (() => {
    const map = new Map(); // eventName -> Set<handler>

    function on(event, handler) {
      if (!map.has(event)) map.set(event, new Set());
      const set = map.get(event);
      set.add(handler);
      // 해제 함수 반환
      return () => off(event, handler);
    }

    function off(event, handler) {
      const set = map.get(event);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) map.delete(event);
    }

    function emit(event, ...args) {
      const set = map.get(event);
      if (!set) return;
      // 복사본으로 순회 (emit 중 on/off로 인한 변형 보호)
      [...set].forEach((fn) => {
        try {
          fn(...args);
        } catch (e) {
          /* noop */
        }
      });
    }

    return { on, off, emit };
  })();

globalThis.__APP_EVENT_BUS__ = bus;

// ---- 편의 함수 ----
export function onRefresh(handler) {
  return bus.on("refresh", handler);
}
export function emitRefresh() {
  bus.emit("refresh");
}

export function onGoPrevDay(handler) {
  return bus.on("goPrevDay", handler);
}
export function emitGoPrevDay() {
  bus.emit("goPrevDay");
}

export function onGoNextDay(handler) {
  return bus.on("goNextDay", handler);
}
export function emitGoNextDay() {
  bus.emit("goNextDay");
}

export default bus;
