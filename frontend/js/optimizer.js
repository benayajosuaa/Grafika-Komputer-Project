import { computeGradientNorm, computePhotometricMetrics, sanitizeParameters } from './metrics.js?v=20260421a';

function cloneParameters(parameters) {
    return {
        albedo: [...parameters.albedo],
        roughness: parameters.roughness,
        metallic: parameters.metallic,
        anisotropy: parameters.anisotropy ?? 0
    };
}

function parameterKeys() {
    return [
        ['albedo', 0],
        ['albedo', 1],
        ['albedo', 2],
        ['roughness', null],
        ['metallic', null],
        ['anisotropy', null]
    ];
}

function getParameterValue(parameters, [key, componentIndex]) {
    if (componentIndex == null) {
        return parameters[key];
    }
    return parameters[key][componentIndex];
}

function setParameterValue(parameters, [key, componentIndex], value) {
    if (componentIndex == null) {
        parameters[key] = value;
        return;
    }
    parameters[key][componentIndex] = value;
}

function createZeroLike() {
    return {
        albedo: [0, 0, 0],
        roughness: 0,
        metallic: 0,
        anisotropy: 0
    };
}

function adaptiveFiniteDifferenceEpsilon(parameterValue) {
    return Math.max(1e-4, Math.abs(parameterValue) * 0.02);
}

function adamCorrection(value, decay, step) {
    const correction = 1 - Math.pow(decay, step);
    if (correction <= 0) {
        return value;
    }
    return value / correction;
}

export class FiniteDifferenceOptimizer {
    constructor({ renderer, logger }) {
        this.renderer = renderer;
        this.logger = logger;
    }

    applyPhysicalConstraints(parameters, evaluationOptions = {}) {
        const constrained = cloneParameters(parameters);
        const targetAnalysis = evaluationOptions.targetAnalysis || {};
        const detectedMetal = targetAnalysis.detectedMetal === true || targetAnalysis.metalProbability >= 0.6;

        if (detectedMetal) {
            constrained.metallic = Math.max(0.7, Math.min(1.0, constrained.metallic));
            constrained.roughness = Math.max(0.15, Math.min(0.45, constrained.roughness));
            if (targetAnalysis.directionalStreakDetected) {
                constrained.anisotropy = Math.max(0.35, constrained.anisotropy);
            }
        }

        return sanitizeParameters(constrained, true);
    }

    async evaluate(parameters, targetImage, evaluationOptions = {}) {
        const snapshot = await this.renderer.renderSnapshot(parameters, evaluationOptions);
        const metrics = computePhotometricMetrics(snapshot.pixels, targetImage.pixels, {
            referencePixels: evaluationOptions.referencePixels || null,
            parameters,
            targetAnalysis: evaluationOptions.targetAnalysis || null
        });

        return {
            loss: metrics.photometric_loss,
            render_time_ms: snapshot.renderTimeMs,
            pixels: snapshot.pixels,
            metrics
        };
    }

    async estimateGradient(parameters, baselineLoss, targetImage, _config, evaluationOptions) {
        const gradient = createZeroLike();
        const adaptiveEpsilons = createZeroLike();

        let renderTimeMs = 0;

        for (const parameterKey of parameterKeys()) {
            const perturbed = cloneParameters(parameters);
            const parameterValue = getParameterValue(perturbed, parameterKey);
            const epsilon = adaptiveFiniteDifferenceEpsilon(parameterValue);
            setParameterValue(perturbed, parameterKey, parameterValue + epsilon);

            const safeParameters = this.applyPhysicalConstraints(perturbed, evaluationOptions);
            const evaluation = await this.evaluate(safeParameters, targetImage, evaluationOptions);
            renderTimeMs += evaluation.render_time_ms;
            const gradientValue = (evaluation.loss - baselineLoss) / epsilon;

            setParameterValue(gradient, parameterKey, gradientValue);
            setParameterValue(adaptiveEpsilons, parameterKey, epsilon);
        }

        return {
            gradient,
            adaptiveEpsilons,
            renderTimeMs
        };
    }

