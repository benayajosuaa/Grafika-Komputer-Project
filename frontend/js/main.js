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
        this.updateSystemInfo();
        this.startPerformanceProbe();
    }

    updateSystemInfo() {
        const webglEl = document.getElementById('webgl-status');
        const rendererEl = document.getElementById('renderer-info');

        const hasWebGL = (() => {
            try {
                const canvas = document.createElement('canvas');
                return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            } catch (e) {
                return false;
            }
        })();

        if (webglEl) {
            webglEl.textContent = hasWebGL ? 'Supported' : 'Not supported';
        }

        if (rendererEl && this.renderer && this.renderer.renderer) {
            const info = this.renderer.renderer.getContext();
            const gl = info;
            const vendor = gl.getParameter(gl.VENDOR);
            const renderer = gl.getParameter(gl.RENDERER);
            rendererEl.textContent = `${vendor} | ${renderer}`;
        } else if (rendererEl) {
            rendererEl.textContent = 'Renderer not ready';
        }
    }

    startPerformanceProbe() {
        const avgFrameEl = document.getElementById('avg-frame');
        if (!avgFrameEl) return;

        let frameCount = 0;
        let startTime = performance.now();

        const probe = (now) => {
            frameCount += 1;
            const elapsed = now - startTime;

            if (elapsed >= 1000) {
                const avgFrameMs = elapsed / frameCount;
                avgFrameEl.textContent = `${avgFrameMs.toFixed(2)} ms`;
                frameCount = 0;
                startTime = now;
            }

            requestAnimationFrame(probe);
        };

        requestAnimationFrame(probe);
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

            const tempImg = new Image();
            tempImg.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const size = 96;
                canvas.width = size;
                canvas.height = size;

                const minDim = Math.min(tempImg.width, tempImg.height);
                const sx = Math.floor((tempImg.width - minDim) / 2);
                const sy = Math.floor((tempImg.height - minDim) / 2);
                ctx.drawImage(tempImg, sx, sy, minDim, minDim, 0, 0, size, size);

                const { data } = ctx.getImageData(0, 0, size, size);
                const pixelCount = size * size;
                let sumR = 0;
                let sumG = 0;
                let sumB = 0;
                let sumL = 0;
                let sumL2 = 0;
                let highlightCount = 0;
                let validCount = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i] / 255;
                    const g = data[i + 1] / 255;
                    const b = data[i + 2] / 255;
                    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

                    if (luminance > 0.8) {
                        highlightCount += 1;
                    }

                    if (luminance < 0.05 || luminance > 0.95) {
                        continue;
                    }

                    sumR += r;
                    sumG += g;
                    sumB += b;
                    sumL += luminance;
                    sumL2 += luminance * luminance;
                    validCount += 1;
                }

                const safeCount = validCount > 0 ? validCount : pixelCount;
                const avgR = (validCount > 0 ? sumR : data.filter((_, idx) => idx % 4 === 0).reduce((a, v) => a + v / 255, 0)) / safeCount;
                const avgG = (validCount > 0 ? sumG : data.filter((_, idx) => idx % 4 === 1).reduce((a, v) => a + v / 255, 0)) / safeCount;
                const avgB = (validCount > 0 ? sumB : data.filter((_, idx) => idx % 4 === 2).reduce((a, v) => a + v / 255, 0)) / safeCount;
                const avgL = (validCount > 0 ? sumL : (avgR * 0.2126 + avgG * 0.7152 + avgB * 0.0722));
                const variance = Math.max(0, (validCount > 0 ? sumL2 / safeCount - avgL * avgL : 0));
                const stdDev = Math.sqrt(variance);

                const maxRGB = Math.max(avgR, avgG, avgB);
                const minRGB = Math.min(avgR, avgG, avgB);
                const saturation = maxRGB === 0 ? 0 : (maxRGB - minRGB) / maxRGB;
                const highlightRatio = highlightCount / pixelCount;

                const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));

                const neutralness = 1 - saturation;
                const colorPenalty = saturation * 0.7;
                const variancePenalty = stdDev * 0.5;
                const metallicEstimate = 0.08 + neutralness * 0.55 + highlightRatio * 0.7 - colorPenalty - variancePenalty;
                this.parameters.metallic = clamp(metallicEstimate, 0, 1);

                const grayscale = avgL;
                const metalBlend = this.parameters.metallic;
                this.parameters.albedo = [avgR, avgG, avgB].map(v => clamp(v * (1 - metalBlend) + grayscale * metalBlend));

                const roughnessEstimate = 0.3 + stdDev * 0.7 - highlightRatio * 0.25;
                this.parameters.roughness = clamp(roughnessEstimate, 0.15, 0.98);

                const sliderMap = {
                    'albedo-r': Math.round(this.parameters.albedo[0] * 100),
                    'albedo-g': Math.round(this.parameters.albedo[1] * 100),
                    'albedo-b': Math.round(this.parameters.albedo[2] * 100),
                    'roughness': Math.round(this.parameters.roughness * 100),
                    'metallic': Math.round(this.parameters.metallic * 100)
                };

                Object.entries(sliderMap).forEach(([id, value]) => {
                    const el = document.getElementById(id);
                    if (el) el.value = value;
                });

                this.updateParameterDisplay();
                this.updatePreview();
            };

            tempImg.onerror = () => {
                this.showMessage('Error loading image for analysis.');
            };

            tempImg.src = this.currentImage;

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
        const baseParams = {
            albedo: [...this.parameters.albedo],
            roughness: this.parameters.roughness,
            metallic: this.parameters.metallic
        };
        
        for (let i = 0; i < numIterations && this.isOptimizing; i++) {
            const noiseScale = 0.002;
            this.parameters.albedo[0] = baseParams.albedo[0] + (Math.random() - 0.5) * noiseScale;
            this.parameters.albedo[1] = baseParams.albedo[1] + (Math.random() - 0.5) * noiseScale;
            this.parameters.albedo[2] = baseParams.albedo[2] + (Math.random() - 0.5) * noiseScale;
            this.parameters.roughness = baseParams.roughness + (Math.random() - 0.5) * noiseScale;
            this.parameters.metallic = baseParams.metallic;
            
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
