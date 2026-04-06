export function createExampleExperimentConfig(imageId = 'example-image') {
    return {
        image_id: imageId,
        init_type: 'heuristic',
        max_iterations: 25,
        learning_rate: 0.04,
        epsilon: 0.01,
        clamp_enabled: true,
        seed: 7
    };
}

export async function runExampleExperiment(runner, imageId) {
    const config = createExampleExperimentConfig(imageId);
    return runner.runExperiment(config);
}

export async function runExampleAblation(runner, imageId) {
    return runner.runAblation(imageId, createExampleExperimentConfig(imageId));
}

export function createExampleExportedJson() {
    return {
        experiment_config: {
            image_id: 'sample-metal-panel',
            init_type: 'heuristic',
            max_iterations: 25,
            learning_rate: 0.04,
            epsilon: 0.01,
            clamp_enabled: true,
            seed: 7
        },
        metrics: {
            final_loss: 0.0124,
            initial_loss: 0.0432,
            loss_reduction_ratio: 0.7129,
            total_iterations: 25,
            total_time_ms: 942.6,
            avg_time_per_iteration: 37.7,
            convergence_iteration: 19,
            gradient_final_norm: 0.0841
        },
        logs: [
            {
                iteration: 1,
                loss: 0.0408,
                delta_loss: 0.0024,
                parameters: {
                    albedo: [0.48, 0.49, 0.5],
                    roughness: 0.58,
                    metallic: 0.21
                },
                gradient_norm: 0.552,
                render_time_ms: 35.1
            }
        ],
        convergence_curve: {
            loss_vs_iteration: [0.0408, 0.0361, 0.0324, 0.0293, 0.0268],
            gradient_norm_vs_iteration: [0.552, 0.441, 0.331, 0.208, 0.141]
        }
    };
}
