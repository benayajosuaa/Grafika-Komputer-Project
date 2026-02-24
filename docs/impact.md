# Impact & Kontribusi Penelitian

## Novelty Penelitian

Penelitian ini menghadirkan **novelty** yang signifikan dalam bidang estimasi BRDF dengan fokus pada:

1. **Pipeline Inverse Rendering dari Satu Citra**
   - Demonstrasi feasibility pipeline inverse rendering berbasis BRDF dari **satu citra smartphone** dengan pencahayaan alami tidak terkendali
   - Menghilangkan ketergantungan pada multi-view capture, setup pencahayaan terkontrol, dan perangkat khusus (flash, scanner, kamera terkalibrasi)

2. **Pendekatan Grafika Komputer Klasik Tanpa AI**
   - Menggunakan pendekatan grafika komputer ringan berbasis **heuristik** dan **gradient-based optimization**
   - Berbeda dari literatur dominan yang bergantung pada CNN besar dan dataset sintetis dengan biaya komputasi tinggi
   - Implementasi **differentiable rendering** yang efisien secara komputasi

3. **Visualisasi Interaktif Real-Time**
   - Pipeline dapat divisualisasikan secara interaktif menggunakan WebGL
   - Memungkinkan eksplorasi parameter material secara langsung dan intuitif

---

## Penerapan untuk Akademisi

### 1. Penelitian dan Eksperimen
- **Basis untuk Penelitian Lanjutan**: Kode ini dapat digunakan sebagai dasar untuk penelitian lebih lanjut dalam estimasi BRDF dan SVBRDF, memungkinkan akademisi untuk mengeksplorasi metode baru dalam inverse rendering tanpa memerlukan setup yang kompleks
- **Material Pengajaran**: Dapat digunakan dalam pengajaran untuk menjelaskan konsep dasar dalam grafika komputer, seperti:
  - Pengolahan gambar dan analisis luminance
  - Rendering berbasis fisika (PBR)
  - Optimisasi parameter material
  - Visualisasi WebGL/Three.js

### 2. Pengembangan Metodologi
- Akademisi dapat mengembangkan metodologi baru berdasarkan pendekatan yang digunakan dalam penelitian ini
- Adaptasi dan perluasan untuk aplikasi lain dalam grafika komputer atau bidang terkait
- Eksperimen dengan heuristik berbeda untuk estimasi parameter material

### 3. Kontribusi Kode Referensi
- **Fungsi `handleImageUpload()`**: Menunjukkan bagaimana mengekstrak parameter material dari satu citra tanpa setup kompleks
- **Fungsi `runOptimization()`**: Implementasi gradient-based optimization untuk inverse rendering
- **Fungsi `initializeRenderer()`**: Integrasi WebGL untuk visualisasi real-time

---

## Penerapan untuk Industri

### 1. Aplikasi dalam Desain dan Visualisasi
- **Desain Produk & Arsitektur**: Menghasilkan material yang realistis dari gambar yang diambil dengan smartphone, mengurangi waktu dan biaya pengambilan gambar multi-view
- **Game Development**: Memungkinkan artist untuk dengan cepat mengekstrak parameter PBR dari foto referensi
- **AR/VR**: Meningkatkan pengalaman pengguna dengan material yang lebih realistis dari capture sederhana

### 2. Optimisasi Proses Produksi
- Mempercepat proses produksi visualisasi material
- Integrasi lebih cepat dari material baru ke dalam proyek
- Mengurangi ketergantungan pada perangkat khusus dan setup studio

### 3. Aksesibilitas dan Efisiensi
- Pipeline berbasis web memungkinkan akses dari berbagai platform
- Tidak memerlukan perangkat keras khusus atau GPU high-end
- Cocok untuk prototyping cepat dan iterasi desain

---

## Alignment dengan Tren CG Modern

### 1. Pendekatan Berbasis Data yang Efisien
- Mencerminkan tren modern dalam grafika komputer yang berfokus pada penggunaan data untuk menghasilkan hasil yang realistis
- Menggunakan **satu citra** untuk estimasi parameter material → mengutamakan efisiensi dan kemudahan akses
- Relevan dengan kebutuhan industri untuk workflow yang cepat dan praktis

### 2. Interaktivitas dan Visualisasi Real-Time
- Menyediakan **visualisasi interaktif** dari parameter material melalui `updatePreview()` dan `updateMaterial()`
- Sejalan dengan tren modern dalam CG yang menekankan pengalaman pengguna yang interaktif dan real-time
- Penting dalam aplikasi industri (game engines, CAD software) dan akademis (simulation tools)

### 3. Penggunaan Teknologi Web
- Menggunakan **WebGL** dan **canvas** untuk rendering → adaptasi terhadap teknologi web modern
- Aplikasi grafika dapat diakses di berbagai platform tanpa memerlukan instalasi perangkat lunak khusus
- Mendukung tren democratization of computer graphics tools

### 4. Physically-Based Rendering (PBR)
- Implementasi parameter material standar industri: **albedo**, **roughness**, **metallic**
- Kompatibel dengan pipeline rendering modern (Unity, Unreal Engine, Blender)
- Memfasilitasi transfer knowledge antara akademisi dan industri

### 5. Inverse Rendering Ringan
- Menunjukkan bahwa inverse rendering tidak selalu memerlukan deep learning skala besar
- Memberikan alternatif untuk skenario dengan resource terbatas
- Membuka peluang untuk edge computing dan mobile applications

---

## Perbedaan dengan Literatur Dominan

| Aspek | Literatur Dominan | Penelitian Ini |
|-------|-------------------|----------------|
| **Metode** | CNN besar + dataset sintetis | Inverse rendering ringan + heuristik |
| **Input** | Multi-view + pencahayaan terkontrol | Single-view + pencahayaan alami |
| **Komputasi** | High-end GPU, training intensif | Lightweight, berbasis browser |
| **Setup** | Perangkat khusus (scanner, flash) | Smartphone biasa |
| **Aksesibilitas** | Terbatas untuk peneliti dengan resource | Dapat diakses oleh siapa saja |

---

## Kesimpulan

Produk penelitian ini memiliki **potensi besar** untuk diterapkan dalam berbagai konteks akademis dan industri, serta sejalan dengan tren modern dalam komputer grafik. Dengan fokus pada:

- ✅ **Efisiensi**: Pipeline ringan tanpa memerlukan setup kompleks
- ✅ **Interaktivitas**: Visualisasi real-time yang intuitif
- ✅ **Aksesibilitas**: Berbasis web, dapat digunakan di berbagai platform
- ✅ **Praktikalitas**: Estimasi dari satu foto smartphone dengan pencahayaan alami

Pendekatan ini dapat memberikan **kontribusi signifikan** terhadap:
1. Pengembangan metode inverse rendering yang lebih accessible
2. Edukasi dalam bidang grafika komputer
3. Akselerasi workflow industri kreatif
4. Eksplorasi alternatif terhadap pendekatan deep learning yang resource-intensive

---

## Referensi Kode Utama

Untuk memahami implementasi teknis dari novelty penelitian ini, berikut adalah fungsi-fungsi kunci:

1. **`handleImageUpload()`** - Ekstraksi parameter dari satu citra
2. **`runOptimization()`** - Gradient-based BRDF optimization
3. **`updatePreview()`** - Real-time visualization pipeline
4. **`initializeRenderer()`** - WebGL/Three.js integration

Fungsi-fungsi ini mendemonstrasikan bagaimana inverse rendering dapat dilakukan dengan pendekatan grafika komputer klasik yang efisien, tanpa bergantung pada model AI kompleks.
