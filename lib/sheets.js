// lib/sheets.js
import Papa from "papaparse";

/**
 * 특정 구글 시트 탭을 CSV로 불러옵니다.
 * @param {{sheetId:string, gid:string}} param0
 * @returns {Promise<Array<object>>}
 */
export async function fetchSheetRows({ sheetId, gid }) {
  if (!sheetId || !gid) throw new Error("fetchSheetRows: sheetId and gid are required");
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}` +
    `/export?format=csv&id=${sheetId}&gid=${gid}`;

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`);

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/csv")) {
    const preview = (await res.text()).slice(0, 200);
    throw new Error("Expected CSV but got HTML/other. Check sharing + URL. Preview: " + preview);
  }

  const csv = await res.text();
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return data;
}
