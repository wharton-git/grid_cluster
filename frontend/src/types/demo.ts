export type TestType = "health" | "info" | "cpu" | "latency" | "mixed" | "status";

export type Intensity = "low" | "medium" | "high";
export type BackendState = "idle" | "loading" | "ok" | "down";
export type AppRuntimeState =
	| "idle"
	| "test_running"
	| "monitoring"
	| "stop_requested";

export type FormState = {
	testType: TestType;
	durationMs: number;
	delayMs: number;
	intensity: Intensity;
	repeatCount: number;
	intervalMs: number;
};

export type RequestRecord = {
	id: string;
	testType: TestType;
	endpoint: string;
	paramsLabel: string;
	durationMs: number;
	statusCode: number;
	statusText: string;
	podName: string;
	timestamp: string;
	ok: boolean;
	response: unknown;
	errorMessage?: string;
	cancelled?: boolean;
};

export type StatusPayload = {
	podName: string;
	timestamp: string;
	requestCount: number;
	averageResponseTimeMs: number;
	errorCount: number;
	inFlightRequests: number;
	uptime: string;
	lastRequest: {
		method: string;
		path: string;
		statusCode: number;
		durationMs: number;
		timestamp: string | null;
		hasRecentValue: boolean;
	};
};

export type InfoPayload = {
	hostname: string;
	podName: string;
	pid: number;
	timestamp: string;
	version: string;
	uptime: string;
	environment: string;
	region: string;
	instanceId: string;
};

export type PodObservation = {
	podName: string;
	count: number;
	lastSeen: string;
	successRate: number;
	averageDurationMs: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const isStatusPayload = (value: unknown): value is StatusPayload =>
	isRecord(value) &&
	typeof value.podName === "string" &&
	typeof value.requestCount === "number" &&
	typeof value.averageResponseTimeMs === "number";

export const isInfoPayload = (value: unknown): value is InfoPayload =>
	isRecord(value) &&
	typeof value.hostname === "string" &&
	typeof value.podName === "string" &&
	typeof value.environment === "string";
