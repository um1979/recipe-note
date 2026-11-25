// 요리 이름으로 관련 추천 유튜브 영상을 찾아 주는 서버 함수 (Vercel)
// 필요한 비밀 값: YOUTUBE_API_KEY (Vercel 환경 변수에만 넣고, 코드에는 쓰지 않아요)
// 키가 없으면 501을 돌려줘요. 그러면 앱은 '유튜브에서 찾아보기' 버튼만 보여 줘요.
const cors = require("./_cors.js");
const guard = require("./_guard.js");

function decode(t) {
  return String(t || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST로만 쓸 수 있어요." });
  if (guard(req, res)) return;
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(501).json({ error: "no_key" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const q = String((body && body.query) || "").trim().slice(0, 60);
  if (q.length < 2) return res.status(400).json({ error: "찾을 요리 이름을 적어 주세요." });
  try {
    const params = new URLSearchParams({
      part: "snippet", type: "video", maxResults: "4", q: q + " 레시피",
      regionCode: "KR", relevanceLanguage: "ko", videoEmbeddable: "true", safeSearch: "strict"
    });
    const r = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), {
      headers: { "x-goog-api-key": key }
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      const m = (data && data.error && data.error.message) || "유튜브가 오류를 돌려줬어요.";
      return res.status(502).json({ error: "유튜브 오류: " + m });
    }
    const videos = (data.items || []).filter(function (i) { return i && i.id && i.id.videoId; }).map(function (i) {
      return { id: i.id.videoId, title: decode(i.snippet && i.snippet.title), channel: decode(i.snippet && i.snippet.channelTitle) };
    });
    return res.status(200).json({ videos: videos });
  } catch (e) {
    return res.status(500).json({ error: "추천 영상을 찾지 못했어요." });
  }
};
