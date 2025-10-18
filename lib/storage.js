// lib/storage.js
// MMKV 우선, 미지원 환경(Expo Go 등)은 AsyncStorage 폴백
import AsyncStorage from "@react-native-async-storage/async-storage";

let useMMKV = false;
let kv = null;

try {
  const { MMKV } = require("react-native-mmkv");
  kv = new MMKV({ id: "today-history" });
  useMMKV = true;
} catch (e) {
  useMMKV = false;
}

// ──────────────── 기본 문자열 ────────────────
export async function getString(key) {
  if (useMMKV) return kv.getString(key) ?? null;
  try { return await AsyncStorage.getItem(key); } catch { return null; }
}

export async function setString(key, value) {
  if (useMMKV) { kv.set(String(key), String(value ?? "")); return; }
  try { await AsyncStorage.setItem(key, String(value ?? "")); } catch {}
}

// ──────────────── JSON ────────────────
export async function getJSON(key, fallback = null) {
  const raw = await getString(key);
  if (!raw) return fallback;
  try {
    const val = JSON.parse(raw);
    return val === null ? fallback : val;
  } catch { return fallback; }
}

export async function setJSON(key, obj) {
  try {
    const s = JSON.stringify(obj ?? null);
    await setString(key, s);
  } catch {}
}

// ──────────────── batch ────────────────
export async function multiSetStrings(pairs) {
  if (!Array.isArray(pairs) || !pairs.length) return;
  if (useMMKV) {
    try { for (const [k, v] of pairs) kv.set(k, String(v ?? "")); return; } catch {}
  }
  try { await AsyncStorage.multiSet(pairs.map(([k, v]) => [k, String(v ?? "")])); } catch {}
}

export async function multiGetStrings(keys) {
  if (!Array.isArray(keys) || !keys.length) return [];
  if (useMMKV) {
    try { return keys.map((k) => [k, kv.getString(k) ?? null]); }
    catch { return keys.map((k) => [k, null]); }
  }
  try { return await AsyncStorage.multiGet(keys); }
  catch { return keys.map((k) => [k, null]); }
}
