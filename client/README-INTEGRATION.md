# Müştəri saytına Q-Control qoşulması

## 1. Guard faylını əlavə et
`q-control-guard.js` faylını müştəri reposunda, məsələn:
`assets/js/q-control-guard.js`

## 2. Q-Control panelindən Public key götür
Layihə → Ətraflı → Public key.

## 3. Müştərinin bütün əsas HTML səhifələrində `<head>` daxilində, app JS-dən əvvəl əlavə et

```html
<script>
window.Q_CONTROL = {
  projectKey: "BURAYA_PUBLIC_KEY",
  domain: "meyveci.az"
};
</script>
<script type="module" src="/assets/js/q-control-guard.js"></script>
```

GitHub Pages project path istifadə olunursa `/assets/...` əvəzinə uyğun nisbi path yaz.

## 4. Test
Q-Control panelində:
- Dayandır → səhifəni Incognito-da aç → maintenance ekranı görünməlidir.
- Aktiv et → səhifəni yenilə → sayt normal açılmalıdır.

Guard 60 saniyə session cache istifadə edir. Təcili testdə Incognito aç və ya sessionStorage təmizlə.

## Vacib
Bu üsul frontend enforcement-dir. Müştəri source kodunu tam idarə edirsə, texniki biliyi olan biri guard-u silə bilər. Daha sərt enforce üçün Cloudflare Worker mərhələsi əlavə etmək lazımdır.
