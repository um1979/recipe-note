// 유튜브 링크를 받아 Gemini에게 레시피를 정리시키는 작은 서버 함수 (Vercel)
// 필요한 비밀 값: GEMINI_API_KEY (Vercel 환경 변수에만 넣고, 코드에는 쓰지 않아요)
const { TIMER_RULES, normalizeSteps } = require("./_recipe-rules.js");
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

function isYoutube(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\.|^m\./, "");
    return h === "youtube.com" || h === "youtu.be";
  } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST로만 쓸 수 있어요." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "서버에 GEMINI_API_KEY가 아직 없어요." });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const url = String((body && body.url) || "").trim();
  if (!isYoutube(url)) return res.status(400).json({ error: "유튜브 링크만 읽을 수 있어요. 인스타 등은 설명글을 붙여 넣어 주세요." });

  const prompt =
    "이 영상은 요리 레시피야. 영상에 실제로 나오는 내용만 써서 JSON 하나만 출력해. 설명 문장이나 코드블록 표시는 쓰지 마.\n" +
    '형식: {"name":"요리 이름","time":분 단위 숫자 또는 null,"ingredients":["재료 + 분량"],"steps":["한 단계씩 짧은 문장"]}\n' +
    "규칙: 불 세기(강불·중불·약불)와 시간(몇 분)이 영상에 있으면 해당 단계 문장에 '강불에서 10분'처럼 그대로 넣어. 영상에 없는 재료, 분량, 시간은 지어내지 마. 모르면 time은 null, 분량은 빼고 재료 이름만 써. 한국어로 써.\n" + TIMER_RULES;

  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ file_data: { file_uri: url } }, { text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await r.json();
    if (!r.ok) {
      const m = (data && data.error && data.error.message) || "Gemini가 오류를 돌려줬어요.";
      return res.status(502).json({ error: "Gemini 오류: " + m });
    }
    const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
      ? data.candidates[0].content.parts.map(p => p.text || "").join("") : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return res.status(502).json({ error: "영상에서 레시피를 읽지 못했어요." });
    const j = JSON.parse(m[0]);
    return res.status(200).json({
      name: j.name || "",
      time: j.time == null ? null : j.time,
      ingredients: Array.isArray(j.ingredients) ? j.ingredients : [],
      steps: normalizeSteps(j.steps)
    });
  } catch (e) {
    return res.status(500).json({ error: "정리에 실패했어요: " + (e && e.message ? e.message : e) });
  }
};
