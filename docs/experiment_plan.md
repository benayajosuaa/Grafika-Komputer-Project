# Experiment Plan

## Tujuan Evaluasi
- Validasi visual hasil estimasi BRDF
- Uji robustness terhadap variasi lighting/noise
- Ukur performa GPU (frame time, FPS)

## Variasi Eksperimen
### 1) Variasi Lighting
- [ ] Indoor terang
- [ ] Indoor redup
- [ ] Outdoor siang
- [ ] Outdoor sore

### 2) Variasi Noise
- [ ] Noise rendah
- [ ] Noise sedang
- [ ] Noise tinggi

### 3) Variasi Material
- [ ] Dielektrik
- [ ] Logam
- [ ] Semi-metallic

## Metrik
- **PSNR**: [target / rentang]
- **SSIM**: [target / rentang]
- **Frame time**: [ms]
- **FPS**: [min]

## Baseline / Referensi
- [Paper/Metode pembanding]
- [Benchmark sederhana jika ada]

## Format Pelaporan
- Tabel ringkas hasil per kondisi
- Screenshot hasil render (input vs output)
- Catatan observasi kualitatif
