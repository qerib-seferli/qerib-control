# Q-Control

Q-Control şəxsi layihə/xidmət nəzarət panelidir. GitHub Pages-də sayt/PWA kimi işləyir, Supabase Auth + Postgres + RLS istifadə edir.

## Əsas imkanlar
- yalnız admin login
- layihə əlavə et / redaktə et / arxivlə
- active / suspended / cancelled statusları
- dəqiq ödəniş bitmə tarixi və avtomatik dayandırma
- 1 / 3 / 6 / 12 ay uzatma
- ödəniş tarixçəsi
- fəaliyyət jurnalı
- hər layihə üçün public status açarı
- müştəri saytına qoşmaq üçün `client/q-control-guard.js`
- PWA install
- offline shell (məlumatlar yalnız internet olduqda Supabase-dən gəlir)

## Quraşdırma ardıcıllığı

1. Supabase SQL Editor-də `sql/01_schema.sql` faylını tam run et.
2. Supabase Authentication > Users bölməsində öz email/parol istifadəçini yarat.
3. `sql/02_make_admin.sql` faylında emaili öz emailinlə əvəz et və run et.
4. GitHub-da bu repo-nu publish et.
5. `js/config.js` artıq verilmiş Supabase URL və anon key ilə hazırlanıb.
6. Panelə daxil ol və ilk layihəni yarat.
7. Layihənin `Public key` dəyərini götür və müştəri saytında `client/q-control-guard.js` nümunəsinə uyğun qoş.

## Avtomatik dayandırma

`01_schema.sql` Supabase Cron (`pg_cron`) aktivləşdirməyə və hər dəqiqə statusları yeniləyən job yaratmağa çalışır. Əgər plan/proyekt icazəsinə görə cron job yaradılması xəta verərsə, SQL-in sonundakı CRON bölməsini ayrıca çıxarıb qalan SQL-i run et. Q-Control status RPC-si tarix keçməsini onsuz da real vaxtda hesablayır; cron sadəcə DB-də saxlanılan statusu da sinxron saxlayır.

## Vacib təhlükəsizlik qeydi

Frontend-də olan anon key gizli server sirri deyil; təhlükəsizlik RLS və RPC icazələri ilə təmin olunur. Heç vaxt `service_role` / secret key-i GitHub-a və ya brauzer koduna yazma.

## Müştəri saytının bağlanması

Q-Control inteqrasiyasından sonra GitHub Pages-i `Unpublish` etmə. Sayt publish qalır, `q-control-guard.js` statusu yoxlayır:
- aktivdirsə normal sayt açılır;
- dayandırılıbsa premium maintenance ekranı göstərilir.

Frontend guard 100% dəyişdirilməz lisenziya mexanizmi deyil: source kodu idarə edən proqramçı onu silə bilər. Daha sərt variant üçün sonradan Cloudflare Worker səviyyəsində enforcement əlavə etmək olar.
