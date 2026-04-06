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

        return JSON.stringify({
            config: result.config || result.experiment_config,
            metrics: result.metrics,
            logs: result.logs,
            convergence_curve: result.convergence_curve,
            status: result.status
        }, null, 2);
    }

    exportResultsCsv(results) {
        const header = ['image_id', 'method', 'final_loss', 'iterations', 'time', 'convergence_iteration'];
        const rows = results.map((result) => buildCsvRow([
            result.config.image_id,
            result.config.init_type,
            result.metrics.final_loss,
            result.metrics.total_iterations,
            result.metrics.total_time_ms,
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
