// Main Application Controller

class BRDFApp {
    constructor() {
        this.isOptimizing = false;
        this.currentImage = null;
        this.parameters = {
            albedo: [0.5, 0.5, 0.5],
            roughness: 0.5,
            metallic: 0.0
        };
        this.lossHistory = [];
        this.paramHistory = [];
        this.metrics = {
            psnr: null,
            ssim: null,
            loss: null
        };
        
        this.renderer = null;
        this.lossChart = null;
        
        this.initializeEventListeners();
        this.initializeRenderer();
        this.initializeLossChart();
    }
    
    initializeLossChart() {
        const chartCanvas = document.getElementById('loss-chart');
        if (!chartCanvas) {
            console.warn('Chart canvas not found');
            return;
        }
        
        const ctx = chartCanvas.getContext('2d');
        this.lossChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Optimization Loss',
                    data: [],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            font: { size: 12 },
                            color: '#111827'
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'logarithmic',
                        min: 0.0001,
                        max: 1,
                        title: {
                            display: true,
                            text: 'Loss (log scale)'
                        },
                        ticks: {
                            color: '#6b7280'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#6b7280'
                        }
                    }
                }
            }
        });
        console.log('✓ Loss chart initialized');
    }
    
    initializeEventListeners() {
        // File upload
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) uploadBtn.addEventListener('click', () => this.handleImageUpload());
        
        // Parameters
        ['albedo-r', 'albedo-g', 'albedo-b'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', (e) => {
                this.parameters.albedo[i] = parseInt(e.target.value) / 100;
                this.updateParameterDisplay();
                this.updatePreview();
            });
        });
        
        const roughnessEl = document.getElementById('roughness');
        if (roughnessEl) roughnessEl.addEventListener('input', (e) => {
            this.parameters.roughness = parseInt(e.target.value) / 100;
            this.updateParameterDisplay();
            this.updatePreview();
        });
        
        const metallicEl = document.getElementById('metallic');
        if (metallicEl) metallicEl.addEventListener('input', (e) => {
            this.parameters.metallic = parseInt(e.target.value) / 100;
            this.updateParameterDisplay();
            this.updatePreview();
        });
        
        // Optimization controls
        const startBtn = document.getElementById('start-optimize');
        if (startBtn) startBtn.addEventListener('click', () => this.startOptimization());
        
        const stopBtn = document.getElementById('stop-optimize');
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopOptimization());
        
        const resetBtn = document.getElementById('reset-params');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetParameters());
        
        // Export
        const exportParamsBtn = document.getElementById('export-params');
        if (exportParamsBtn) exportParamsBtn.addEventListener('click', () => this.exportParameters());
        
        const exportRenderBtn = document.getElementById('export-render');
        if (exportRenderBtn) exportRenderBtn.addEventListener('click', () => this.exportRender());
    }
    
    initializeRenderer() {
        this.renderer = new ThreeJSRenderer('canvas-container');
        console.log('✓ Three.js renderer initialized');
    }
    
    handleImageUpload() {
        const fileInput = document.getElementById('file-input');
        if (!fileInput || fileInput.files.length === 0) {
            alert('Please select an image first!');
            return;
        }
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            const imgEl = document.getElementById('input-image');
            if (imgEl) imgEl.src = this.currentImage;
            console.log('✓ Image uploaded');
            this.showMessage('Image uploaded successfully!');
        };
        
        reader.onerror = () => {
            this.showMessage('Error reading file!');
        };
        
        reader.readAsDataURL(file);
    }
    
    updateParameterDisplay() {
        const updateEl = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        updateEl('albedo-r-val', this.parameters.albedo[0].toFixed(2));
        updateEl('albedo-g-val', this.parameters.albedo[1].toFixed(2));
        updateEl('albedo-b-val', this.parameters.albedo[2].toFixed(2));
        updateEl('roughness-val', this.parameters.roughness.toFixed(2));
        updateEl('metallic-val', this.parameters.metallic.toFixed(2));
        
        // Update color preview
        const previewEl = document.getElementById('albedo-preview');
        if (previewEl) {
            const [r, g, b] = this.parameters.albedo;
            const rgbColor = `rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`;
            previewEl.style.backgroundColor = rgbColor;
        }
    }
    
    updatePreview() {
        if (this.renderer) {
            this.renderer.updateMaterial(this.parameters);
        }
    }
    
    async startOptimization() {
        if (this.isOptimizing) return;
        if (!this.currentImage) {
            alert('Please upload an image first!');
            return;
        }
        
        this.isOptimizing = true;
        const startBtn = document.getElementById('start-optimize');
        const stopBtn = document.getElementById('stop-optimize');
        const progressSection = document.getElementById('progress-section');
        const spinner = document.getElementById('loading-spinner');
        
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (progressSection) progressSection.style.display = 'block';
        if (spinner) spinner.style.display = 'block';
        
        try {
            await this.runOptimization();
        } catch (error) {
            console.error('Optimization error:', error);
            alert('Optimization failed: ' + error.message);
        } finally {
            this.isOptimizing = false;
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            if (spinner) spinner.style.display = 'none';
        }
    }
    
    async runOptimization() {
        // Simulate BRDF optimization
        const numIterations = 300;
        
        for (let i = 0; i < numIterations && this.isOptimizing; i++) {
            // Simulate parameter updates
            this.parameters.albedo[0] += (Math.random() - 0.5) * 0.01;
            this.parameters.albedo[1] += (Math.random() - 0.5) * 0.01;
            this.parameters.albedo[2] += (Math.random() - 0.5) * 0.01;
            this.parameters.roughness += (Math.random() - 0.5) * 0.01;
            
            // Clamp values
            this.parameters.albedo = this.parameters.albedo.map(v => Math.max(0, Math.min(1, v)));
            this.parameters.roughness = Math.max(0, Math.min(1, this.parameters.roughness));
            this.parameters.metallic = Math.max(0, Math.min(1, this.parameters.metallic));
            
            // Simulate loss (exponential decay)
            const loss = Math.exp(-i / 50) + Math.random() * 0.01;
            this.lossHistory.push(loss);
            this.paramHistory.push({...this.parameters});
            
            // Update UI
            this.updateParameterDisplay();
            this.updatePreview();
            this.updateProgressBar(i, numIterations, loss);
            this.updateLossChart();
            this.updateMetricsDisplay();  // ← UPDATE METRICS EVERY ITERATION!
            
            // Reduce wait time for faster optimization (20ms per iteration)
            // Total time: ~6 minutes for 300 iterations
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        // Final metrics update
        this.updateMetricsDisplay();
        
        // Show interpretation popout if system initialized
        try {
            if (window.simplePopout) {
                window.simplePopout.showInterpretationPopout(
                    this.parameters.albedo,
                    this.parameters.roughness,
                    this.parameters.metallic
                );
            }
        } catch (e) {
            console.warn('Could not show interpretation popout:', e);
        }
        
        console.log('✓ Optimization complete');
        console.log('Final BRDF Parameters:', this.parameters);
        console.log('Metrics:', this.metrics);
    }
    
    stopOptimization() {
        this.isOptimizing = false;
        const stopBtn = document.getElementById('stop-optimize');
        if (stopBtn) stopBtn.disabled = true;
        this.showMessage('Optimization stopped');
    }
    
    resetParameters() {
        this.parameters = {
            albedo: [0.5, 0.5, 0.5],
            roughness: 0.5,
            metallic: 0.0
        };
        this.lossHistory = [];
        this.paramHistory = [];
        
        // Reset UI sliders
        const sliders = {
            'albedo-r': 50,
            'albedo-g': 50,
            'albedo-b': 50,
            'roughness': 50,
            'metallic': 0
        };
        
        Object.entries(sliders).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });
        
        this.updateParameterDisplay();
        this.updatePreview();
        const progressSection = document.getElementById('progress-section');
        if (progressSection) progressSection.style.display = 'none';
        
        this.showMessage('Parameters reset');
    }
    
    updateProgressBar(current, total, loss) {
        const percentage = (current / total) * 100;
        const fillEl = document.getElementById('progress-fill');
        const textEl = document.getElementById('progress-text');
        
        if (fillEl) fillEl.style.width = percentage + '%';
        if (textEl) textEl.textContent = 
            `Iteration ${current}/${total} | Loss: ${loss.toFixed(6)}`;
    }
    
    updateLossChart() {
        // Update Chart.js with loss history
        if (this.lossChart && this.lossHistory.length > 0) {
            this.lossChart.data.labels = this.lossHistory.map((_, i) => i);
            this.lossChart.data.datasets[0].data = this.lossHistory;
            this.lossChart.update('none');  // No animation
        }
    }
    
    updateMetricsDisplay() {
        // Calculate metrics from loss history
        const updateEl = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        if (this.lossHistory.length === 0) {
            updateEl('metric-psnr', '--');
            updateEl('metric-ssim', '--');
            updateEl('metric-loss', '--');
            return;
        }
        
        const finalLoss = this.lossHistory[this.lossHistory.length - 1];
        
        // Simulate metrics based on loss (inverse relationship)
        const psnr = (28 - (Math.log10(finalLoss) + 3) * 4.3).toFixed(2);
        const ssim = Math.max(0.3, (1 - finalLoss * 100)).toFixed(3);
        
        updateEl('metric-psnr', isNaN(psnr) ? '--' : psnr + ' dB');
        updateEl('metric-ssim', isNaN(ssim) ? '--' : ssim);
        updateEl('metric-loss', finalLoss.toFixed(6));
        
        this.metrics = {
            psnr: parseFloat(psnr),
            ssim: parseFloat(ssim),
            loss: finalLoss
        };
    }
    
    exportParameters() {
        try {
            const params = {
                timestamp: new Date().toISOString(),
                parameters: this.parameters,
                losses: this.lossHistory,
                iterations: this.paramHistory.length
            };
            
            const dataStr = JSON.stringify(params, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            if (link) {
                link.href = url;
                link.download = `brdf_params_${Date.now()}.json`;
                link.click();
            }
            
            this.showMessage('Parameters exported!');
        } catch (error) {
            this.showMessage(`Error exporting parameters: ${error.message}`);
            console.error(error);
        }
    }
    
    exportRender() {
        try {
            if (this.renderer && this.renderer.canvas) {
                this.renderer.canvas.toBlob(blob => {
                    if (!blob) {
                        this.showMessage('Error: Could not create image blob');
                        return;
                    }
                    
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    
                    if (link) {
                        link.href = url;
                        link.download = `brdf_render_${Date.now()}.png`;
                        link.click();
                    }
                    
                    this.showMessage('Render exported!');
                });
            } else {
                this.showMessage('Error: Renderer not initialized');
            }
        } catch (error) {
            this.showMessage(`Error exporting render: ${error.message}`);
            console.error(error);
        }
    }
    
    showMessage(msg) {
        console.log(msg);
        // Could add toast notification here
        alert(msg);
    }
}

// Initialize app on load
window.addEventListener('DOMContentLoaded', () => {
    window.app = new BRDFApp();
    console.log('✓ BRDF Application initialized');
});
