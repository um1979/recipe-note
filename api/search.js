// 요리 이름을 받아 Gemini가 레시피를 써 주는 서버 함수 (Vercel)
// 유튜브 링크 없이 이름만으로 칸을 채워요. (구글 검색은 무료 키로 안 돼서 쓰지 않아요)
// 필요한 비밀 값: GEMINI_API_KEY (Vercel 환경 변수에만 넣고, 코드에는 쓰지 않아요)
// 모델은 고정값: gemini-3.5-flash-lite (무료 한도가 넉넉한 모델)
const { TASTY_RULES, normalizeSteps } = require("./_recipe-rules.js");
const MODEL = "gemini-3.5-flash-lite";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST로만 쓸 수 있어요." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "서버에 GEMINI_API_KEY가 아직 없어요." });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const q = String((body && body.query) || "").trim().slice(0, 80);
  if (q.length < 2) return res.status(400).json({ error: "찾을 요리 이름을 적어 주세요." });

  const prompt =
    "'" + q + "' 요리의 레시피를 JSON 하나만 출력해. 설명 문장이나 코드블록 표시는 쓰지 마.\n" +
    '형식: {"name":"요리 이름","time":분 단위 숫자 또는 null,"ingredients":["재료 + 분량"],"steps":["한 단계씩 짧은 문장"]}\n' +
    "한국어로 써.";

  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: TASTY_RULES }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      const m = (data && data.error && data.error.message) || "Gemini가 오류를 돌려줬어요.";
      return res.status(502).json({ error: "Gemini 오류: " + m });
    }
    const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
      ? data.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join("") : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return res.status(502).json({ error: "레시피를 읽지 못했어요. 요리 이름을 바꿔서 다시 해 보세요." });
    let j;
    try { j = JSON.parse(m[0]); } catch (e) { return res.status(502).json({ error: "정리 결과를 읽지 못했어요. 다시 눌러 주세요." }); }
    const ing = Array.isArray(j.ingredients) ? j.ingredients : [];
    const steps = normalizeSteps(j.steps);
    if (!ing.length && !steps.length) return res.status(404).json({ error: "이 요리는 잘 모르겠어요. 이름을 바꾸거나 링크·글을 붙여 넣어 주세요." });
    return res.status(200).json({ name: j.name || q, time: j.time == null ? null : j.time, ingredients: ing, steps: steps });
  } catch (e) {
    return res.status(500).json({ error: "찾기에 실패했어요: " + (e && e.message ? e.message : e) });
  }
};
