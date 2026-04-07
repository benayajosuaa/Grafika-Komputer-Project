function buildCsvRow(values) {
    return values.map((value) => {
        const serialized = value == null ? '' : String(value);
        return `"${serialized.replace(/"/g, '""')}"`;
    }).join(',');
}

export class ExperimentExporter {
    exportExperimentResults(result, format = 'json') {
        if (format === 'csv') {
            return this.exportResultsCsv([result]);
        }

        const metrics = result.metrics || {};
        return JSON.stringify({
            image_id: result.config.image_id,
            method: result.config.init_type,
            metrics: result.metrics,
            summary_metrics: {
                final_loss: metrics.final_loss,
                total_iterations: metrics.total_iterations,
                total_runtime: metrics.total_runtime_ms,
                convergence_iteration: metrics.convergence_iteration,
                loss_drop_percentage: metrics.loss_drop_percentage
            },
            logs: result.logs,
            loss_curve: result.convergence_curve.loss_vs_iteration,
            convergence_curve: result.convergence_curve,
            status: result.status
        }, null, 2);
    }

    exportResultsCsv(results) {
        const header = ['image_id', 'method', 'final_loss', 'iterations', 'runtime', 'convergence_iteration'];
        const rows = results.map((result) => buildCsvRow([
            result.config.image_id,
            result.config.init_type,
            result.metrics.final_loss,
            result.metrics.total_iterations,
            result.metrics.total_runtime_ms,
            result.metrics.convergence_iteration
        ]));

        return [buildCsvRow(header), ...rows].join('\n');
    }

    downloadTextFile(content, filename, mimeType = 'application/json') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}
