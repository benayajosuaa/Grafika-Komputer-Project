# Seluruh Pipeline (Input, Process, dan Output)

Dokumen ini merangkum pipeline aktual pada proyek `BRDF-Estimation-Research` berdasarkan implementasi di folder `frontend/` dan `backend/`.

## 1. Tujuan Pipeline

Pipeline ini digunakan untuk:

- menerima citra material dari pengguna,
- mengubah citra menjadi representasi tekstur yang lebih stabil,
- mengestimasi parameter material BRDF,
- memvisualisasikan hasil estimasi pada proxy geometry 3D,
- mengevaluasi hasil secara kuantitatif,
- mengekspor hasil untuk kebutuhan eksperimen dan pelaporan penelitian.

## 2. Input

### 2.1 Input utama dari pengguna

Sumber input berasal dari antarmuka di `frontend/index.html`:

- `Material Image`
  File gambar material yang diunggah pengguna.
- slider parameter BRDF
  - `Albedo (R, G, B)`
  - `Roughness`
  - `Metallic`
  - `Anisotropy`
  - `Light Intensity`
  - `Opacity`
  - `IOR`
- mode material
  - `Standard`
  - `Glass / Transparent`
- proxy geometry
  - `Sphere`
  - `Flat Plane`
  - `Side-by-Side Compare`
  - `Multiview`
- texture preset
  Digunakan sebagai input sintetis/alternatif untuk demonstrasi.

### 2.2 Input internal untuk eksperimen

Beberapa input tambahan dibentuk di dalam sistem:

- `image_id`
  ID unik gambar yang diregistrasi.
- `init_type`
  Strategi inisialisasi seperti `heuristic` atau `random`.
- `seed`
  Seed acak deterministik untuk reproduksibilitas eksperimen.
- `max_iterations`, `learning_rate`, dan konfigurasi optimizer lainnya.

## 3. Process

## 3.1 Akuisisi dan registrasi gambar

Saat pengguna mengunggah gambar:

1. File dibaca di `BRDFApp.handleImageUpload()` pada `frontend/js/main.js`.
2. Gambar ditampilkan pada panel perbandingan sebagai `Input Image`.
3. Gambar diregistrasi ke `ExperimentRunner.registerImage()` pada `frontend/js/experiment_runner.js`.

## 3.2 Pembersihan citra dan pembentukan tekstur

Pada tahap registrasi, sistem menjalankan:

1. `buildSeamlessTextureFromImage()`
   - mengecilkan gambar,
   - menghitung statistik piksel,
   - memperbaiki area terlalu gelap/terlalu terang,
   - memilih patch terbaik,
   - menyusun ulang patch menjadi tekstur yang lebih seamless.
2. Hasilnya disimpan sebagai:
   - `materialTexture.canvas`
   - `materialTexture.source`
   - `materialTexture.stats`

Tujuan tahap ini adalah membuat input tekstur lebih stabil untuk render dan estimasi.

## 3.3 Persiapan data target

Fungsi `prepareImage()`:

- melakukan resize ke resolusi eksperimen,
- mengambil `ImageData`,
- mengonversi piksel ke:
  - ruang warna linear untuk komputasi loss,
  - sRGB untuk referensi tampilan.

Output tahap ini menjadi `target` pada registry gambar.

## 3.4 Analisis statistik material

Fungsi `collectImageStats()` dan `analyzeMaterialAppearance()` menghitung fitur berikut:

- rata-rata RGB,
- luminance rata-rata,
- deviasi standar luminance,
- saturasi,
- neutralness,
- highlight ratio,
- contrast/edge energy,
- metal probability,
- anisotropy score,
- directional streak detection.

Tahap ini menghasilkan `materialProfile`, misalnya:

- `metal`
- `fabric`
- `wood`
- `plastic`
- `matte`

Profile ini dipakai untuk menyesuaikan:

- `detailScale`
- `textureRepeat`
- `displacementScale`
- `detailContrast`
- `sheenStrength`
- `specularBoost`
- `bumpIntensity`
- `grainDirection`

## 3.5 Inisialisasi parameter BRDF

Setelah gambar dianalisis, sistem membuat tebakan awal parameter melalui:

- `ExperimentRunner.createInitialParameters()` / logika heuristik terkait,
- `computeHeuristicInitialization()`.

Parameter awal yang dibentuk:

- `albedo`
- `roughness`
- `metallic`
- `anisotropy`

Parameter ini lalu:

- diisikan ke slider UI,
- diterapkan ke renderer,
- dipakai sebagai titik awal optimasi.

