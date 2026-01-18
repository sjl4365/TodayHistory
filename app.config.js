// app.config.js
export default ({ config }) => {
  const profile =
    process.env.EAS_BUILD_PROFILE ||
    process.env.EXPO_PROFILE || // 로컬에서 쓰고 싶으면 직접 지정 가능
    "development";              // 기본값

  const isDev = profile === "development";

  const basePlugins = Array.isArray(config.plugins) ? config.plugins : [];

  const pluginsWithoutDevClient = basePlugins.filter((p) => {
    if (typeof p === "string") return p !== "expo-dev-client";
    if (Array.isArray(p)) return p[0] !== "expo-dev-client";
    return true;
  });

  return {
    ...config,
    plugins: [
      ...(isDev ? ["expo-dev-client"] : []),
      ...pluginsWithoutDevClient,
    ],
  };
};
