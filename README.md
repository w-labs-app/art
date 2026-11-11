# wilsonart

Lítill, læstur vefur á Cloudflare Workers sem sýnir hönnunarhugmyndir. Forsíðan (`/`) sýnir yfirlit, hver hugmynd á sína slóð.

Allar hugmyndir eru **hönnunartillögur**, ekki opinberir vefir fyrirtækjanna. Vefurinn er `noindex` (meta tag og `X-Robots-Tag` haus á öllum svörum).

## Svona bætirðu við nýrri hugmynd

1. Búðu til nýja möppu undir `public/`, t.d. `public/naesta-hugmynd/`, og settu `index.html` (og aðrar skrár hugmyndarinnar) þar.
2. Settu forskoðunarmynd í `public/img/`, t.d. `public/img/naesta-hugmynd.jpg`.
3. Bættu einni færslu við `public/ideas.json`:
   ```json
   {
     "title": "Heiti hugmyndar",
     "description": "Ein lína af lýsingu.",
     "url": "/naesta-hugmynd/",
     "image": "/img/naesta-hugmynd.jpg",
     "tag": "Hönnunartillaga"
   }
   ```
   (Mundu kommu á milli færslna.)
4. Vistaðu og sendu á GitHub: `git add .`, `git commit -m "Ný hugmynd"`, `git push`.
5. Cloudflare byggir og uppfærir vefinn sjálfkrafa eftir um mínútu.

Ef hugmyndin er byggð á alvöru fyrirtæki, hafðu línuna „Hönnunartillaga. Ekki opinber vefur …“ í fæti síðunnar.

## Lykilorðið

Vefurinn er læstur. Workerinn (`src/index.js`) athugar lykilorðið áður en nokkur skrá er afhent. Lykilorðið er **aldrei** í kóðanum eða í git. Það er geymt sem Cloudflare secret með nafninu `SITE_PASSWORD`.

Ef secret vantar svarar vefurinn með villu og er lokaður (aldrei opinn fyrir mistök).

### Skipta um lykilorð

Í Cloudflare vefviðmótinu: Workers & Pages → `art` → Settings → Variables and Secrets → `SITE_PASSWORD` → Edit → settu inn nýtt gildi → Deploy.

Eða í skipanalínu, í möppu verkefnisins:

```
npx wrangler secret put SITE_PASSWORD
```

Allir sem voru innskráðir þurfa þá að skrá sig inn aftur (kökurnar gilda ekki lengur).

### Prófa á eigin tölvu

Búðu til skrána `.dev.vars` (hún er í `.gitignore`, fer aldrei á GitHub) með einni línu: `SITE_PASSWORD=eitthvað-til-að-prófa`. Keyrðu svo `npm install` og `npm run dev`.
