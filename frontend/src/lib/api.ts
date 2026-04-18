import axios from "axios";
import type { FormState, RequestRecord, TestType } from "../types/demo";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

type EndpointDescriptor = {
	path: string;
	params: Record<string, string>;
};

const buildEndpoint = (
	testType: TestType,
	form: FormState,
): EndpointDescriptor => {
	switch (testType) {
		case "health":
			return { path: "/api/health", params: {} };
		case "info":
			return { path: "/api/info", params: {} };
		case "status":
			return { path: "/api/status", params: {} };
		case "cpu":
			return {
				path: "/api/load/cpu",
				params: {
					duration: String(form.durationMs),
					intensity: form.intensity,
				},
			};
		case "latency":
			return {
				path: "/api/load/latency",
				params: {
					delay: String(form.delayMs),
				},
			};
		case "mixed":
			return {
				path: "/api/load/mixed",
				params: {
					duration: String(form.durationMs),
					delay: String(form.delayMs),
					intensity: form.intensity,
				},
			};
	}
};

const buildEndpointLabel = (path: string, params: Record<string, string>) => {
	const searchParams = new URLSearchParams(params);
	const queryString = searchParams.toString();
	return queryString === "" ? path : `${path}?${queryString}`;
};

const buildTimeout = (testType: TestType, form: FormState) => {
	switch (testType) {
		case "cpu":
			return Math.max(15_000, form.durationMs + 10_000);
		case "latency":
			return Math.max(15_000, form.delayMs + 10_000);
		case "mixed":
			return Math.max(20_000, form.durationMs + form.delayMs + 10_000);
		default:
			return 10_000;
	}
};

const getTimestamp = (payload: unknown) => {
	if (
		typeof payload === "object" &&
		payload !== null &&
		"timestamp" in payload &&
		typeof payload.timestamp === "string"
	) {
		return payload.timestamp;
	}

	return new Date().toISOString();
};

const getPodName = (payload: unknown, headerValue: string | undefined) => {
	if (headerValue) {
		return headerValue;
	}

	if (
		typeof payload === "object" &&
		payload !== null &&
		"podName" in payload &&
		typeof payload.podName === "string"
	) {
		return payload.podName;
	}

	if (
		typeof payload === "object" &&
		payload !== null &&
		"hostname" in payload &&
		typeof payload.hostname === "string"
	) {
		return payload.hostname;
	}

	return "unknown";
};

const buildParamsLabel = (params: Record<string, string>) => {
	const entries = Object.entries(params);
	if (entries.length === 0) {
		return "Aucun parametre";
	}

	return entries.map(([key, value]) => `${key}=${value}`).join(" | ");
};

export const runDemoRequest = async (
	testType: TestType,
	form: FormState,
	options?: {
		signal?: AbortSignal;
	},
): Promise<RequestRecord> => {
	const { path, params } = buildEndpoint(testType, form);
	const endpoint = buildEndpointLabel(path, params);
	const startedAt = performance.now();

	try {
		const response = await axios.get(`${API_BASE_URL}${path}`, {
			params,
			timeout: buildTimeout(testType, form),
			signal: options?.signal,
			headers: {
				Accept: "application/json",
			},
		});
		const durationMs = Math.round(performance.now() - startedAt);

		return {
			id: crypto.randomUUID(),
			testType,
			endpoint,
			paramsLabel: buildParamsLabel(params),
			durationMs,
			statusCode: response.status,
			statusText: response.statusText,
			podName: getPodName(response.data, response.headers["x-pod-name"]),
			timestamp: getTimestamp(response.data),
			ok: true,
			response: response.data,
		};
	} catch (error) {
		const durationMs = Math.round(performance.now() - startedAt);

		if (axios.isAxiosError(error)) {
			if (error.code === "ERR_CANCELED") {
				return {
					id: crypto.randomUUID(),
					testType,
					endpoint,
					paramsLabel: buildParamsLabel(params),
					durationMs,
					statusCode: 0,
					statusText: "Cancelled",
					podName: "cancelled",
					timestamp: new Date().toISOString(),
					ok: false,
					response: {
						error: "cancelled",
						message: "La requete a ete annulee.",
					},
					errorMessage: "La requete a ete annulee.",
					cancelled: true,
				};
			}

			const payload = error.response?.data ?? {
				error: "network_error",
				message: error.message,
			};

			return {
				id: crypto.randomUUID(),
				testType,
				endpoint,
				paramsLabel: buildParamsLabel(params),
				durationMs,
				statusCode: error.response?.status ?? 0,
				statusText: error.response?.statusText ?? "Network error",
				podName: error.response
					? getPodName(payload, error.response.headers["x-pod-name"])
					: "unreachable",
				timestamp: getTimestamp(payload),
				ok: false,
				response: payload,
				errorMessage:
					typeof payload === "object" &&
					payload !== null &&
					"message" in payload &&
					typeof payload.message === "string"
						? payload.message
						: error.message,
			};
		}

		return {
			id: crypto.randomUUID(),
			testType,
			endpoint,
			paramsLabel: buildParamsLabel(params),
			durationMs,
			statusCode: 0,
			statusText: "Unknown error",
			podName: "unreachable",
			timestamp: new Date().toISOString(),
			ok: false,
			response: {
				error: "unknown_error",
				message: "Une erreur inattendue est survenue.",
			},
			errorMessage: "Une erreur inattendue est survenue.",
		};
	}
};
