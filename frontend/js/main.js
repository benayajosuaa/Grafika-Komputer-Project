import { runExampleAblation, runExampleExperiment } from './example_experiments.js?v=20260421a';
import { ExperimentRunner } from './experiment_runner.js?v=20260421a';
import { ThreeJSRenderer } from './renderer.js?v=20260421a';

function createFallbackMaterialProfile() {
    return {
        key: 'matte',
        label: 'Matte / Stone',
        description: 'Proxy geometry akan menyesuaikan mikrostruktur dan highlight supaya lebih mirip material yang terdeteksi.'
    };
}

function createProceduralCanvas(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
}

function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function createTexturePresets() {
    const presets = {
        'red-ceramic': {
            label: 'Red Ceramic',
            parameters: { albedo: [0.76, 0.23, 0.18], roughness: 0.42, metallic: 0.05, anisotropy: 0.02 },
            draw: (context, size) => {
                context.fillStyle = '#efe7df';
                context.fillRect(0, 0, size, size);
                const tile = size / 4;
                for (let y = 0; y < 4; y += 1) {
                    for (let x = 0; x < 4; x += 1) {
                        context.fillStyle = `rgb(${150 + (x + y) * 8}, ${46 + y * 6}, ${38 + x * 4})`;
                        context.fillRect(x * tile + 4, y * tile + 4, tile - 8, tile - 8);
                    }
                }
            }
        },
        'blue-plastic': {
            label: 'Blue Plastic',
            parameters: { albedo: [0.18, 0.45, 0.86], roughness: 0.28, metallic: 0.08, anisotropy: 0.0 },
            draw: (context, size) => {
                const gradient = context.createLinearGradient(0, 0, size, size);
                gradient.addColorStop(0, '#4ea0ff');
                gradient.addColorStop(1, '#174ea6');
                context.fillStyle = gradient;
                context.fillRect(0, 0, size, size);
                const image = context.getImageData(0, 0, size, size);
                for (let index = 0; index < image.data.length; index += 4) {
                    const noise = (Math.random() - 0.5) * 24;
                    image.data[index] = clampChannel(image.data[index] + noise);
                    image.data[index + 1] = clampChannel(image.data[index + 1] + noise);
                    image.data[index + 2] = clampChannel(image.data[index + 2] + noise * 1.4);
                }
                context.putImageData(image, 0, 0);
            }
        },
        'green-fabric': {
            label: 'Green Fabric',
            parameters: { albedo: [0.24, 0.63, 0.33], roughness: 0.74, metallic: 0.02, anisotropy: 0.0 },
            draw: (context, size) => {
                context.fillStyle = '#2e7d44';
                context.fillRect(0, 0, size, size);
                context.strokeStyle = 'rgba(200, 255, 210, 0.24)';
                context.lineWidth = 2;
                const spacing = 12;
                for (let index = -size; index < size * 2; index += spacing) {
                    context.beginPath();
                    context.moveTo(index, 0);
                    context.lineTo(index - size, size);
                    context.stroke();
                    context.beginPath();
                    context.moveTo(index, size);
                    context.lineTo(index - size, 0);
                    context.stroke();
                }
            }
        },
        'gold-metal': {
            label: 'Gold Metal',
            parameters: { albedo: [0.88, 0.71, 0.21], roughness: 0.14, metallic: 0.96, anisotropy: 0.38 },
            draw: (context, size) => {
                const gradient = context.createLinearGradient(0, 0, size, size);
                gradient.addColorStop(0, '#fff2a8');
                gradient.addColorStop(0.35, '#d9ae2b');
                gradient.addColorStop(0.7, '#8a6110');
                gradient.addColorStop(1, '#f7cf5f');
                context.fillStyle = gradient;
                context.fillRect(0, 0, size, size);
                context.strokeStyle = 'rgba(255,255,255,0.18)';
                for (let x = 0; x < size; x += 8) {
                    context.beginPath();
                    context.moveTo(x, 0);
                    context.lineTo(x - size * 0.18, size);
                    context.stroke();
                }
            }
        },
        'white-marble': {
            label: 'White Marble',
            parameters: { albedo: [0.94, 0.94, 0.95], roughness: 0.36, metallic: 0.01, anisotropy: 0.0 },
            draw: (context, size) => {
                context.fillStyle = '#f4f5f7';
                context.fillRect(0, 0, size, size);
                context.lineWidth = 3;
                for (let index = 0; index < 11; index += 1) {
                    context.strokeStyle = index % 2 === 0 ? 'rgba(120, 130, 145, 0.28)' : 'rgba(168, 175, 188, 0.22)';
                    context.beginPath();
                    const startY = Math.random() * size;
                    context.moveTo(-10, startY);
                    for (let step = 0; step <= 6; step += 1) {
                        const x = (size / 6) * step;
                        const y = startY + Math.sin((step + index) * 1.4) * 18 + (Math.random() - 0.5) * 26;
                        context.lineTo(x, y);
                    }
                    context.stroke();
                }
            }
        },
        'dark-leather': {
            label: 'Dark Leather',
            parameters: { albedo: [0.22, 0.14, 0.1], roughness: 0.68, metallic: 0.0, anisotropy: 0.0 },
            draw: (context, size) => {
                const gradient = context.createLinearGradient(0, 0, 0, size);
                gradient.addColorStop(0, '#4a2e23');
                gradient.addColorStop(1, '#24150f');
                context.fillStyle = gradient;
                context.fillRect(0, 0, size, size);
                const image = context.getImageData(0, 0, size, size);
                for (let index = 0; index < image.data.length; index += 4) {
                    const grain = (Math.random() - 0.5) * 38;
                    image.data[index] = clampChannel(image.data[index] + grain);
                    image.data[index + 1] = clampChannel(image.data[index + 1] + grain * 0.65);
                    image.data[index + 2] = clampChannel(image.data[index + 2] + grain * 0.45);
                }
                context.putImageData(image, 0, 0);
                context.strokeStyle = 'rgba(255,255,255,0.05)';
                for (let index = 0; index < 22; index += 1) {
                    context.beginPath();
                    context.ellipse(Math.random() * size, Math.random() * size, 12 + Math.random() * 16, 6 + Math.random() * 10, Math.random() * Math.PI, 0, Math.PI * 2);
                    context.stroke();
                }
            }
        }
    };

    return Object.fromEntries(Object.entries(presets).map(([key, preset]) => [key, {
        ...preset,
        createCanvas: () => {
            const canvas = createProceduralCanvas();
            const context = canvas.getContext('2d', { willReadFrequently: true });
            preset.draw(context, canvas.width);
            return canvas;
        }
    }]));
}

