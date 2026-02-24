# Literature Review

## Glosarium Singkat
- **SVBRDF**: Spatially Varying BRDF, yaitu BRDF yang berubah per-pixel pada permukaan.
- **Multi-view**: Menggunakan banyak sudut pandang (lebih dari satu citra) untuk estimasi material.
- **Single-image**: Hanya memakai satu citra untuk estimasi parameter material.

## Kriteria Seleksi
- Relevansi: BRDF / SVBRDF / inverse rendering / material estimation.
- Fokus perbandingan: single-image vs multi-view, lighting terkontrol vs natural.

## Ringkasan Jurnal (Berdasarkan Pengenalan Topik)
### 1) Unified Shape and Appearance Reconstruction with Joint Camera Parameter Refinement
- **Input**: Multi-view RGB images dengan point-light (flash) berkolokasi dengan kamera.
- **Metode**: Inverse rendering untuk merekonstruksi shape + SVBRDF + parameter kamera.
- **Keluaran**: Rekonstruksi objek 3D ber fidelitas tinggi.
- **Research Gap**: Masih bergantung multi-view dan pencahayaan semi-terkontrol; belum menangani single-image smartphone dengan lighting natural; belum mengevaluasi efisiensi GPU praktis.

### 2) Single-Image Reflectance and Transmittance Estimation from Any Flatbed Scanner
- **Input**: Citra material dari flatbed scanner.
- **Metode**: Deep learning + intrinsic image decomposition untuk estimasi SVBSDF (reflectance + transmittance).
- **Keluaran**: Estimasi material planar beresolusi tinggi.
- **Research Gap**: Terbatas pada material planar dan scanner (lighting uniform); tidak menangani objek 3D, scene nyata, atau foto smartphone; tidak memakai pipeline differentiable rendering grafika.

### 3) Deep Scene-Scale Material Estimation from Multi-View Indoor Captures
- **Input**: Multi-view indoor images dengan pipeline photogrammetry.
- **Metode**: CNN untuk estimasi SVBRDF skala scene.
- **Keluaran**: Aset PBR siap pakai untuk industri.
- **Research Gap**: Bergantung multi-view + dataset training besar; bukan single-image; bukan inverse rendering optimisasi; tidak fokus robustness lighting smartphone.

### 4) Simultaneous Acquisition of Geometry and Material for Translucent Objects
- **Input**: Pasangan gambar flash / no-flash.
- **Metode**: Inverse rendering untuk estimasi geometry, reflectance, dan subsurface scattering.
- **Keluaran**: Estimasi objek translusen dengan SSS.
- **Research Gap**: Kompleks dan spesifik; tidak relevan untuk estimasi BRDF material umum dari satu foto smartphone tanpa kontrol lighting.

### 5) Multiview SVBRDF Capture from Unified Shape and Illumination
- **Input**: Multiview images.
- **Metode**: Deep learning + differentiable rendering dengan dataset sintetis besar.
- **Keluaran**: Estimasi SVBRDF per-pixel.
- **Research Gap**: Masih memerlukan multi-view dan data besar; belum membahas single-image smartphone serta efisiensi GPU praktis.

## Sintesis
- **Trend utama**: Multi-view capture, pencahayaan terkontrol/semi-terkontrol, serta deep learning berbasis dataset besar.
- **Area belum terjawab**: Single-image smartphone dengan lighting natural dan evaluasi efisiensi GPU pada pipeline ringan.
- **Implikasi untuk proposal**: Menguatkan kebutuhan pipeline inverse rendering yang lebih praktis dan efisien.
