---
description: Update opencode-termux — pasang ulang via npm
---
# Update opencode-termux

Command bawaan `/update` (upgrade upstream) gagal di Termux dengan
`Installation method not found` — binary opencode tidak mengenali pemasangan
`@nemoobc/opencode-termux` sebagai pemasangan npm `@opencode/cli`.

Cara update yang benar untuk Termux:

```sh
npm install -g @nemoobc/opencode-termux@latest
```

Kalau npm memblokir script postinstall:

```sh
npm config set allow-scripts=@nemoobc/opencode-termux --location=user
npm rebuild -g @nemoobc/opencode-termux
```

📦 Paket: https://www.npmjs.com/package/@nemoobc/opencode-termux