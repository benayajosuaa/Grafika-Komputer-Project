# Gap Analysis

## Statement (Berdasarkan Tangkapan Layar)
Sebagian besar penelitian terdahulu dalam estimasi BRDF/SVBRDF masih bergantung pada multi-view capture, setup pencahayaan terkontrol atau semi-terkontrol, serta perangkat khusus. Banyak pendekatan menggunakan model deep learning berskala besar yang menuntut dataset sintetis dan biaya komputasi tinggi, sementara aspek efisiensi GPU untuk penggunaan praktis masih jarang dibahas. Akibatnya, estimasi parameter material dari satu foto smartphone dengan pencahayaan alami tidak terkendali menggunakan pendekatan grafika berbasis differentiable rendering yang efisien secara komputasi masih belum banyak dieksplorasi.

## Gap Utama
1) **Ketergantungan multi-view & lighting terkontrol**
   - Tidak praktis untuk skenario smartphone single-image.

2) **Ketergantungan deep learning + dataset besar**
   - Biaya data & komputasi tinggi untuk prototipe ringan.

3) **Minim evaluasi efisiensi GPU secara praktis**
   - Feasibility di perangkat umum belum jelas.

## Mapping ke Literatur
- **Unified Shape and Appearance Reconstruction...** → gap 1 (multi-view + semi-terkontrol)
- **Deep Scene-Scale Material Estimation...** → gap 2 (DL + dataset besar)
- **Multiview SVBRDF Capture...** → gap 1 & 2 (multi-view + data besar)
- **Single-Image Reflectance and Transmittance...** → gap 1 (lighting terkontrol via scanner)
- **Simultaneous Acquisition of Geometry and Material...** → gap 1 (flash/no-flash spesifik)

## Jawaban Proposal terhadap Gap
- **Gap 1**: Pipeline single-image + lighting natural.
- **Gap 2**: Optimisasi berbasis differentiable rendering tanpa training dataset.
- **Gap 3**: Evaluasi performa GPU di WebGL (FPS, frame time).

## Bukti yang Ditunjukkan di Prototype
- UI interaktif + parameter BRDF + rendering WebGL.
- Metrik PSNR/SSIM + observasi frame time.
