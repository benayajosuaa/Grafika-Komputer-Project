/**
 * Research Context Modal
 * 
 * Menampilkan konteks penelitian, tujuan, dan batasan sistem
 * untuk membantu pengguna memahami kerangka kerja prototype ini.
 */

class ResearchContextModal {
    constructor() {
        this.isVisible = false;
    }
    
    showWelcomeModal() {
        if (this.isVisible) return;
        this.isVisible = true;
        
        const modal = document.createElement('div');
        modal.className = 'research-modal-overlay';
        modal.id = 'research-welcome-modal';
        
        modal.innerHTML = `
            <div class="research-modal-content">
                <button class="modal-close-btn">&times;</button>
                
                <div class="modal-header">
                    <h1>🔬 BRDF Material Estimation</h1>
                    <p class="subtitle">Prototype Penelitian UTS Grafika Komputer</p>
                </div>
                
                <div class="modal-body">
                    <section class="modal-section">
                        <h2>Tujuan Penelitian</h2>
                        <p>Mengembangkan dan mengevaluasi <strong>feasibility pipeline inverse rendering</strong> 
                        berbasis differentiable rendering untuk mengestimasi parameter material (BRDF) 
                        dari satu citra kamera smartphone dengan pencahayaan alami yang tidak terkendali.</p>
                    </section>
                    
                    <section class="modal-section">
                        <h2>Tujuan Khusus (TK)</h2>
                        <ul class="objectives-list">
                            <li>
                                <strong>TK1:</strong> Mengembangkan metode inverse rendering untuk estimasi BRDF 
                                tanpa setup pencahayaan terkalibrasi
                            </li>
                            <li>
                                <strong>TK2:</strong> Menganalisis robustness terhadap variasi pencahayaan alami, 
                                sudut pandang, dan noise
                            </li>
                            <li>
                                <strong>TK3:</strong> Mengevaluasi kualitas visual hasil estimasi secara kualitatif
                            </li>
                            <li>
                                <strong>TK4:</strong> Mengevaluasi performa komputasi berbasis GPU
                            </li>
                            <li>
                                <strong>TK5:</strong> Membandingkan dengan metode referensi dari literatur
                            </li>
                        </ul>
                    </section>
                    
                    <section class="modal-section highlight">
                        <h2>⚠️ Batasan Penting</h2>
                        <ul class="constraints-list">
                            <li><strong>Bukan klasifikasi material:</strong> Sistem TIDAK mengidentifikasi jenis material (kayu, logam, kain, dll)</li>
                            <li><strong>Fokus feasibility:</strong> Mengevaluasi apakah pipeline dapat bekerja, bukan akurasi state-of-the-art</li>
                            <li><strong>Metrik kualitatif:</strong> PSNR, SSIM, Loss hanya digunakan sebagai indikator proses, bukan validasi akurat</li>
                            <li><strong>Interpretasi deskriptif:</strong> Parameter BRDF dijelaskan berdasarkan sifat fisik, bukan label material</li>
                        </ul>
                    </section>
                    
                    <section class="modal-section">
                        <h2>Cara Menggunakan Prototype</h2>
                        <ol class="usage-steps">
                            <li><strong>Upload Citra:</strong> Pilih foto material dari perangkat (smartphone, kamera digital, dll)</li>
                            <li><strong>Lihat Preview 3D:</strong> Visualisasi real-time material dengan parameter awal</li>
                            <li><strong>Jalankan Optimasi:</strong> Klik "Start Optimization" untuk menjalankan inverse rendering</li>
                            <li><strong>Amati Hasil:</strong> Lihat kurva optimasi, metrik kualitas, dan interpretasi BRDF</li>
                            <li><strong>Pelajari Istilah:</strong> Klik tombol "?" untuk mengerti istilah teknis dan keterkaitannya dengan tujuan penelitian</li>
                            <li><strong>Eksport Hasil:</strong> Simpan parameter BRDF dan render sebagai file</li>
                        </ol>
                    </section>
                    
                    <section class="modal-section">
                        <h2>Informasi Teknis</h2>
                        <p>
                            <strong>BRDF Model:</strong> Cook-Torrance Microfacet Model<br>
                            <strong>Parameter:</strong> Albedo (RGB), Roughness, Metallic<br>
                            <strong>Rendering:</strong> Three.js (WebGL)<br>
                            <strong>Optimasi:</strong> Algoritma random walk (simulasi)<br>
                            <strong>Visualisasi:</strong> Kurva loss real-time, metrik kualitas visual
                        </p>
                    </section>
                    
                    <section class="modal-section">
                        <h2>💡 Tips</h2>
                        <ul>
                            <li>Untuk hasil terbaik, gunakan citra dengan pencahayaan yang konsisten</li>
                            <li>Kualitas citra smartphone (noise, blur) akan mempengaruhi robustness estimasi</li>
                            <li>Setiap pop-out edukatif menjelaskan istilah dan keterkaitannya dengan tujuan penelitian</li>
                            <li>Interpretasi hasil bersifat kualitatif - fokus pada kecenderungan sifat material, bukan jenis material</li>
                        </ul>
                    </section>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-primary" id="modal-start-btn">Mulai Demo</button>
                    <button class="btn btn-secondary" id="modal-skip-btn">Lewati</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        const closeBtn = modal.querySelector('.modal-close-btn');
        const startBtn = document.getElementById('modal-start-btn');
        const skipBtn = document.getElementById('modal-skip-btn');
        
        const handleClose = () => {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.remove();
                this.isVisible = false;
            }, 300);
        };
        
        closeBtn.addEventListener('click', handleClose);
        startBtn.addEventListener('click', handleClose);
        skipBtn.addEventListener('click', handleClose);
    }
    
    /**
     * Tampilkan tips ketika mulai pertama kali
     */
    showFirstRunTips() {
        const hasShown = localStorage.getItem('brdf-first-run-tips');
        if (!hasShown) {
            localStorage.setItem('brdf-first-run-tips', 'true');
            this.showWelcomeModal();
        }
    }
}

// Inisialisasi ketika DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.researchContextModal = new ResearchContextModal();
        window.researchContextModal.showFirstRunTips();
        console.log('✓ Research context modal initialized');
    });
} else {
    window.researchContextModal = new ResearchContextModal();
    window.researchContextModal.showFirstRunTips();
    console.log('✓ Research context modal initialized');
}
