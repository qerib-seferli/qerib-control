# Q-Control — Final İdarəetmə Sistemi

Q-Control mənim aylıq xidmət göstərdiyim sayt və sistemləri bir paneldən idarə etməyim üçün hazırlanmış şəxsi nəzarət sistemidir.

Panel:
- GitHub Pages-də işləyir;
- PWA kimi telefona quraşdırılır;
- Supabase Auth + Database + RLS + Storage istifadə edir;
- domenli layihələri bir universal Cloudflare Worker ilə idarə edir;
- layihələrin ödəniş tarixini, statusunu, ikonunu, audit tarixçəsini və qazancı saxlayır.

---

## 1. Arxitektura

```text
Mən → Q-Control PWA
          ↓
       Supabase
          ↓
  active / suspended
          ↓
Cloudflare q-control-gateway
          ↓
Müştərinin domeni
```

Layihə `active` olduqda Worker sorğunu normal origin-ə ötürür.

Layihə `suspended` olduqda GitHub 404 göstərilmir. Q-Control-un premium **“Xidmət müvəqqəti dayandırılıb”** ekranı göstərilir.

Q-Control/Supabase qısa müddət əlçatmaz olsa Worker `fail-open` işləyir və müştəri saytı səbəbsiz bağlanmır.

---

## 2. Q-Control-un əsas funksiyaları

Dashboard:
- aktiv layihə sayı;
- dayandırılmış layihə sayı;
- 7 gün ərzində vaxtı çatan layihələr;
- aktiv layihələrin aylıq portfeli;
- cari ayda daxil olmuş ödənişlər;
- bütün ödəniş tarixçəsi üzrə ümumi qazanc.

`Ümumi qazanc` Q-Control-da qeyd etdiyim **brüt daxilolmadır**. Xərc çıxılmır.

Layihələr:
- ad;
- ikon;
- slug;
- domen;
- aylıq qiymət;
- bitmə tarixi;
- active / suspended / cancelled;
- avtomatik dayandırma;
- maintenance başlığı və mətni;
- daxili qeyd.

Ödənişlər:
- 1 / 3 / 6 / 12 ay;
- faktiki məbləğ;
- ödəniş tarixi;
- period başlanğıcı və sonu;
- qeyd;
- ümumi qazanc və cari ay qazancı.

Tarixçə:
- layihə yaradılması;
- redaktə;
- status dəyişməsi;
- ödəniş;
- arxiv;
- public-key dəyişməsi;
- profil dəyişiklikləri.

---

## 3. Vaxt və tarix qaydası

Q-Control biznes vaxtını **Asia/Baku / Azərbaycan vaxtı** kimi göstərir.

Frontend `datetime-local` tarixlərini `+04:00` Azərbaycan vaxtı kimi Supabase-ə göndərir. Buna görə kompüter və ya telefon başqa timezone-a keçsə belə paneldə layihənin ödəniş saatı Azərbaycan vaxtına görə göstərilir.

Misal:

```text
Bitmə: 15.08.2026 12:00
+ 1 ay → 15.09.2026 12:00
+ 3 ay → 15.11.2026 12:00
```

Ayın 29/30/31-i kimi tarixlərdə növbəti ayda həmin gün yoxdursa son mümkün gün seçilir.

Auto suspend aktivdirsə `paid_until` vaxtı çatanda public status RPC layihəni dərhal dayandırılmış hesab edir.

---

## 4. Yeni DOMENLİ layihəni qoşmaq

Bu ən yaxşı və ən asan üsuldur.

### Q-Control

1. `+ Layihə` bas.
2. Layihə adını yaz.
3. İkon seç.
4. Domeni yalnız host kimi yaz:
   ```text
   example.az
   ```
5. Aylıq məbləği yaz.
6. Ödəniş bitmə tarixini yaz.
7. `Avtomatik dayandır` açıq qalsın.
8. `Yadda saxla`.

### Cloudflare

Bir dəfə yaratdığım Worker:

```text
q-control-gateway
```

Yeni layihə üçün **yeni Worker yaratmıram**.

Cloudflare:

```text
Workers & Pages
→ q-control-gateway
→ Domains
→ Add Route
→ layihənin zone-u
```

