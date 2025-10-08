// lib/bus.js
const makeBus = () => {
  const subs = new Map();
  const on = (name, fn) => {
    const set = subs.get(name) || new Set();
    set.add(fn);
    subs.set(name, set);
    return () => set.delete(fn);
  };
  const emit = (name, payload) => {
    const set = subs.get(name);
    if (!set) return;
    set.forEach((fn) => { try { fn(payload); } catch {} });
  };
  return { on, emit };
};

const bus = globalThis.__APP_BUS__ ?? (globalThis.__APP_BUS__ = makeBus());

// 기존 이벤트
export const onRefresh     = (fn) => bus.on("refresh", fn);
export const emitRefresh   = () => bus.emit("refresh");

export const onGoPrevDay   = (fn) => bus.on("goPrev", fn);
export const emitGoPrevDay = () => bus.emit("goPrev");

export const onGoNextDay   = (fn) => bus.on("goNext", fn);
export const emitGoNextDay = () => bus.emit("goNext");

export const onShareAttach   = (fn) => bus.on("shareAttach", fn);
export const emitShareAttach = () => bus.emit("shareAttach");

export const onUiLangChanged      = (fn) => bus.on("uiLangChanged", fn);
export const emitUiLangChanged    = (lang) => bus.emit("uiLangChanged", lang);

export const onCountriesChanged   = (fn) => bus.on("countriesChanged", fn);
export const emitCountriesChanged = (arr) => bus.emit("countriesChanged", arr);