## 3.6 Rendering dan visualisasi 3D

Visualisasi dijalankan oleh `ThreeJSRenderer` di `frontend/js/renderer.js`.

Tahap render mencakup:

1. pembuatan scene, camera, dan WebGL renderer,
2. pembuatan shader material kustom,
3. pemilihan proxy geometry:
   - sphere,
   - plane,
   - compare mode,
4. pemuatan tekstur material,
5. update uniform shader berdasarkan parameter BRDF,
6. render ke canvas utama dan panel multiview.

Shader yang dipakai memadukan:

- texture-based appearance,
- pencahayaan lokal,
- komponen diffuse/specular,
- simulasi profil permukaan seperti fabric, metal, wood, plastic, dan matte,
- opsi material transparan (`glass mode`).

## 3.7 Optimasi parameter

Ketika pengguna menekan `Start Optimization`:

1. app membangun konfigurasi eksperimen,
2. `ExperimentRunner` memanggil optimizer,
3. renderer membuat snapshot terukur melalui `renderSnapshot()`,
4. loss fotometrik dihitung,
5. parameter diperbarui secara iteratif.

Komponen yang terlibat:

- `frontend/js/optimizer.js`
- `frontend/js/metrics.js`
- `frontend/js/experiment_logger.js`

Log tiap iterasi dapat mencakup:

- nilai loss,
- gradient norm,
- parameter saat ini,
- runtime.

## 3.8 Evaluasi kuantitatif

Evaluasi kualitas hasil dilakukan menggunakan metrik di `frontend/js/metrics.js`, antara lain:

- photometric loss,
- RMSE,
- SSIM,
- convergence iteration,
- loss drop percentage,
- failure detection,
- aggregate batch metrics.

Evaluasi performa visual interaktif dilakukan di `ThreeJSRenderer.profilePerformance()` dan benchmark FPS pada UI:

- `Avg Frame`
- `Live FPS`
- `P95 Frame`
- `FPS Target`
- `Samples`
- benchmark kuantitatif 3 detik dengan target `>=60 FPS`

Dengan demikian, proyek ini mengevaluasi dua hal:

- kualitas estimasi material,
- performa interaktif sistem render.

## 3.9 Logging dan ekspor

Sistem menyediakan ekspor untuk:

- parameter eksperimen (`JSON`, `CSV`),
- render hasil,
- comparison figure,
- convergence chart,
- viewer screenshot,
- pipeline diagram.

Fitur ini membantu penyusunan laporan penelitian, dokumentasi eksperimen, dan presentasi hasil.

## 4. Output

Output pipeline dibagi menjadi tiga kelompok.

### 4.1 Output visual

- preview 3D material pada canvas utama,
- render `sphere`,
- render `flat plane`,
- mode `compare`,
- panel `multiview`,
- screenshot viewer,
- figure perbandingan.

### 4.2 Output numerik

- estimasi `albedo`,
- estimasi `roughness`,
- estimasi `metallic`,
- estimasi `anisotropy`,
- loss akhir,
- RMSE,
- SSIM,
- convergence iteration,
- total runtime,
- average runtime per iteration,
- FPS rata-rata,
- P95 frame time,
- status target `>=60 FPS`.

### 4.3 Output dokumen/arsip eksperimen

- file `JSON`,
- file `CSV`,
- gambar `.png` untuk figure penelitian,
- log eksperimen dan kurva konvergensi.

## 5. Ringkasan Alur Sederhana

Pipeline lengkap dapat diringkas sebagai:

1. `Input`
   Pengguna mengunggah citra material atau memilih preset.
2. `Pre-process`
   Sistem membersihkan citra, membangun seamless texture, dan menyiapkan data target.
3. `Material Analysis`
   Sistem mengekstrak statistik warna, highlight, anisotropi, dan profil material.
4. `Initialization`
   Sistem membuat tebakan awal parameter BRDF.
5. `Rendering`
   Parameter diterapkan ke shader dan divisualisasikan pada proxy geometry 3D.
6. `Optimization`
   Parameter diperbaiki iteratif agar render mendekati citra target.
7. `Evaluation`
   Sistem menghitung metrik kualitas estimasi dan performa FPS.
8. `Output`
   Hasil ditampilkan di UI dan dapat diekspor sebagai data maupun figure.

## 6. Diagram Naratif Satu Baris

`Input image -> image registration -> seamless texture + image stats -> material profile -> BRDF parameter initialization -> shader-based rendering -> iterative optimization -> quantitative evaluation -> exported outputs`
