<div align="center">

<img src="public/icons/icon.svg" width="96" alt="MetaCrypt logo" />

# MetaCrypt

**Open-source client-side metadata editor with encrypted metadata support.**

View, edit, clean, export and *encrypt* image metadata — 100% in your browser.
No uploads. No backend. No tracking.

🌐 **[English](README.md)** · [Русский](docs/README.ru.md) · [Қазақша](docs/README.kk.md)

`react` `typescript` `vite` `tailwindcss` `webcrypto` `exif` `xmp` `iptc` `png` `aes` `privacy` `pwa` `github-pages`

</div>

---

## Why MetaCrypt?

Every photo you take carries invisible baggage: GPS coordinates, camera serial
numbers, timestamps, editing history. Most tools that let you inspect it want
you to **upload your files to a server**. MetaCrypt doesn't — it *can't*.
There is no server. Everything runs in your browser via the File API, typed
arrays and the Web Crypto API, and keeps working with the network cable
unplugged.

MetaCrypt aims to be the reference open-source metadata editor for
photographers, developers, digital-forensics specialists, archivists — and,
as a bonus feature, it can hide AES-256-encrypted records inside your images.

## Features

- 🔍 **Inspect** — EXIF, XMP, IPTC, PNG text chunks, ICC presence, GPS,
  file facts, SHA-256 checksum, RAW views (JSON / XML / HEX / tree)
- ✏️ **Edit** — change, add, rename and delete fields; custom XMP namespaces;
  type-aware EXIF value parsing (rationals, GPS, dates)
- 🧹 **Clean** — strip any metadata family (or everything) in one click,
  without recompressing a single pixel
- 🔐 **Encrypt** — the Secure Vault embeds an AES-256-GCM encrypted record
  (logins, tokens, notes, unlimited custom fields) into the image's XMP
- 📤 **Export / Import** — JSON, XML, TXT
- 📡 **Compatibility checker** — will Telegram / WhatsApp / Drive / Discord…
  keep or destroy your metadata (and your encrypted vault)?
- 🌍 **Multilingual** — English, Русский, Қазақша; system language
  auto-detected
- 🌓 **Dark / light theme**, responsive, keyboard-navigable, ARIA-labelled
- 📴 **Installable PWA** — fully offline after the first visit

## Quick start

Requirements:

- Node.js 20+
- npm 10+

```bash
git clone <repository-url>
cd MetaCrypt
npm install
npm run dev
```

Then open the URL printed by Vite, usually `http://localhost:5173/`.

## How to use

1. Open **Editor** and drop an image into the upload area.
2. Inspect the parsed metadata in the Overview, EXIF, XMP, IPTC, PNG and RAW tabs.
3. Edit supported fields, clean unwanted metadata, or export metadata as JSON/XML/TXT.
4. Open **Secure Vault** if you want to embed an encrypted record into the image.
5. Download the edited image. Pixel data is copied byte-for-byte; only metadata containers are changed.

For privacy testing, open DevTools → Network after the initial app load. Normal file operations should not create upload requests because all parsing, editing and encryption run in the browser.

## Architecture

```
src/
├── components/     # UI: shadcn-style primitives + app components
├── pages/          # Home, Editor (9 tabs), Vault, 404
├── hooks/          # useImageStore (in-memory image state), useTheme, useSha256
├── crypto/         # AES-256-GCM + PBKDF2 (Web Crypto), password tools
├── metadata/       # the engine:
│   ├── jpeg.ts     #   JPEG segment surgery (APP1/APP13/COM splicing)
│   ├── png.ts      #   PNG chunks: tEXt / zTXt / iTXt codecs
│   ├── exif.ts     #   EXIF editing (piexifjs, type-aware)
│   ├── xmp.ts      #   XMP packet parse/serialize (flat model)
│   ├── iptc.ts     #   IPTC-IIM codec (Photoshop APP13 / 8BIM)
│   ├── metacrypt.ts#   encrypted envelope ↔ XMP bridge
│   ├── reader.ts   #   unified parse (ExifReader for the read-only views)
│   ├── writer.ts   #   unified write (edits → new file bytes)
│   ├── cleaner.ts  #   metadata stripping
│   ├── exporter.ts #   JSON/XML/TXT export + import
│   └── compat.ts   #   platform compatibility rules
├── workers/        # SHA-256 checksum off the main thread
├── i18n/           # en / ru / kk translations
├── types/          # domain types + vendor lib declarations
└── utils/          # binary helpers, downloads, formatting
```

**Key design decision:** metadata lives in container-level structures (JPEG
segments, PNG chunks) *before* the pixel data. MetaCrypt splices those
structures and copies the compressed pixels byte-for-byte — original quality
is always preserved, nothing is ever re-encoded.

## Supported formats & metadata