Əsas domen üçün:

```text
example.az/*
```

`www` işləyirsə ayrıca:

```text
www.example.az/*
```

əlavə edirəm.

**Add Domain / Custom Domain istifadə etmirəm. Route istifadə edirəm.**

Layihənin HTML və JS fayllarına Q-Control kodu əlavə etmək lazım deyil.

GitHub Pages-i də `Unpublish` etmirəm. Origin daim publish qalır.

---

## 5. Domenli layihənin real testi

Qoşduqdan sonra həmişə bu testi et:

### Aktiv test

Q-Control:

```text
Layihə → Aktiv et
```

Incognito/private pəncərədə domeni aç.

Normal sayt gəlməlidir.

### Dayandırma testi

Q-Control:

```text
Layihə → Dayandır
```

Domeni yenilə.

Q-Control maintenance ekranı gəlməlidir.

### Ödəniş testi

Q-Control:

```text
Layihə → Ödəniş
→ 1 / 3 / 6 / 12 ay
→ məbləğ
→ Ödənişi qeyd et və aktivləşdir
```

Normal sayt yenidən açılmalıdır.

---

## 6. Domeni OLMAYAN layihə necə qoşulur?

Məsələn yalnız belə ünvan varsa:

```text
https://qerib-seferli.github.io/project/
```

`github.io` mənim domenim olmadığı üçün Cloudflare route ilə onun bütün trafikini tuta bilmərəm.

Üç seçim var.

### A — tövsiyə edilən

Layihəyə öz domen/subdomain qoş.

Sonra onu Cloudflare-ə əlavə et və normal Worker Route istifadə et.

Bu ən güclü və ən az kod tələb edən üsuldur.

### B — ortaq giriş JS-i varsa

Layihədə bütün səhifələrin istifadə etdiyi `core.js`, `app.js`, `layout.js` kimi ortaq giriş nöqtəsi varsa Q-Control frontend guard həmin bir girişdən çağırıla bilər.

Q-Control → Layihə → Ətraflı bölməsində public key var.

Nümunə:

```html
<script>
window.Q_CONTROL = {
  projectKey: "PUBLIC_KEY",
  domain: ""
};
</script>
<script src="https://qerib-seferli.github.io/qerib-control/client/q-control-guard.js"></script>
```

Bu Cloudflare qədər sərt deyil. Source kodunu idarə edən proqramçı guard-u silə bilər.

### C — nə domen, nə də ortaq giriş yoxdursa

Ehtiyat üsul:

```text
GitHub → Settings → Pages → Unpublish site
```

Açmaq:

```text
Actions → Pages workflow → Run workflow
```

Bu halda xüsusi maintenance səhifəsi yox, GitHub 404 görünə bilər.

---

## 7. Layihə ikonları

Supabase bucket:

```text
project-icons
```

Hər layihə üçün yalnız:

```text
<project-id>/icon.webp
```

saxlanılır.

Q-Control:
- PNG/JPG/WebP qəbul edir;
- browser-də 256×256 WebP edir;
- yeni ikon yüklənəndə köhnə `icon.webp` silinir;
- sonra eyni path-ə yeni ikon yazılır;
- DB-də yalnız son `icon_url` qalır.

Beləliklə ikon dəyişdikcə Storage lazımsız fayllarla dolmur.

---

## 8. Ödəniş və qazanc qaydası

Məsələn aylıq qiymət:

```text
94.12 ₼
```

1 ay seçəndə ilkin məbləğ:

```text
94.12 ₼
```

3 ay:

```text
282.36 ₼
```

6 ay:

```text
564.72 ₼
```

12 ay:

```text
1129.44 ₼
```

Məbləği lazım olsa ödəniş pəncərəsində əl ilə dəyişmək mümkündür.

Ödəniş qeydə alınanda:
1. `control_payments` tarixçəsinə əlavə olunur;
2. layihənin `paid_until` tarixi uzadılır;
3. layihə `active` edilir;
4. audit jurnalı yazılır;
5. Dashboard qazancı yenilənir.

