import { computeGradientNorm, computePhotometricMetrics, sanitizeParameters } from './metrics.js?v=20260413b';

function cloneParameters(parameters) {
    return {
        albedo: [...parameters.albedo],
        roughness: parameters.roughness,
        metallic: parameters.metallic
    };
}

function parameterKeys(config = {}) {
    const keys = [];

    if (config.optimize_albedo === true) {
        keys.push(
            ['albedo', 0],
            ['albedo', 1],
            ['albedo', 2]
        );
    }

    keys.push(
        ['roughness', null],
        ['metallic', null]
    );

    return keys;
}

function shouldStopFromLogs(logs) {
    if (logs.length < 8) {
        return false;
    }

    const recent = logs.slice(-8);
    const stableLoss = recent.every((entry) => Math.abs(entry.delta_loss) <= 1e-5);
    const smallGradient = recent.every((entry) => entry.gradient_norm <= 1e-3);
    return stableLoss || smallGradient;
}

export class FiniteDifferenceOptimizer {
    constructor({ renderer, logger }) {
        this.renderer = renderer;
        this.logger = logger;
    }

    async evaluate(parameters, targetImage, evaluationOptions = {}) {
        const snapshot = await this.renderer.renderSnapshot(parameters, evaluationOptions);
        const metrics = computePhotometricMetrics(snapshot.pixels, targetImage.pixels, evaluationOptions.referencePixels || null);

        return {
            loss: metrics.photometric_loss,
            render_time_ms: snapshot.renderTimeMs,
            pixels: snapshot.pixels,
            metrics
        };
    }

    async estimateGradient(parameters, baselineLoss, targetImage, config, evaluationOptions) {
        const epsilon = config.epsilon;
        const gradient = {
            albedo: [0, 0, 0],
            roughness: 0,
            metallic: 0
        };

        let renderTimeMs = 0;

        for (const [key, componentIndex] of parameterKeys(config)) {
            const perturbed = cloneParameters(parameters);

            if (componentIndex == null) {
                perturbed[key] += epsilon;
            } else {
                perturbed[key][componentIndex] += epsilon;
            }

            const safeParameters = sanitizeParameters(perturbed, config.clamp_enabled);
            const evaluation = await this.evaluate(safeParameters, targetImage, evaluationOptions);
            renderTimeMs += evaluation.render_time_ms;
            const gradientValue = (evaluation.loss - baselineLoss) / epsilon;

            if (componentIndex == null) {
                gradient[key] = gradientValue;
            } else {
                gradient[key][componentIndex] = gradientValue;
            }
        }

        return {
            gradient,
            renderTimeMs
        };
    }

    applyGradientStep(parameters, gradient, config) {
        const next = cloneParameters(parameters);

        if (config.optimize_albedo === true) {
            next.albedo = next.albedo.map((value, index) => value - config.learning_rate * gradient.albedo[index]);
        }
        next.roughness -= config.learning_rate * gradient.roughness;
        next.metallic -= config.learning_rate * gradient.metallic;

        return sanitizeParameters(next, config.clamp_enabled);
    }

    async optimize({
        config,
        initialParameters,
        targetImage,
        evaluationOptions = {},
        onIteration = null,
        shouldContinue = null
    }) {
        this.logger.reset();

        const totalStart = performance.now();
        let currentParameters = sanitizeParameters(initialParameters, config.clamp_enabled);
        const initialEvaluation = await this.evaluate(currentParameters, targetImage, evaluationOptions);
        const initialLoss = initialEvaluation.loss;
        let currentLoss = initialLoss;
        let finalEvaluation = initialEvaluation;

        for (let iteration = 1; iteration <= config.max_iterations; iteration += 1) {
            if (shouldContinue && !shouldContinue()) {
                break;
            }

            const { gradient, renderTimeMs: gradientRenderTimeMs } = await this.estimateGradient(
                currentParameters,
                currentLoss,
                targetImage,
                config,
                evaluationOptions
            );

            const updatedParameters = this.applyGradientStep(currentParameters, gradient, config);
            const updatedEvaluation = await this.evaluate(updatedParameters, targetImage, evaluationOptions);
            const iterationRenderTime = gradientRenderTimeMs + updatedEvaluation.render_time_ms;
            const deltaLoss = currentLoss - updatedEvaluation.loss;
            currentParameters = updatedParameters;
            currentLoss = updatedEvaluation.loss;
            finalEvaluation = updatedEvaluation;

            const logEntry = this.logger.logIteration({
                iteration,
                loss: updatedEvaluation.loss,
                delta_loss: deltaLoss,
                parameters: currentParameters,
                gradient_norm: computeGradientNorm(gradient),
                render_time_ms: iterationRenderTime
            });

            if (onIteration) {
                onIteration(logEntry);
            }

            if (shouldStopFromLogs(this.logger.getLogs())) {
                break;
            }
        }

        return {
            initial_loss: initialLoss,
            final_parameters: currentParameters,
            logs: this.logger.getLogs(),
            total_time_ms: performance.now() - totalStart,
            final_evaluation_metrics: finalEvaluation.metrics
        };
    }
}
