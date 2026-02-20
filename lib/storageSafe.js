// lib/storageSafe.js
// AsyncStorage wrapper: 타입/에러 처리, JSON 파싱, 기본값을 한 곳에서 관리합니다.
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Get raw string. Returns fallback on errors / missing.
 */
export async function getString(key, fallback = null) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Set raw string (errors are swallowed).
 */
export async function setString(key, value) {
  try {
    await AsyncStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a key (errors are swallowed).
 */
export async function remove(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get JSON value. Returns fallback if parse fails / missing.
 */
export async function getJSON(key, fallback = null) {
  const raw = await getString(key, null);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Set JSON value (errors are swallowed).
 */
export async function setJSON(key, value) {
  try {
    const raw = JSON.stringify(value);
    await AsyncStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get integer value. Returns fallback if missing/invalid.
 */
export async function getInt(key, fallback = 0) {
  const raw = await getString(key, null);
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Set integer value.
 */
export async function setInt(key, value) {
  return setString(key, String(parseInt(String(value), 10)));
}

/**
 * Multi-get. Returns an object map { key: valueString|null }.
 */
export async function multiGet(keys) {
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    const out = {};
    for (const [k, v] of pairs) out[k] = v;
    return out;
  } catch {
    const out = {};
    for (const k of keys) out[k] = null;
    return out;
  }
}

/**
 * Multi-set with [[key, value], ...]. Values are stringified with String().
 */
export async function multiSet(pairs) {
  try {
    const normalized = pairs.map(([k, v]) => [k, String(v)]);
    await AsyncStorage.multiSet(normalized);
    return true;
  } catch {
    return false;
  }
}