`Aylıq portfel` başqa anlayışdır: hazırda aktiv layihələrin aylıq müqavilə məbləğlərinin cəmidir.

`Bu ay qazanc`: Azərbaycan vaxtına görə cari təqvim ayında faktiki qeyd edilmiş ödənişlərin cəmidir.

`Ümumi qazanc`: `control_payments` tarixçəsində olan bütün faktiki ödənişlərin cəmidir.

Test üçün yazılmış ödəniş də database-də qaldığı müddətdə qazanca daxil olacaq. Test qeydi istənmirsə production istifadəsindən əvvəl həmin test payment ayrıca silinməli/düzəldilməlidir.

---

## 9. Cloudflare Worker

Worker adı:

```text
q-control-gateway
```

Mənbə kod:

```text
cloudflare/q-control-worker.js
```

`workers.dev` URL health-check üçündür və belə cavab verir:

```json
{
  "ok": true,
  "service": "q-control-gateway",
  "status": "ready"
}
```

Bir Worker bütün domenli layihələr üçün istifadə olunur.

Yeni layihədə yalnız yeni Route əlavə olunur.

Worker production-da dəyişdirilərsə:

```text
Workers & Pages
→ q-control-gateway
→ Edit code
→ Deploy
```

---

## 10. PWA

Q-Control telefon browserindən açılır və PWA kimi quraşdırılır.

Telefon UI:
- dashboard statistikaları 2 sütun;
- böyük layihə kartları 1 sütun;
- settings blokları 1 sütun;
- aşağıda sabit mobil naviqasiya;
- `+` düyməsi ilə sürətli layihə əlavə etmə;
- safe-area dəstəyi;
- standalone tətbiq görünüşü.

PWA köhnə versiyanı göstərirsə:
1. tətbiqi tam bağla;
2. yenidən aç;
3. lazım olsa browser-də Q-Control səhifəsini hard refresh et.

Service Worker cache versiyası dəyişdirildikdə köhnə shell avtomatik təmizlənir.

---

## 11. Müştəri layihəsinin öz PWA-sı varsa

Cloudflare request-ləri server tərəfdə idarə edir, amma müştəri layihəsinin öz Service Worker-i navigation səhifəsini tam cache-dən verirsə köhnə açıq ekran görünə bilər.

Buna görə Q-Control-a bağlanan PWA layihələrdə navigation üçün:
- network-first;
- və ya offline navigation cache-in söndürülməsi

tövsiyə olunur.

Real test həmişə həm browser, həm də quraşdırılmış PWA-da edilməlidir.

---

## 12. Təhlükəsizlik

- Q-Control login Supabase Auth-dır.
- əsas cədvəllər RLS ilə qorunur;
- admin olmayan hesab panel məlumatına girə bilmir;
- `service_role` və Supabase secret key frontend/Worker koduna yazılmır;
- Worker yalnız məhdud public status RPC çağırır;
- idarə olunmayan domen tapılmazsa Worker `fail-open` edir;
- Q-Control API cavab verməsə müştəri saytı səbəbsiz dayandırılmır.

Anon/publishable key brauzer və public RPC üçün istifadə olunur. Səlahiyyət təhlükəsizliyi RLS/RPC tərəfində qalır.

---

## 13. Backup / dəyişiklik etməzdən əvvəl

Əsas Q-Control dəyişikliklərindən əvvəl:
1. GitHub-da işlək commit saxla;
2. Supabase SQL-i destructive etmə;
3. `control_projects`, `control_payments`, `control_activity_logs` məlumatlarını silmə;
4. Cloudflare route-u dəyişdirəndə əvvəl bir layihədə test et.

Müştəri layihəsinin Supabase URL/key-i ilə Q-Control üçün oynama.

---

## 14. Yeni layihə üçün 60 saniyəlik checklist

```text
[ ] Q-Control → + Layihə
[ ] Ad
[ ] İkon
[ ] Domain
[ ] Aylıq qiymət
[ ] Bitmə tarixi
[ ] Auto suspend = ON
[ ] Yadda saxla
[ ] Cloudflare → q-control-gateway → Domains
[ ] example.az/*
[ ] www.example.az/* (işləyirsə)
[ ] Aktiv test
[ ] Dayandır test
[ ] Ödəniş/aktiv test
```

