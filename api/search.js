// 요리 이름을 받아 Gemini가 구글 검색으로 레시피를 찾아 정리하는 서버 함수 (Vercel)
// 유튜브 링크 없이 검색만으로 레시피를 채워요.
// 필요한 비밀 값: GEMINI_API_KEY (Vercel 환경 변수에만 넣고, 코드에는 쓰지 않아요)
// 근거: Google 공식 문서 "Grounding with Google Search" (ai.google.dev/gemini-api/docs/google-search)
//   - 주소: POST https://generativelanguage.googleapis.com/v1beta/interactions
//   - 키는 x-goog-api-key 헤더, 검색 켜기는 tools: [{ type: "google_search" }]
//   - 답은 steps 중 type이 model_output인 곳의 content[].text, 출처는 그 text의 annotations(url_citation)
const MODEL = process.env.GEMINI_SEARCH_MODEL || "gemini-3.8-flash";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST로만 쓸 수 있어요." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "서버에 GEMINI_API_KEY가 아직 없어요." });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const q = String((body && body.query) || "").trim().slice(0, 80);
  if (q.length < 2) return res.status(400).json({ error: "찾을 요리 이름을 적어 주세요." });

  const prompt =
    "구글 검색으로 '" + q + "' 레시피를 찾아서 JSON 하나만 출력해. 설명 문장이나 코드블록 표시는 쓰지 마.\n" +
    '형식: {"name":"요리 이름","time":분 단위 숫자 또는 null,"ingredients":["재료 + 분량"],"steps":["한 단계씩 짧은 문장"]}\n' +
    "규칙: 검색 결과에 실제로 나온 내용만 써. 없는 재료, 분량, 시간은 지어내지 마. 모르면 time은 null, 분량은 빼고 재료 이름만 써. " +
    "불 세기(강불·중불·약불)와 시간(몇 분)이 검색 결과에 있으면 해당 단계 문장에 '강불에서 10분'처럼 그대로 넣어. 한국어로 써.";

  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ model: MODEL, input: prompt, tools: [{ type: "google_search" }] })
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      const m = (data && data.error && data.error.message) || "Gemini가 오류를 돌려줬어요.";
      return res.status(502).json({ error: "Gemini 오류: " + m });
    }
    let text = "";
    const sources = [];
    (data.steps || []).forEach(function (s) {
      if (s.type !== "model_output") return;
      (s.content || []).forEach(function (c) {
        if (c.type !== "text") return;
        text += c.text || "";
        (c.annotations || []).forEach(function (a) {
          if (a.type === "url_citation" && a.url && sources.every(function (x) { return x.url !== a.url; })) {
            sources.push({ url: a.url, title: a.title || a.url });
          }
        });
      });
    });
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return res.status(502).json({ error: "검색 결과에서 레시피를 읽지 못했어요. 요리 이름을 바꿔서 다시 해 보세요." });
    let j;
    try { j = JSON.parse(m[0]); } catch (e) { return res.status(502).json({ error: "정리 결과를 읽지 못했어요. 다시 눌러 주세요." }); }
    return res.status(200).json({
      name: j.name || q,
      time: j.time == null ? null : j.time,
      ingredients: Array.isArray(j.ingredients) ? j.ingredients : [],
      steps: Array.isArray(j.steps) ? j.steps : [],
      sources: sources.slice(0, 5)
    });
  } catch (e) {
    return res.status(500).json({ error: "찾기에 실패했어요: " + (e && e.message ? e.message : e) });
  }
};
