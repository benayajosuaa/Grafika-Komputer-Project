/**
 * SIMPLE Educational Pop-out System
 * Direct implementation tanpa complexity
 */

class SimpleEducationalPopout {
    constructor() {
        console.log('🎓 SimpleEducationalPopout initializing...');
        this.container = document.querySelector('.info-popout-container');
        
        if (!this.container) {
            console.warn('⚠️ info-popout-container not found! Creating one...');
            this.container = document.createElement('div');
            this.container.className = 'info-popout-container';
            document.body.appendChild(this.container);
        }
        
        console.log('✓ Container ready:', this.container);
        
        // Knowledge base
        this.knowledge = {
            'albedo': {
                title: 'Albedo (Warna Dasar)',
                text: 'Parameter RGB yang merepresentasikan warna dan reflektansi dasar material. Nilai lebih tinggi = permukaan lebih cerah dan reflektif.',
                tk: 'TK1 (Inverse Rendering), TK3 (Kualitas Visual)'
            },
            'roughness': {
                title: 'Roughness (Tekstur Permukaan)',
                text: 'Mendeskripsikan mikro-tekstur permukaan:\n• Kecil (0.0): Halus, refleksi tajam seperti cermin\n• Sedang (0.5): Campuran difus dan spekuler\n• Besar (1.0): Kasar, refleksi difus dominan',
                tk: 'TK1 (Inverse Rendering), TK3 (Kualitas Visual)'
            },
            'metallic': {
                title: 'Metallic (Sifat Logam)',
                text: 'Menunjukkan tingkat sifat logam material:\n• 0.0: Non-logam (dielektrik)\n• 0.5: Transisi antara logam dan non-logam\n• 1.0: Logam (konduktif)',
                tk: 'TK1 (Inverse Rendering), TK3 (Kualitas Visual)'
            },
            'metrics': {
                title: 'Quality Metrics (Metrik Kualitas)',
                text: 'PSNR (dB): Mengukur perbedaan piksel antara input dan render.\nSSIM (0-1): Mengukur kesamaan struktur visual.\nLoss: Fungsi error yang diminimalkan saat optimasi.',
                tk: 'TK3 (Evaluasi Kualitas Visual), TK4 (Performa GPU)'
            },
            'optimization-curve': {
                title: 'Optimization Curve (Kurva Optimasi)',
                text: 'Menampilkan penurunan loss sepanjang iterasi. Sumbu X: iterasi (0-300). Sumbu Y: loss value (skala logaritmik). Menunjukkan proses inverse rendering berjalan.',
                tk: 'TK1 (Inverse Rendering), TK4 (Performa GPU)'
            }
        };
        
        // Setup event delegation
        this.setupEventDelegation();
        console.log('✓ Event delegation setup complete');
    }
    