    applyAdamStep(parameters, gradient, adamState, config, step) {
        const baseLearningRate = Math.max(1e-6, config.learning_rate ?? 0.03);
        const beta1 = config.adam_beta1 ?? 0.9;
        const beta2 = config.adam_beta2 ?? 0.999;
        const eps = config.adam_epsilon ?? 1e-8;
        const next = cloneParameters(parameters);

        for (const key of parameterKeys()) {
            const gradientValue = getParameterValue(gradient, key);
            const previousM = getParameterValue(adamState.m, key);
            const previousV = getParameterValue(adamState.v, key);
            const m = beta1 * previousM + (1 - beta1) * gradientValue;
            const v = beta2 * previousV + (1 - beta2) * gradientValue * gradientValue;
            setParameterValue(adamState.m, key, m);
            setParameterValue(adamState.v, key, v);

            const mHat = adamCorrection(m, beta1, step);
            const vHat = adamCorrection(v, beta2, step);
            const adaptiveRate = baseLearningRate / (Math.sqrt(vHat) + eps);
            const currentValue = getParameterValue(next, key);
            const updatedValue = currentValue - adaptiveRate * mHat;
            setParameterValue(next, key, updatedValue);
        }

        const sanitized = sanitizeParameters(next, config.clamp_enabled !== false);
        return this.applyPhysicalConstraints(sanitized, config.evaluation_options || {});
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
        config.evaluation_options = evaluationOptions;
        let currentParameters = this.applyPhysicalConstraints(
            sanitizeParameters(initialParameters, config.clamp_enabled !== false),
            evaluationOptions
        );
        const initialEvaluation = await this.evaluate(currentParameters, targetImage, evaluationOptions);
        const initialLoss = initialEvaluation.loss;
        let currentLoss = initialLoss;
        let finalEvaluation = initialEvaluation;
        let convergenceReason = 'max_iterations_reached';
        let stagnationCounter = 0;
        const gradientStopThreshold = 1e-4;
        const minimumLossImprovement = 1e-6;
        const stagnationLimit = 5;
        let totalRenderCalls = 1;

        const adamState = {
            m: createZeroLike(),
            v: createZeroLike()
        };

        for (let iteration = 1; iteration <= config.max_iterations; iteration += 1) {
            if (shouldContinue && !shouldContinue()) {
                convergenceReason = 'stopped_by_user';
                break;
            }

            const { gradient, adaptiveEpsilons, renderTimeMs: gradientRenderTimeMs } = await this.estimateGradient(
                currentParameters,
                currentLoss,
                targetImage,
                config,
                evaluationOptions
            );
            totalRenderCalls += parameterKeys().length;
            const gradientNorm = computeGradientNorm(gradient);

            if (gradientNorm < gradientStopThreshold) {
                const logEntry = this.logger.logIteration({
                    iteration,
                    loss: currentLoss,
                    delta_loss: 0,
                    parameters: currentParameters,
                    gradient_norm: gradientNorm,
                    render_time_ms: gradientRenderTimeMs,
                    adaptive_epsilons: adaptiveEpsilons
                });
                if (onIteration) {
                    onIteration(logEntry);
                }
                convergenceReason = 'gradient_norm_threshold';
                break;
            }

            const updatedParameters = this.applyPhysicalConstraints(
                this.applyAdamStep(currentParameters, gradient, adamState, config, iteration),
                evaluationOptions
            );
            const updatedEvaluation = await this.evaluate(updatedParameters, targetImage, evaluationOptions);
            totalRenderCalls += 1;
            const iterationRenderTime = gradientRenderTimeMs + updatedEvaluation.render_time_ms;
            const deltaLoss = currentLoss - updatedEvaluation.loss;
            currentParameters = updatedParameters;
            currentLoss = updatedEvaluation.loss;
            finalEvaluation = updatedEvaluation;
            stagnationCounter = deltaLoss < minimumLossImprovement ? stagnationCounter + 1 : 0;

            const logEntry = this.logger.logIteration({
                iteration,
                loss: updatedEvaluation.loss,
                delta_loss: deltaLoss,
                parameters: currentParameters,
                gradient_norm: gradientNorm,
                render_time_ms: iterationRenderTime,
                adaptive_epsilons: adaptiveEpsilons
            });

            if (onIteration) {
                onIteration(logEntry);
            }

            if (stagnationCounter >= stagnationLimit) {
                convergenceReason = 'loss_improvement_plateau';
                break;
            }
        }

        if (this.logger.getLogs().length >= config.max_iterations && convergenceReason === 'max_iterations_reached') {
            convergenceReason = 'max_iterations_reached';
        }

        return {
            initial_loss: initialLoss,
            final_parameters: currentParameters,
            logs: this.logger.getLogs(),
            total_time_ms: performance.now() - totalStart,
            final_evaluation_metrics: finalEvaluation.metrics,
            convergence_reason: convergenceReason,
            convergence_iteration: this.logger.getLogs().length > 0 ? this.logger.getLogs()[this.logger.getLogs().length - 1].iteration : null,
            total_render_calls: totalRenderCalls
        };
    }
}
