#!/data/data/com.termux/files/usr/bin/sh
# Jalankan dev server Next.js: sh dev.sh   (buka http://localhost:3000, ?debug = HUD diag)
# PATH wajib: shim `next` di ext4 (~/.cache/lg-bin) tak bisa di-exec langsung dari FUSE.
D=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export PATH="$HOME/.cache/lg-bin:$PATH"
cd "$D" || exit 1
exec pnpm dev
