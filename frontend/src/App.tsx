import {
	useDeferredValue,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";
import { CircleAlert } from "lucide-react";
import { AvailabilitySection } from "./components/AvailabilitySection";
import { BackendMonitoring } from "./components/BackendMonitoring";
import { CommandShowcase } from "./components/CommandShowcase";
import { ControlPanel } from "./components/ControlPanel";
import { HeroSection } from "./components/HeroSection";
import { ObservedPods } from "./components/ObservedPods";
import { OverviewCards } from "./components/OverviewCards";
import { RequestResults } from "./components/RequestResults";
import { runDemoRequest } from "./lib/api";
import { createClientId } from "./lib/id";
import {
	type AppRuntimeState,
	type BackendState,
	type FormState,
	type InfoPayload,
	type PodObservation,
	type RequestRecord,
	type StatusPayload,
	isInfoPayload,
	isStatusPayload,
} from "./types/demo";

const initialForm: FormState = {
	testType: "cpu",
	durationMs: 5000,
	delayMs: 1000,
	intensity: "medium",
	repeatCount: 6,
	intervalMs: 250,
};

const MAIN_REQUEST_LIMIT = 20;
const MONITORING_REQUEST_LIMIT = 9;
const MANUAL_MONITORING_INTERVAL_MS = 5000;
const TEST_STATUS_MONITORING_INTERVAL_MS = 100;
const TEST_META_MONITORING_INTERVAL_MS = 4000;
const BACKEND_CHECKS = ["health", "info", "status"] as const;
const TEST_META_BACKEND_CHECKS = ["health", "info"] as const;

type BackendCheckType = (typeof BACKEND_CHECKS)[number];
type RequestLogMode = "main" | "monitoring" | "silent";

type RequestSource =
	| "user"
	| "manual_check"
	| "manual_monitoring"
	| "temporary_monitoring"
	| "post_test_refresh";

type ManagedRequestKind = "test" | "monitoring";

type PerformRequestOptions = {
	logMode?: RequestLogMode;
	surfaceErrors?: boolean;
	source?: RequestSource;
};

type RefreshRequestOptions = {
	source: RequestSource;
	surfaceErrors?: boolean;
	logMode?: RequestLogMode;
	reuseInFlight?: boolean;
};

type RefreshBackendSnapshotOptions = {
	source: RequestSource;
	surfaceErrors?: boolean;
	stopOnNetworkFailure?: boolean;
	showLoadingState?: boolean;
	trackCheckingState?: boolean;
	sections?: ReadonlyArray<BackendCheckType>;
	perSectionLogMode?: Partial<Record<BackendCheckType, RequestLogMode>>;
	reuseInFlight?: boolean;
};

const getBackendStateFromRequest = (request: RequestRecord): BackendState => {
	if (request.statusCode === 0) {
		return "down";
	}

	return request.statusCode >= 500 ? "down" : "ok";
};

const isAbortError = (error: unknown) =>
	error instanceof DOMException && error.name === "AbortError";

const isStopSensitiveSource = (source: RequestSource) =>
	source === "temporary_monitoring" || source === "post_test_refresh";

const isTrackablePodName = (
	podName: string | null | undefined,
): podName is string =>
	Boolean(
		podName &&
			podName !== "unreachable" &&
			podName !== "cancelled" &&
			podName !== "unknown",
	);

const getMostRecentTimestamp = (currentTimestamp: string | null, nextTimestamp: string) => {
	if (!currentTimestamp) {
		return nextTimestamp;
	}

	return new Date(nextTimestamp).getTime() > new Date(currentTimestamp).getTime()
		? nextTimestamp
		: currentTimestamp;
};

const sleepWithSignal = (durationMs: number, signal: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		if (signal.aborted) {
			reject(new DOMException("Aborted", "AbortError"));
			return;
		}

		const timeoutId = window.setTimeout(() => {
			signal.removeEventListener("abort", handleAbort);
			resolve();
		}, durationMs);

		const handleAbort = () => {
			window.clearTimeout(timeoutId);
			signal.removeEventListener("abort", handleAbort);
			reject(new DOMException("Aborted", "AbortError"));
		};

		signal.addEventListener("abort", handleAbort, { once: true });
	});

