# moneycellsapp.com — static site

Plain HTML/CSS. No build step. Colors match the app's "ocean-candy" theme (`C` in `App.js`).

```
index.html              Home
Privacy-Policy/         /Privacy-Policy/ (same URL as the old site, which the App Store listing links to)
support/                /support/
404.html                Custom 404
assets/style.css        Shared styles and color tokens (:root)
assets/logo.png, favicon-*.png, apple-touch-icon.png   App icon (from App Store v1.5.0)
.htaccess               HTTPS + www redirects, 404 page, caching
```

## Before you upload
- Confirm `support@moneycellsapp.com` exists, or search-and-replace it.
- Have the Privacy Policy reviewed. It was written from the app code, not copied from the old site.

## Deploy to Namecheap (cPanel)
1. cPanel → **SSL/TLS Status** → run AutoSSL for moneycellsapp.com and www (the `.htaccess` forces HTTPS).
2. Back up the current `public_html` (File Manager → select all → Compress).
3. Upload the **contents** of this folder, including the hidden `.htaccess`, into `public_html`.
   In File Manager, turn on Settings → "Show Hidden Files" to see it.
4. Check https://www.moneycellsapp.com/ and https://www.moneycellsapp.com/Privacy-Policy/
   The path is case-sensitive on Namecheap's Linux hosting.

Preview locally: `python3 -m http.server -d website 8000`. `.htaccess` rules only run on Apache.
