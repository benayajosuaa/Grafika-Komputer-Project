const DEFAULT_STABILITY_WINDOW = 8;
const DEFAULT_STABILITY_EPSILON = 1e-5;

function sum(values) {
    return values.reduce((acc, value) => acc + value, 0);
}

function mean(values) {
    return values.length > 0 ? sum(values) / values.length : 0;
}

function variance(values) {
    if (values.length === 0) {
        return 0;
    }

    const avg = mean(values);
    return mean(values.map((value) => {
        const delta = value - avg;
        return delta * delta;
    }));
}

function std(values) {
    return Math.sqrt(variance(values));
}

function linearRegressionSlope(values) {
    if (values.length < 2) {
        return 0;
    }

    const xs = values.map((_, index) => index + 1);
    const xMean = mean(xs);
    const yMean = mean(values);

    let numerator = 0;
    let denominator = 0;

    for (let index = 0; index < values.length; index += 1) {
        const dx = xs[index] - xMean;
        numerator += dx * (values[index] - yMean);
        denominator += dx * dx;
    }

    return denominator === 0 ? 0 : numerator / denominator;
}

export function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

export function sanitizeParameters(parameters, clampEnabled = true) {
    const next = {
        albedo: [...parameters.albedo],
        roughness: parameters.roughness,
        metallic: parameters.metallic,
        anisotropy: parameters.anisotropy ?? 0
    };

    if (!clampEnabled) {
        return next;
    }

    next.albedo = next.albedo.map((value) => clamp01(value));
    next.roughness = clamp01(next.roughness);
    next.metallic = clamp01(next.metallic);
    next.anisotropy = clamp01(next.anisotropy);
    return next;
}

export function computeGradientNorm(gradient) {
    const values = [
        ...gradient.albedo,
        gradient.roughness,
        gradient.metallic,
        gradient.anisotropy ?? 0
    ];
    return Math.sqrt(values.reduce((acc, value) => acc + value * value, 0));
}

export function computeMSE(renderedPixels, targetPixels) {
    const length = Math.min(renderedPixels.length, targetPixels.length);
    if (length === 0) {
        return 0;
    }

    let error = 0;
    for (let index = 0; index < length; index += 1) {
        const delta = renderedPixels[index] - targetPixels[index];
        error += delta * delta;
    }

    return error / length;
}

export function computeRMSE(renderedPixels, targetPixels) {
    return Math.sqrt(computeMSE(renderedPixels, targetPixels));
}