const getRuntimeState = (
	isRunning: boolean,
	isMonitoringActive: boolean,
	isStopRequested: boolean,
): AppRuntimeState => {
	if (isStopRequested) {
		return "stop_requested";
	}

	if (isRunning) {
		return "test_running";
	}

	if (isMonitoringActive) {
		return "monitoring";
	}

	return "idle";
};

function App() {
	const [form, setForm] = useState<FormState>(initialForm);
	const [requests, setRequests] = useState<RequestRecord[]>([]);
	const [monitoringRequests, setMonitoringRequests] = useState<RequestRecord[]>([]);
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [isCheckingBackend, setIsCheckingBackend] = useState(false);
	const [isMonitoring, setIsMonitoring] = useState(false);
	const [isTemporaryMonitoring, setIsTemporaryMonitoring] = useState(false);
	const [isStopRequested, setIsStopRequested] = useState(false);
	const [sequenceProgress, setSequenceProgress] = useState<{
		completed: number;
		total: number;
	} | null>(null);
	const [backendState, setBackendState] = useState<BackendState>("idle");
	const [notice, setNotice] = useState<string | null>(null);
	const [latestStatus, setLatestStatus] = useState<StatusPayload | null>(null);
	const [latestInfo, setLatestInfo] = useState<InfoPayload | null>(null);
	const [lastBackendCheckAt, setLastBackendCheckAt] = useState<string | null>(null);
	const [observedPodsByName, setObservedPodsByName] = useState<
		Record<string, PodObservation>
	>({});
	const backendRefreshInFlightRef = useRef<
		Record<BackendCheckType, Promise<RequestRecord | null> | null>
	>({
		health: null,
		info: null,
		status: null,
	});
	const stopRequestedRef = useRef(false);
	const activeControllersRef = useRef(
		new Map<
			string,
			{
				controller: AbortController;
				kind: ManagedRequestKind;
				source: RequestSource;
			}
		>(),
	);

	const deferredRequests = useDeferredValue(requests);
	const deferredMonitoringRequests = useDeferredValue(monitoringRequests);
	const isMonitoringActive = isMonitoring || isTemporaryMonitoring;
	const appRuntimeState = getRuntimeState(
		isRunning,
		isMonitoringActive,
		isStopRequested,
	);
	const monitoringModeLabel = isMonitoring
		? isTemporaryMonitoring
			? "Actif (manuel 5s + test status 0,9s)"
			: "Actif (manuel | 5s)"
		: isTemporaryMonitoring
			? "Actif (test status 0,9s | meta 4s)"
			: "Arrete";
	const observedPods = Object.values(observedPodsByName);
	const liveObservedPods = [...observedPods].sort((left, right) => {
		const requestCountDifference =
			(right.requestCount ?? -1) - (left.requestCount ?? -1);

		if (requestCountDifference !== 0) {
			return requestCountDifference;
		}

		return new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime();
	});
	const mostRecentlySeenPod = observedPods.reduce<PodObservation | null>(
		(currentLatest, pod) => {
			if (!currentLatest) {
				return pod;
			}

			return new Date(pod.lastSeen).getTime() >
				new Date(currentLatest.lastSeen).getTime()
				? pod
				: currentLatest;
		},
		null,
	);
	const selectedRequest =
		deferredRequests.find((request) => request.id === selectedRequestId) ??
		deferredRequests[0] ??
		null;

	const successfulRequests = requests.filter((request) => request.ok);
	const averageClientLatencyMs =
		successfulRequests.length === 0
			? 0
			: successfulRequests.reduce(
				(total, request) => total + request.durationMs,
				0,
			) / successfulRequests.length;
	const latestPodName =
		latestStatus?.podName ??
		latestInfo?.podName ??
		mostRecentlySeenPod?.podName ??
		null;

	const registerController = (kind: ManagedRequestKind, source: RequestSource) => {
		const id = createClientId();
		const controller = new AbortController();
		activeControllersRef.current.set(id, { controller, kind, source });

		return {
			controller,
			cleanup: () => {
				activeControllersRef.current.delete(id);
			},
		};
	};

	const abortActiveControllers = (
		predicate: (entry: {
			controller: AbortController;
			kind: ManagedRequestKind;
			source: RequestSource;
		}) => boolean,
	) => {
		for (const [id, entry] of activeControllersRef.current.entries()) {
			if (!predicate(entry)) {
				continue;
			}

			entry.controller.abort();
			activeControllersRef.current.delete(id);
		}
	};

	const updateBackendSnapshot = (request: RequestRecord) => {
		if (request.cancelled) {
			return;
		}

		const statusPayload =
			request.ok && isStatusPayload(request.response) ? request.response : null;
		const infoPayload =
			request.ok && isInfoPayload(request.response) ? request.response : null;
		const podName = statusPayload?.podName ?? infoPayload?.podName ?? request.podName;
		const lastSeenAt =
			statusPayload?.timestamp ?? infoPayload?.timestamp ?? request.timestamp;

		if (isTrackablePodName(podName)) {
			setObservedPodsByName((current) => {
				const previous = current[podName];

				return {
					...current,
					[podName]: {
						podName,
						requestCount: statusPayload?.requestCount ?? previous?.requestCount ?? null,
						inFlightRequests:
							statusPayload?.inFlightRequests ?? previous?.inFlightRequests ?? null,
						errorCount: statusPayload?.errorCount ?? previous?.errorCount ?? null,
						averageResponseTimeMs:
							statusPayload?.averageResponseTimeMs ??
							previous?.averageResponseTimeMs ??
							null,
						lastSeen: getMostRecentTimestamp(previous?.lastSeen ?? null, lastSeenAt),
						hasBackendSnapshot:
							statusPayload !== null || previous?.hasBackendSnapshot === true,
					},
				};
			});
		}

		setBackendState(getBackendStateFromRequest(request));

		if (statusPayload) {
			setLatestStatus(statusPayload);
		}

		if (infoPayload) {
			setLatestInfo(infoPayload);
		}
	};

	const appendMainRequest = (request: RequestRecord) => {
		setRequests((current) => [request, ...current].slice(0, MAIN_REQUEST_LIMIT));
		setSelectedRequestId((current) => current ?? request.id);
	};

	const appendMonitoringRequest = (request: RequestRecord) => {
		setMonitoringRequests((current) =>
			[request, ...current].slice(0, MONITORING_REQUEST_LIMIT),
		);
	};

	const performRequest = async (
		testType: FormState["testType"],
		options: PerformRequestOptions = {},
	) => {
		const {
			logMode = "main",
			surfaceErrors = true,
			source = logMode === "main" ? "user" : "manual_monitoring",
		} = options;
		const managedRequest = registerController(
			logMode === "main" ? "test" : "monitoring",
			source,
		);

		try {
			const request = await runDemoRequest(testType, form, {
				signal: managedRequest.controller.signal,
			});
			updateBackendSnapshot(request);

			if (!request.cancelled) {
				if (logMode === "main") {
					appendMainRequest(request);
				}

				if (logMode === "monitoring") {
					appendMonitoringRequest(request);
				}
			}

			if (!surfaceErrors || request.cancelled) {
				return request;
			}

			if (request.ok) {
				setNotice(null);
			} else if (request.statusCode === 0) {
				setNotice("Le backend est indisponible ou non joignable depuis le frontend.");
			} else {
				setNotice(request.errorMessage ?? "La requete a echoue.");
			}

			return request;
		} finally {
			managedRequest.cleanup();
		}
	};

	const runManagedBackendRefresh = (
		testType: BackendCheckType,
		{
			source,
			surfaceErrors = false,
			logMode,
			reuseInFlight = true,
		}: RefreshRequestOptions,
	) => {
		if (stopRequestedRef.current && isStopSensitiveSource(source)) {
			return Promise.resolve(null);
		}

		const inFlightRequest = backendRefreshInFlightRef.current[testType];
		if (inFlightRequest) {
			return reuseInFlight ? inFlightRequest : Promise.resolve(null);
		}

		const refreshPromise = performRequest(testType, {
			logMode:
				logMode ??
				(source === "manual_monitoring" || source === "manual_check"
					? "monitoring"
					: "silent"),
			surfaceErrors,
			source,
		})
			.then((request) => {
				if (!request.cancelled) {
					setLastBackendCheckAt(new Date().toISOString());
				}

				return request;
			})
			.finally(() => {
				backendRefreshInFlightRef.current[testType] = null;
			});

		backendRefreshInFlightRef.current[testType] = refreshPromise;
		return refreshPromise;
	};

	const refreshStatusRequest = (options: RefreshRequestOptions) =>
		runManagedBackendRefresh("status", options);

	const refreshInfoRequest = (options: RefreshRequestOptions) =>
		runManagedBackendRefresh("info", options);

	const refreshHealthRequest = (options: RefreshRequestOptions) =>
		runManagedBackendRefresh("health", options);

	const refreshBackendSnapshotRequest = async ({
		source,
		surfaceErrors = false,
		stopOnNetworkFailure = true,
		showLoadingState = false,
		trackCheckingState = false,
		sections = BACKEND_CHECKS,
		perSectionLogMode = {},
		reuseInFlight = true,
	}: RefreshBackendSnapshotOptions) => {
		if (stopRequestedRef.current && isStopSensitiveSource(source)) {
			return false;
		}

		if (trackCheckingState) {
			setIsCheckingBackend(true);
		}
		if (showLoadingState) {
			setBackendState("loading");
		}

		try {
			let hasCompletedRequest = false;

			for (const testType of sections) {
				if (stopRequestedRef.current && isStopSensitiveSource(source)) {
					break;
				}

				const request =
					testType === "status"
						? await refreshStatusRequest({
							source,
							surfaceErrors,
							logMode: perSectionLogMode.status,
							reuseInFlight,
						})
						: testType === "info"
							? await refreshInfoRequest({
								source,
								surfaceErrors,
								logMode: perSectionLogMode.info,
								reuseInFlight,
							})
							: await refreshHealthRequest({
								source,
								surfaceErrors,
								logMode: perSectionLogMode.health,
								reuseInFlight,
							});

				if (!request) {
					continue;
				}

				if (request.cancelled) {
					break;
				}

				hasCompletedRequest = true;

				if (stopOnNetworkFailure && request.statusCode === 0) {
					break;
				}
			}

			return hasCompletedRequest;
		} finally {
			if (trackCheckingState) {
				setIsCheckingBackend(false);
			}
		}
	};

	const refreshStatus = useEffectEvent(
		async (options: RefreshRequestOptions) => refreshStatusRequest(options),
	);

	const refreshBackendSnapshot = useEffectEvent(
		async (options: RefreshBackendSnapshotOptions) =>
			refreshBackendSnapshotRequest(options),
	);

	useEffect(() => {
		if (!isMonitoring) {
			return;
		}

		const intervalId = window.setInterval(() => {
			void refreshBackendSnapshot({
				source: "manual_monitoring",
				surfaceErrors: false,
				stopOnNetworkFailure: true,
				sections: BACKEND_CHECKS,
				perSectionLogMode: {
					health: "monitoring",
					info: "monitoring",
					status: "monitoring",
				},
				reuseInFlight: false,
			});
		}, MANUAL_MONITORING_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [isMonitoring]);

	useEffect(() => {
		if (!isTemporaryMonitoring) {
			return;
		}

		const intervalId = window.setInterval(() => {
			void refreshStatus({
				source: "temporary_monitoring",
				surfaceErrors: false,
				logMode: "silent",
				reuseInFlight: false,
			});
		}, TEST_STATUS_MONITORING_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [isTemporaryMonitoring]);

	useEffect(() => {
		if (!isTemporaryMonitoring) {
			return;
		}

		const intervalId = window.setInterval(() => {
			void refreshBackendSnapshot({
				source: "temporary_monitoring",
				surfaceErrors: false,
				stopOnNetworkFailure: true,
				sections: TEST_META_BACKEND_CHECKS,
				perSectionLogMode: {
					health: "silent",
					info: "silent",
				},
				reuseInFlight: false,
			});
		}, TEST_META_MONITORING_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [isTemporaryMonitoring]);

	useEffect(() => {
		return () => {
			abortActiveControllers(() => true);
		};
	}, []);

	const handleRunSingle = async () => {
		stopRequestedRef.current = false;
		setIsStopRequested(false);
		setIsRunning(true);
		setIsTemporaryMonitoring(true);
		setSequenceProgress(null);
		setNotice(null);

		try {
			void refreshStatusRequest({
				source: "temporary_monitoring",
				surfaceErrors: false,
				logMode: "silent",
				reuseInFlight: false,
			});

			const request = await performRequest(form.testType, {
				source: "user",
			});

			setIsTemporaryMonitoring(false);
			abortActiveControllers(
				(entry) => entry.source === "temporary_monitoring",
			);

			if (!request.cancelled && !stopRequestedRef.current) {
				await refreshBackendSnapshotRequest({
					surfaceErrors: false,
					stopOnNetworkFailure: true,
					source: "post_test_refresh",
					sections: BACKEND_CHECKS,
					perSectionLogMode: {
						health: "silent",
						info: "silent",
						status: "silent",
					},
				});
			}
		} finally {
			setIsTemporaryMonitoring(false);
			abortActiveControllers(
				(entry) => entry.source === "temporary_monitoring",
			);
			setIsRunning(false);
			setIsStopRequested(false);
			stopRequestedRef.current = false;
		}
	};

	const handleRunSeries = async () => {
		stopRequestedRef.current = false;
		setIsStopRequested(false);
		setIsRunning(true);
		setIsTemporaryMonitoring(true);
		setSequenceProgress({ completed: 0, total: form.repeatCount });
		setNotice(null);

		try {
			await refreshStatusRequest({
				source: "temporary_monitoring",
				surfaceErrors: false,
				logMode: "silent",
			});

			for (let index = 0; index < form.repeatCount; index += 1) {
				if (stopRequestedRef.current) {
					break;
				}

				const request = await performRequest(form.testType, {
					source: "user",
				});
				if (request.cancelled || stopRequestedRef.current) {
					break;
				}

				setSequenceProgress({
					completed: index + 1,
					total: form.repeatCount,
				});

				if (index < form.repeatCount - 1 && form.intervalMs > 0) {
					const pauseController = registerController("test", "user");

					try {
						await sleepWithSignal(form.intervalMs, pauseController.controller.signal);
					} catch (error) {
						if (!isAbortError(error)) {
							throw error;
						}
						break;
					} finally {
						pauseController.cleanup();
					}
				}
			}

			setIsTemporaryMonitoring(false);
			abortActiveControllers(
				(entry) => entry.source === "temporary_monitoring",
			);

			if (!stopRequestedRef.current) {
				await refreshBackendSnapshotRequest({
					surfaceErrors: false,
					stopOnNetworkFailure: true,
					source: "post_test_refresh",
					sections: BACKEND_CHECKS,
					perSectionLogMode: {
						health: "silent",
						info: "silent",
						status: "silent",
					},
				});
			}
		} finally {
			setIsTemporaryMonitoring(false);
			abortActiveControllers(
				(entry) => entry.source === "temporary_monitoring",
			);
			setIsRunning(false);
			setSequenceProgress(null);
			setIsStopRequested(false);
			stopRequestedRef.current = false;
		}
	};

	const handleCheckBackend = async () => {
		await refreshBackendSnapshotRequest({
			surfaceErrors: true,
			stopOnNetworkFailure: false,
			source: "manual_check",
			showLoadingState: true,
			trackCheckingState: true,
			sections: BACKEND_CHECKS,
			perSectionLogMode: {
				health: "monitoring",
				info: "monitoring",
				status: "monitoring",
			},
		});
	};

	const handleToggleMonitoring = async () => {
		if (isMonitoring) {
			setIsMonitoring(false);
			abortActiveControllers(
				(entry) => entry.source === "manual_monitoring",
			);
			return;
		}

		setIsMonitoring(true);
		await refreshBackendSnapshotRequest({
			surfaceErrors: false,
			stopOnNetworkFailure: true,
			source: "manual_monitoring",
			sections: BACKEND_CHECKS,
			perSectionLogMode: {
				health: "monitoring",
				info: "monitoring",
				status: "monitoring",
			},
		});
	};

	const handleStopTests = () => {
		if (!isRunning) {
			return;
		}

		stopRequestedRef.current = true;
		setIsStopRequested(true);
		setIsTemporaryMonitoring(false);
		setNotice("Arret manuel demande. Les tests en cours sont interrompus.");

		abortActiveControllers(
			(entry) =>
				entry.kind === "test" ||
				entry.source === "temporary_monitoring" ||
				entry.source === "post_test_refresh",
		);
	};

	const scrollToId = (id: string) => {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	return (
		<div className="min-h-screen">
			<div className="mx-auto flex w-full max-w-3/4 flex-col gap-8 px-6 py-8">
				<HeroSection
					backendState={backendState}
					observedPodCount={liveObservedPods.length}
					latestPodName={latestPodName}
					onPrimaryAction={() => {
						scrollToId("test-section");
					}}
					onSecondaryAction={() => {
						scrollToId("backend-section");
					}}
				/>

				{notice ? (
					<div className="alert border border-error/20 bg-error/10 text-error">
						<CircleAlert className="size-5" />
						<span>{notice}</span>
					</div>
				) : null}

				<OverviewCards
					backendState={backendState}
					latestStatus={latestStatus}
					latestInfo={latestInfo}
					observedPodCount={liveObservedPods.length}
					loggedRequestCount={requests.length}
					averageClientLatencyMs={averageClientLatencyMs}
					latestPodName={latestPodName}
					isRunning={isRunning}
					isMonitoringActive={isMonitoringActive}
					appRuntimeState={appRuntimeState}
				/>

				<div className="grid grid-cols-[1.02fr_0.98fr] gap-6">
					<div className="flex flex-col gap-6">
						<div id="test-section" className="scroll-mt-24">
							<ControlPanel
								form={form}
								isRunning={isRunning}
								sequenceProgress={sequenceProgress}
								isStopRequested={isStopRequested}
								onChange={(partial) =>
									setForm((current) => ({
										...current,
										...partial,
									}))
								}
								onRunSingle={handleRunSingle}
								onRunSeries={handleRunSeries}
								onStopTests={handleStopTests}
							/>
						</div>
						<div id="backend-section" className="scroll-mt-24">
							<BackendMonitoring
								backendState={backendState}
								appRuntimeState={appRuntimeState}
								isCheckingBackend={isCheckingBackend}
								isManualMonitoringEnabled={isMonitoring}
								isMonitoringActive={isMonitoringActive}
								monitoringModeLabel={monitoringModeLabel}
								isStopRequested={isStopRequested}
								monitoringRequests={deferredMonitoringRequests}
								lastBackendCheckAt={lastBackendCheckAt}
								latestInfo={latestInfo}
								latestStatus={latestStatus}
								onCheckBackend={handleCheckBackend}
								onToggleMonitoring={() => {
									void handleToggleMonitoring();
								}}
							/>
						</div>
					</div>
					<ObservedPods pods={liveObservedPods} />
				</div>

				<RequestResults
					requests={deferredRequests}
					selectedRequestId={selectedRequest?.id ?? null}
					onSelectRequest={setSelectedRequestId}
				/>

				<AvailabilitySection />
				<CommandShowcase />
			</div>
		</div>
	);
}

export default App;
