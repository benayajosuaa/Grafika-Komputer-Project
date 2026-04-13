import { runExampleAblation, runExampleExperiment } from './example_experiments.js?v=20260413b';
import { ExperimentRunner } from './experiment_runner.js?v=20260413b';
import { ThreeJSRenderer } from './renderer.js?v=20260413b';

function createFallbackMaterialProfile() {
    return {
        key: 'matte',
        label: 'Matte / Stone',
        description: 'Proxy geometry akan menyesuaikan mikrostruktur dan highlight supaya lebih mirip material yang terdeteksi.'
    };
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
        this.parameters = {
            albedo: [0.5, 0.5, 0.5],
            roughness: 0.5,
            metallic: 0.0
        };
        this.lossHistory = [];
        this.gradientHistory = [];
        this.metrics = {
            psnr: null,
            ssim: null,
            loss: null
        };
        this.charts = {};

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
        this.updatePreview();
        this.exposeResearchApi();
    }

    initializeRenderer() {
        this.renderer = new ThreeJSRenderer('canvas-container');
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
            albedo: [...heuristicParameters.albedo],
            roughness: heuristicParameters.roughness,
            metallic: heuristicParameters.metallic
        };

        this.syncSlidersToParameters();
        this.updateParameterDisplay();
        this.updatePreview();
        this.showMessage(`Image registered as ${this.currentImageId}`);
    }

    applyMaterialProfile(profile = createFallbackMaterialProfile()) {
        this.currentMaterialProfile = {
            ...createFallbackMaterialProfile(),
            ...profile
        };

        if (this.renderer) {
            this.renderer.setMaterialProfile(this.currentMaterialProfile);
            this.renderer.updateMaterial(this.parameters);
        }

        this.updateMaterialProfileDisplay();
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

    syncSlidersToParameters() {
        const sliderMap = {
            'albedo-r': Math.round(this.parameters.albedo[0] * 100),
            'albedo-g': Math.round(this.parameters.albedo[1] * 100),
            'albedo-b': Math.round(this.parameters.albedo[2] * 100),
            roughness: Math.round(this.parameters.roughness * 100),
            metallic: Math.round(this.parameters.metallic * 100)
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
    }

    setGeometryMode(mode) {
        this.renderer.setGeometryMode(mode);

        const modeLabel = document.getElementById('geometry-mode-label');
        if (modeLabel) {
            modeLabel.textContent = mode === 'cube' ? 'Cube' : 'Sphere';
        }

        ['sphere', 'cube'].forEach((geometryMode) => {
            const button = document.getElementById(`geometry-${geometryMode}`);
            if (!button) {
                return;
            }

            button.classList.toggle('is-active', geometryMode === mode);
            button.classList.toggle('btn-primary', geometryMode === mode);
            button.classList.toggle('btn-secondary', geometryMode !== mode);
        });

        this.syncRenderedImagePreview();
    }

    syncRenderedImagePreview() {
        const renderedImage = document.getElementById('rendered-image');
        if (!renderedImage || !this.renderer || !this.renderer.canvas) {
            return;
        }

        renderedImage.src = this.renderer.canvas.toDataURL('image/png');
    }

    buildExperimentConfig(initType = 'heuristic') {
        return {
            image_id: this.currentImageId,
            init_type: initType,
            max_iterations: 40,
            learning_rate: 0.05,
            epsilon: 0.01,
            clamp_enabled: true,
            optimize_albedo: false,
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
                        albedo: [...logEntry.parameters.albedo],
                        roughness: logEntry.parameters.roughness,
                        metallic: logEntry.parameters.metallic
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
                },
                shouldContinue: () => this.isOptimizing
            });

            this.currentExperimentResult = result;
            this.parameters = {
                albedo: [...result.final_parameters.albedo],
                roughness: result.final_parameters.roughness,
                metallic: result.final_parameters.metallic
            };
            this.lossHistory = result.convergence_curve.loss_vs_iteration;
            this.gradientHistory = result.convergence_curve.gradient_norm_vs_iteration;
            this.updateConvergenceCharts(result.logs);
            this.updateMetricsDisplay(result.metrics);
            this.updateSummaryMetricsPanel(result.metrics);
            this.syncSlidersToParameters();
            this.syncRenderedImagePreview();

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
            metallic: 0.0
        };
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
        this.updatePreview();
        this.updateConvergenceCharts([]);
        this.updateMetricsDisplay();
        this.updateSummaryMetricsPanel(null);
        this.updateAblationPanel(null);
        this.updateOptimizationStatus(0, 0, null, 0);
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