| Format | EXIF | XMP | IPTC | PNG text | Clean |
|--------|------|-----|------|----------|-------|
| JPEG   | ✏️ read/write | ✏️ read/write | ✏️ read/write | — | ✅ |
| PNG    | 👁 read | ✏️ read/write | — | ✏️ read/write | ✅ |
| WebP / GIF / TIFF / HEIC / AVIF | 👁 read | 👁 read | 👁 read | — | — |

Notes:

- JPEG editing works by replacing metadata segments while preserving compressed image data.
- PNG editing currently targets text/XMP metadata chunks. PNG `eXIf` is read-only in this version.
- Some social platforms and messengers strip metadata by design. Use the Compatibility tab before relying on an embedded vault.

## Encryption

The Secure Vault stores an encrypted record inside the image's XMP packet
under the `https://metacrypt.app/ns/1.0/` namespace:

```
password ──PBKDF2-SHA256 (600 000 iterations, random 16-byte salt)──▶ AES-256 key
record JSON ──AES-256-GCM (random 96-bit IV, 128-bit auth tag)──▶ ciphertext
```

```xml
<rdf:Description xmlns:mc="https://metacrypt.app/ns/1.0/">
  <mc:Version>1</mc:Version>
  <mc:Algorithm>AES-256-GCM</mc:Algorithm>
  <mc:KDF>PBKDF2</mc:KDF>
  <mc:Iterations>600000</mc:Iterations>
  <mc:Salt>…base64…</mc:Salt>
  <mc:IV>…base64…</mc:IV>
  <mc:CipherText>…base64…</mc:CipherText>
  <mc:Created>2026-07-02T12:00:00.000Z</mc:Created>
</rdf:Description>
```

The envelope is versioned so future releases can evolve the format while
still decrypting old images. GCM authenticates the payload: a wrong password
or tampered data yields one **generic** error — no technical details leak.

## Privacy model

| Guarantee | How |
|-----------|-----|
| Images never leave the device | no network code paths; files live in a `Uint8Array` in memory |
| Passwords never leave the device | Web Crypto `deriveKey` with non-extractable keys |
| No cookies, no secrets in localStorage | only theme & language preferences are stored |
| Nothing decrypted is logged | decrypted data exists only in React state until you hide it |
| Auditable | MIT-licensed, ~60 small source files, no obfuscation |

## Security notes

MetaCrypt is a client-side privacy tool, not a substitute for a dedicated password manager or encrypted backup system.

- The encrypted vault protects the record contents, but the fact that a vault exists is visible in XMP.
- If a platform strips metadata, the encrypted vault is removed together with the metadata.
- A forgotten password cannot be recovered.
- Browser extensions, compromised devices, clipboard managers or screen recorders can still observe data while you are using the app.
- For sensitive work, use a trusted offline browser profile and keep original files backed up.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build (dist/) — deployable to GitHub Pages as-is
npm run preview    # serve the production build locally
```

The build uses relative asset paths (`base: './'`) and hash-based routing, so
`dist/` works from any static host or sub-path — including GitHub Pages.

## Deployment

### Static hosting

```bash
npm run build
```

Upload the contents of `dist/` to any static host.

### GitHub Pages

The project is already configured for GitHub Pages-friendly paths:

- Vite uses `base: './'`.
- Routing uses hash URLs, so refreshes work on static hosting.
- The generated PWA files live in `dist/`.

One simple deployment flow:

1. Push the source code to GitHub.
2. Run `npm run build`.
3. Publish the `dist/` folder through GitHub Pages, GitHub Actions, or a `gh-pages` branch.

## Repository checklist

Before publishing a release:

```bash
npm run typecheck
npm run build
npm audit --omit=dev
```

The repository should include source files, `package-lock.json`, docs and public assets. It should not include `node_modules/`, `dist/`, local editor folders or private `.env` files.

## Roadmap

- [ ] Batch processing & folder upload
- [ ] Metadata comparison / diff of two images
- [ ] Undo / redo history
- [ ] Steganography module (LSB)
- [ ] Digital signatures
- [ ] Plugin architecture
- [ ] CLI version · Desktop (Tauri) · Browser extension

## FAQ

**Is my image really not uploaded anywhere?**
Yes. Open DevTools → Network while using the app: after the initial page
load there are zero requests. The app even works offline as a PWA.

**Can someone see that an image contains a MetaCrypt vault?**
Yes — the envelope metadata (algorithm, salt, IV, ciphertext) is visible to
any XMP reader by design. Without the password the content is
computationally unreadable. If you need deniability, remember that platforms
that re-encode images (Telegram photos, WhatsApp) destroy the vault entirely.

**I forgot my password. Can you recover the record?**
No. There is no backdoor, no recovery, no server. That's the point.

**Why does editing PNG EXIF not work?**
PNG stores EXIF in an `eXIf` chunk; v1 reads it but doesn't write it yet —
it's on the roadmap.

## Contributing

Issues and PRs are welcome. Keep changes focused, typed, and commented in the
existing style; every metadata codec must round-trip byte-safely (never write
a file you can't re-parse). Run `npm run build` before submitting.

## License

[MIT](LICENSE)
