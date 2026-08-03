// One-time font fetcher: pulls the exact Cabinet Grotesk + Switzer weights from Fontshare's CDN and writes
// local @font-face rules — the site self-hosts (no CDN call, no tracking, no CSP surprises).
const https = require("https");
const fs = require("fs");

function get(url) {
  return new Promise((res, rej) => {
    https
      .get(url, { headers: { Referer: "https://www.fontshare.com/" } }, (r) => {
        if (r.statusCode >= 300 && r.headers.location) return get(r.headers.location).then(res, rej);
        const c = [];
        r.on("data", (d) => c.push(d));
        r.on("end", () => res(Buffer.concat(c)));
      })
      .on("error", rej);
  });
}

(async () => {
  const css = (await get("https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&f[]=switzer@400,500,600")).toString();
  const blocks = css.split("@font-face").slice(1);
  console.log("blocks found:", blocks.length);
  if (blocks.length) console.log("sample block:\n" + blocks[0].slice(0, 300));
  const out = [];
  for (const b of blocks) {
    const fam = (b.match(/font-family:\s*['"]?([^'";]+)/) || [])[1]?.trim();
    const w = (b.match(/font-weight:\s*(\d+)/) || [])[1];
    const u = (b.match(/url\(['"]?(\/\/cdn[^)'"]+\.woff2)['"]?\)/) || [])[1];
    if (!fam || !w || !u) {
      console.log("skip block: fam=%s w=%s u=%s", fam, w, !!u);
      continue;
    }
    const slug = fam.toLowerCase().replace(/\s+/g, "-") + "-" + w;
    const buf = await get("https:" + u);
    fs.writeFileSync("fonts/" + slug + ".woff2", buf);
    out.push(`@font-face{font-family:"${fam}";font-weight:${w};font-display:swap;src:url("/fonts/${slug}.woff2") format("woff2")}`);
    console.log(slug, buf.length, "bytes");
  }
  fs.writeFileSync("fonts/fonts.css", out.join("\n") + "\n");
  console.log("fonts.css written:", out.length, "faces");
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
