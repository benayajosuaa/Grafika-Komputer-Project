/**
 * Educational Pop-out System
 * 
 * Mengimplementasikan pop-out edukatif untuk menjelaskan istilah teknis
 * dan keterkaitannya dengan tujuan penelitian.
 * 
 * Tujuan Penelitian:
 * TK1: Mengembangkan metode inverse rendering untuk estimasi BRDF
 * TK2: Menganalisis robustness terhadap variasi pencahayaan dan noise
 * TK3: Mengevaluasi kualitas visual hasil estimasi
 * TK4: Mengevaluasi performa komputasi berbasis GPU
 * TK5: Membandingkan dengan metode referensi literatur
 */

class EducationalPopoutSystem {
    constructor() {
        this.container = document.getElementById('info-popout-container');
        this.popouts = new Map();
        this.activePopout = null;
        
        // Knowledge base untuk setiap istilah
        this.knowledge = {
            albedo: {
                title: 'Albedo',
                theme: 'interpretation',
                content: `
                    Albedo merepresentasikan warna dasar dan reflektansi difus 
                    dari permukaan material pada berbagai panjang gelombang (R, G, B).
                    Nilai yang lebih tinggi menunjukkan permukaan yang lebih reflektif.
                `,
                research: 'TK1, TK3',
                description: 'Mendukung estimasi parameter BRDF dan evaluasi kualitas visual.'
            },
            roughness: {
                title: 'Roughness (Kekasaran)',
                theme: 'interpretation',
                content: `
                    Mendeskripsikan tekstur mikro permukaan:
                    • Nilai kecil (~0.0): Permukaan halus, cerminan tajam
                    • Nilai sedang (~0.5): Permukaan dengan karakteristik campuran
                    • Nilai besar (~1.0): Permukaan kasar, refleksi difus
                    
                    Parameter ini mempengaruhi distribusi cahaya reflektif.
                `,
                research: 'TK1, TK3',
                description: 'Menunjukkan sifat permukaan difus vs spekuler.'
            },
            metallic: {
                title: 'Metallic (Sifat Logam)',
                theme: 'interpretation',
                content: `
                    Menunjukkan tingkat sifat logam material:
                    • Nilai ~0.0: Sifat non-logam (dielektrik)
                    • Nilai ~1.0: Sifat logam (konduktif)
                    
                    Mempengaruhi interaksi cahaya dengan permukaan dan
                    karakteristik refleksi spekuler.
                `,
                research: 'TK1, TK3',
                description: 'Membedakan perilaku refreksi antara material logam dan non-logam.'
            },
            metrics: {
                title: 'Quality Metrics (Metrik Kualitas)',
                theme: 'technical',
                content: `
                    <strong>PSNR (Peak Signal-to-Noise Ratio):</strong>
                    Mengukur perbedaan intensitas piksel antara citra input dan hasil render.
                    Satuan: dB (desibel). Nilai lebih tinggi = hasil lebih mirip.
                    
                    <strong>SSIM (Structural Similarity Index):</strong>
                    Mengukur kesamaan struktur dan persepsi visual antara dua citra.
                    Range: 0-1. Nilai lebih tinggi = kesamaan lebih baik.
                    
                    <strong>Loss (Fungsi Optimasi):</strong>
                    Fungsi error yang diminimalkan selama optimasi. 
                    Nilai lebih kecil = estimasi parameter lebih baik.
                `,
                research: 'TK3, TK4',
                description: 'Metrik ini mendukung evaluasi kualitas visual dan performa optimasi (TK3, TK4).'
            },
            'optimization-curve': {
                title: 'Optimization Curve (Kurva Optimasi)',
                theme: 'technical',
                content: `
                    Menampilkan penurunan nilai loss sepanjang iterasi optimasi.
                    
                    <strong>Sumbu X:</strong> Nomor iterasi (0-300)
                    <strong>Sumbu Y:</strong> Nilai loss (skala logaritmik)
                    
                    Kurva yang menurun menunjukkan optimasi berjalan baik.
                    Plateau menunjukkan sistem mendekati konvergensi.
                    
                    Ini merupakan indikator proses inverse rendering.
                `,
                research: 'TK1, TK4',
                description: 'Visualisasi proses optimasi parameter BRDF dan efisiensi komputasi.'
            },
            'optimization-loss': {
                title: 'Optimization Loss',
                theme: 'technical',
                content: `
                    Fungsi error yang mengukur perbedaan antara:
                    • Citra yang di-render dengan parameter estimasi
                    • Citra input dari pengguna
                    
                    Optimasi bertujuan meminimalkan nilai ini melalui
                    iterasi parameter BRDF.
                `,
                research: 'TK1',
                description: 'Inti dari proses inverse rendering berbasis optimasi.'
            },
            'gpu-time': {
                title: 'GPU Time',
                theme: 'technical',
                content: `
                    Waktu eksekusi proses rendering dan optimasi pada GPU.
                    Digunakan untuk mengevaluasi performa komputasi.
                    
                    Metrik ini membantu mengukur feasibility pipeline 
                    untuk penggunaan interaktif.
                `,
                research: 'TK4',
                description: 'Evaluasi performa komputasi berbasis GPU.'
            },
            'brdf-interpretation': {
                title: 'Interpretasi Hasil BRDF',
                theme: 'interpretation',
                content: `
                    Hasil estimasi parameter BRDF harus diinterpretasikan 
                    secara kualitatif berdasarkan sifat fisik material:
                    
                    <strong>Jangan:</strong> Mengklasifikasikan jenis material 
                    (misalnya "ini adalah kayu" atau "ini adalah logam")
                    
                    <strong>Lakukan:</strong> Mendeskripsikan kecenderungan sifat
                    berdasarkan nilai albedo, roughness, dan metallic.
                    
                    Contoh benar:
                    "Nilai roughness tinggi menunjukkan permukaan cenderung difus."
                    "Nilai metallic mendekati nol menunjukkan sifat non-logam."
                `,
                research: 'TK1, TK2, TK3',
                description: 'Panduan interpretasi parameter BRDF sesuai kerangka penelitian.'
            }
        };
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Event delegation untuk semua info buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('info-btn')) {
                const term = e.target.dataset.term;
                if (term) {
                    this.showPopout(term, e.target);
                }
            }
        });
    }
    
    showPopout(term, triggerElement) {
        // Tutup popout aktif jika ada
        if (this.activePopout) {
            this.closePopout(this.activePopout);
        }
        
        const knowledge = this.knowledge[term];
        if (!knowledge) {
            console.warn(`Unknown educational term: ${term}`);
            return;
        }
        
        const popout = this.createPopoutElement(term, knowledge);
        this.container.appendChild(popout);
        this.activePopout = term;
        
        // Position popout near trigger element
        this.positionPopout(popout, triggerElement);
        
        // Setup close handler
        const closeBtn = popout.querySelector('.info-popout-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePopout(term));
        }
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!popout.contains(e.target) && 
                    e.target !== triggerElement &&
                    !e.target.classList.contains('info-btn')) {
                    this.closePopout(term);
                }
            }, { once: true });
        }, 100);
    }
    
    createPopoutElement(term, knowledge) {
        const popout = document.createElement('div');
        popout.className = `info-popout theme-${knowledge.theme}`;
        popout.id = `popout-${term}`;
        
        const objectives = knowledge.research.split(', ').map(tk => {
            const objDescriptions = {
                'TK1': 'Mengembangkan metode inverse rendering',
                'TK2': 'Menganalisis robustness',
                'TK3': 'Evaluasi kualitas visual',
                'TK4': 'Evaluasi performa GPU',
                'TK5': 'Perbandingan dengan literatur'
            };
            return `<span class="research-tag">${tk}</span> ${objDescriptions[tk] || ''}`;
        }).join('<br>');
        
        popout.innerHTML = `
            <div class="info-popout-header">
                <h3 class="info-popout-title">${knowledge.title}</h3>
                <button class="info-popout-close" aria-label="Close">&times;</button>
            </div>
            <div class="info-popout-body">
                ${knowledge.content.trim()}
            </div>
            <div class="research-objective">
                <strong>📊 Tujuan Penelitian:</strong><br>
                ${objectives}
                <br><br>
                <em>${knowledge.description}</em>
            </div>
        `;
        
        return popout;
    }
    
    positionPopout(popout, triggerElement) {
        // Get trigger element bounds
        const triggerRect = triggerElement.getBoundingClientRect();
        const popoutWidth = 320;
        const popoutHeight = 300; // Approximate
        
        let left = triggerRect.right + 15;
        let top = triggerRect.top;
        
        // Check if popout would go off-screen right
        if (left + popoutWidth > window.innerWidth) {
            left = triggerRect.left - popoutWidth - 15;
        }
        
        // Check if popout would go off-screen bottom
        if (top + popoutHeight > window.innerHeight) {
            top = window.innerHeight - popoutHeight - 20;
        }
        
        // Check if popout would go off-screen top
        if (top < 20) {
            top = 20;
        }
        
        popout.style.left = `${left}px`;
        popout.style.top = `${top}px`;
    }
    
    closePopout(term) {
        const popout = document.getElementById(`popout-${term}`);
        if (!popout) return;
        
        popout.classList.add('closing');
        
        setTimeout(() => {
            popout.remove();
            if (this.activePopout === term) {
                this.activePopout = null;
            }
        }, 300);
    }
    
    /**
     * Tampilkan pop-out interpretasi hasil ketika optimasi selesai
     */
    showInterpretationPopout(parameters) {
        const { albedo, roughness, metallic } = parameters;
        
        // Interpretasi kualitatif
        let surfaceCharacteristic = '';
        if (roughness < 0.3) {
            surfaceCharacteristic = 'Permukaan halus dengan refleksi tajam.';
        } else if (roughness < 0.7) {
            surfaceCharacteristic = 'Permukaan dengan karakteristik campuran (difus-spekuler).';
        } else {
            surfaceCharacteristic = 'Permukaan kasar dengan refleksi difus dominan.';
        }
        
        let materialCharacteristic = '';
        if (metallic < 0.3) {
            materialCharacteristic = 'Menunjukkan sifat non-logam (dielektrik).';
        } else if (metallic < 0.7) {
            materialCharacteristic = 'Menunjukkan sifat transisi antara non-logam dan logam.';
        } else {
            materialCharacteristic = 'Menunjukkan sifat logam (konduktif).';
        }
        
        const avgAlbedo = ((albedo[0] + albedo[1] + albedo[2]) / 3).toFixed(2);
        let brightnessCharacteristic = '';
        if (avgAlbedo < 0.3) {
            brightnessCharacteristic = 'Material gelap dengan reflektansi rendah.';
        } else if (avgAlbedo < 0.7) {
            brightnessCharacteristic = 'Material dengan reflektansi sedang.';
        } else {
            brightnessCharacteristic = 'Material cerah dengan reflektansi tinggi.';
        }
        
        const popout = document.createElement('div');
        popout.className = 'info-popout theme-interpretation';
        popout.id = 'popout-interpretation-result';
        
        popout.innerHTML = `
            <div class="info-popout-header">
                <h3 class="info-popout-title">📋 Interpretasi Hasil BRDF</h3>
                <button class="info-popout-close" aria-label="Close">&times;</button>
            </div>
            <div class="info-popout-body">
                <strong>Hasil Estimasi Parameter:</strong><br>
                • Albedo: RGB(${albedo[0].toFixed(2)}, ${albedo[1].toFixed(2)}, ${albedo[2].toFixed(2)})<br>
                • Roughness: ${roughness.toFixed(2)}<br>
                • Metallic: ${metallic.toFixed(2)}<br><br>
                
                <strong>Interpretasi Kualitatif:</strong><br>
                ✓ ${brightnessCharacteristic}<br>
                ✓ ${surfaceCharacteristic}<br>
                ✓ ${materialCharacteristic}<br>
                
                <em style="font-size: 0.75em; color: #6b7280;">
                    Interpretasi ini bersifat deskriptif dan tidak mengklasifikasikan 
                    jenis material spesifik, sesuai dengan kerangka penelitian.
                </em>
            </div>
            <div class="research-objective">
                <strong>📊 Tujuan Penelitian:</strong><br>
                <span class="research-tag">TK1</span> Inverse rendering<br>
                <span class="research-tag">TK3</span> Evaluasi visual<br><br>
                <em>Hasil ini mendukung feasibility pipeline estimasi BRDF.</em>
            </div>
        `;
        
        this.container.appendChild(popout);
        
        // Position di tengah layar
        popout.style.left = `calc(50% - 160px)`;
        popout.style.top = `100px`;
        
        const closeBtn = popout.querySelector('.info-popout-close');
        closeBtn.addEventListener('click', () => {
            popout.classList.add('closing');
            setTimeout(() => popout.remove(), 300);
        });
    }
}

// Inisialisasi ketika DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.educationalSystem = new EducationalPopoutSystem();
        console.log('✓ Educational pop-out system initialized');
    });
} else {
    window.educationalSystem = new EducationalPopoutSystem();
    console.log('✓ Educational pop-out system initialized');
}
