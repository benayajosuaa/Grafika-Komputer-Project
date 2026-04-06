export class ExperimentLogger {
    constructor() {
        this.experimentLog = [];
    }

    reset() {
        this.experimentLog.length = 0;
    }

    logIteration(entry) {
        const clonedEntry = {
            iteration: entry.iteration,
            loss: entry.loss,
            delta_loss: entry.delta_loss,
            parameters: {
                albedo: [...entry.parameters.albedo],
                roughness: entry.parameters.roughness,
                metallic: entry.parameters.metallic
            },
            gradient_norm: entry.gradient_norm,
            render_time_ms: entry.render_time_ms
        };

        this.experimentLog.push(clonedEntry);
        return clonedEntry;
    }

    getLogs() {
        return this.experimentLog.map((entry) => ({
            ...entry,
            parameters: {
                albedo: [...entry.parameters.albedo],
                roughness: entry.parameters.roughness,
                metallic: entry.parameters.metallic
            }
        }));
    }

    exportAsJson() {
        return JSON.stringify(this.getLogs(), null, 2);
    }
}