class BRDFApp {
    constructor() {
        this.isOptimizing = false;
        this.currentImage = null;
        this.currentImageId = null;
        this.currentExperimentResult = null;
        this.currentAblationResult = null;
        this.currentBatchResult = null;
        this.currentMaterialProfile = createFallbackMaterialProfile();
        this.texturePresets = createTexturePresets();
        this.currentTexturePreset = null;
        this.parameters = {
            albedo: [0.5, 0.5, 0.5],
            roughness: 0.5,
            metallic: 0.0,
            anisotropy: 0.0,
            lightIntensity: 1.0,
            opacity: 1.0,
            ior: 1.5,
            materialMode: 'standard'
        };
        this.lossHistory = [];
        this.gradientHistory = [];
        this.metrics = {
            psnr: null,
            ssim: null,
            loss: null
        };
        this.charts = {};
        this.multiviewVisible = false;

        this.initializeRenderer();
        this.experimentRunner = new ExperimentRunner({
            renderer: this.renderer,
            imageSize: 64
        });

        this.initializeEventListeners();
        this.initializeCharts();
        this.updateParameterDisplay();
        this.updateMetricsDisplay();
        this.updateSummaryMetricsPanel(null);
        this.updateAblationPanel(null);
        this.updateOptimizationStatus(0, 0, null, 0);
        this.updateSystemInfo();
        this.startPerformanceProbe();
        this.updateMaterialProfileDisplay();
        this.setMaterialMode(this.parameters.materialMode);
        this.updatePreview();
        this.updateDebugPanel();
        this.exposeResearchApi();
    }

    initializeRenderer() {
        this.renderer = new ThreeJSRenderer('canvas-container');
        this.renderer.setSpecularMetricsListener((metrics) => this.updateSpecularMetricsDisplay(metrics));
    }

    exposeResearchApi() {
        window.researchRunner = this.experimentRunner;
        window.rendererApi = {
            setRenderMode: (mode) => this.renderer.setRenderMode(mode),
            loadTexture: (textureSource) => this.renderer.loadTexture(textureSource),
            getShaderSources: () => this.renderer.getShaderSources(),
            setMaterialProfile: (profile) => this.applyMaterialProfile(profile)
        };
        window.experimentUiApi = {
            runAblationAndDisplay: (imageId = this.currentImageId, config = {}) => this.runAblationAndDisplay(imageId, config),
            exportExperimentResults: () => this.exportExperimentResults(),
            runBatchExperiment: (imageList, config = {}) => this.runBatchExperiment(imageList, config),
            getConvergenceGraphData: () => this.getConvergenceGraphData()
        };
        window.researchExamples = {
            runExampleExperiment: async () => {
                if (!this.currentImageId) {
                    throw new Error('Upload an image before running the example experiment');
                }
                return runExampleExperiment(this.experimentRunner, this.currentImageId);
            },
            runExampleAblation: async () => {
                if (!this.currentImageId) {
                    throw new Error('Upload an image before running the example ablation');
                }
                return runExampleAblation(this.experimentRunner, this.currentImageId);
            }
        };
    }

    initializeEventListeners() {
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) uploadBtn.addEventListener('click', () => this.handleImageUpload());

        ['albedo-r', 'albedo-g', 'albedo-b'].forEach((id, index) => {
            const element = document.getElementById(id);
            if (!element) {
                return;
            }

            element.addEventListener('input', (event) => {
                this.parameters.albedo[index] = parseInt(event.target.value, 10) / 100;
                this.updateParameterDisplay();
                this.updatePreview();
            });
        });

        const roughnessElement = document.getElementById('roughness');
        if (roughnessElement) {
            roughnessElement.addEventListener('input', (event) => {
                this.parameters.roughness = parseInt(event.target.value, 10) / 100;
                this.updateParameterDisplay();
                this.updatePreview();
            });
        }

        const metallicElement = document.getElementById('metallic');
        if (metallicElement) {
            metallicElement.addEventListener('input', (event) => {
                this.parameters.metallic = parseInt(event.target.value, 10) / 100;
                this.updateParameterDisplay();
                this.updatePreview();
            });
        }

        const anisotropyElement = document.getElementById('anisotropy');
        if (anisotropyElement) {
            anisotropyElement.addEventListener('input', (event) => {
                this.parameters.anisotropy = parseInt(event.target.value, 10) / 100;
                this.updateParameterDisplay();
                this.updatePreview();
            });
        }

        const lightIntensityElement = document.getElementById('light-intensity');
        if (lightIntensityElement) {
            lightIntensityElement.addEventListener('input', (event) => {
                this.parameters.lightIntensity = parseFloat(event.target.value);
                this.updateParameterDisplay();
                this.updatePreview();
            });
        }

        const opacityElement = document.getElementById('opacity');
        if (opacityElement) {
            opacityElement.addEventListener('input', (event) => {
                this.parameters.opacity = parseFloat(event.target.value);
                this.updateParameterDisplay();
                this.updatePreview();
            });
        }

