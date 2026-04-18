import type { PodObservation, RequestRecord } from "../types/demo";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
	dateStyle: "medium",
	timeStyle: "medium",
});

const compactDateFormatter = new Intl.DateTimeFormat("fr-FR", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
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

export const serializePayload = (payload: unknown) => {
	try {
		return JSON.stringify(payload, null, 2);
	} catch {
		return "Impossible d afficher la charge utile JSON.";
	}
};

export const summarizePods = (requests: RequestRecord[]): PodObservation[] => {
	const podMap = new Map<
		string,
		{
			count: number;
			successCount: number;
			totalDuration: number;
			lastSeen: string;
		}
	>();

	for (const request of requests) {
		if (
			!request.podName ||
			request.podName === "unreachable" ||
			request.podName === "cancelled"
		) {
			continue;
		}

		const current = podMap.get(request.podName) ?? {
			count: 0,
			successCount: 0,
			totalDuration: 0,
			lastSeen: request.timestamp,
		};

		current.count += 1;
		current.totalDuration += request.durationMs;
		current.successCount += request.ok ? 1 : 0;
		if (new Date(request.timestamp) > new Date(current.lastSeen)) {
			current.lastSeen = request.timestamp;
		}

		podMap.set(request.podName, current);
	}

	return Array.from(podMap.entries())
		.map(([podName, values]) => ({
			podName,
			count: values.count,
			lastSeen: values.lastSeen,
			successRate: values.count === 0 ? 0 : values.successCount / values.count,
			averageDurationMs:
				values.count === 0 ? 0 : values.totalDuration / values.count,
		}))
		.sort((left, right) => right.count - left.count);
};
