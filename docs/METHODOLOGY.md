# Methodology Design (Detail)

## Ringkasan Pipeline
- **Input**: Foto material smartphone (single-image)
- **Output**: Estimasi parameter BRDF (albedo, roughness, metallic) + render ulang
- **Pendekatan**: Inverse rendering berbasis optimisasi (differentiable rendering)

## Glosarium Istilah Penting
- **BRDF (Bidirectional Reflectance Distribution Function)**: Fungsi yang mendeskripsikan bagaimana cahaya dipantulkan dari permukaan material berdasarkan arah datang dan arah pantul.
- **Inverse Rendering**: Proses “membalik” rendering untuk menebak parameter material dari citra nyata.
- **Differentiable Rendering**: Rendering yang dapat menghitung gradien sehingga parameter material bisa dioptimasi.
- **Albedo**: Warna dasar/reflectance material. Semakin tinggi albedo, permukaan terlihat lebih cerah.
- **Roughness**: Tingkat kekasaran mikro permukaan. Rendah = refleksi tajam, tinggi = refleksi menyebar.
- **Metallic**: Indikator sifat logam material. 0 = dielektrik (non-logam), 1 = logam.
- **PSNR**: Metrik perbedaan piksel antara input dan render; lebih tinggi biasanya lebih baik.
- **SSIM**: Metrik kesamaan struktur visual (0–1); lebih tinggi lebih mirip.

## Flowchart Pipeline
> Tempatkan gambar flowchart final di: `docs/flowchart.svg` atau `docs/flowchart.png`

### Tahap 1 — Input & Pre-processing
- **Input data**: foto material dari smartphone.
- **Pre-processing**:
  - Resize: konsistenkan ukuran untuk pipeline.
  - Crop: fokus pada area material utama.
  - Sampling warna: ambil statistik warna untuk inisialisasi.

### Tahap 2 — Inisialisasi Parameter BRDF
- **Parameter**:
  - **Albedo (RGB)**: warna dasar material yang dipantulkan.
  - **Roughness**: kontrol sebaran highlight.
  - **Metallic**: kontrol sifat konduktif material.
- **Inisialisasi**: heuristik awal dari warna dan highlight.

### Tahap 3 — Estimasi Awal (Heuristik)
- **Metode**: analisis luminance dan highlight untuk initial guess.
- **Tujuan**: memberi titik awal agar optimisasi stabil.

### Tahap 4 — Refinement via Differentiable Rendering
- **Loss function**: L2/SSIM atau kombinasi keduanya.
- **Optimizer**: gradient descent/Adam.
- **Stopping criteria**:
  - Iterasi maksimum.
  - Loss mendekati konvergen.
  - Early stopping bila perbaikan sangat kecil.

### Tahap 5 — Rendering Ulang
- **Renderer**: WebGL / Three.js.
- **Material model**: Cook-Torrance / GGX.

### Tahap 6 — Visualisasi Interaktif
- UI kontrol parameter, preview 3D, perbandingan input vs render.

### Tahap 7 — Evaluasi
- **Metrik kualitas**: PSNR, SSIM.
- **Performa**: FPS, frame time, informasi GPU.

## Tools & Teknologi
- **Frontend**: HTML/CSS/JS, Three.js, Chart.js.
- **Backend / Notebook**: Python, NumPy.

## Asumsi & Batasan
- Single-image tanpa multi-view.
- Lighting tidak terkalibrasi.
- Target: feasibility, bukan akurasi production-ready.

## Timeline (Garis Besar)
- Minggu 1: persiapan data + desain UI.
- Minggu 2: implementasi pipeline awal.
- Minggu 3: evaluasi metrik + perbaikan heuristik.
- Minggu 4: dokumentasi + laporan.