    setupEventDelegation() {
        // Detect info buttons yang di-klik
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.info-btn');
            if (btn) {
                const term = btn.dataset.term;
                console.log('🔍 Info button clicked:', term);
                if (term && this.knowledge[term]) {
                    this.showPopout(term);
                }
            }
        }, true); // Use capture phase
    }
    
    showPopout(term) {
        const info = this.knowledge[term];
        if (!info) {
            console.warn('Unknown term:', term);
            return;
        }
        
        // Remove existing popouts
        const existing = this.container.querySelectorAll('.popout');
        existing.forEach(p => p.remove());
        
        // Create popout
        const popout = document.createElement('div');
        popout.className = 'popout';
        popout.innerHTML = `
            <div class="popout-inner">
                <button class="popout-close" onclick="this.parentElement.parentElement.remove()">×</button>
                <h3>${info.title}</h3>
                <p>${info.text.replace(/\n/g, '<br>')}</p>
                <div class="popout-tk">
                    <strong>📊 Tujuan Penelitian:</strong><br>
                    ${info.tk}
                </div>
            </div>
        `;
        
        this.container.appendChild(popout);
        console.log('✓ Popout shown:', term);
        
        // Auto close after 10 seconds
        setTimeout(() => {
            if (popout.parentElement) {
                popout.remove();
            }
        }, 10000);
    }
    
    // Call ini setelah optimization selesai
    showInterpretationPopout(albedo, roughness, metallic) {
        console.log('📋 Showing interpretation popout...');
        
        let surfaceDesc = '';
        if (roughness < 0.3) {
            surfaceDesc = 'Permukaan halus dengan refleksi tajam (specular).';
        } else if (roughness < 0.7) {
            surfaceDesc = 'Permukaan dengan karakteristik campuran (difus + spekuler).';
        } else {
            surfaceDesc = 'Permukaan kasar dengan refleksi difus dominan.';
        }
        
        let metalDesc = '';
        if (metallic < 0.3) {
            metalDesc = 'Menunjukkan sifat non-logam (dielektrik).';
        } else if (metallic < 0.7) {
            metalDesc = 'Menunjukkan sifat transisi logam-non-logam.';
        } else {
            metalDesc = 'Menunjukkan sifat logam (konduktif).';
        }
        
        const avgAlbedo = ((albedo[0] + albedo[1] + albedo[2]) / 3).toFixed(2);
        let brightnessDesc = '';
        if (avgAlbedo < 0.3) {
            brightnessDesc = 'Material gelap dengan reflektansi rendah.';
        } else if (avgAlbedo < 0.7) {
            brightnessDesc = 'Material dengan reflektansi sedang.';
        } else {
            brightnessDesc = 'Material cerah dengan reflektansi tinggi.';
        }
        
        const popout = document.createElement('div');
        popout.className = 'popout interpretation-popout';
        popout.innerHTML = `
            <div class="popout-inner">
                <button class="popout-close" onclick="this.parentElement.parentElement.remove()">×</button>
                <h2>📋 Hasil Estimasi BRDF</h2>
                <div class="popout-content">
                    <p><strong>Parameter yang Diestimasi:</strong></p>
                    <ul>
                        <li>Albedo: RGB(${albedo[0].toFixed(2)}, ${albedo[1].toFixed(2)}, ${albedo[2].toFixed(2)})</li>
                        <li>Roughness: ${roughness.toFixed(2)}</li>
                        <li>Metallic: ${metallic.toFixed(2)}</li>
                    </ul>
                    
                    <p><strong>Interpretasi Kualitatif:</strong></p>
                    <ul>
                        <li>✓ ${brightnessDesc}</li>
                        <li>✓ ${surfaceDesc}</li>
                        <li>✓ ${metalDesc}</li>
                    </ul>
                    
                    <p style="font-size: 0.85em; color: #666; font-style: italic;">
                        ⚠️ Interpretasi ini bersifat kualitatif berdasarkan sifat fisik parameter. 
                        BUKAN klasifikasi jenis material (kayu, logam, kain, dll).
                    </p>
                </div>
                <div class="popout-tk">
                    <strong>📊 Tujuan Penelitian yang Didukung:</strong><br>
                    • TK1: Inverse Rendering untuk Estimasi BRDF<br>
                    • TK3: Evaluasi Kualitas Visual Hasil Estimasi
                </div>
            </div>
        `;
        
        this.container.appendChild(popout);
        console.log('✓ Interpretation popout shown');
        
        // Auto close after 15 seconds
        setTimeout(() => {
            if (popout.parentElement) {
                popout.remove();
            }
        }, 15000);
    }
}

// Initialize ASAP
let simplePopout = null;

function initSimplePopout() {
    if (!simplePopout) {
        simplePopout = new SimpleEducationalPopout();
        console.log('✓✓✓ SimpleEducationalPopout READY');
        window.simplePopout = simplePopout;
        
        // ALWAYS show welcome message (removed localStorage check)
        setTimeout(() => {
            // Create welcome popout
            const container = simplePopout.container;
            const welcome = document.createElement('div');
            welcome.className = 'popout';
            welcome.innerHTML = `
                <div class="popout-inner">
                    <button class="popout-close" onclick="this.parentElement.parentElement.remove()">×</button>
                    <h2>🔬 Selamat Datang!</h2>
                    <p>Ini adalah <strong>Prototype Penelitian UTS Grafika Komputer</strong> untuk mengevaluasi <strong>feasibility pipeline inverse rendering</strong> berbasis differentiable rendering.</p>
                    
                    <p><strong>Cara Menggunakan:</strong></p>
                    <ul>
                        <li>Upload citra material dari komputer Anda</li>
                        <li>Klik "?" untuk mempelajari setiap parameter</li>
                        <li>Klik "Start Optimization" untuk menjalankan estimasi BRDF</li>
                        <li>Lihat interpretasi hasil setelah selesai</li>
                    </ul>
                    
                    <p style="font-size: 0.85em; color: #666;">
                        💡 <strong>Penting:</strong> Sistem ini mengevaluasi feasibility pipeline, bukan akurasi production-ready. 
                        Hasil diinterpretasikan secara kualitatif berdasarkan sifat fisik parameter, bukan klasifikasi jenis material.
                    </p>
                    
                    <div class="popout-tk">
                        <strong>📊 Tujuan Penelitian (TK):</strong><br>
                        • TK1: Metode inverse rendering untuk estimasi BRDF<br>
                        • TK2: Robustness terhadap variasi pencahayaan & noise<br>
                        • TK3: Evaluasi kualitas visual hasil estimasi<br>
                        • TK4: Evaluasi performa komputasi GPU<br>
                        • TK5: Perbandingan dengan metode referensi
                    </div>
                </div>
            `;
            
            container.appendChild(welcome);
            console.log('✓ Welcome popout shown');
            
            // Auto close after 12 seconds
            setTimeout(() => {
                if (welcome.parentElement) {
                    welcome.remove();
                }
            }, 12000);
        }, 500); // Delay 500ms untuk ensure DOM ready
    }
}

// Try multiple ways to initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimplePopout);
} else {
    initSimplePopout();
}

// Also on window load
window.addEventListener('load', initSimplePopout);

// Direct call if needed
setTimeout(initSimplePopout, 100);
