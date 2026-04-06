export async function exampleSingleExperiment(runner, imageId) {
    return runner.runSingleExperiment({
        image_id: imageId,
        init_type: 'heuristic',
        max_iterations: 30,
        learning_rate: 0.04,
        epsilon: 0.01,
        clamp_enabled: true,
        seed: 11
    });
}

export async function exampleAblationRun(runner, imageId) {
    return runner.runAblation(imageId, {
        max_iterations: 30,
        learning_rate: 0.04,
        epsilon: 0.01,
        clamp_enabled: true,
        seed: 11
    });
}

export async function exampleBatchRun(runner, imageIds) {
    return runner.runBatch(imageIds, {
        init_type: 'heuristic',
        max_iterations: 20,
        learning_rate: 0.04,
        epsilon: 0.01,
        clamp_enabled: true,
        seed: 11
    });
}

export async function examplePaperWorkflow(runner, imageId) {
    const ablation = await runner.runAblation(imageId, {
        max_iterations: 30,
        learning_rate: 0.04,
        epsilon: 0.01,
        clamp_enabled: true,
        seed: 11
    });

    const exported = runner.exportResults(ablation.runs.heuristic);
    return {
        ablation,
        exported
    };
}
