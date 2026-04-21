import { ExperimentLogger } from './experiment_logger.js?v=20260413b';
import { ExperimentExporter } from './exporter.js?v=20260413b';
import { aggregateBatchMetrics, analyzeConvergence, clamp01, computeFinalMetrics, detectConvergence, sanitizeParameters } from './metrics.js?v=20260421a';
import { FiniteDifferenceOptimizer } from './optimizer.js?v=20260421a';
import { SeededRNG, createSeededRandom } from './research_rng.js?v=20260413b';

function cloneParameters(parameters) {
    return {
        albedo: [...parameters.albedo],
        roughness: parameters.roughness,
        metallic: parameters.metallic,
        anisotropy: parameters.anisotropy ?? 0
    };
}

function srgbToLinear(value) {
    if (value <= 0.04045) {
        return value / 12.92;
    }
    return Math.pow((value + 0.055) / 1.055, 2.4);
}

function readImagePixels(imageData, colorSpace = 'linear') {
    const pixels = [];
    for (let index = 0; index < imageData.data.length; index += 4) {
        const sr = imageData.data[index] / 255;
        const sg = imageData.data[index + 1] / 255;
        const sb = imageData.data[index + 2] / 255;
        const r = colorSpace === 'linear' ? srgbToLinear(sr) : sr;
        const g = colorSpace === 'linear' ? srgbToLinear(sg) : sg;
        const b = colorSpace === 'linear' ? srgbToLinear(sb) : sb;
        pixels.push(
            r,
            g,
            b
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

function luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function computeSobelStreakFeatures(imageData, width, height) {
    if (width < 3 || height < 3) {
        return {
            anisotropyScore: 0,
            horizontalStreakScore: 0,
            directionalStreakDetected: false
        };
    }

    const luminanceValues = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = (y * width + x) * 4;
            const r = imageData.data[index] / 255;
            const g = imageData.data[index + 1] / 255;
            const b = imageData.data[index + 2] / 255;
            luminanceValues[y * width + x] = luminance(r, g, b);
        }
    }

    const bins = new Float32Array(12);
    let sumMagnitude = 0;
    let weightedSin = 0;
    let weightedCos = 0;
    let verticalGradientEnergy = 0;
    let horizontalGradientEnergy = 0;

    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            const i00 = (y - 1) * width + (x - 1);
            const i01 = (y - 1) * width + x;
            const i02 = (y - 1) * width + (x + 1);
            const i10 = y * width + (x - 1);
            const i12 = y * width + (x + 1);
            const i20 = (y + 1) * width + (x - 1);
            const i21 = (y + 1) * width + x;
            const i22 = (y + 1) * width + (x + 1);

            const gx = (luminanceValues[i02] + 2 * luminanceValues[i12] + luminanceValues[i22])
                - (luminanceValues[i00] + 2 * luminanceValues[i10] + luminanceValues[i20]);
            const gy = (luminanceValues[i20] + 2 * luminanceValues[i21] + luminanceValues[i22])
                - (luminanceValues[i00] + 2 * luminanceValues[i01] + luminanceValues[i02]);
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            if (magnitude < 1e-5) {
                continue;
            }

            const angle = Math.atan2(gy, gx);
            const normalized = (angle + Math.PI) / (2 * Math.PI);
            const bin = Math.min(bins.length - 1, Math.floor(normalized * bins.length));
            bins[bin] += magnitude;
            sumMagnitude += magnitude;
            weightedSin += Math.sin(2 * angle) * magnitude;
            weightedCos += Math.cos(2 * angle) * magnitude;
            verticalGradientEnergy += Math.abs(gy);
            horizontalGradientEnergy += Math.abs(gx);
        }
    }

    if (sumMagnitude <= 1e-6) {
        return {
            anisotropyScore: 0,
            horizontalStreakScore: 0,
            directionalStreakDetected: false
        };
    }

    const dominantBin = Math.max(...bins) / sumMagnitude;
    const coherence = Math.sqrt(weightedSin * weightedSin + weightedCos * weightedCos) / sumMagnitude;
    const anisotropyScore = clamp01(0.5 * dominantBin + 0.5 * coherence);
    const horizontalStreakScore = clamp01(verticalGradientEnergy / Math.max(1e-6, verticalGradientEnergy + horizontalGradientEnergy));

    return {
        anisotropyScore,
        horizontalStreakScore,
        directionalStreakDetected: anisotropyScore > 0.34 && horizontalStreakScore > 0.54
    };
}

