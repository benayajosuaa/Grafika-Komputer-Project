# 🎨 Tujuan Matakuliah "Grafika Komputer" - Penjelasan Sederhana

## 📖 Apa itu Grafika Komputer?

Grafika Komputer adalah ilmu yang mempelajari **bagaimana membuat gambar dan video dari data** di dalam komputer.

Bukan sekedar photoshop atau menggambar biasa, tapi:
- Membuat 3D objects (model 3D)
- Memberi warna dan tekstur (shading)
- Simulasi cahaya nyata (lighting)
- Render untuk output visual
- Optimisasi performa

---

## 🎯 Tujuan Utama Matakuliah Grafika Komputer

### **Tujuan 1: Memahami Pipeline Rendering**

**Apa itu rendering?**
```
Rendering = Proses mengubah data 3D menjadi gambar 2D yang dilihat di layar

Analogi:
- 3D data = blueprint rumah (ada dimensi x, y, z)
- Rendering = foto rumah dari sudut tertentu
- 2D image = foto yang dilihat di layar (pixel 2D)
```

**Pipeline rendering yang dipelajari:**
```
1. Vertex Setup      → Tentukan posisi titik 3D
2. Rasterization    → Ubah titik jadi area (pixel)
3. Fragment Shader  → Tentukan warna setiap pixel
4. Lighting         → Simulasi cahaya
5. Texturing        → Tambah detail dengan texture
6. Output           → Gambar final di layar
```

**Di website BRDF:**
- ✅ Kita buat 3D sphere (vertex)
- ✅ Render di WebGL (rasterization)
- ✅ Simulasi lighting dengan shader (fragment shader)
- ✅ Tampilkan hasilnya real-time

---

### **Tujuan 2: Memahami Material dan Cahaya**

**Pertanyaan dasar:**
- Kenapa kayu terlihat berbeda dari logam?
- Kenapa plastik terlihat glossy tapi kayu matte?
- Bagaimana cahaya berinteraksi dengan permukaan?

**Jawaban: BRDF (Bidirectional Reflectance Distribution Function)**

```
BRDF = Fungsi yang menjelaskan bagaimana cahaya 
       dipantulkan dari permukaan material

Dalam bahasa sederhana:
- Albedo    = Warna dasar material
- Roughness = Seberapa halus/kasar permukaan
- Metallic  = Apakah material adalah logam atau bukan
```

**Contoh nyata:**

```
KAYU:
- Albedo: Coklat (karena warna kayu)
- Roughness: Medium-High (permukaan kayu agak kasar)
- Metallic: 0 (bukan logam)
→ Hasilnya: Terlihat seperti kayu real ✓

LOGAM CHROME:
- Albedo: Putih/Silver (reflective)
- Roughness: Sangat rendah (sangat halus/polished)
- Metallic: 1.0 (full metal)
→ Hasilnya: Berkilau seperti chrome ✓

PLASTIK GELANG:
- Albedo: Sesuai warna (merah, biru, dll)
- Roughness: Medium (plastik glossy tapi tidak specular)
- Metallic: 0 (non-metal)
→ Hasilnya: Terlihat seperti plastik ✓
```

---

### **Tujuan 3: Belajar Implementasi Real-Time Graphics**

**Apa itu real-time graphics?**
```
= Grafis yang di-render cukup cepat untuk interaksi langsung
  (biasanya 30-60 FPS, artinya 30-60 gambar per detik)

Berbeda dengan:
- Offline rendering: Render bisa butuh jam/hari (untuk film)
- Real-time: Harus render dalam <16ms (untuk 60 FPS)
```

**Tools yang dipelajari:**
- OpenGL / WebGL (GPU programming)
- GLSL (shader language)
- Game engines (Unity, Unreal, Three.js)
- Optimization techniques

**Di website BRDF:**
- ✅ WebGL (GPU-accelerated rendering)
- ✅ Three.js (abstraction layer)
- ✅ Real-time updates saat drag/scroll
- ✅ 60 FPS target

---

### **Tujuan 4: Inverse Rendering / Material Capture**

**Pertanyaan yang dijawab:**

Jika kita bisa render material dari parameter → gambar...

**Bagaimana caranya kebalik?**
```
Gambar → ??? → Parameter material
```

Ini adalah **inverse rendering** atau **material capture**.

**Aplikasi praktis:**
- Game development: capture material dari foto
- 3D modeling: otomatis dapatkan material properties
- VFX: match lighting dan material dari footage asli
- E-commerce: scan produk fisik → 3D digital

