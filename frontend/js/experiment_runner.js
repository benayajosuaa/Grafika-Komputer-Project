import { ExperimentLogger } from './experiment_logger.js';
import { ExperimentExporter } from './exporter.js';
import { aggregateBatchMetrics, analyzeConvergence, clamp01, computeFinalMetrics, detectConvergence, sanitizeParameters } from './metrics.js';
import { FiniteDifferenceOptimizer } from './optimizer.js';
import { SeededRNG, createSeededRandom } from './research_rng.js';

function cloneParameters(parameters) {
    return {
        albedo: [...parameters.albedo],
        roughness: parameters.roughness,
        metallic: parameters.metallic
    };
}

function readImagePixels(imageData) {
    const pixels = [];
    for (let index = 0; index < imageData.data.length; index += 4) {
        pixels.push(
            imageData.data[index] / 255,
            imageData.data[index + 1] / 255,
            imageData.data[index + 2] / 255
        );
    }
    return pixels;
}

function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

export class ExperimentRunner {
    constructor({ renderer, imageSize = 64 }) {
        this.renderer = renderer;
        this.imageSize = imageSize;
        this.logger = new ExperimentLogger();
        this.optimizer = new FiniteDifferenceOptimizer({
            renderer: this.renderer,
            logger: this.logger
        });
        this.exporter = new ExperimentExporter();
        this.imageRegistry = new Map();
        this.lastResult = null;
        this.experimentLog = this.logger.experimentLog;
    }

    getDefaultConfig(overrides = {}) {
        return {
            image_id: '',
            init_type: 'heuristic',
            max_iterations: 40,
            learning_rate: 0.05,
            epsilon: 0.01,
            clamp_enabled: true,
            seed: 1,
            ...overrides
        };
    }

    async registerImage({ imageId, source, referenceSource = null }) {
        const target = await this.prepareImage(source);
        const reference = referenceSource ? await this.prepareImage(referenceSource) : null;

        this.imageRegistry.set(imageId, {
            id: imageId,
            target,
            reference
        });

        return this.imageRegistry.get(imageId);
    }

    getImageRecord(imageId) {
        const record = this.imageRegistry.get(imageId);
        if (!record) {
            throw new Error(`Image "${imageId}" is not registered`);
        }
        return record;
    }

    async prepareImage(source) {
        const canvas = createCanvas(this.imageSize, this.imageSize);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const image = await this.resolveImageSource(source);
        context.drawImage(image, 0, 0, this.imageSize, this.imageSize);
        const imageData = context.getImageData(0, 0, this.imageSize, this.imageSize);

        return {
            width: this.imageSize,
            height: this.imageSize,
            imageData,
            pixels: readImagePixels(imageData)
        };
    }

