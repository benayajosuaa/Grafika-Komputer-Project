# Methodology Design (Detail)

## Ringkasan Pipeline
- **Input**: Foto material smartphone (single-image)
- **Output**: Estimasi parameter BRDF (albedo, roughness, metallic) + render ulang
- **Pendekatan**: Inverse rendering berbasis optimisasi (differentiable rendering)

## Flowchart Pipeline
> Tempatkan gambar flowchart final di: `docs/flowchart.svg` atau `docs/flowchart.png`

### Tahap 1 — Input & Pre-processing
- **Input data**: [jelaskan format, ukuran, contoh]
- **Pre-processing**:
  - Resize: [nilai]
  - Crop: [strategi]
  - Sampling warna: [metode]

### Tahap 2 — Inisialisasi Parameter BRDF
- **Parameter**:
  - Albedo (RGB): [rentang]
  - Roughness: [rentang]
  - Metallic: [rentang]
- **Inisialisasi**: [heuristik / prior]

### Tahap 3 — Estimasi Awal (Heuristik)
- **Metode**: [misal: analisis luminance highlight]
- **Tujuan**: memberi initial guess untuk optimisasi

### Tahap 4 — Refinement via Differentiable Rendering
- **Loss function**: [misal: L2 / SSIM / kombinasi]
- **Optimizer**: [misal: gradient descent / Adam]
- **Stopping criteria**:
  - Iterasi maksimum: [n]
  - Threshold loss: [value]
  - Early stopping: [ya/tidak]

### Tahap 5 — Rendering Ulang
- **Renderer**: [WebGL / Three.js]
- **Material model**: [Cook-Torrance / GGX]

### Tahap 6 — Visualisasi Interaktif
- UI kontrol parameter, preview 3D, hasil perbandingan

### Tahap 7 — Evaluasi
- **Metrik kualitas**: PSNR, SSIM
- **Performa**: FPS, frame time, GPU info

## Tools & Teknologi
- **Frontend**: HTML/CSS/JS, Three.js, Chart.js
- **Backend / Notebook**: Python, NumPy, [lainnya]

## Asumsi & Batasan
- Single-image tanpa multi-view
- Lighting tidak terkalibrasi
- Target: feasibility, bukan akurasi production

## Timeline (Garis Besar)
- Minggu 1: [ ]
- Minggu 2: [ ]
- Minggu 3: [ ]
- Minggu 4: [ ]