Bitdi.

---

## 15. Mövcud real nümunə — Meyvəçi

```text
Layihə: Meyvəçi
Domain: meyveci.az
Worker: q-control-gateway
Routes:
  meyveci.az/*
  www.meyveci.az/*
```

Q-Control-dan `Dayandır` veriləndə xüsusi maintenance səhifəsi göstərilir.

`Aktiv et` və ya `Ödənişi qeyd et və aktivləşdir` verildikdə normal Meyvəçi saytı açılır.

Bu, yeni layihələri qoşarkən işlək referans nümunədir.


# Q-Control V3 — layihə və ödəniş tipləri

Q-Control artıq yalnız sayt bağlama sistemi deyil, bütün layihələrimin portfolio + gəlir nəzarət panelidir.

## İdarəetmə tipləri

### 1. Aylıq xidmət + sayt dayandırıla bilər
`enforced_recurring`

Meyvəçi kimi layihələr üçündür.

- aylıq məbləğ var;
- ödəniş bitmə tarixi var;
- auto suspend işləyir;
- Cloudflare Worker saytın girişini dayandıra bilir;
- ödəniş qeyd ediləndə tarix uzanır və sayt aktivləşir.

### 2. Aylıq xidmət + yalnız ödəniş izləmə
`monitor_recurring`

Məsələn email sistemi üçün hər ay $20 aldığım, amma saytı bağlamaq istəmədiyim layihə.

- aylıq məbləğ və tarix izlənir;
- 7 gün qalmış sarı xəbərdarlıq görünür;
- vaxt keçərsə `ÖDƏNİŞ GECİKİB` görünür;
- sayt Q-Control tərəfindən heç vaxt bloklanmır;
- Cloudflare route olsa belə Worker həmişə saytı buraxır.

### 3. Birdəfəlik layihə / satış
`one_time`

Birdəfəlik qiymətə satdığım layihələr üçündür.

- `Layihənin satış qiyməti` yazılır;
- neçə hissə ödəniş alsam hər birini `Layihə satışı` kimi əlavə edirəm;
- Q-Control `Alınıb` və `Qalıq` məbləğini hesablayır;
- sayt dayandırılmır;
- aylıq tarix tələb olunmur.

## Eyni layihədə satış + aylıq xidmət

Layihə aylıq xidmətlidirsə belə `Layihənin satış qiyməti` yaza bilərəm.

Ödəniş pəncərəsində:
- `Aylıq xidmət`
- `Layihə satışı / ilkin ödəniş`

seçimi var.

Beləliklə məsələn:
- saytın hazırlanması: 1500 AZN;
- alınan ilkin ödənişlər: 500 + 500 + 500;
- aylıq server/xidmət: 94.12 AZN

eyni layihə daxilində ayrıca izlənir.

## Valyuta

Hər layihə üçün:
- AZN
- USD
- EUR

seçilir.

Q-Control fərqli valyutaları bir-birinə səhvən toplamır. Dashboard-da nəticə məsələn belə görünə bilər:

`144,12 ₼ · $20`

## Domen linki

Layihə kartında və layihələr cədvəlində domenin üzərinə toxunanda sayt yeni tabda açılır.

## Yeni layihə üçün qısa seçim

Saytı bağlamaq istəyirəm:
`Aylıq xidmət + sayt dayandırıla bilər`

Ödənişi izləyirəm, amma saytı bağlamıram:
`Aylıq xidmət + yalnız ödəniş izləmə`

Birdəfəlik satmışam:
`Birdəfəlik layihə / satış`

## Quraşdırma

V3 fayllarını GitHub-a deploy etdikdən sonra Supabase SQL Editor-də bir dəfə:

`sql/05_upgrade_v3_billing_portfolio.sql`

run et.

Mövcud Meyvəçi layihəsi avtomatik əvvəlki rejimdə qalır:
`enforced_recurring + AZN`.

Cloudflare Worker kodunu dəyişmək lazım deyil; V3 SQL-də mövcud `check_control_service_by_domain()` RPC-si yeni rejimlərə uyğun yenilənir.