**Di website BRDF:**
- ✅ Upload foto material
- ✅ Algoritma optimisasi mencari parameter terbaik
- ✅ Output: Albedo, Roughness, Metallic
- ✅ Gunakan parameter untuk render apapun!

---

### **Tujuan 5: Optimization & Numerical Methods**

**Pertanyaan:**
- Bagaimana cara menemukan parameter BRDF yang tepat?
- Jika ada 3 parameter × 300 iterasi = harus cek 900 kombinasi!

**Jawaban: Gradient Descent Optimization**

```
Analogi gunung:
1. Mulai dari puncak gunung (parameter random)
2. Cek: "Kemiringan di mana?"
3. Jalan ke arah yang paling menurun
4. Ulangi sampai sampai ke lembah (optimal)

Dalam BRDF:
1. Mulai dengan parameter random
2. Cek loss (kesalahan): berapa besar perbedaan dengan foto asli?
3. Hitung gradient (arah yang harus diubah)
4. Update parameter ke arah yang menurunkan loss
5. Ulangi sampai loss minimal
```

**Di website BRDF:**
- ✅ Loss menurun exponential (lihat di graph)
- ✅ Parameter berubah setiap iterasi
- ✅ Dalam 300 iterasi, loss dari ~0.5 menjadi ~0.05
- ✅ Hasil semakin mirip dengan foto asli

---

## 🧠 Konsep Utama yang Dipelajari

### **1. Coordinate Systems**
```
Dunia 3D punya 3 sumbu: X, Y, Z

Setiap object memiliki:
- World space: posisi di dunia 3D
- Camera space: posisi relatif terhadap kamera
- Screen space: posisi di layar (2D)

Transformasi antar space adalah penting!
```

### **2. Transformations**
```
3 operasi dasar:
- Translation: geser posisi
- Rotation: putar sudut
- Scaling: ubah ukuran

Semua dikerjakan dengan matrix math (linear algebra)
```

### **3. Lighting Models**
```
Bagaimana cahaya berinteraksi dengan material:

Ambient light:     cahaya background (biasanya rendah)
Diffuse light:     cahaya yang dipantulkan merata
Specular light:    cahaya yang berkilau/reflective

Formula: Final_Color = Ambient + Diffuse + Specular
```

### **4. Texture Mapping**
```
Texture = 2D image yang diletakkan di 3D surface

Caranya:
1. Define UV coordinates (mapping 2D → 3D surface)
2. Sample texture pada setiap pixel
3. Multiply dengan lighting
4. Output warna final
```

### **5. Shaders**
```
Program kecil yang berjalan di GPU:

Vertex Shader:    proses setiap vertex (posisi 3D)
Fragment Shader:  proses setiap pixel (warna)

Dieksekusi ribuan/jutaan kali per frame paralel!
```

---

## 🔧 Teknologi dalam Website BRDF

### **1. WebGL**
```
GPU API untuk browser
- Render 3D di web tanpa plugin
- Akses GPU langsung
- Write shader dalam GLSL
```

### **2. Three.js**
```
Library yang abstract WebGL complexity
- Mudah membuat scene, camera, lights
- Built-in material & geometry
- Event handling (mouse, keyboard)
```

### **3. Differentiable Rendering**
```
Rendering yang bisa diturunkan secara mathematics
- Forward: parameter → render
- Backward: gradient computation
- Used untuk optimization

Konsep baru di grafika komputer (tahun 2019+)
```

### **4. Optimization Algorithm**
```
Adam optimizer (atau SGD) untuk update parameter:
param_new = param_old - learning_rate * gradient

Mirip seperti machine learning, tapi untuk graphics!
```

---

## 📚 Hubungan dengan Course Project BRDF

### **Di Matakuliah Ini Dipelajari:**

```
Bulan 1-2: Fundamentals
✓ 3D graphics basics
✓ Coordinate systems
✓ Transformations
✓ Lighting models
✓ Shading

Bulan 3-4: WebGL & Real-time
✓ WebGL API
✓ Shader programming
✓ Texturing
✓ Optimization

Bulan 5: Advanced Topics
✓ Normal mapping
✓ Physically-based rendering
✓ Post-processing
✓ Advanced optimization

BONUS (Project BRDF):
✓ Material capture
✓ BRDF estimation
✓ Inverse rendering
✓ Gradient-based optimization
```

### **Project BRDF Menggunakan Semua Itu!**