        const iorElement = document.getElementById('ior');
        if (iorElement) {
            iorElement.addEventListener('input', (event) => {
                this.parameters.ior = parseFloat(event.target.value);
                this.updateParameterDisplay();
                this.updatePreview();
            });
        }

        const standardModeBtn = document.getElementById('material-mode-standard');
        if (standardModeBtn) standardModeBtn.addEventListener('click', () => this.setMaterialMode('standard'));

        const glassModeBtn = document.getElementById('material-mode-glass');
        if (glassModeBtn) glassModeBtn.addEventListener('click', () => this.setMaterialMode('glass'));

        Object.keys(this.texturePresets).forEach((presetKey) => {
            const button = document.getElementById(`preset-${presetKey}`);
            if (!button) {
                return;
            }

            button.addEventListener('click', () => this.applyTexturePreset(presetKey));
        });

        const startBtn = document.getElementById('start-optimize');
        if (startBtn) startBtn.addEventListener('click', () => this.startOptimization());

        const stopBtn = document.getElementById('stop-optimize');
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopOptimization());

        const resetBtn = document.getElementById('reset-params');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetParameters());

        const sphereBtn = document.getElementById('geometry-sphere');
        if (sphereBtn) sphereBtn.addEventListener('click', () => this.setGeometryMode('sphere'));

        const cubeBtn = document.getElementById('geometry-cube');
        if (cubeBtn) cubeBtn.addEventListener('click', () => this.setGeometryMode('cube'));

        const compareBtn = document.getElementById('geometry-compare');
        if (compareBtn) compareBtn.addEventListener('click', () => this.setGeometryMode('compare'));

        const multiviewBtn = document.getElementById('toggle-multiview');
        if (multiviewBtn) multiviewBtn.addEventListener('click', () => this.toggleMultiview());

        const exportParamsBtn = document.getElementById('export-params');
        if (exportParamsBtn) exportParamsBtn.addEventListener('click', () => this.exportExperimentResults('json'));

        const exportRenderBtn = document.getElementById('export-render');
        if (exportRenderBtn) exportRenderBtn.addEventListener('click', () => this.exportRender());

        const exportComparisonBtn = document.getElementById('export-comparison-figure');
        if (exportComparisonBtn) exportComparisonBtn.addEventListener('click', () => this.exportComparisonFigure());

        const exportConvergenceBtn = document.getElementById('export-convergence-chart');
        if (exportConvergenceBtn) exportConvergenceBtn.addEventListener('click', () => this.exportConvergenceChart());

        const exportViewerBtn = document.getElementById('export-viewer-screenshot');
        if (exportViewerBtn) exportViewerBtn.addEventListener('click', () => this.exportViewerScreenshot());

        const exportPipelineBtn = document.getElementById('export-pipeline-diagram');
        if (exportPipelineBtn) exportPipelineBtn.addEventListener('click', () => this.exportPipelineDiagram());

        const exportExperimentBtn = document.getElementById('export-experiment-figure');
        if (exportExperimentBtn) exportExperimentBtn.addEventListener('click', () => this.exportBatchCsv());
    }

    getResearchChartOptions(yLabel, isLogarithmic = false) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: { size: 12, family: 'Segoe UI' },
                        color: '#111827'
                    }
                }
            },
            scales: {
                y: {
                    type: isLogarithmic ? 'logarithmic' : 'linear',
                    min: isLogarithmic ? 0.000001 : 0,
                    title: {
                        display: true,
                        text: yLabel,
                        color: '#111827',
                        font: { size: 12, weight: '600' }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Iteration',
                        color: '#111827',
                        font: { size: 12, weight: '600' }
                    }
                }
            }
        };
    }

    createLineChart(canvasId, label, borderColor, yLabel, isLogarithmic = false) {
        const chartCanvas = document.getElementById(canvasId);
        if (!chartCanvas) {
            return null;
        }

        return new Chart(chartCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label,
                    data: [],
                    borderColor,
                    borderWidth: 2,
                    tension: 0.25,
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: this.getResearchChartOptions(yLabel, isLogarithmic)
        });
    }

    initializeCharts() {
        this.charts.loss = this.createLineChart('loss-chart', 'Loss', '#2563eb', 'Loss', true);
        this.charts.roughness = this.createLineChart('roughness-chart', 'Gradient Norm', '#d97706', 'Gradient Norm');
        this.charts.metallic = this.createLineChart('metallic-chart', 'Metallic', '#059669', 'Metallic');

        if (this.charts.loss) {
            this.charts.loss.data.datasets = [
                {
                    label: 'Heuristic',
                    data: [],
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    tension: 0.25,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Random',
                    data: [],
                    borderColor: '#dc2626',
                    borderWidth: 2,
                    tension: 0.25,
                    fill: false,
                    pointRadius: 0
                }
            ];
            this.charts.loss.update('none');
        }
    }

    updateSystemInfo() {
        const webglElement = document.getElementById('webgl-status');
        const rendererElement = document.getElementById('renderer-info');

        const hasWebGL = (() => {
            try {
                const canvas = document.createElement('canvas');
                return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            } catch (error) {
                return false;
            }
        })();

        if (webglElement) {
            webglElement.textContent = hasWebGL ? 'Supported' : 'Not supported';
        }

        if (rendererElement && this.renderer && this.renderer.renderer) {
            const gl = this.renderer.renderer.getContext();
            rendererElement.textContent = `${gl.getParameter(gl.VENDOR)} | ${gl.getParameter(gl.RENDERER)}`;
        }
    }

    startPerformanceProbe() {
        const avgFrameElement = document.getElementById('avg-frame');
        if (!avgFrameElement) {
            return;
        }

        const update = () => {
            const profile = this.experimentRunner.profilePerformance();
            avgFrameElement.textContent = profile.avg_frame_time_ms ? `${profile.avg_frame_time_ms.toFixed(2)} ms` : '--';
            requestAnimationFrame(update);
        };

        requestAnimationFrame(update);
    }

    async handleImageUpload() {
        const fileInput = document.getElementById('file-input');
        if (!fileInput || fileInput.files.length === 0) {
            alert('Please select an image first.');
            return;
        }

        const file = fileInput.files[0];
        const imageUrl = URL.createObjectURL(file);
        this.currentImage = imageUrl;
        this.currentImageId = file.name || `image-${Date.now()}`;
        this.currentTexturePreset = null;

        Object.keys(this.texturePresets).forEach((key) => {
            const button = document.getElementById(`preset-${key}`);
            if (button) {
                button.classList.remove('is-active', 'btn-primary');
                button.classList.add('btn-secondary');
            }
        });

        const inputImage = document.getElementById('input-image');
        if (inputImage) {
            inputImage.src = imageUrl;
        }

        await this.experimentRunner.registerImage({
            imageId: this.currentImageId,
            source: imageUrl
        });
        try {
            const cleanedTexture = this.experimentRunner.getMaterialTexture(this.currentImageId);
            await this.renderer.loadTexture(cleanedTexture?.source || imageUrl);
        } catch (error) {
            console.warn('Could not load uploaded image as texture:', error);
        }

        this.applyMaterialProfile(this.experimentRunner.getMaterialProfile(this.currentImageId));

        const heuristicParameters = this.experimentRunner.createInitialParameters({
            image_id: this.currentImageId,
            init_type: 'heuristic',
            seed: 1
        });

        this.parameters = {
            ...this.parameters,
            albedo: [...heuristicParameters.albedo],
            roughness: heuristicParameters.roughness,
            metallic: heuristicParameters.metallic,
            anisotropy: heuristicParameters.anisotropy ?? 0
        };

        this.syncSlidersToParameters();
        this.updateParameterDisplay();
        this.updatePreview();
        this.updateDebugPanel();
        this.showMessage(`Image registered as ${this.currentImageId}`);
    }

    applyMaterialProfile(profile = createFallbackMaterialProfile()) {
        this.currentMaterialProfile = {
            ...createFallbackMaterialProfile(),
            ...profile
        };

        if (this.renderer) {
            this.renderer.setMaterialProfile(this.currentMaterialProfile);
            if (this.currentMaterialProfile.anisotropyBias != null) {
                this.parameters.anisotropy = Math.max(this.parameters.anisotropy ?? 0, this.currentMaterialProfile.anisotropyBias);
            }
            this.renderer.updateMaterial(this.parameters);
        }

        this.updateMaterialProfileDisplay();
    }

    setMaterialMode(mode = 'standard') {
        this.parameters.materialMode = mode === 'glass' ? 'glass' : 'standard';
        this.renderer.setMaterialMode(this.parameters.materialMode);

        const glassControls = document.getElementById('glass-controls');
        if (glassControls) {
            glassControls.classList.toggle('is-hidden', this.parameters.materialMode !== 'glass');
        }

        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.classList.toggle('is-glass-mode', this.parameters.materialMode === 'glass');
        }

        ['standard', 'glass'].forEach((materialMode) => {
            const button = document.getElementById(`material-mode-${materialMode}`);
            if (!button) {
                return;
            }

            const active = materialMode === this.parameters.materialMode;
            button.classList.toggle('is-active', active);
            button.classList.toggle('btn-primary', active);
            button.classList.toggle('btn-secondary', !active);
        });

        this.updatePreview();
        this.updateDebugPanel();
    }

    async applyTexturePreset(presetKey) {
        const preset = this.texturePresets[presetKey];
        if (!preset) {
            return;
        }

        this.currentTexturePreset = presetKey;
        this.parameters = {
            ...this.parameters,
            albedo: [...preset.parameters.albedo],
            roughness: preset.parameters.roughness,
            metallic: preset.parameters.metallic,
            anisotropy: preset.parameters.anisotropy ?? 0
        };

        const textureCanvas = preset.createCanvas();
        await this.renderer.loadTexture(textureCanvas);
        this.syncSlidersToParameters();
        this.updateParameterDisplay();

        Object.keys(this.texturePresets).forEach((key) => {
            const button = document.getElementById(`preset-${key}`);
            if (!button) {
                return;
            }

            const active = key === presetKey;
            button.classList.toggle('btn-primary', active);
            button.classList.toggle('btn-secondary', !active);
            button.classList.toggle('is-active', active);
        });

        this.updatePreview();
    }

    updateMaterialProfileDisplay() {
        const labelElement = document.getElementById('material-profile-label');
        const descriptionElement = document.getElementById('material-profile-description');

        if (labelElement) {
            labelElement.textContent = this.currentMaterialProfile?.label || 'Matte / Stone';
        }

        if (descriptionElement) {
            const confidenceText = this.currentMaterialProfile?.confidence != null
                ? ` Confidence ${Math.round(this.currentMaterialProfile.confidence * 100)}%.`
                : '';
            descriptionElement.textContent = `${this.currentMaterialProfile?.description || createFallbackMaterialProfile().description}${confidenceText}`;
        }
    }

    updateDebugPanel() {
        const stats = this.currentMaterialProfile?.stats || {};
        const dominantColor = this.currentMaterialProfile?.dominantColor || [stats.avgR ?? 0.5, stats.avgG ?? 0.5, stats.avgB ?? 0.5];
        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        };

        setText(
            'debug-dominant-color',
            `rgb(${Math.round((dominantColor[0] ?? 0.5) * 255)}, ${Math.round((dominantColor[1] ?? 0.5) * 255)}, ${Math.round((dominantColor[2] ?? 0.5) * 255)})`
        );
        setText('debug-saturation', (stats.saturation ?? 0).toFixed(3));
        setText('debug-metal-probability', (stats.metalProbability ?? 0).toFixed(3));
        setText('debug-anisotropy-score', (stats.anisotropyScore ?? 0).toFixed(3));
        setText(
            'debug-final-params',
            `albedo=[${this.parameters.albedo.map((value) => value.toFixed(3)).join(', ')}], metallic=${this.parameters.metallic.toFixed(3)}, roughness=${this.parameters.roughness.toFixed(3)}, anisotropy=${(this.parameters.anisotropy ?? 0).toFixed(3)}`
        );
    }

    syncSlidersToParameters() {
        const sliderMap = {
            'albedo-r': Math.round(this.parameters.albedo[0] * 100),
            'albedo-g': Math.round(this.parameters.albedo[1] * 100),
            'albedo-b': Math.round(this.parameters.albedo[2] * 100),
            roughness: Math.round(this.parameters.roughness * 100),
            metallic: Math.round(this.parameters.metallic * 100),
            anisotropy: Math.round((this.parameters.anisotropy ?? 0) * 100),
            'light-intensity': (this.parameters.lightIntensity || 1.0).toFixed(1),
            opacity: (this.parameters.opacity ?? 1.0).toFixed(2),
            ior: (this.parameters.ior ?? 1.5).toFixed(2)
        };

        Object.entries(sliderMap).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });
    }

    updateParameterDisplay() {
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        };

        updateElement('albedo-r-val', this.parameters.albedo[0].toFixed(2));
        updateElement('albedo-g-val', this.parameters.albedo[1].toFixed(2));
        updateElement('albedo-b-val', this.parameters.albedo[2].toFixed(2));
        updateElement('roughness-val', this.parameters.roughness.toFixed(2));
        updateElement('metallic-val', this.parameters.metallic.toFixed(2));
        updateElement('anisotropy-val', (this.parameters.anisotropy ?? 0).toFixed(2));
        updateElement('light-intensity-val', (this.parameters.lightIntensity || 1.0).toFixed(2));
        updateElement('opacity-val', (this.parameters.opacity ?? 1.0).toFixed(2));
        updateElement('ior-val', (this.parameters.ior ?? 1.5).toFixed(2));

        const previewElement = document.getElementById('albedo-preview');
        if (previewElement) {
            const [r, g, b] = this.parameters.albedo;
            previewElement.style.backgroundColor = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        }
    }

    updatePreview() {
        if (!this.renderer) {
            return;
        }

        this.renderer.updateMaterial(this.parameters);
        this.renderer.renderFrame();
        this.syncRenderedImagePreview();
        this.updateDebugPanel();
    }

    toggleMultiview() {
        this.multiviewVisible = !this.multiviewVisible;

        const panel = document.getElementById('multiview-panel');
        if (panel) {
            panel.classList.toggle('is-hidden', !this.multiviewVisible);
        }

        const button = document.getElementById('toggle-multiview');
        if (button) {
            button.textContent = this.multiviewVisible ? 'Hide Multiview' : 'Multiview';
            button.classList.toggle('is-active', this.multiviewVisible);
            button.classList.toggle('btn-primary', this.multiviewVisible);
            button.classList.toggle('btn-secondary', !this.multiviewVisible);
        }

        this.renderer.setMultiviewEnabled(this.multiviewVisible);
        if (this.multiviewVisible) {
            this.renderer.renderFrame();
        }
    }

    setGeometryMode(mode) {
        this.renderer.setGeometryMode(mode);

        const modeLabel = document.getElementById('geometry-mode-label');
        if (modeLabel) {
            modeLabel.textContent = mode === 'compare'
                ? 'Compare Mode (Sphere vs Flat Plane)'
                : mode === 'cube'
                    ? 'Flat Plane'
                    : 'Sphere';
        }

        ['sphere', 'cube', 'compare'].forEach((geometryMode) => {
            const button = document.getElementById(`geometry-${geometryMode}`);
            if (!button) {
                return;
            }

            button.classList.toggle('is-active', geometryMode === mode);
            button.classList.toggle('btn-primary', geometryMode === mode);
            button.classList.toggle('btn-secondary', geometryMode !== mode);
        });

        this.updateSpecularMetricsDisplay(this.renderer.computeSpecularMetrics());
        this.syncRenderedImagePreview();
    }

    updateSpecularMetricsDisplay(metrics = {}) {
        const geometries = ['sphere', 'cube'];
        const currentMode = this.renderer?.currentGeometryMode || 'sphere';

        geometries.forEach((geometry) => {
            const card = document.getElementById(`specular-card-${geometry}`);
            if (card) {
                const shouldShow = currentMode === 'compare' || currentMode === geometry;
                card.classList.toggle('is-hidden', !shouldShow);
            }

            const geometryMetrics = metrics[geometry];
            if (!geometryMetrics) {
                return;
            }

            const intensityElement = document.getElementById(`specular-${geometry}-intensity`);
            const ndhElement = document.getElementById(`specular-${geometry}-ndh`);
            const shininessElement = document.getElementById(`specular-${geometry}-shininess`);

            if (intensityElement) {
                intensityElement.textContent = geometryMetrics.specularIntensity.toFixed(6);
            }
            if (ndhElement) {
                ndhElement.textContent = geometryMetrics.ndhPeak.toFixed(6);
            }
            if (shininessElement) {
                shininessElement.textContent = geometryMetrics.shininess.toFixed(2);
            }
        });
    }

    syncRenderedImagePreview() {
        const renderedImage = document.getElementById('rendered-image');
        if (!renderedImage || !this.renderer || !this.renderer.canvas) {
            return;
        }

        renderedImage.src = this.renderer.canvas.toDataURL('image/png');
        const sphereImage = document.getElementById('rendered-sphere-image');
        const planeImage = document.getElementById('rendered-plane-image');
        const previousMode = this.renderer.currentGeometryMode;

        this.renderer.setGeometryMode('sphere');
        this.renderer.renderFrame();
        if (sphereImage) {
            sphereImage.src = this.renderer.canvas.toDataURL('image/png');
        }

        this.renderer.setGeometryMode('cube');
        this.renderer.renderFrame();
        if (planeImage) {
            planeImage.src = this.renderer.canvas.toDataURL('image/png');
        }

        this.renderer.setGeometryMode(previousMode);
        this.renderer.renderFrame();
    }

    buildExperimentConfig(initType = 'heuristic') {
        return {
            image_id: this.currentImageId,
            init_type: initType,
            max_iterations: 40,
            learning_rate: 0.05,
            epsilon: 0.01,
            clamp_enabled: true,
            optimize_albedo: true,
            seed: 7
        };
    }

    async startOptimization() {
        if (this.isOptimizing) {
            return;
        }

        if (!this.currentImageId) {
            alert('Please upload an image first.');
            return;
        }

        this.isOptimizing = true;
        this.currentAblationResult = null;
        this.updateAblationPanel(null);
        this.toggleOptimizationUi(true);
        const startedAt = performance.now();

        try {
            const config = this.buildExperimentConfig('heuristic');
            const result = await this.experimentRunner.runExperiment(config, {
                onIteration: (logEntry) => {
                    if (!this.isOptimizing) {
                        return;
                    }

                    this.parameters = {
                        ...this.parameters,
                        albedo: [...logEntry.parameters.albedo],
                        roughness: logEntry.parameters.roughness,
                        metallic: logEntry.parameters.metallic,
                        anisotropy: logEntry.parameters.anisotropy ?? 0
                    };
                    this.lossHistory.push(logEntry.loss);
                    this.gradientHistory.push(logEntry.gradient_norm);
                    this.updateParameterDisplay();
                    this.updatePreview();
                    this.updateConvergenceCharts(this.experimentRunner.logger.getLogs());
                    this.updateProgressBar(logEntry.iteration, config.max_iterations, logEntry.loss);
                    this.updateOptimizationStatus(
                        logEntry.iteration,
                        config.max_iterations,
                        logEntry.loss,
                        (performance.now() - startedAt) / 1000
                    );
                    this.updateDebugPanel();
                },
                shouldContinue: () => this.isOptimizing
            });

            this.currentExperimentResult = result;
            this.parameters = {
                ...this.parameters,
                albedo: [...result.final_parameters.albedo],
                roughness: result.final_parameters.roughness,
                metallic: result.final_parameters.metallic,
                anisotropy: result.final_parameters.anisotropy ?? 0
            };
            this.lossHistory = result.convergence_curve.loss_vs_iteration;
            this.gradientHistory = result.convergence_curve.gradient_norm_vs_iteration;
            this.updateConvergenceCharts(result.logs);
            this.updateMetricsDisplay(result.metrics);
            this.updateSummaryMetricsPanel(result.metrics);
            this.syncSlidersToParameters();
            this.syncRenderedImagePreview();
            this.updateDebugPanel();

            await this.runAblationAndDisplay(this.currentImageId, this.buildExperimentConfig('heuristic'));
            this.showMessage(`Experiment complete. Final loss: ${result.metrics.final_loss.toFixed(6)}`);
        } catch (error) {
            console.error(error);
            alert(`Optimization failed: ${error.message}`);
        } finally {
            this.isOptimizing = false;
            this.toggleOptimizationUi(false);
        }
    }

    stopOptimization() {
        this.isOptimizing = false;
        this.toggleOptimizationUi(false);
    }

    toggleOptimizationUi(isRunning) {
        const startBtn = document.getElementById('start-optimize');
        const stopBtn = document.getElementById('stop-optimize');
        const progressSection = document.getElementById('progress-section');
        const spinner = document.getElementById('loading-spinner');

        if (startBtn) {
            startBtn.disabled = isRunning;
        }
        if (stopBtn) {
            stopBtn.disabled = !isRunning;
        }
        if (progressSection) {
            progressSection.style.display = isRunning ? 'block' : 'none';
        }
        if (spinner) {
            spinner.style.display = isRunning ? 'block' : 'none';
        }
    }

    resetParameters() {
        this.parameters = {
            albedo: [0.5, 0.5, 0.5],
            roughness: 0.5,
            metallic: 0.0,
            anisotropy: 0.0,
            lightIntensity: 1.0,
            opacity: 1.0,
            ior: 1.5,
            materialMode: 'standard'
        };
        this.currentTexturePreset = null;
        this.applyMaterialProfile(
            this.currentImageId ? this.experimentRunner.getMaterialProfile(this.currentImageId) : createFallbackMaterialProfile()
        );
        this.lossHistory = [];
        this.gradientHistory = [];
        this.currentExperimentResult = null;
        this.currentAblationResult = null;
        this.currentBatchResult = null;
        this.syncSlidersToParameters();
        this.updateParameterDisplay();
        this.setMaterialMode(this.parameters.materialMode);
        Object.keys(this.texturePresets).forEach((key) => {
            const button = document.getElementById(`preset-${key}`);
            if (button) {
                button.classList.remove('is-active', 'btn-primary');
                button.classList.add('btn-secondary');
            }
        });
        this.updatePreview();
        this.updateConvergenceCharts([]);
        this.updateMetricsDisplay();
        this.updateSummaryMetricsPanel(null);
        this.updateAblationPanel(null);
        this.updateOptimizationStatus(0, 0, null, 0);
        this.updateDebugPanel();
    }

    updateProgressBar(current, total, loss) {
        const fillElement = document.getElementById('progress-fill');
        const textElement = document.getElementById('progress-text');
        const percentage = total > 0 ? (current / total) * 100 : 0;

        if (fillElement) {
            fillElement.style.width = `${percentage}%`;
        }
        if (textElement) {
            textElement.textContent = `Iteration ${current}/${total} | Loss: ${loss.toFixed(6)}`;
        }
    }

    updateConvergenceCharts(logs = this.currentExperimentResult?.logs || []) {
        const heuristicLogs = Array.isArray(logs) ? logs : [];
        const randomLogs = this.currentAblationResult?.runs?.random?.logs || [];
        const labels = this.getConvergenceGraphData().iterations;
        const heuristicLosses = heuristicLogs.map((entry) => entry.loss);
        const randomLosses = randomLogs.map((entry) => entry.loss);
        const gradientNorms = heuristicLogs.map((entry) => entry.gradient_norm);
        const metallicHistory = heuristicLogs.map((entry) => entry.parameters.metallic);

        if (this.charts.loss) {
            this.charts.loss.data.labels = labels;
            this.charts.loss.data.datasets[0].data = heuristicLosses;
            this.charts.loss.data.datasets[1].data = randomLosses;
            this.charts.loss.update('none');
        }

        if (this.charts.roughness) {
            this.charts.roughness.data.labels = labels;
            this.charts.roughness.data.datasets[0].data = gradientNorms;
            this.charts.roughness.update('none');
        }

        if (this.charts.metallic) {
            this.charts.metallic.data.labels = labels;
            this.charts.metallic.data.datasets[0].data = metallicHistory;
            this.charts.metallic.update('none');
        }
    }

    updateOptimizationStatus(currentIteration, maxIterations, currentLoss, elapsedTimeSeconds) {
        const iterationElement = document.getElementById('status-iteration');
        const lossElement = document.getElementById('status-loss');
        const timeElement = document.getElementById('status-time');

        if (iterationElement) iterationElement.textContent = `${currentIteration} / ${maxIterations}`;
        if (lossElement) lossElement.textContent = currentLoss == null ? '--' : currentLoss.toFixed(6);
        if (timeElement) timeElement.textContent = `${elapsedTimeSeconds.toFixed(2)} s`;
    }

    updateMetricsDisplay(metrics = this.currentExperimentResult?.metrics || null) {
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        };

        if (!metrics) {
            updateElement('metric-psnr', '--');
            updateElement('metric-ssim', '--');
            updateElement('metric-loss', '--');
            return;
        }

        updateElement('metric-psnr', metrics.rmse == null ? '--' : metrics.rmse.toFixed(4));
        updateElement('metric-ssim', metrics.ssim == null ? '--' : metrics.ssim.toFixed(4));
        updateElement('metric-loss', metrics.final_loss.toFixed(6));
    }

    updateSummaryMetricsPanel(metrics = this.currentExperimentResult?.metrics || null) {
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        };

        if (!metrics) {
            updateElement('summary-converged', '--');
            updateElement('summary-loss-drop', '--');
            updateElement('summary-runtime', '--');
            updateElement('summary-avg-iter', '--');
            return;
        }

        updateElement('summary-converged', metrics.convergence_iteration == null ? 'No convergence' : `${metrics.convergence_iteration}`);
        updateElement('summary-loss-drop', `${metrics.loss_drop_percentage.toFixed(2)}%`);
        updateElement('summary-runtime', `${metrics.total_runtime_ms.toFixed(2)} ms`);
        updateElement('summary-avg-iter', `${metrics.avg_runtime_per_iteration.toFixed(2)} ms`);
    }

    updateAblationPanel(ablationResult = this.currentAblationResult) {
        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        };

        if (!ablationResult) {
            [
                'heuristic-final-loss', 'heuristic-iterations', 'heuristic-runtime',
                'random-final-loss', 'random-iterations', 'random-runtime',
                'ablation-loss-improvement', 'ablation-iteration-reduction', 'ablation-speedup'
            ].forEach((id) => setText(id, '--'));
            return;
        }

        const heuristic = ablationResult.heuristic;
        const random = ablationResult.random;
        const comparison = ablationResult.comparison;
        const lossImprovementPercentage = comparison.loss_improvement_ratio * 100;
        const iterationReductionPercentage = random.total_iterations > 0
            ? ((random.total_iterations - heuristic.total_iterations) / random.total_iterations) * 100
            : 0;
        const speedupPercentage = (comparison.runtime_speedup - 1) * 100;

        setText('heuristic-final-loss', heuristic.final_loss.toFixed(6));
        setText('heuristic-iterations', `${heuristic.total_iterations}`);
        setText('heuristic-runtime', `${heuristic.total_runtime_ms.toFixed(2)} ms`);
        setText('random-final-loss', random.final_loss.toFixed(6));
        setText('random-iterations', `${random.total_iterations}`);
        setText('random-runtime', `${random.total_runtime_ms.toFixed(2)} ms`);
        setText('ablation-loss-improvement', `${lossImprovementPercentage.toFixed(2)}%`);
        setText('ablation-iteration-reduction', `${iterationReductionPercentage.toFixed(2)}%`);
        setText('ablation-speedup', `${speedupPercentage.toFixed(2)}%`);
    }

    getConvergenceGraphData() {
        const heuristicCurve = this.currentAblationResult?.runs?.heuristic?.convergence_curve?.loss_vs_iteration || this.currentExperimentResult?.convergence_curve?.loss_vs_iteration || [];
        const randomCurve = this.currentAblationResult?.runs?.random?.convergence_curve?.loss_vs_iteration || [];
        const maxLength = Math.max(heuristicCurve.length, randomCurve.length);
        return {
            iterations: Array.from({ length: maxLength }, (_, index) => index + 1),
            heuristic: heuristicCurve,
            random: randomCurve
        };
    }

    async runAblationAndDisplay(imageId = this.currentImageId, config = this.buildExperimentConfig('heuristic')) {
        if (!imageId) {
            throw new Error('Image is required for ablation');
        }

        const ablationResult = await this.experimentRunner.runAblation(imageId, config);
        this.currentAblationResult = ablationResult;
        this.updateAblationPanel(ablationResult);
        this.updateConvergenceCharts(this.currentExperimentResult?.logs || ablationResult.runs.heuristic.logs);
        return ablationResult;
    }

    async runBatchExperiment(imageList, config = this.buildExperimentConfig('heuristic')) {
        const batchResult = await this.experimentRunner.runBatchExperiment(imageList, config);
        this.currentBatchResult = batchResult;
        return batchResult;
    }

    exportExperimentResults(format = 'json') {
        if (!this.currentExperimentResult) {
            alert('Run an experiment before exporting results.');
            return;
        }

        const content = this.experimentRunner.exportExperimentResults(this.currentExperimentResult, format);
        const filename = format === 'csv' ? 'experiment_result.csv' : 'experiment_result.json';

        this.experimentRunner.exporter.downloadTextFile(
            content,
            filename,
            format === 'csv' ? 'text/csv' : 'application/json'
        );
        this.showMessage(`Exported ${format.toUpperCase()} results.`);
        return content;
    }

    exportBatchCsv() {
        if (!this.currentExperimentResult) {
            alert('Run an experiment before exporting CSV.');
            return;
        }

        this.exportExperimentResults('csv');
    }

    exportRender() {
        if (!this.renderer || !this.renderer.canvas) {
            return;
        }

        this.renderer.canvas.toBlob((blob) => {
            if (!blob) {
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `brdf_render_${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(url);
        });
    }

    createFigureCanvas(width = 1400, height = 900) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    drawFigureHeader(ctx, title, subtitle, width, height) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#0f172a';
        ctx.font = '700 34px Segoe UI';
        ctx.fillText(title, 52, 64);
        ctx.fillStyle = '#475569';
        ctx.font = '18px Segoe UI';
        ctx.fillText(subtitle, 52, 98);
    }

    drawImagePanel(ctx, imageSource, x, y, width, height, label) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = '#0f172a';
        ctx.font = '600 20px Segoe UI';
        ctx.fillText(label, x, y - 14);

        const canDraw = imageSource
            && ((imageSource instanceof HTMLCanvasElement)
                || (imageSource instanceof HTMLImageElement && imageSource.complete && imageSource.naturalWidth > 0));

        if (canDraw) {
            ctx.drawImage(imageSource, x + 12, y + 12, width - 24, height - 24);
        }
    }

    downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        link.click();
    }

    exportComparisonFigure() {
        const canvas = this.createFigureCanvas(1400, 760);
        const ctx = canvas.getContext('2d');
        this.drawFigureHeader(ctx, 'Input vs Estimated Render', 'Qualitative comparison for single-image BRDF estimation', canvas.width, canvas.height);
        this.drawImagePanel(ctx, document.getElementById('input-image'), 52, 150, 620, 480, 'Input Image');
        this.drawImagePanel(ctx, document.getElementById('rendered-image'), 728, 150, 620, 480, 'Estimated Render');
        this.downloadCanvas(canvas, `comparison_figure_${Date.now()}.png`);
    }

    exportConvergenceChart() {
        const canvas = this.createFigureCanvas(1500, 980);
        const ctx = canvas.getContext('2d');
        this.drawFigureHeader(ctx, 'Optimization Convergence', 'Loss, gradient norm, and metallic trajectories across iterations', canvas.width, canvas.height);

        [
            { id: 'loss-chart', label: 'Loss' },
            { id: 'roughness-chart', label: 'Gradient Norm' },
            { id: 'metallic-chart', label: 'Metallic' }
        ].forEach((chart, index) => {
            this.drawImagePanel(ctx, document.getElementById(chart.id), 52, 150 + index * 250, 1396, 200, chart.label);
        });

        this.downloadCanvas(canvas, `convergence_chart_${Date.now()}.png`);
    }

    exportViewerScreenshot() {
        const canvas = this.createFigureCanvas(1200, 900);
        const ctx = canvas.getContext('2d');
        this.drawFigureHeader(ctx, '3D BRDF Viewer', `Proxy geometry: ${this.renderer.currentGeometryMode}`, canvas.width, canvas.height);
        this.drawImagePanel(ctx, this.renderer.canvas, 80, 150, 1040, 680, 'Viewer Screenshot');
        this.downloadCanvas(canvas, `viewer_screenshot_${Date.now()}.png`);
    }

    exportPipelineDiagram() {
        const canvas = this.createFigureCanvas(980, 1280);
        const ctx = canvas.getContext('2d');
        const steps = [
            'Input Image Registration',
            'Deterministic Initialization',
            'Cook-Torrance BRDF Model',
            'Finite-Difference Optimization',
            'Structured Iteration Logging',
            'Metrics and Failure Analysis',
            'JSON / CSV Export'
        ];

        this.drawFigureHeader(ctx, 'Research Experiment Pipeline', 'Reproducible single-image BRDF estimation without machine learning', canvas.width, canvas.height);

        steps.forEach((step, index) => {
            const x = 130;
            const y = 150 + index * 145;
            ctx.fillStyle = '#eff6ff';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.fillRect(x, y, 720, 88);
            ctx.strokeRect(x, y, 720, 88);
            ctx.fillStyle = '#0f172a';
            ctx.font = '600 28px Segoe UI';
            ctx.fillText(step, x + 28, y + 52);

            if (index < steps.length - 1) {
                ctx.strokeStyle = '#b91c1c';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(x + 360, y + 88);
                ctx.lineTo(x + 360, y + 120);
                ctx.stroke();
            }
        });

        this.downloadCanvas(canvas, `pipeline_diagram_${Date.now()}.png`);
    }

    showMessage(message) {
        console.log(message);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new BRDFApp();
});
