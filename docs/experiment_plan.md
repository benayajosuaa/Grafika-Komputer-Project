# Experiment Plan

## Tujuan Evaluasi
- Validasi visual hasil estimasi BRDF dari single-image.
- Uji robustness terhadap variasi pencahayaan dan noise.
- Ukur performa GPU (frame time, FPS) pada WebGL.

## Setup Eksperimen
- **Perangkat**: [jenis smartphone/PC]
- **Resolusi input**: [misal 512x512]
- **Model material**: [Cook-Torrance / GGX]
- **Iterasi optimisasi**: [jumlah]

## Desain Eksperimen
### A) Variasi Pencahayaan
- Indoor terang
- Indoor redup
- Outdoor siang
- Outdoor sore

### B) Variasi Noise
- Noise rendah
- Noise sedang
- Noise tinggi

### C) Variasi Material
- Dielektrik (non-logam)
- Logam
- Semi-metallic

## Prosedur
1. Ambil foto material pada kondisi yang ditentukan.
2. Jalankan pipeline estimasi BRDF.
3. Simpan output parameter dan hasil render.
4. Hitung metrik PSNR/SSIM dan catat frame time/FPS.
5. Ulangi untuk setiap variasi kondisi.

## Metrik & Indikator
- **PSNR**: semakin tinggi semakin baik.
- **SSIM**: mendekati 1 berarti struktur lebih mirip.
- **Frame time**: semakin kecil semakin baik.
- **FPS**: semakin tinggi semakin baik.

## Baseline / Pembanding
- Referensi literatur yang memakai multi-view atau DL.
- Perbandingan kualitatif dengan hasil render sederhana (tanpa optimisasi).

## Output & Pelaporan
- Tabel ringkas hasil per kondisi.
- Screenshot input vs output.
- Catatan observasi kualitatif (artefak, stabilitas).