```
1. 3D Graphics (basic)        → Sphere rendering
2. Lighting Models (advanced) → Cook-Torrance BRDF
3. Shaders (advanced)         → Custom material shader
4. Real-time (requirement)    → 60 FPS interactive
5. Optimization (extra)       → Gradient descent
6. Application (practical)    → Material capture dari smartphone
```

---

## 🎓 Alur Pembelajaran yang Ideal

```
PHASE 1: Foundation (Bulan 1-2)
  ↓
Pelajari teori:
- 3D math (vectors, matrices)
- Lighting (Phong, Blinn-Phong)
- Shading concepts
- GPU architecture basics

PHASE 2: Implementation (Bulan 3-4)
  ↓
Implementasi:
- WebGL dari nol
- Shader programming
- Simple 3D scene
- Interactive camera

PHASE 3: Advanced (Bulan 5-6)
  ↓
Topik lanjutan:
- Normal mapping
- Parallax mapping
- Shadow mapping
- PBR basics

PROJECT: BRDF Material Capture
  ↓
Aplikasikan semua:
- Forward rendering (PHASE 1 + 2)
- BRDF material (PHASE 3)
- Optimization loop (Extra)
- Real-world application!
```

---

## 💡 Insight Praktis Untuk Anda

### **Mengapa Project BRDF Penting?**

```
1. Menggabungkan semua konsep yang dipelajari
2. Aplikasi real-world (material capture)
3. Advanced technique (inverse rendering)
4. Relevan dengan industri (game, VFX, 3D scan)
5. Portfolio-worthy project
```

### **Apa yang Bisa Anda Lakukan Setelah Ini?**

```
1. Buat tool untuk capture material dari foto
2. Integrate ke game engine (Unity, Godot)
3. Develop untuk 3D modeling software
4. Research publikasi (konferensi graphics)
5. Startup idea (automated material capture)
```

### **Kesalahan yang Perlu Dihindari**

```
❌ Hanya copy-paste code tanpa memahami
❌ Tidak test dengan berbagai material
❌ Ignore optimization sampai akhir
❌ Tidak dokumentasi proses

✅ Lakukan:
✅ Pahami setiap komponen
✅ Test systematically
✅ Optimize sambil develop
✅ Document everything
```

---

## 🌟 Kesimpulan Tujuan Grafika Komputer

```
TUJUAN UTAMA (dalam urutan penting):

1. Memahami Pipeline Rendering
   → Dari data 3D jadi gambar 2D

2. Material & Lighting Physics
   → Bagaimana cahaya dan material berinteraksi

3. Real-time Graphics Implementation
   → Render cepat untuk interaksi langsung (60+ FPS)

4. Inverse Rendering (Advanced)
   → Extract material dari gambar/foto

5. Optimization & Performance
   → Buat grafis yang cepat dan efficient

DALAM KONTEKS PROJECT ANDA:
→ Semua ini ada di website BRDF!
→ Dari rendering material sphere sampai optimization
→ Sesuai dengan research methodology
→ Siap untuk publikasi dan presentasi
```

---

## 🚀 Action Items untuk Anda

### **1. Pahami Website Sepenuhnya**
- [ ] Upload berbagai material (kayu, logam, plastik, kain)
- [ ] Amati bagaimana parameter berubah
- [ ] Analisis loss curve untuk setiap material
- [ ] Dokumentasikan hasil

### **2. Test dengan Berbagai Kondisi**
- [ ] Foto dengan pencahayaan berbeda
- [ ] Material dengan roughness berbeda
- [ ] Metallic dan non-metallic materials
- [ ] Document setiap skenario

### **3. Analisis Hasil Kuantitatif**
- [ ] Catat PSNR, SSIM untuk setiap test
- [ ] Plot loss curve untuk analisis convergence
- [ ] Hitung rata-rata iterasi untuk convergence
- [ ] Bandingkan antar material type

### **4. Implementasi Backend (untuk UAS)**
- [ ] Study PyTorch3D documentation
- [ ] Implement actual BRDF model (Cook-Torrance)
- [ ] Implement gradient computation
- [ ] Connect ke frontend API
- [ ] Test end-to-end

### **5. Dokumentasikan untuk Paper**
- [ ] Tulis methodology section
- [ ] Dokumentasikan algorithm
- [ ] Buatkan hasil figures dan tables
- [ ] Analisis limitations

---

**Semoga penjelasan ini membuat Anda lebih memahami tujuan matakuliah dan relevansi project BRDF! 🎉**
