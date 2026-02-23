# Gap Analysis

## Ringkasan Gap (Draft)
1) **Ketergantungan multi-view dan lighting terkontrol**
   - Bukti: mayoritas paper menggunakan multi-view atau setup lighting khusus.
   - Dampak: tidak praktis untuk skenario smartphone single-image.

2) **Ketergantungan dataset besar / deep learning**
   - Bukti: metode DL butuh dataset sintetis besar + training mahal.
   - Dampak: sulit diadopsi pada prototype ringan.

3) **Minim evaluasi performa GPU real-time**
   - Bukti: banyak penelitian fokus akurasi, bukan efisiensi.
   - Dampak: feasibility pada perangkat umum kurang jelas.

## Mapping ke Literatur
- [Paper A] → gap 1 (multi-view / controlled lighting)
- [Paper B] → gap 2 (dataset besar / DL heavy)
- [Paper C] → gap 3 (tanpa evaluasi GPU)

## Jawaban Proposal terhadap Gap
- **Gap 1**: Pipeline single-image + lighting natural.
- **Gap 2**: Optimisasi berbasis differentiable rendering tanpa training dataset.
- **Gap 3**: Evaluasi performa GPU di WebGL.

## Bukti dalam Prototype
- UI interaktif + parameter BRDF + rendering WebGL.
- Metrik PSNR/SSIM + observasi frame time.
