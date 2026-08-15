# Q-Control 2.0

Q-Control mənə məxsus layihə/xidmət nəzarət panelidir. Panel GitHub Pages + PWA kimi işləyir, məlumatları Supabase-də saxlayır. Real domeni Cloudflare-də olan layihələr **universal Cloudflare Worker** vasitəsilə idarə olunur. Belə layihələrin HTML və JS fayllarına Q-Control kodu əlavə etmək lazım deyil.

## Sistem necə işləyir?

```text
İstifadəçi → layihə domeni → Cloudflare Worker → Q-Control statusu
                                                ├─ ACTIVE → normal sayt
                                                └─ SUSPENDED → xüsusi xidmət ekranı
```

Q-Control əlçatmaz olarsa Worker `fail-open` işləyir: layihə təsadüfən bağlanmır.

## İlk dəfə Q-Control 2.0-a keçid

1. Supabase SQL Editor-də `sql/04_upgrade_v2_cloudflare_icons.sql` faylını bir dəfə Run et.
2. GitHub-a bu upgrade ZIP-indəki dəyişən/yeni faylları eyni qovluqlara deploy et.
3. PWA köhnə versiyanı göstərərsə tətbiqi bağlayıb yenidən aç və ya browser-də bir dəfə hard refresh et.
4. Cloudflare-də `cloudflare/q-control-worker.js` kodu ilə bir Worker yarat: `q-control-gateway`.
5. Hər real domen üçün həmin Worker-a Route əlavə et.

## Real domenli yeni layihəni qoşmaq — ən asan üsul

Məsələn `meyveci.az`.

1. Q-Control → `+ Layihə`.
2. Layihə adı, domen, aylıq məbləğ və bitmə tarixini yaz.
3. İstəsən layihə ikonunu seç. İkon 256×256 WebP olur.
4. Yadda saxla.
5. Cloudflare → Workers & Pages → `q-control-gateway`.
6. `Settings → Domains & Routes → Add → Route`.
7. Route olaraq:
   - `meyveci.az/*`
   - lazım olsa ayrıca `www.meyveci.az/*`
8. Bitdi. Layihənin HTML/JS fayllarına heç nə əlavə etmə.

### Test

1. Q-Control-da layihəni `Aktiv` et → sayt normal açılmalıdır.
2. `Dayandır` vur → yeni/incognito pəncərədə domeni aç → Q-Control-un xüsusi xidmət səhifəsi görünməlidir.
3. `Ödəniş` → 1/3/6/12 ay seç → `Ödənişi qeyd et və aktivləşdir`.
4. Saytı yenilə → normal sayt geri açılmalıdır.

**GitHub Pages-i Unpublish etmə.** Cloudflare Worker istifadə olunanda sayt həmişə publish qalır.

## Layihə ikonları

- Bucket: `project-icons`
- Fayl yolu həmişə: `<project-id>/icon.webp`
- Yeni ikon seçiləndə köhnə obyekt Storage API ilə silinir və eyni path-ə yeni WebP yazılır.
- Beləliklə hər dəyişiklikdə yeni fayllar yığılıb Storage-i doldurmur.
- DB-də yalnız son `icon_url` saxlanılır.

## Domeni olmayan layihə necə qoşulur?

Cloudflare Route yalnız sənə məxsus/Cloudflare-də idarə olunan domen üçün işləyir. Məsələn yalnız:

`https://qerib-seferli.github.io/project/`

ünvanı olan layihəyə `github.io` səviyyəsində Worker Route qoya bilmərəm, çünki `github.io` domeni mənə məxsus deyil.

Belə layihələr üçün 3 variant var:

### Variant A — ən yaxşısı
Layihəyə öz domain/subdomain qoş və Cloudflare Worker istifadə et. Sonra layihə koduna toxunmaq lazım deyil.

### Variant B — ortaq JS olan layihə
Layihənin bütün səhifələrinin istifadə etdiyi bir `core.js`, `app.js`, `layout.js` və s. varsa, həmin ortaq girişdən `client/q-control-guard.js` çağır. Public key Q-Control → Ətraflı bölməsindədir.

```html
<script>
window.Q_CONTROL = {
  projectKey: "PUBLIC_KEY",
  domain: ""
};
</script>
<script src="https://qerib-seferli.github.io/qerib-control/client/q-control-guard.js"></script>
```

Bu frontend üsuludur və source kodunu idarə edən proqramçı guard-u silə bilər.

### Variant C — heç domain, heç ortaq giriş yoxdursa
GitHub Pages `Unpublish / Run workflow` manual ehtiyat üsulundan istifadə et. Bir faylla bütün `github.io` trafikinə xaricdən nəzarət etmək mümkün deyil, çünki domen sənə məxsus deyil.

## İkon seçimi qaydası

Layihə yaradarkən və ya Redaktə edərkən ikon sahəsinə toxun:
- PNG / JPG / WebP
- maksimum giriş faylı 8 MB
- Q-Control browser-də 256×256 WebP-ə çevirir
- Storage-də yalnız son ikon qalır

## Ödəniş axını

`Ödəniş → 1 / 3 / 6 / 12 ay → məbləğ → Ödənişi qeyd et və aktivləşdir`

Sistem:
- ödəniş tarixçəsi yaradır;
- bitmə tarixini uzadır;
- statusu `active` edir;
- audit jurnalına yazır.

Tarix çatanda auto-suspend aktivdirsə Q-Control status yoxlaması layihəni dayandırılmış hesab edir.

## Təhlükəsizlik

- Admin panel RLS + Supabase Auth ilə qorunur.
- `service_role` / secret key heç vaxt frontend və Worker koduna yazılmamalıdır.
- Worker-dəki anon key yalnız məhdud public status RPC-ni çağırır.
- Public RPC cədvəlləri açmır; yalnız domenin `active/suspended` cavabını və maintenance mətnini verir.

## Q-Control-da browser/GitHub tipli popup

Q-Control 2.0 standart `window.confirm()` istifadə etmir. Aktivləşdirmə, dayandırma, arxiv və public-key yeniləmə üçün panelin öz modalı göstərilir. Ona görə popup-da `github.io says...` görünməməlidir.

## Cloudflare universal Worker

Kod: `cloudflare/q-control-worker.js`

Bir Worker bütün domenlər üçün kifayətdir. Yeni layihə üçün yeni Worker yaratma; yalnız mövcud `q-control-gateway` Worker-a yeni Route əlavə et.