    resolveImageSource(source) {
        if (source instanceof HTMLImageElement) {
            if (source.complete && source.naturalWidth > 0) {
                return Promise.resolve(source);
            }

            return new Promise((resolve, reject) => {
                source.onload = () => resolve(source);
                source.onerror = () => reject(new Error('Failed to load image element'));
            });
        }

        if (typeof source === 'string') {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('Failed to load image source'));
                image.src = source;
            });
        }

        throw new Error('Unsupported image source type');
    }

    computeHeuristicInitialization(imageRecord) {
        const pixels = imageRecord.target.imageData.data;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumL = 0;
        let sumL2 = 0;
        let highlightCount = 0;
        const pixelCount = pixels.length / 4;

        for (let index = 0; index < pixels.length; index += 4) {
            const r = pixels[index] / 255;
            const g = pixels[index + 1] / 255;
            const b = pixels[index + 2] / 255;
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            sumR += r;
            sumG += g;
            sumB += b;
            sumL += luminance;
            sumL2 += luminance * luminance;

            if (luminance > 0.8) {
                highlightCount += 1;
            }
        }

        const avgR = sumR / pixelCount;
        const avgG = sumG / pixelCount;
        const avgB = sumB / pixelCount;
        const avgL = sumL / pixelCount;
        const variance = Math.max(0, sumL2 / pixelCount - avgL * avgL);
        const stdDev = Math.sqrt(variance);
        const maxRGB = Math.max(avgR, avgG, avgB);
        const minRGB = Math.min(avgR, avgG, avgB);
        const saturation = maxRGB === 0 ? 0 : (maxRGB - minRGB) / maxRGB;
        const neutralness = 1 - saturation;
        const highlightRatio = highlightCount / pixelCount;

        return sanitizeParameters({
            albedo: [avgR, avgG, avgB],
            roughness: clamp01(0.3 + stdDev * 0.7 - highlightRatio * 0.25),
            metallic: clamp01(0.08 + neutralness * 0.55 + highlightRatio * 0.7 - saturation * 0.7 - stdDev * 0.5)
        });
    }

    computeRandomInitialization(rng) {
        return {
            albedo: [rng.next(), rng.next(), rng.next()],
            roughness: rng.range(0.05, 0.95),
            metallic: rng.range(0, 1)
        };
    }

    computeConstantInitialization() {
        return {
            albedo: [0.5, 0.5, 0.5],
            roughness: 0.5,
            metallic: 0.0
        };
    }

    createInitialParameters(config) {
        const imageRecord = this.getImageRecord(config.image_id);
        const rng = new SeededRNG(config.seed);

        switch (config.init_type) {
            case 'random':
                return this.computeRandomInitialization(rng);
            case 'constant':
                return this.computeConstantInitialization();
            case 'heuristic':
            default:
                return this.computeHeuristicInitialization(imageRecord);
        }
    }

    applyNoise(imageRecord, level = 0.05, seed = 1) {
        const rng = new SeededRNG(seed);
        const noisyPixels = imageRecord.target.pixels.map((value) => clamp01(value + rng.range(-level, level)));

        return {
            ...imageRecord.target,
            pixels: noisyPixels
        };
    }

    applyLightingVariation(imageRecord, type = 'warm') {
        const multipliers = {
            warm: [1.08, 1.0, 0.92],
            cool: [0.92, 1.0, 1.08],
            dim: [0.82, 0.82, 0.82],
            bright: [1.15, 1.15, 1.15]
        };
        const multiplier = multipliers[type] || [1, 1, 1];

        return {
            ...imageRecord.target,
            pixels: imageRecord.target.pixels.map((value, index) => clamp01(value * multiplier[index % 3]))
        };
    }

    buildExperimentPayload(config, optimizerResult, record, metadata = {}) {
        const metrics = computeFinalMetrics({
            logs: optimizerResult.logs,
            totalTimeMs: optimizerResult.total_time_ms,
            initialLoss: optimizerResult.initial_loss,
            finalParameters: optimizerResult.final_parameters,
            finalEvaluationMetrics: optimizerResult.final_evaluation_metrics
        });

        const convergence = analyzeConvergence(optimizerResult.logs);
        const convergenceDetection = detectConvergence(optimizerResult.logs, 1e-4, 5);
        const result = {
            config: { ...config },
            experiment_config: { ...config },
            metrics,
            logs: optimizerResult.logs,
            final_parameters: cloneParameters(optimizerResult.final_parameters),
            convergence_curve: {
                loss_vs_iteration: convergence.loss_curve,
                gradient_norm_vs_iteration: convergence.gradient_magnitude_curve
            },
            analysis: convergence,
            convergence_detection: convergenceDetection,
            metadata,
            profile: {
                total_render_calls: 1 + optimizerResult.logs.length * 6,
                total_time: optimizerResult.total_time_ms,
                avg_time_per_iteration: metrics.avg_iteration_time
            },
            status: metrics.status
        };

        if (record.reference) {
            result.reference_available = true;
        }

        this.lastResult = result;
        this.experimentLog = this.logger.getLogs();
        return result;
    }

    async runSingleExperiment(configOverrides, options = {}) {
        const config = this.getDefaultConfig(configOverrides);
        const record = this.getImageRecord(config.image_id);
        const initialParameters = options.initialParameters || this.createInitialParameters(config);
        const targetImage = options.targetImage || record.target;
        const evaluationOptions = {
            width: targetImage.width,
            height: targetImage.height,
            lightingType: options.lightingType || 'default',
            referencePixels: record.reference ? record.reference.pixels : null
        };

        const optimizerResult = await this.optimizer.optimize({
            config,
            initialParameters,
            targetImage,
            evaluationOptions,
            onIteration: options.onIteration || null,
            shouldContinue: options.shouldContinue || null
        });

        return this.buildExperimentPayload(config, optimizerResult, record, {
            robustness_condition: options.robustnessCondition || 'clean'
        });
    }

    async runExperiment(configOverrides, options = {}) {
        return this.runSingleExperiment(configOverrides, options);
    }

    async runAblation(imageId, configOverrides = {}) {
        const sharedConfig = this.getDefaultConfig({
            ...configOverrides,
            image_id: imageId
        });

        const heuristic = await this.runSingleExperiment({
            ...sharedConfig,
            init_type: 'heuristic'
        });

        const random = await this.runSingleExperiment({
            ...sharedConfig,
            init_type: 'random',
            seed: sharedConfig.seed
        });

        return {
            heuristic: heuristic.metrics,
            random: random.metrics,
            comparison: {
                loss_improvement_ratio: random.metrics.final_loss > 0
                    ? (random.metrics.final_loss - heuristic.metrics.final_loss) / random.metrics.final_loss
                    : 0,
                iteration_reduction: random.metrics.total_iterations - heuristic.metrics.total_iterations,
                runtime_speedup: heuristic.metrics.total_runtime_ms > 0
                    ? random.metrics.total_time_ms / heuristic.metrics.total_time_ms
                    : 0,
                speedup_ratio: heuristic.metrics.total_runtime_ms > 0
                    ? random.metrics.total_time_ms / heuristic.metrics.total_time_ms
                    : 0,
                iteration_difference: heuristic.metrics.total_iterations - random.metrics.total_iterations
            },
            runs: {
                heuristic,
                random
            }
        };
    }

    async runBaselineComparison(imageId, configOverrides = {}) {
        const sharedConfig = this.getDefaultConfig({
            ...configOverrides,
            image_id: imageId
        });
        const methods = ['heuristic', 'random', 'constant'];
        const results = {};

        for (const method of methods) {
            results[method] = await this.runSingleExperiment({
                ...sharedConfig,
                init_type: method,
                seed: sharedConfig.seed
            });
        }

        return results;
    }

    async runBatch(imageList, configOverrides = {}) {
        const results = [];

        for (const imageId of imageList) {
            const result = await this.runSingleExperiment({
                ...configOverrides,
                image_id: imageId
            });
            results.push(result);
        }

        return {
            results,
            ...aggregateBatchMetrics(results)
        };
    }

    async runBatchExperiment(imageList, configOverrides = {}) {
        return this.runBatch(imageList, configOverrides);
    }

    async runRobustnessSuite(imageId, configOverrides = {}) {
        const record = this.getImageRecord(imageId);
        const clean = await this.runSingleExperiment({
            ...configOverrides,
            image_id: imageId
        }, {
            robustnessCondition: 'clean'
        });

        const noisyTarget = this.applyNoise(record, configOverrides.noise_level || 0.05, configOverrides.seed || 1);
        const noisy = await this.runSingleExperiment({
            ...configOverrides,
            image_id: imageId
        }, {
            targetImage: noisyTarget,
            robustnessCondition: 'noisy'
        });

        const alteredTarget = this.applyLightingVariation(record, configOverrides.lighting_type || 'warm');
        const alteredLighting = await this.runSingleExperiment({
            ...configOverrides,
            image_id: imageId
        }, {
            targetImage: alteredTarget,
            lightingType: configOverrides.lighting_type || 'warm',
            robustnessCondition: 'altered_lighting'
        });

        return {
            clean,
            noisy,
            altered_lighting: alteredLighting,
            degradation: {
                noisy_loss_delta: noisy.metrics.final_loss - clean.metrics.final_loss,
                altered_lighting_loss_delta: alteredLighting.metrics.final_loss - clean.metrics.final_loss
            }
        };
    }

    profilePerformance() {
        return this.renderer.profilePerformance();
    }

    exportExperimentResults(result = this.lastResult, format = 'json') {
        if (!result) {
            throw new Error('No experiment results available for export');
        }
        return this.exporter.exportExperimentResults(result, format);
    }

    exportResults(result = this.lastResult) {
        if (!result) {
            throw new Error('No experiment results available for export');
        }

        return {
            json: this.exporter.exportExperimentResults(result, 'json'),
            csv: this.exporter.exportResultsCsv([result])
        };
    }

    createSeededRandom(seed) {
        return createSeededRandom(seed);
    }

    detectConvergence(logs, threshold = 1e-4, window = 5) {
        return detectConvergence(logs, threshold, window);
    }
}
