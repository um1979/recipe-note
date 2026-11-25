// 서버 함수를 아무나 마구 부르지 못하게 막는 작은 경비원
// 1) 허락한 두 주소(앱 화면)에서 온 요청만 받아요
// 2) 같은 사람이 1분에 8번 넘게 부르면 잠깐 막아요 (제미나이 무료 한도를 지키려고)
// 참고: 완벽한 보안은 아니에요. 주소 위조까지는 못 막고, 서버가 쉬었다 켜지면 횟수가 초기화돼요.
const OK = require("./_cors.js").OK;
const hits = new Map();
module.exports = function guard(req, res) {
  const o = req.headers && req.headers.origin;
  if (!o || OK.indexOf(o) === -1) {
    res.status(403).json({ error: "허락된 앱 화면에서만 쓸 수 있어요." });
    return true;
  }
  const ip = String((req.headers["x-forwarded-for"] || "")).split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(function (t) { return now - t < 60000; });
  if (recent.length >= 8) {
    res.status(429).json({ error: "너무 자주 눌렀어요. 1분 뒤에 다시 해 주세요." });
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) hits.clear();
  return false;
};
