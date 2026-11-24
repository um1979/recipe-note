// github.io 화면에서도 이 서버 함수를 부를 수 있게 허락해 주는 작은 도우미
// (허락하는 곳은 아래 두 주소뿐이에요)
const OK = ["https://um1979.github.io", "https://recipe-note-sand.vercel.app"];
module.exports = function cors(req, res) {
  const o = req.headers && req.headers.origin;
  if (o && OK.indexOf(o) !== -1) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
};
