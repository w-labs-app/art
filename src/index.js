// Worker sem keyrir á undan ÖLLUM skrám (run_worker_first).
// Lykilorðið er Cloudflare secret (env.SITE_PASSWORD) – aldrei í kóðanum.

const COOKIE = "wa_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dagar
const enc = new TextEncoder();

async function hmacHex(secret, message) {
	const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Tímaöruggur samanburður: báðir strengir eru hashaðir í jafnlanga 32 bæta
// og bornir saman með timingSafeEqual.
async function safeEqual(a, b) {
	const [ha, hb] = await Promise.all([
		crypto.subtle.digest("SHA-256", enc.encode(a)),
		crypto.subtle.digest("SHA-256", enc.encode(b)),
	]);
	return crypto.subtle.timingSafeEqual(ha, hb);
}

async function makeToken(secret) {
	const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
	return `${exp}.${await hmacHex(secret, "wilsonart:" + exp)}`;
}

async function validToken(secret, token) {
	if (!token) return false;
	const [exp, sig] = token.split(".");
	if (!exp || !sig || !/^\d+$/.test(exp)) return false;
	if (Number(exp) < Date.now() / 1000) return false;
	return safeEqual(sig, await hmacHex(secret, "wilsonart:" + exp));
}

function getCookie(request, name) {
	const header = request.headers.get("Cookie") || "";
	for (const part of header.split(";")) {
		const i = part.indexOf("=");
		if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
	}
	return null;
}

function safeNext(value) {
	// Aðeins slóðir á þessum vef (kemur í veg fyrir opna tilvísun).
	return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") && !value.startsWith("/login")
		? value
		: "/";
}

function withHeaders(response, extra = {}) {
	const r = new Response(response.body, response);
	r.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
	r.headers.set("X-Content-Type-Options", "nosniff");
	r.headers.set("Referrer-Policy", "same-origin");
	for (const [k, v] of Object.entries(extra)) r.headers.set(k, v);
	return r;
}

function loginPage({ error = false, next = "/" } = {}) {
	const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
	const html = `<!doctype html>
<html lang="is">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="#05070B">
<title>wilsonart – innskráning</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&display=swap" rel="stylesheet">
<style>
:root{--bg:#05070B;--white:#F5F8FF;--silver:#AAB5C5;--cyan:#00DFFF;--line:rgba(170,181,197,.28);--err:#FF8A8A}
*,*::before,*::after{box-sizing:border-box}
html{background:var(--bg);color-scheme:dark}
body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:1.25rem;background:var(--bg);color:var(--white);font-family:"Archivo",system-ui,sans-serif;font-size:1.0625rem;line-height:1.5;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:22rem}
.brand{font-weight:800;font-stretch:125%;letter-spacing:.14em;text-transform:uppercase;font-size:.95rem;margin:0 0 2.5rem}
h1{font-size:1.5rem;font-weight:700;margin:0 0 .5rem;letter-spacing:-.01em}
p{margin:0 0 1.5rem;color:var(--silver)}
label{display:block;font-size:.875rem;color:var(--silver);margin-bottom:.4rem}
input{width:100%;font:inherit;color:var(--white);background:transparent;border:1px solid var(--line);border-radius:0;padding:.85rem 1rem;min-height:3rem}
input:focus-visible,button:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
input[aria-invalid=true]{border-color:var(--err)}
button{margin-top:1rem;width:100%;min-height:3rem;font:inherit;font-weight:700;color:var(--bg);background:var(--cyan);border:0;cursor:pointer;transition:background .2s}
button:hover{background:#7DEBFF}
.err{margin:.75rem 0 0;color:var(--err);font-size:.95rem}
</style>
</head>
<body>
<main>
<div class="brand">wilsonart</div>
<h1>Innskráning</h1>
<p>Þessi vefur er læstur.</p>
<form method="post" action="/login">
<input type="hidden" name="next" value="${esc(next)}">
<label for="pw">Lykilorð</label>
<input id="pw" name="password" type="password" autocomplete="current-password" required autofocus${error ? ' aria-invalid="true" aria-describedby="e"' : ""}>
${error ? '<p class="err" id="e" role="alert">Rangt lykilorð. Reyndu aftur.</p>' : ""}
<button type="submit">Opna</button>
</form>
</main>
</body>
</html>`;
	return withHeaders(
		new Response(html, {
			status: error ? 401 : 200,
			headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
		}),
	);
}

function text(status, body) {
	return withHeaders(new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }));
}

export default {
	async fetch(request, env) {
		const secret = env.SITE_PASSWORD;
		// Lokað ef lykilorð vantar – aldrei opið fyrir mistök.
		if (!secret) return text(503, "Vefurinn er ekki tilbúinn: lykilorð hefur ekki verið stillt.");

		const url = new URL(request.url);

		if (url.pathname === "/login") {
			if (request.method === "POST") {
				const form = await request.formData().catch(() => null);
				const password = form && form.get("password");
				const next = safeNext(form && form.get("next"));
				if (typeof password === "string" && (await safeEqual(password, secret))) {
					const cookie = `${COOKIE}=${await makeToken(secret)}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`;
					return withHeaders(new Response(null, { status: 303, headers: { Location: next, "Set-Cookie": cookie, "Cache-Control": "no-store" } }));
				}
				return loginPage({ error: true, next });
			}
			return loginPage({ next: safeNext(url.searchParams.get("next")) });
		}

		if (url.pathname === "/logout") {
			return withHeaders(
				new Response(null, {
					status: 303,
					headers: { Location: "/login", "Set-Cookie": `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`, "Cache-Control": "no-store" },
				}),
			);
		}

		if (!(await validToken(secret, getCookie(request, COOKIE)))) {
			const dest = "/login?next=" + encodeURIComponent(url.pathname + url.search);
			return withHeaders(new Response(null, { status: 303, headers: { Location: dest, "Cache-Control": "no-store" } }));
		}

		const res = await env.ASSETS.fetch(request);
		return withHeaders(res, { "Cache-Control": "private, no-cache" });
	},
};
