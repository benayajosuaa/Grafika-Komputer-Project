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
        metallic: parameters.metallic
    };

    if (!clampEnabled) {
        return next;
    }

    next.albedo = next.albedo.map((value) => clamp01(value));
    next.roughness = clamp01(next.roughness);
    next.metallic = clamp01(next.metallic);
    return next;
}

export function computeGradientNorm(gradient) {
    const values = [
        ...gradient.albedo,
        gradient.roughness,
        gradient.metallic
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

function extractLuminance(pixels) {
    const luminance = [];
    for (let index = 0; index < pixels.length; index += 3) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        luminance.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    return luminance;
}

export function computeSSIM(renderedPixels, targetPixels) {
    if (renderedPixels.length === 0 || targetPixels.length === 0) {
        return null;
    }

    const x = extractLuminance(renderedPixels);
    const y = extractLuminance(targetPixels);
    const count = Math.min(x.length, y.length);
    if (count === 0) {
        return null;
    }

    const xTrimmed = x.slice(0, count);
    const yTrimmed = y.slice(0, count);
    const muX = mean(xTrimmed);
    const muY = mean(yTrimmed);
    const sigmaX2 = variance(xTrimmed);
    const sigmaY2 = variance(yTrimmed);
    let covariance = 0;

    for (let index = 0; index < count; index += 1) {
        covariance += (xTrimmed[index] - muX) * (yTrimmed[index] - muY);
    }

    covariance /= count;

    const c1 = 0.01 * 0.01;
    const c2 = 0.03 * 0.03;
    const numerator = (2 * muX * muY + c1) * (2 * covariance + c2);
    const denominator = (muX * muX + muY * muY + c1) * (sigmaX2 + sigmaY2 + c2);

    if (denominator === 0) {
        return null;
    }

    return numerator / denominator;
}

export function computePhotometricMetrics(renderedPixels, targetPixels, referencePixels = null) {
    const metrics = {
        photometric_loss: computeMSE(renderedPixels, targetPixels)
    };

    if (referencePixels) {
        metrics.rmse = computeRMSE(renderedPixels, referencePixels);
        metrics.ssim = computeSSIM(renderedPixels, referencePixels);
    } else {
        metrics.rmse = null;
        metrics.ssim = null;
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
    const convergenceIteration = estimateConvergenceIteration(logs, window, threshold);
    return {
        converged: convergenceIteration !== null,
        convergence_iteration: convergenceIteration
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
        parameters.metallic
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
        loss_reduction_ratio: initialLoss > 0 ? (initialLoss - finalLoss) / initialLoss : 0,
        total_iterations: totalIterations,
        total_time_ms: totalTimeMs,
        avg_iteration_time: avgTimePerIteration,
        avg_time_per_iteration: avgTimePerIteration,
        convergence_iteration: convergence.convergence_iteration,
        gradient_final_norm: finalLog ? finalLog.gradient_norm : 0,
        rmse: finalEvaluationMetrics ? finalEvaluationMetrics.rmse : null,
        ssim: finalEvaluationMetrics ? finalEvaluationMetrics.ssim : null,
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
        mean_time: mean(times),
        success_rate: results.length > 0 ? successCount / results.length : 0
    };
}