function extractLuminance(pixels, count = Math.floor(pixels.length / 3)) {
    const luminance = new Float32Array(count);
    for (let index = 0; index < pixels.length; index += 3) {
        const outputIndex = Math.floor(index / 3);
        if (outputIndex >= count) {
            break;
        }
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        luminance[outputIndex] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return luminance;
}

function inferImageShape(sampleCount) {
    if (sampleCount <= 0) {
        return { width: 0, height: 0 };
    }

    const square = Math.round(Math.sqrt(sampleCount));
    if (square * square === sampleCount) {
        return { width: square, height: square };
    }

    const fallbackWidth = 64;
    const width = sampleCount % fallbackWidth === 0 ? fallbackWidth : sampleCount;
    const height = Math.max(1, Math.floor(sampleCount / width));
    return { width, height };
}

function buildIntegralImage(values, width, height) {
    const stride = width + 1;
    const integral = new Float64Array((width + 1) * (height + 1));

    for (let y = 1; y <= height; y += 1) {
        let rowSum = 0;
        for (let x = 1; x <= width; x += 1) {
            rowSum += values[(y - 1) * width + (x - 1)];
            integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum;
        }
    }

    return integral;
}

function rectSum(integral, width, x0, y0, x1, y1) {
    const stride = width + 1;
    const xa = x0;
    const ya = y0;
    const xb = x1 + 1;
    const yb = y1 + 1;
    return integral[yb * stride + xb]
        - integral[ya * stride + xb]
        - integral[yb * stride + xa]
        + integral[ya * stride + xa];
}

function fallbackGlobalSSIM(x, y, count) {
    const xValues = Array.from(x.slice(0, count));
    const yValues = Array.from(y.slice(0, count));
    const muX = mean(xValues);
    const muY = mean(yValues);
    const sigmaX2 = variance(xValues);
    const sigmaY2 = variance(yValues);
    let covariance = 0;

    for (let index = 0; index < count; index += 1) {
        covariance += (x[index] - muX) * (y[index] - muY);
    }
    covariance /= count;

    const c1 = 0.01 * 0.01;
    const c2 = 0.03 * 0.03;
    const numerator = (2 * muX * muY + c1) * (2 * covariance + c2);
    const denominator = (muX * muX + muY * muY + c1) * (sigmaX2 + sigmaY2 + c2);

    if (denominator <= 1e-12) {
        return null;
    }

    return numerator / denominator;
}

export function computeSSIM(renderedPixels, targetPixels) {
    if (renderedPixels.length === 0 || targetPixels.length === 0) {
        return null;
    }

    const sampleCount = Math.min(
        Math.floor(renderedPixels.length / 3),
        Math.floor(targetPixels.length / 3)
    );
    if (sampleCount === 0) {
        return null;
    }

    const { width, height } = inferImageShape(sampleCount);
    if (width * height !== sampleCount || width < 3 || height < 3) {
        const lx = extractLuminance(renderedPixels, sampleCount);
        const ly = extractLuminance(targetPixels, sampleCount);
        return fallbackGlobalSSIM(lx, ly, sampleCount);
    }

    const x = extractLuminance(renderedPixels, sampleCount);
    const y = extractLuminance(targetPixels, sampleCount);
    const x2 = new Float32Array(sampleCount);
    const y2 = new Float32Array(sampleCount);
    const xy = new Float32Array(sampleCount);

    for (let index = 0; index < sampleCount; index += 1) {
        const xv = x[index];
        const yv = y[index];
        x2[index] = xv * xv;
        y2[index] = yv * yv;
        xy[index] = xv * yv;
    }

    const sumX = buildIntegralImage(x, width, height);
    const sumY = buildIntegralImage(y, width, height);
    const sumX2 = buildIntegralImage(x2, width, height);
    const sumY2 = buildIntegralImage(y2, width, height);
    const sumXY = buildIntegralImage(xy, width, height);
    const radius = 3;
    const c1 = 0.01 * 0.01;
    const c2 = 0.03 * 0.03;
    let accumulator = 0;
    let validCount = 0;

    for (let yCoord = 0; yCoord < height; yCoord += 1) {
        for (let xCoord = 0; xCoord < width; xCoord += 1) {
            const x0 = Math.max(0, xCoord - radius);
            const y0 = Math.max(0, yCoord - radius);
            const x1 = Math.min(width - 1, xCoord + radius);
            const y1 = Math.min(height - 1, yCoord + radius);
            const area = (x1 - x0 + 1) * (y1 - y0 + 1);

            const muX = rectSum(sumX, width, x0, y0, x1, y1) / area;
            const muY = rectSum(sumY, width, x0, y0, x1, y1) / area;
            const sigmaX2 = Math.max(0, rectSum(sumX2, width, x0, y0, x1, y1) / area - muX * muX);
            const sigmaY2 = Math.max(0, rectSum(sumY2, width, x0, y0, x1, y1) / area - muY * muY);
            const covariance = rectSum(sumXY, width, x0, y0, x1, y1) / area - muX * muY;

            const numerator = (2 * muX * muY + c1) * (2 * covariance + c2);
            const denominator = (muX * muX + muY * muY + c1) * (sigmaX2 + sigmaY2 + c2);
            if (denominator <= 1e-12) {
                continue;
            }

            accumulator += numerator / denominator;
            validCount += 1;
        }
    }

    if (validCount === 0) {
        return null;
    }

    return accumulator / validCount;
}

export function computeSobelEdgeLoss(renderedPixels, targetPixels) {
    const sampleCount = Math.min(
        Math.floor(renderedPixels.length / 3),
        Math.floor(targetPixels.length / 3)
    );
    if (sampleCount === 0) {
        return 0;
    }

    const { width, height } = inferImageShape(sampleCount);
    if (width * height !== sampleCount || width < 3 || height < 3) {
        return 0;
    }

    const x = extractLuminance(renderedPixels, sampleCount);
    const y = extractLuminance(targetPixels, sampleCount);
    let edgeDiffSum = 0;
    let edgeCount = 0;

    for (let py = 1; py < height - 1; py += 1) {
        for (let px = 1; px < width - 1; px += 1) {
            const i00 = (py - 1) * width + (px - 1);
            const i01 = (py - 1) * width + px;
            const i02 = (py - 1) * width + (px + 1);
            const i10 = py * width + (px - 1);
            const i12 = py * width + (px + 1);
            const i20 = (py + 1) * width + (px - 1);
            const i21 = (py + 1) * width + px;
            const i22 = (py + 1) * width + (px + 1);

            const gxX = (x[i02] + 2 * x[i12] + x[i22]) - (x[i00] + 2 * x[i10] + x[i20]);
            const gyX = (x[i20] + 2 * x[i21] + x[i22]) - (x[i00] + 2 * x[i01] + x[i02]);
            const gxY = (y[i02] + 2 * y[i12] + y[i22]) - (y[i00] + 2 * y[i10] + y[i20]);
            const gyY = (y[i20] + 2 * y[i21] + y[i22]) - (y[i00] + 2 * y[i01] + y[i02]);

            const magX = Math.sqrt(gxX * gxX + gyX * gyX);
            const magY = Math.sqrt(gxY * gxY + gyY * gyY);
            edgeDiffSum += Math.abs(magX - magY);
            edgeCount += 1;
        }
    }

    if (edgeCount === 0) {
        return 0;
    }

    return edgeDiffSum / edgeCount;
}

function computeHistogramLoss(renderedPixels, targetPixels, bins = 32) {
    const clampedBins = Math.max(8, Math.min(128, Math.floor(bins)));
    const renderedHist = Array.from({ length: 3 }, () => new Float32Array(clampedBins));
    const targetHist = Array.from({ length: 3 }, () => new Float32Array(clampedBins));
    const sampleCount = Math.min(
        Math.floor(renderedPixels.length / 3),
        Math.floor(targetPixels.length / 3)
    );

    if (sampleCount === 0) {
        return 0;
    }

    for (let index = 0; index < sampleCount; index += 1) {
        for (let channel = 0; channel < 3; channel += 1) {
            const renderedValue = clamp01(renderedPixels[index * 3 + channel]);
            const targetValue = clamp01(targetPixels[index * 3 + channel]);
            const renderedBin = Math.min(clampedBins - 1, Math.floor(renderedValue * clampedBins));
            const targetBin = Math.min(clampedBins - 1, Math.floor(targetValue * clampedBins));
            renderedHist[channel][renderedBin] += 1;
            targetHist[channel][targetBin] += 1;
        }
    }

    let loss = 0;
    for (let channel = 0; channel < 3; channel += 1) {
        for (let bin = 0; bin < clampedBins; bin += 1) {
            const renderedProb = renderedHist[channel][bin] / sampleCount;
            const targetProb = targetHist[channel][bin] / sampleCount;
            loss += Math.abs(renderedProb - targetProb);
        }
    }

    return loss / 3;
}

function computeEdgeDirectionLoss(renderedPixels, targetPixels) {
    const sampleCount = Math.min(
        Math.floor(renderedPixels.length / 3),
        Math.floor(targetPixels.length / 3)
    );
    if (sampleCount === 0) {
        return 0;
    }

    const { width, height } = inferImageShape(sampleCount);
    if (width * height !== sampleCount || width < 3 || height < 3) {
        return 0;
    }

    const renderedLum = extractLuminance(renderedPixels, sampleCount);
    const targetLum = extractLuminance(targetPixels, sampleCount);
    let weightedDirectionError = 0;
    let weightSum = 0;

    for (let py = 1; py < height - 1; py += 1) {
        for (let px = 1; px < width - 1; px += 1) {
            const i00 = (py - 1) * width + (px - 1);
            const i01 = (py - 1) * width + px;
            const i02 = (py - 1) * width + (px + 1);
            const i10 = py * width + (px - 1);
            const i12 = py * width + (px + 1);
            const i20 = (py + 1) * width + (px - 1);
            const i21 = (py + 1) * width + px;
            const i22 = (py + 1) * width + (px + 1);

            const rGx = (renderedLum[i02] + 2 * renderedLum[i12] + renderedLum[i22]) - (renderedLum[i00] + 2 * renderedLum[i10] + renderedLum[i20]);
            const rGy = (renderedLum[i20] + 2 * renderedLum[i21] + renderedLum[i22]) - (renderedLum[i00] + 2 * renderedLum[i01] + renderedLum[i02]);
            const tGx = (targetLum[i02] + 2 * targetLum[i12] + targetLum[i22]) - (targetLum[i00] + 2 * targetLum[i10] + targetLum[i20]);
            const tGy = (targetLum[i20] + 2 * targetLum[i21] + targetLum[i22]) - (targetLum[i00] + 2 * targetLum[i01] + targetLum[i02]);

            const targetMagnitude = Math.sqrt(tGx * tGx + tGy * tGy);
            if (targetMagnitude < 1e-4) {
                continue;
            }

            const renderedMagnitude = Math.sqrt(rGx * rGx + rGy * rGy);
            const dot = rGx * tGx + rGy * tGy;
            const cosine = dot / Math.max(1e-6, renderedMagnitude * targetMagnitude);
            const directionError = 1 - Math.max(-1, Math.min(1, cosine));
            weightedDirectionError += directionError * targetMagnitude;
            weightSum += targetMagnitude;
        }
    }

    if (weightSum <= 1e-6) {
        return 0;
    }

    return weightedDirectionError / weightSum;
}

function computeHighlightRatio(pixels, threshold = 0.72) {
    const sampleCount = Math.floor(pixels.length / 3);
    if (sampleCount === 0) {
        return 0;
    }

    let highlights = 0;
    for (let index = 0; index < sampleCount; index += 1) {
        const r = pixels[index * 3];
        const g = pixels[index * 3 + 1];
        const b = pixels[index * 3 + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum >= threshold) {
            highlights += 1;
        }
    }

    return highlights / sampleCount;
}

function computeSpecularPriorLoss(renderedPixels, targetPixels, options = {}) {
    const parameters = options.parameters || {};
    const analysis = options.targetAnalysis || {};
    const targetHighlightRatio = computeHighlightRatio(targetPixels, 0.72);
    const renderedHighlightRatio = computeHighlightRatio(renderedPixels, 0.72);
    const targetSaturation = clamp01(analysis.saturation ?? 0.5);
    const targetMetalProbability = clamp01(
        analysis.metalProbability
        ?? (targetHighlightRatio * 1.9 + (1 - targetSaturation) * 0.55)
    );
    const metalLike = targetMetalProbability >= 0.55;
    const desiredMetallic = metalLike ? 0.85 : 0.18;
    const desiredRoughness = metalLike ? 0.3 : 0.5;
    const desiredAnisotropy = analysis.directionalStreakDetected ? clamp01(Math.max(0.35, analysis.anisotropyScore ?? 0)) : 0;
    const metallicError = Math.abs((parameters.metallic ?? 0) - desiredMetallic);
    const roughnessError = Math.abs((parameters.roughness ?? 0.5) - desiredRoughness);
    const anisotropyError = Math.abs((parameters.anisotropy ?? 0) - desiredAnisotropy);
    const highlightError = Math.abs(renderedHighlightRatio - targetHighlightRatio);
    return (
        0.45 * metallicError
        + 0.2 * roughnessError
        + 0.15 * anisotropyError
        + 0.2 * highlightError
    );
}

export function computePhotometricMetrics(renderedPixels, targetPixels, options = {}) {
    const referencePixels = options.referencePixels || null;
    const mse = computeMSE(renderedPixels, targetPixels);
    const ssimRaw = computeSSIM(renderedPixels, targetPixels);
    const ssim = ssimRaw == null ? 0 : Math.max(-1, Math.min(1, ssimRaw));
    const ssimLoss = 1 - ssim;
    const sobelEdgeLoss = computeSobelEdgeLoss(renderedPixels, targetPixels);
    const histogramLoss = computeHistogramLoss(renderedPixels, targetPixels, options.histogramBins || 32);
    const edgeDirectionLoss = computeEdgeDirectionLoss(renderedPixels, targetPixels);
    const specularPriorLoss = computeSpecularPriorLoss(renderedPixels, targetPixels, options);
    const totalLoss = (0.4 * mse) + (0.3 * histogramLoss) + (0.2 * edgeDirectionLoss) + (0.1 * specularPriorLoss);

    const metrics = {
        photometric_loss: totalLoss,
        mse,
        ssim,
        ssim_loss: ssimLoss,
        sobel_edge_loss: sobelEdgeLoss,
        histogram_loss: histogramLoss,
        edge_direction_loss: edgeDirectionLoss,
        specular_prior_loss: specularPriorLoss
    };

    metrics.rmse = computeRMSE(renderedPixels, targetPixels);

    if (referencePixels && referencePixels.length > 0) {
        metrics.reference_rmse = computeRMSE(renderedPixels, referencePixels);
        metrics.reference_ssim = computeSSIM(renderedPixels, referencePixels);
    } else {
        metrics.reference_rmse = null;
        metrics.reference_ssim = null;
    }

    return metrics;
}

export function estimateConvergenceIteration(logs, windowSize = DEFAULT_STABILITY_WINDOW, epsilon = DEFAULT_STABILITY_EPSILON) {
    if (logs.length < windowSize) {
        return null;
    }

    for (let index = windowSize - 1; index < logs.length; index += 1) {
        const window = logs.slice(index - windowSize + 1, index + 1).map((entry) => Math.abs(entry.delta_loss));
        if (window.every((delta) => delta <= epsilon)) {
            return logs[index].iteration;
        }
    }

    return null;
}

export function detectConvergence(logs, threshold = 1e-4, window = 5) {
    if (!logs || logs.length === 0) {
        return {
            converged: false,
            convergence_iteration: null,
            reason: 'empty_log'
        };
    }

    const gradStop = logs.find((entry) => entry.gradient_norm < 1e-4);
    if (gradStop) {
        return {
            converged: true,
            convergence_iteration: gradStop.iteration,
            reason: 'gradient_norm_threshold'
        };
    }

    const convergenceIteration = estimateConvergenceIteration(logs, 5, 1e-6);
    return {
        converged: convergenceIteration !== null,
        convergence_iteration: convergenceIteration,
        reason: convergenceIteration != null ? 'loss_improvement_plateau' : 'max_iterations_reached'
    };
}

export function analyzeConvergence(logs) {
    const lossCurve = logs.map((entry) => entry.loss);
    const gradientCurve = logs.map((entry) => entry.gradient_norm);
    const deltas = logs.map((entry) => entry.delta_loss);
    const slope = linearRegressionSlope(lossCurve);
    const convergenceIteration = estimateConvergenceIteration(logs);

    let oscillationCount = 0;
    for (let index = 2; index < deltas.length; index += 1) {
        const previous = deltas[index - 1];
        const current = deltas[index];
        if (Math.sign(previous) !== 0 && Math.sign(current) !== 0 && Math.sign(previous) !== Math.sign(current)) {
            oscillationCount += 1;
        }
    }

    return {
        slope,
        early_convergence_detected: convergenceIteration !== null,
        convergence_iteration: convergenceIteration,
        oscillation_detected: oscillationCount >= Math.max(3, Math.floor(logs.length * 0.1)),
        oscillation_count: oscillationCount,
        loss_curve: lossCurve,
        gradient_magnitude_curve: gradientCurve
    };
}

export function detectFailure(logs, parameters) {
    if (logs.length === 0) {
        return {
            failed: true,
            reasons: ['empty_log']
        };
    }

    const reasons = [];
    const firstLoss = logs[0].loss;
    const lastLoss = logs[logs.length - 1].loss;

    if (!Number.isFinite(firstLoss) || !Number.isFinite(lastLoss) || logs.some((entry) => !Number.isFinite(entry.loss))) {
        reasons.push('nan_loss');
    }

    const consecutiveIncreases = logs.slice(1).reduce((count, entry, index) => {
        const previousLoss = logs[index].loss;
        return entry.loss > previousLoss ? count + 1 : 0;
    }, 0);

    if (lastLoss > firstLoss * 1.05 || consecutiveIncreases >= 3) {
        reasons.push('divergence');
    }

    const convergence = detectConvergence(logs, 1e-4, 5);
    if (!convergence.converged) {
        reasons.push('no_convergence');
    }

    if (Math.abs(lastLoss - firstLoss) < 1e-4) {
        reasons.push('stagnation');
    }

    const invalidParameter = [
        ...parameters.albedo,
        parameters.roughness,
        parameters.metallic,
        parameters.anisotropy ?? 0
    ].some((value) => !Number.isFinite(value) || value < 0 || value > 1);

    if (invalidParameter) {
        reasons.push('unrealistic_parameters');
    }

    return {
        failed: reasons.length > 0,
        reasons
    };
}

export function computeFinalMetrics({
    logs,
    totalTimeMs,
    initialLoss,
    finalParameters,
    finalEvaluationMetrics = null
}) {
    const finalLog = logs[logs.length - 1] || null;
    const finalLoss = finalLog ? finalLog.loss : initialLoss;
    const totalIterations = logs.length;
    const avgTimePerIteration = totalIterations > 0 ? totalTimeMs / totalIterations : 0;
    const convergenceAnalysis = analyzeConvergence(logs);
    const convergence = detectConvergence(logs, 1e-4, 5);
    const failure = detectFailure(logs, finalParameters);

    return {
        final_loss: finalLoss,
        initial_loss: initialLoss,
        loss_drop_percentage: initialLoss > 0 ? ((initialLoss - finalLoss) / initialLoss) * 100 : 0,
        loss_reduction_ratio: initialLoss > 0 ? (initialLoss - finalLoss) / initialLoss : 0,
        total_iterations: totalIterations,
        total_runtime_ms: totalTimeMs,
        total_time_ms: totalTimeMs,
        avg_runtime_per_iteration: avgTimePerIteration,
        avg_iteration_time: avgTimePerIteration,
        avg_time_per_iteration: avgTimePerIteration,
        convergence_iteration: convergence.convergence_iteration,
        convergence_reason: convergence.reason,
        gradient_final_norm: finalLog ? finalLog.gradient_norm : 0,
        rmse: finalEvaluationMetrics ? finalEvaluationMetrics.rmse : null,
        ssim: finalEvaluationMetrics ? finalEvaluationMetrics.ssim : null,
        mse: finalEvaluationMetrics ? finalEvaluationMetrics.mse : null,
        sobel_edge_loss: finalEvaluationMetrics ? finalEvaluationMetrics.sobel_edge_loss : null,
        histogram_loss: finalEvaluationMetrics ? finalEvaluationMetrics.histogram_loss : null,
        edge_direction_loss: finalEvaluationMetrics ? finalEvaluationMetrics.edge_direction_loss : null,
        specular_prior_loss: finalEvaluationMetrics ? finalEvaluationMetrics.specular_prior_loss : null,
        failure,
        convergence: convergenceAnalysis,
        status: failure.failed ? 'failed' : 'success'
    };
}

export function aggregateBatchMetrics(results) {
    const losses = results.map((result) => result.metrics.final_loss);
    const iterations = results.map((result) => result.metrics.total_iterations);
    const times = results.map((result) => result.metrics.total_time_ms);
    const successCount = results.filter((result) => !result.metrics.failure.failed).length;

    return {
        mean_loss: mean(losses),
        std_loss: std(losses),
        mean_iterations: mean(iterations),
        mean_runtime: mean(times),
        mean_time: mean(times),
        success_rate: results.length > 0 ? successCount / results.length : 0
    };
}