function coverImageOnCanvas(context, image, width, height) {
    const sourceWidth = image.naturalWidth || image.videoWidth || image.width;
    const sourceHeight = image.naturalHeight || image.videoHeight || image.height;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (width - drawWidth) * 0.5;
    const offsetY = (height - drawHeight) * 0.5;
    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function computePixelStatistics(imageData) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumL = 0;
    let sumL2 = 0;
    const count = imageData.data.length / 4;

    for (let index = 0; index < imageData.data.length; index += 4) {
        const r = imageData.data[index] / 255;
        const g = imageData.data[index + 1] / 255;
        const b = imageData.data[index + 2] / 255;
        const l = luminance(r, g, b);
        sumR += r;
        sumG += g;
        sumB += b;
        sumL += l;
        sumL2 += l * l;
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    const avgL = sumL / count;
    const variance = Math.max(0, sumL2 / count - avgL * avgL);

    return {
        avgR,
        avgG,
        avgB,
        avgL,
        stdL: Math.sqrt(variance)
    };
}

function clampColorChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function buildSeamlessTextureFromImage(image, outputSize = 256) {
    const analysisCanvas = createCanvas(128, 128);
    const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
    coverImageOnCanvas(analysisContext, image, analysisCanvas.width, analysisCanvas.height);
    const sourceImageData = analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
    const sourcePixels = sourceImageData.data;
    const stats = computePixelStatistics(sourceImageData);
    const repairedCanvas = createCanvas(analysisCanvas.width, analysisCanvas.height);
    const repairedContext = repairedCanvas.getContext('2d', { willReadFrequently: true });
    const repairedImageData = repairedContext.createImageData(analysisCanvas.width, analysisCanvas.height);
    const repairedPixels = repairedImageData.data;
    const shadowThreshold = Math.max(0.16, stats.avgL - stats.stdL * 0.9);
    const brightThreshold = Math.min(0.95, stats.avgL + stats.stdL * 1.25 + 0.18);

    for (let index = 0; index < sourcePixels.length; index += 4) {
        const r = sourcePixels[index] / 255;
        const g = sourcePixels[index + 1] / 255;
        const b = sourcePixels[index + 2] / 255;
        const l = luminance(r, g, b);
        const deviation = Math.abs(r - stats.avgR) + Math.abs(g - stats.avgG) + Math.abs(b - stats.avgB);
        const invalid = l < shadowThreshold || l > brightThreshold || deviation > 0.75;
        const safeL = Math.max(l, 0.06);
        const gain = Math.max(0.7, Math.min(1.45, stats.avgL / safeL));

        const nextR = invalid ? stats.avgR * 255 : r * 255 * gain;
        const nextG = invalid ? stats.avgG * 255 : g * 255 * gain;
        const nextB = invalid ? stats.avgB * 255 : b * 255 * gain;

        repairedPixels[index] = clampColorChannel(nextR);
        repairedPixels[index + 1] = clampColorChannel(nextG);
        repairedPixels[index + 2] = clampColorChannel(nextB);
        repairedPixels[index + 3] = 255;
    }

    repairedContext.putImageData(repairedImageData, 0, 0);

    const patchSize = 16;
    const patchCandidates = [];
    const repairedStats = computePixelStatistics(repairedImageData);

    for (let top = 0; top <= repairedCanvas.height - patchSize; top += patchSize) {
        for (let left = 0; left <= repairedCanvas.width - patchSize; left += patchSize) {
            const patch = repairedContext.getImageData(left, top, patchSize, patchSize);
            const patchStats = computePixelStatistics(patch);
            let penalty = 0;

            for (let index = 0; index < patch.data.length; index += 4) {
                const r = patch.data[index] / 255;
                const g = patch.data[index + 1] / 255;
                const b = patch.data[index + 2] / 255;
                const l = luminance(r, g, b);
                if (l < shadowThreshold || l > brightThreshold) {
                    penalty += 1;
                }
            }

            const darknessPenalty = Math.abs(patchStats.avgL - repairedStats.avgL);
            const colorPenalty = Math.abs(patchStats.avgR - repairedStats.avgR)
                + Math.abs(patchStats.avgG - repairedStats.avgG)
                + Math.abs(patchStats.avgB - repairedStats.avgB);

            patchCandidates.push({
                left,
                top,
                score: penalty * 4 + darknessPenalty * 100 + colorPenalty * 70 + patchStats.stdL * 20
            });
        }
    }

    patchCandidates.sort((a, b) => a.score - b.score);
    const selectedPatches = patchCandidates.slice(0, 16);
    const tileCanvas = createCanvas(outputSize, outputSize);
    const tileContext = tileCanvas.getContext('2d', { willReadFrequently: true });
    const tilePatchSize = outputSize / 4;

    selectedPatches.forEach((patch, index) => {
        const dx = (index % 4) * tilePatchSize;
        const dy = Math.floor(index / 4) * tilePatchSize;
        tileContext.drawImage(
            repairedCanvas,
            patch.left,
            patch.top,
            patchSize,
            patchSize,
            dx,
            dy,
            tilePatchSize,
            tilePatchSize
        );
    });

    tileContext.globalAlpha = 0.12;
    tileContext.drawImage(tileCanvas, -outputSize * 0.5, 0, outputSize, outputSize);
    tileContext.drawImage(tileCanvas, outputSize * 0.5, 0, outputSize, outputSize);
    tileContext.drawImage(tileCanvas, 0, -outputSize * 0.5, outputSize, outputSize);
    tileContext.drawImage(tileCanvas, 0, outputSize * 0.5, outputSize, outputSize);
    tileContext.globalAlpha = 1;

    return {
        canvas: tileCanvas,
        source: tileCanvas.toDataURL('image/png'),
        stats: computePixelStatistics(tileContext.getImageData(0, 0, outputSize, outputSize))
    };
}

function buildMaterialProfile(stats) {
    const {
        saturation,
        highlightRatio,
        stdDev,
        neutralness,
        warmBias,
        detectedMetal,
        directionalStreakDetected,
        anisotropyScore
    } = stats;

    if ((highlightRatio > 0.12 && neutralness > 0.62) || detectedMetal) {
        return {
            key: 'metal',
            label: 'Metallic / Reflective',
            description: 'Menambahkan brushed detail, highlight tajam, dan displacement halus agar proxy terlihat lebih licin dan mengkilap.',
            detailScale: 10.5,
            textureRepeat: 2.4,
            displacementScale: 0.004,
            detailContrast: 1.45,
            sheenStrength: 0.28,
            specularBoost: 1.45,
            bumpIntensity: 0.035,
            sheenTint: [1.0, 1.0, 1.0],
            grainDirection: directionalStreakDetected ? [1.0, 0.0] : [1.0, 0.08],
            anisotropyBias: directionalStreakDetected ? Math.max(0.35, anisotropyScore) : 0
        };
    }

    if (saturation > 0.18 && stdDev > 0.16 && highlightRatio < 0.08) {
        return {
            key: 'fabric',
            label: 'Fabric / Velvet',
            description: 'Menambahkan weave/fiber noise, bump lebih terasa, dan rim sheen lembut agar sphere/cube terasa seperti kain atau beludru.',
            detailScale: 13.5,
            textureRepeat: 3.0,
            displacementScale: 0.03,
            detailContrast: 1.3,
            sheenStrength: 0.42,
            specularBoost: 0.72,
            bumpIntensity: 0.12,
            sheenTint: [1.0, 1.0, 1.0],
            grainDirection: [0.92, 0.35]
        };
    }

    if (warmBias > 0.05 && stdDev > 0.1) {
        return {
            key: 'wood',
            label: 'Wood / Grainy',
            description: 'Memunculkan garis serat dan variasi tonal agar proxy lebih dekat ke permukaan kayu atau material berserat.',
            detailScale: 8.5,
            textureRepeat: 2.2,
            displacementScale: 0.012,
            detailContrast: 1.1,
            sheenStrength: 0.12,
            specularBoost: 0.88,
            bumpIntensity: 0.07,
            sheenTint: [1.0, 1.0, 1.0],
            grainDirection: [1.0, 0.22]
        };
    }

    if (highlightRatio > 0.06 && saturation > 0.08) {
        return {
            key: 'plastic',
            label: 'Glossy Plastic / Coated',
            description: 'Memberi highlight yang lebih rapat dan permukaan lebih rapih supaya terasa seperti plastik coating atau keramik glossy.',
            detailScale: 7.2,
            textureRepeat: 1.8,
            displacementScale: 0.006,
            detailContrast: 1.0,
            sheenStrength: 0.2,
            specularBoost: 1.12,
            bumpIntensity: 0.04,
            sheenTint: [1.0, 1.0, 1.0],
            grainDirection: [1.0, 0.14]
        };
    }

    return {
        key: 'matte',
        label: 'Matte / Stone',
        description: 'Menonjolkan granular diffuse detail agar proxy terlihat lebih kasar, kering, dan tidak terlalu memantul.',
        detailScale: 6.8,
        textureRepeat: 2.0,
        displacementScale: 0.014,
        detailContrast: 1.18,
        sheenStrength: 0.08,
        specularBoost: 0.78,
        bumpIntensity: 0.085,
        sheenTint: [1.0, 1.0, 1.0],
        grainDirection: [0.84, 0.44]
    };
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
            learning_rate: 0.03,
            adam_beta1: 0.9,
            adam_beta2: 0.999,
            adam_epsilon: 1e-8,
            clamp_enabled: true,
            optimize_albedo: true,
            seed: 1,
            ...overrides
        };
    }

    async registerImage({ imageId, source, referenceSource = null }) {
        const image = await this.resolveImageSource(source);
        const materialTexture = buildSeamlessTextureFromImage(image);
        const target = await this.prepareImage(materialTexture.canvas);
        const reference = referenceSource ? await this.prepareImage(referenceSource) : null;
        const materialProfile = this.analyzeMaterialAppearance(target);

        this.imageRegistry.set(imageId, {
            id: imageId,
            target,
            reference,
            materialProfile,
            materialTexture
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
        const linearPixels = readImagePixels(imageData, 'linear');
        const srgbPixels = readImagePixels(imageData, 'srgb');

        return {
            width: this.imageSize,
            height: this.imageSize,
            imageData,
            pixels: linearPixels,
            srgbPixels,
            colorSpace: 'sRGB'
        };
    }

    resolveImageSource(source) {
        if (source instanceof HTMLCanvasElement) {
            return Promise.resolve(source);
        }

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
        const stats = imageRecord.materialProfile?.stats || this.collectImageStats(imageRecord.target);
        const isLowSaturationGray = stats.saturation < 0.08 && stats.neutralness > 0.9;
        const luminanceInit = clamp01(stats.avgL);
        const albedo = isLowSaturationGray
            ? [luminanceInit, luminanceInit, luminanceInit]
            : [clamp01(stats.avgR), clamp01(stats.avgG), clamp01(stats.avgB)];
        const metallicFromHighlights = stats.highlightRatio > 0.11 && stats.neutralness > 0.68;
        const detectedMetal = stats.detectedMetal === true;
        const metallic = metallicFromHighlights || detectedMetal
            ? 0.8
            : clamp01(0.12 + stats.metalProbability * 0.65);
        const roughness = detectedMetal
            ? clamp01(0.24 + (1 - stats.highlightRatio) * 0.1)
            : clamp01(0.3 + (1 - stats.highlightRatio) * 0.32);
        const anisotropy = stats.directionalStreakDetected
            ? clamp01(Math.max(0.35, stats.anisotropyScore))
            : clamp01(stats.anisotropyScore * 0.35);

        return sanitizeParameters({
            albedo,
            roughness,
            metallic,
            anisotropy
        });
    }

    collectImageStats(targetImage) {
        const pixels = targetImage.imageData.data;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumL = 0;
        let sumL2 = 0;
        let highlightCount = 0;
        let edgeEnergy = 0;
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

        for (let y = 0; y < targetImage.height - 1; y += 1) {
            for (let x = 0; x < targetImage.width - 1; x += 1) {
                const index = (y * targetImage.width + x) * 4;
                const rightIndex = index + 4;
                const bottomIndex = index + targetImage.width * 4;
                const currentL = 0.2126 * (pixels[index] / 255) + 0.7152 * (pixels[index + 1] / 255) + 0.0722 * (pixels[index + 2] / 255);
                const rightL = 0.2126 * (pixels[rightIndex] / 255) + 0.7152 * (pixels[rightIndex + 1] / 255) + 0.0722 * (pixels[rightIndex + 2] / 255);
                const bottomL = 0.2126 * (pixels[bottomIndex] / 255) + 0.7152 * (pixels[bottomIndex + 1] / 255) + 0.0722 * (pixels[bottomIndex + 2] / 255);
                edgeEnergy += Math.abs(currentL - rightL) + Math.abs(currentL - bottomL);
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

        const streak = computeSobelStreakFeatures(targetImage.imageData, targetImage.width, targetImage.height);
        const neutralness = 1 - saturation;
        const metalProbability = clamp01(
            highlightCount / pixelCount * 1.6
            + neutralness * 0.55
            + streak.anisotropyScore * 0.45
            - saturation * 0.35
        );
        const detectedMetal = metalProbability >= 0.58 || (highlightCount / pixelCount > 0.11 && neutralness > 0.7);

        return {
            avgR,
            avgG,
            avgB,
            avgL,
            stdDev,
            saturation,
            neutralness,
            highlightRatio: highlightCount / pixelCount,
            warmBias: avgR - avgB,
            coolBias: avgB - avgR,
            contrastEnergy: clamp01(edgeEnergy / Math.max(1, targetImage.width * targetImage.height)),
            metalProbability,
            detectedMetal,
            anisotropyScore: streak.anisotropyScore,
            horizontalStreakScore: streak.horizontalStreakScore,
            directionalStreakDetected: streak.directionalStreakDetected,
            dominantColor: [avgR, avgG, avgB],
            isGrayscale: saturation < 0.08
        };
    }

    analyzeMaterialAppearance(targetImage) {
        const stats = this.collectImageStats(targetImage);
        const profile = buildMaterialProfile(stats);
        return {
            ...profile,
            confidence: clamp01(
                (stats.highlightRatio * 1.8)
                + (stats.stdDev * 1.2)
                + (stats.contrastEnergy * 0.6)
                + (stats.saturation * 0.4)
            ),
            stats,
            detectedMetal: stats.detectedMetal,
            metalProbability: stats.metalProbability,
            anisotropyScore: stats.anisotropyScore,
            directionalStreakDetected: stats.directionalStreakDetected,
            dominantColor: stats.dominantColor || [stats.avgR, stats.avgG, stats.avgB]
        };
    }

    getMaterialProfile(imageId) {
        return this.getImageRecord(imageId).materialProfile;
    }

    getMaterialTexture(imageId) {
        return this.getImageRecord(imageId).materialTexture;
    }

    computeRandomInitialization(rng) {
        return {
            albedo: [rng.next(), rng.next(), rng.next()],
            roughness: rng.range(0.05, 0.95),
            metallic: rng.range(0, 1),
            anisotropy: rng.range(0, 1)
        };
    }

    computeConstantInitialization() {
        return {
            albedo: [0.5, 0.5, 0.5],
            roughness: 0.5,
            metallic: 0.0,
            anisotropy: 0
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
        const convergenceReason = optimizerResult.convergence_reason || convergenceDetection.reason || 'max_iterations_reached';
        metrics.convergence_reason = convergenceReason;
        const result = {
            config: { ...config },
            experiment_config: { ...config },
            metrics,
            logs: optimizerResult.logs,
            final_parameters: cloneParameters(optimizerResult.final_parameters),
            convergence_curve: {
                loss_vs_iteration: convergence.loss_curve,
                gradient_norm_vs_iteration: convergence.gradient_magnitude_curve,
                parameter_trajectory: {
                    albedo_r: optimizerResult.logs.map((entry) => entry.parameters.albedo[0]),
                    albedo_g: optimizerResult.logs.map((entry) => entry.parameters.albedo[1]),
                    albedo_b: optimizerResult.logs.map((entry) => entry.parameters.albedo[2]),
                    roughness: optimizerResult.logs.map((entry) => entry.parameters.roughness),
                    metallic: optimizerResult.logs.map((entry) => entry.parameters.metallic),
                    anisotropy: optimizerResult.logs.map((entry) => entry.parameters.anisotropy ?? 0)
                },
                convergence_reason: convergenceReason
            },
            analysis: {
                ...convergence,
                convergence_reason: convergenceReason
            },
            convergence_detection: {
                ...convergenceDetection,
                convergence_iteration: optimizerResult.convergence_iteration || convergenceDetection.convergence_iteration,
                reason: convergenceReason
            },
            metadata,
            material_profile: record.materialProfile,
            profile: {
                total_render_calls: optimizerResult.total_render_calls || (1 + optimizerResult.logs.length * 7),
                total_time: optimizerResult.total_time_ms,
                avg_time_per_iteration: metrics.avg_iteration_time
            },
            status: metrics.status,
            optimizer: {
                type: 'adam_finite_difference',
                beta1: config.adam_beta1 ?? 0.9,
                beta2: config.adam_beta2 ?? 0.999,
                epsilon: config.adam_epsilon ?? 1e-8,
                stop_reason: convergenceReason
            },
            export_summary: {
                json_schema_version: '2.0',
                csv_columns: [
                    'image_id',
                    'method',
                    'status',
                    'final_loss',
                    'initial_loss',
                    'loss_drop_percentage',
                    'iterations',
                    'runtime_ms',
                    'convergence_iteration',
                    'convergence_reason',
                    'gradient_final_norm',
                    'final_albedo_r',
                    'final_albedo_g',
                    'final_albedo_b',
                    'final_roughness',
                    'final_metallic',
                    'final_anisotropy',
                    'mse',
                    'ssim',
                    'sobel_edge_loss',
                    'color_mean_loss',
                    'histogram_loss',
                    'saturation_loss',
                    'perceptual_loss'
                ]
            }
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
            lightingType: 'default',
            referencePixels: record.reference ? record.reference.pixels : null,
            snapshotScale: 1.55,
            snapshotCameraZ: 2.1,
            showLightHelper: false,
            transparentBackground: true,
            forceNeutralLighting: true,
            forceNeutralEnvironment: true,
            disableToneMapping: true,
            targetAnalysis: record.materialProfile?.stats || null
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
        if (format === 'csv') {
            return this.buildCsvSummary(result);
        }
        return JSON.stringify(result, null, 2);
    }

    exportResults(result = this.lastResult) {
        if (!result) {
            throw new Error('No experiment results available for export');
        }

        return {
            json: JSON.stringify(result, null, 2),
            csv: this.buildCsvSummary(result)
        };
    }

    buildCsvSummary(result) {
        const metrics = result.metrics || {};
        const params = result.final_parameters || {};
        const albedo = Array.isArray(params.albedo) ? params.albedo : [null, null, null];
        const headers = [
            'image_id',
            'method',
            'status',
            'final_loss',
            'initial_loss',
            'loss_drop_percentage',
            'iterations',
            'runtime_ms',
            'convergence_iteration',
            'convergence_reason',
            'gradient_final_norm',
            'final_albedo_r',
            'final_albedo_g',
            'final_albedo_b',
            'final_roughness',
            'final_metallic',
            'final_anisotropy',
            'mse',
            'ssim',
            'sobel_edge_loss',
            'color_mean_loss',
            'histogram_loss',
            'saturation_loss',
            'perceptual_loss'
        ];
        const values = [
            result?.config?.image_id ?? '',
            result?.config?.init_type ?? '',
            result?.status ?? '',
            metrics.final_loss ?? '',
            metrics.initial_loss ?? '',
            metrics.loss_drop_percentage ?? '',
            metrics.total_iterations ?? '',
            metrics.total_runtime_ms ?? '',
            metrics.convergence_iteration ?? '',
            metrics.convergence_reason ?? '',
            metrics.gradient_final_norm ?? '',
            albedo[0] ?? '',
            albedo[1] ?? '',
            albedo[2] ?? '',
            params.roughness ?? '',
            params.metallic ?? '',
            params.anisotropy ?? '',
            metrics.mse ?? '',
            metrics.ssim ?? '',
            metrics.sobel_edge_loss ?? '',
            metrics.color_mean_loss ?? '',
            metrics.histogram_loss ?? '',
            metrics.saturation_loss ?? '',
            metrics.perceptual_loss ?? ''
        ];

        const escapeCsv = (value) => `"${String(value).replace(/"/g, '""')}"`;
        const headerRow = headers.map(escapeCsv).join(',');
        const valueRow = values.map(escapeCsv).join(',');
        return `${headerRow}\n${valueRow}`;
    }

    createSeededRandom(seed) {
        return createSeededRandom(seed);
    }

    detectConvergence(logs, threshold = 1e-4, window = 5) {
        return detectConvergence(logs, threshold, window);
    }
}
