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
        document.getElementById('upload-btn').addEventListener('click', () => this.handleImageUpload());
        
        // Parameters
        ['albedo-r', 'albedo-g', 'albedo-b'].forEach((id, i) => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.parameters.albedo[i] = parseInt(e.target.value) / 100;
                this.updateParameterDisplay();
                this.updatePreview();
            });
        });
        
        document.getElementById('roughness').addEventListener('input', (e) => {
            this.parameters.roughness = parseInt(e.target.value) / 100;
            this.updateParameterDisplay();
            this.updatePreview();
        });
        
        document.getElementById('metallic').addEventListener('input', (e) => {
            this.parameters.metallic = parseInt(e.target.value) / 100;
            this.updateParameterDisplay();
            this.updatePreview();
        });
        
        // Optimization controls
        document.getElementById('start-optimize').addEventListener('click', () => this.startOptimization());
        document.getElementById('stop-optimize').addEventListener('click', () => this.stopOptimization());
        document.getElementById('reset-params').addEventListener('click', () => this.resetParameters());
        
        // Export
        document.getElementById('export-params').addEventListener('click', () => this.exportParameters());
        document.getElementById('export-render').addEventListener('click', () => this.exportRender());
    }
    
    initializeRenderer() {
        this.renderer = new ThreeJSRenderer('canvas-container');
        console.log('✓ Three.js renderer initialized');
    }
    
    handleImageUpload() {
        const fileInput = document.getElementById('file-input');
        if (fileInput.files.length === 0) return;
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            document.getElementById('input-image').src = this.currentImage;
            console.log('✓ Image uploaded');
            this.showMessage('Image uploaded successfully!');
        };
        
        reader.readAsDataURL(file);
    }
    
    updateParameterDisplay() {
        document.getElementById('albedo-r-val').textContent = this.parameters.albedo[0].toFixed(2);
        document.getElementById('albedo-g-val').textContent = this.parameters.albedo[1].toFixed(2);
        document.getElementById('albedo-b-val').textContent = this.parameters.albedo[2].toFixed(2);
        document.getElementById('roughness-val').textContent = this.parameters.roughness.toFixed(2);
        document.getElementById('metallic-val').textContent = this.parameters.metallic.toFixed(2);
        
        // Update color preview
        const [r, g, b] = this.parameters.albedo;
        const rgbColor = `rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`;
        document.getElementById('albedo-preview').style.backgroundColor = rgbColor;
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
        document.getElementById('start-optimize').disabled = true;
        document.getElementById('stop-optimize').disabled = false;
        document.getElementById('progress-section').style.display = 'block';
        document.getElementById('loading-spinner').style.display = 'block';
        
        try {
            await this.runOptimization();
        } catch (error) {
            console.error('Optimization error:', error);
            alert('Optimization failed: ' + error.message);
        } finally {
            this.isOptimizing = false;
            document.getElementById('start-optimize').disabled = false;
            document.getElementById('stop-optimize').disabled = true;
            document.getElementById('loading-spinner').style.display = 'none';
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
        console.log('✓ Optimization complete');
        console.log('Final BRDF Parameters:', this.parameters);
        console.log('Metrics:', this.metrics);
    }
    
    stopOptimization() {
        this.isOptimizing = false;
        document.getElementById('stop-optimize').disabled = true;
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
        
        // Reset UI
        document.getElementById('albedo-r').value = 50;
        document.getElementById('albedo-g').value = 50;
        document.getElementById('albedo-b').value = 50;
        document.getElementById('roughness').value = 50;
        document.getElementById('metallic').value = 0;
        
        this.updateParameterDisplay();
        this.updatePreview();
        document.getElementById('progress-section').style.display = 'none';
        
        this.showMessage('Parameters reset');
    }
    
    updateProgressBar(current, total, loss) {
        const percentage = (current / total) * 100;
        document.getElementById('progress-fill').style.width = percentage + '%';
        document.getElementById('progress-text').textContent = 
            `Iteration ${current}/${total} | Loss: ${loss.toFixed(6)}`;
    }
    
    updateLossChart() {
        // Update Chart.js with loss history
        if (this.lossChart && this.lossHistory.length > 0) {
            this.lossChart.data.labels = this.lossHistory.map((_, i) => i);
            this.lossChart.data.datasets[0].data = this.lossHistory;
            this.lossChart.update('none');
        }
    }
    
    updateMetricsDisplay() {
        // Calculate metrics from loss history
        if (this.lossHistory.length === 0) {
            document.getElementById('metric-psnr').textContent = '--';
            document.getElementById('metric-ssim').textContent = '--';
            document.getElementById('metric-loss').textContent = '--';
            return;
        }
        
        const finalLoss = this.lossHistory[this.lossHistory.length - 1];
        
        // Simulate metrics based on loss (inverse relationship)
        const psnr = (28 - (Math.log10(finalLoss) + 3) * 4.3).toFixed(2);
        const ssim = Math.max(0.3, (1 - finalLoss * 100)).toFixed(3);
        
        document.getElementById('metric-psnr').textContent = isNaN(psnr) ? '--' : psnr + ' dB';
        document.getElementById('metric-ssim').textContent = isNaN(ssim) ? '--' : ssim;
        document.getElementById('metric-loss').textContent = finalLoss.toFixed(6);
        
        this.metrics = {
            psnr: parseFloat(psnr),
            ssim: parseFloat(ssim),
            loss: finalLoss
        };
    }
    
    exportParameters() {
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
        link.href = url;
        link.download = `brdf_params_${Date.now()}.json`;
        link.click();
        
        this.showMessage('Parameters exported!');
    }
    
    exportRender() {
        if (this.renderer && this.renderer.canvas) {
            this.renderer.canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `brdf_render_${Date.now()}.png`;
                link.click();
                this.showMessage('Render exported!');
            });
        }
    }
    
    showMessage(msg) {
        console.log(msg);
        // Could add toast notification here
    }
}

// Initialize app on load
window.addEventListener('DOMContentLoaded', () => {
    window.app = new BRDFApp();
    console.log('✓ BRDF Application initialized');
});
