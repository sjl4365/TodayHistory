// app.config.js
export default ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE; // production / apk / preview / development
  const isDev = profile === "development";

  // 기존 plugins 배열 가져오기
  const basePlugins = Array.isArray(config.plugins) ? config.plugins : [];

  // 혹시 app.json에 expo-dev-client가 이미 들어있다면 제거 (중복/production 적용 방지)
  const pluginsWithoutDevClient = basePlugins.filter((p) => {
    if (typeof p === "string") return p !== "expo-dev-client";
    if (Array.isArray(p)) return p[0] !== "expo-dev-client";
    return true;
  });

  return {
    ...config,

    // ✅ dev-client는 development 프로필에서만 적용
    plugins: [
      ...(isDev ? ["expo-dev-client"] : []),
      ...pluginsWithoutDevClient,
    ],
  };
};
