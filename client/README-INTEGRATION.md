# Q-Control layihə inteqrasiyası

## 1) Real domen Cloudflare-dədirsə
Frontend guard istifadə etmə.

Universal `q-control-gateway` Worker-a route əlavə et:
- `domain.az/*`
- `www.domain.az/*` (www istifadə edilirsə)

HTML/JS dəyişiklik yoxdur.

## 2) Domen yoxdursa
Cloudflare `github.io` domenini idarə edə bilmədiyi üçün frontend guard istifadə olunur. Layihənin ortaq giriş faylından və ya bütün səhifələrin ortaq layoutundan Q-Control guard çağırılmalıdır.

```html
<script>
window.Q_CONTROL = {
  projectKey: "Q_CONTROL_PUBLIC_KEY",
  domain: ""
};
</script>
<script src="https://qerib-seferli.github.io/qerib-control/client/q-control-guard.js"></script>
```

Ortaq giriş nöqtəsi olmayan və öz domeni olmayan layihədə xaricdən bir faylla bütün səhifələri məcburi qorumaq mümkün deyil; manual GitHub Pages unpublish ehtiyat variantıdır.
