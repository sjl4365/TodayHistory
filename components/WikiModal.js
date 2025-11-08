// components/WikiModal.js
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Linking, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// 동적 로드: 패키지 미설치 시에도 앱이 죽지 않게
let WebViewAny = null;
try {
  WebViewAny = require("react-native-webview").WebView;
} catch {
  WebViewAny = null;
}

// 간단 URL 정화 + 화이트리스트 (위키/위키미디어만)
function sanitizeWikiUrl(input) {
  if (!input) return null;
  try {
    const u = new URL(String(input));
    if (u.protocol !== "https:") u.protocol = "https:";
    const allow = [
      "wikipedia.org",
      "m.wikipedia.org",
      "upload.wikimedia.org",
      "wikimedia.org",
      "commons.wikimedia.org",
    ];
    const host = u.hostname.replace(/^.*?(\w+\.\w+\.\w+)$/,'$1'); // sub.sub.domain -> last 3 parts
    if (!allow.some(d => u.hostname.endsWith(d) || host.endsWith(d))) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default function WikiModal({ url, onClose }) {
  const insets = useSafeAreaInsets();
  const safeUrl = useMemo(() => sanitizeWikiUrl(url), [url]);

  // 폴백: WebView가 없거나 URL이 불량이면 외부 브라우저로
  if (!WebViewAny || !safeUrl) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>Wikipedia</Text>
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Pressable
            onPress={async () => {
              if (url) { try { await Linking.openURL(url); } catch {} }
              onClose?.();
            }}
            style={styles.openBtn}
          >
            <Text style={styles.openBtnText}>브라우저로 열기</Text>
          </Pressable>
          {!WebViewAny && <Text style={styles.infoDim}>WebView 미설치로 폴백</Text>}
          {!safeUrl && !!url && <Text style={styles.infoDim}>허용되지 않은 링크</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>Wikipedia</Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>

      <WebViewAny
        source={{ uri: safeUrl }}
        startInLoadingState
        // 안정화 옵션
        setSupportMultipleWindows={false}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        allowsBackForwardNavigationGestures={true}
        // Android에서 리소스 절약
        androidHardwareAccelerationDisabled={false}
        // 외부 앱/새창 방지: 같은 WebView 내 탐색만 허용
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(req) => {
          // 허용 도메인 내 이동만 허용
          const next = sanitizeWikiUrl(req.url);
          return !!next;
        }}
        onError={() => {
          // 로딩 실패 → 외부 브라우저 폴백
          if (url) { Linking.openURL(url).catch(() => {}); }
          onClose?.();
        }}
        style={styles.web}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0C10" },
  header: {
    height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, borderBottomWidth: 1, borderColor: "#1E2330", backgroundColor: "#0F1320",
  },
  title: { color: "#EAF0FA", fontSize: 16, fontWeight: "700", flex: 1 },
  close: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#1B2136" },
  closeText: { color: "#D5DDEF", fontSize: 13 },
  web: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  infoDim: { color: "#94A3B8", marginTop: 4 },
  openBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "#1B2136" },
  openBtnText: { color: "#EAF0FA", fontWeight: "700" },
});
