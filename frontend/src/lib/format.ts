const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
	dateStyle: "medium",
	timeStyle: "medium",
});

const compactDateFormatter = new Intl.DateTimeFormat("fr-FR", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

const decimalFormatter = new Intl.NumberFormat("fr-FR", {
	maximumFractionDigits: 2,
});

export const formatTimestamp = (timestamp: string) =>
	dateFormatter.format(new Date(timestamp));

export const formatCompactTimestamp = (timestamp: string) =>
	compactDateFormatter.format(new Date(timestamp));

export const formatDuration = (durationMs: number) =>
	durationMs >= 1000
		? `${(durationMs / 1000).toFixed(2)} s`
		: `${Math.round(durationMs)} ms`;

export const formatAverage = (durationMs: number) =>
	durationMs === 0 ? "0 ms" : formatDuration(durationMs);

export const formatPercentage = (value: number) =>
	`${Math.round(value * 100)}%`;

export const formatDecimal = (value: number, suffix?: string) => {
	const formatted = decimalFormatter.format(value);
	return suffix ? `${formatted} ${suffix}` : formatted;
};

export const formatBytes = (value: number | null | undefined) => {
	if (value == null || Number.isNaN(value)) {
		return "n/d";
	}

	if (value === 0) {
		return "0 B";
	}

	const units = ["B", "KB", "MB", "GB", "TB"];
	let size = value;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex += 1;
	}

	return `${decimalFormatter.format(size)} ${units[unitIndex]}`;
};

export const formatBytesPerSecond = (value: number | null | undefined) => {
	const formatted = formatBytes(value);
	return formatted === "n/d" ? formatted : `${formatted}/s`;
};

export const serializePayload = (payload: unknown) => {
	try {
		return JSON.stringify(payload, null, 2);
	} catch {
		return "Impossible d afficher la charge utile JSON.";
	}
};
