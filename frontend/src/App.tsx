import {
	useDeferredValue,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";
import { CircleAlert } from "lucide-react";
import heroImage from "./assets/hero.png";
import { AvailabilitySection } from "./components/AvailabilitySection";
import { BackendMonitoring } from "./components/BackendMonitoring";
import { CommandShowcase } from "./components/CommandShowcase";
import { ControlPanel } from "./components/ControlPanel";
import { HeroSection } from "./components/HeroSection";
import { ObservedPods } from "./components/ObservedPods";
import { OverviewCards } from "./components/OverviewCards";
import { RequestResults } from "./components/RequestResults";
import { runDemoRequest } from "./lib/api";
import { summarizePods } from "./lib/format";
import {
	type AppRuntimeState,
	type BackendState,
	type FormState,
	type InfoPayload,
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
const TEST_MONITORING_INTERVAL_MS = 500;
const BACKEND_CHECKS = ["health", "info", "status"] as const;

type RequestSource =
	| "user"
	| "manual_monitoring"
	| "temporary_monitoring"
	| "post_test_refresh";

type ManagedRequestKind = "test" | "monitoring";

type PerformRequestOptions = {
	logToMain?: boolean;
	surfaceErrors?: boolean;
	source?: RequestSource;
};

const getBackendStateFromRequest = (request: RequestRecord): BackendState => {
	if (request.statusCode === 0) {
		return "down";
	}

	return request.statusCode >= 500 ? "down" : "ok";
};

const isAbortError = (error: unknown) =>
	error instanceof DOMException && error.name === "AbortError";

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
	const monitoringInFlightRef = useRef(false);
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
			? "Actif (manuel 5s + test 0,5s)"
			: "Actif (manuel | 5s)"
		: isTemporaryMonitoring
			? "Actif (temporaire | 0,5s)"
			: "Arrete";
	const liveObservedPods = summarizePods([...requests, ...monitoringRequests]);
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
		[...requests, ...monitoringRequests].find(
			(request) => request.podName !== "unreachable",
		)?.podName ??
		null;

	const registerController = (kind: ManagedRequestKind, source: RequestSource) => {
		const id = crypto.randomUUID();
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

		setBackendState(getBackendStateFromRequest(request));

		if (request.ok && isStatusPayload(request.response)) {
			setLatestStatus(request.response);
		}

		if (request.ok && isInfoPayload(request.response)) {
			setLatestInfo(request.response);
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
			logToMain = true,
			surfaceErrors = true,
			source = logToMain ? "user" : "manual_monitoring",
		} = options;
		const managedRequest = registerController(
			logToMain ? "test" : "monitoring",
			source,
		);

		try {
			const request = await runDemoRequest(testType, form, {
				signal: managedRequest.controller.signal,
			});
			updateBackendSnapshot(request);

			if (!request.cancelled) {
				if (logToMain) {
					appendMainRequest(request);
				} else {
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

	const runBackendCheck = useEffectEvent(
		async ({
			surfaceErrors,
			stopOnNetworkFailure,
			source,
			showLoadingState,
		}: {
			surfaceErrors: boolean;
			stopOnNetworkFailure: boolean;
			source: RequestSource;
			showLoadingState: boolean;
		}) => {
			if (monitoringInFlightRef.current) {
				return false;
			}

			monitoringInFlightRef.current = true;
			setIsCheckingBackend(true);
			if (showLoadingState) {
				setBackendState("loading");
			}

			try {
				let hasCompletedRequest = false;

				for (const testType of BACKEND_CHECKS) {
					if (
						stopRequestedRef.current &&
						source !== "manual_monitoring"
					) {
						break;
					}

					const request = await performRequest(testType, {
						logToMain: false,
						surfaceErrors,
						source,
					});

					if (request.cancelled) {
						break;
					}

					hasCompletedRequest = true;

					if (stopOnNetworkFailure && request.statusCode === 0) {
						break;
					}
				}

				if (hasCompletedRequest) {
					setLastBackendCheckAt(new Date().toISOString());
				}
				return hasCompletedRequest;
			} finally {
				monitoringInFlightRef.current = false;
				setIsCheckingBackend(false);
			}
		}
	);

	useEffect(() => {
		if (!isMonitoringActive) {
			return;
		}

		const intervalMs = isTemporaryMonitoring
			? TEST_MONITORING_INTERVAL_MS
			: MANUAL_MONITORING_INTERVAL_MS;

		const intervalId = window.setInterval(() => {
			void runBackendCheck({
				surfaceErrors: false,
				stopOnNetworkFailure: true,
				source: isTemporaryMonitoring
					? "temporary_monitoring"
					: "manual_monitoring",
				showLoadingState: false,
			});
		}, intervalMs);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [isMonitoringActive, isTemporaryMonitoring, runBackendCheck]);

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
			void runBackendCheck({
				surfaceErrors: false,
				stopOnNetworkFailure: true,
				source: "temporary_monitoring",
				showLoadingState: false,
			});

			const request = await performRequest(form.testType, {
				source: "user",
			});

			if (!request.cancelled && !stopRequestedRef.current) {
				await runBackendCheck({
					surfaceErrors: false,
					stopOnNetworkFailure: true,
					source: "post_test_refresh",
					showLoadingState: false,
				});
			}
		} finally {
			setIsTemporaryMonitoring(false);
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
			await runBackendCheck({
				surfaceErrors: false,
				stopOnNetworkFailure: true,
				source: "temporary_monitoring",
				showLoadingState: false,
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

			if (!stopRequestedRef.current) {
				await runBackendCheck({
					surfaceErrors: false,
					stopOnNetworkFailure: true,
					source: "post_test_refresh",
					showLoadingState: false,
				});
			}
		} finally {
			setIsTemporaryMonitoring(false);
			setIsRunning(false);
			setSequenceProgress(null);
			setIsStopRequested(false);
			stopRequestedRef.current = false;
		}
	};

	const handleCheckBackend = async () => {
		await runBackendCheck({
			surfaceErrors: true,
			stopOnNetworkFailure: false,
			source: "manual_monitoring",
			showLoadingState: true,
		});
	};

	const handleToggleMonitoring = async () => {
		if (isMonitoring) {
			setIsMonitoring(false);
			return;
		}

		setIsMonitoring(true);
		await runBackendCheck({
			surfaceErrors: false,
			stopOnNetworkFailure: true,
			source: "manual_monitoring",
			showLoadingState: false,
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

	return (
		<div className="min-h-screen">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
				<HeroSection
					imageSrc={heroImage}
					backendState={backendState}
					observedPodCount={liveObservedPods.length}
					latestPodName={latestPodName}
					onPrimaryAction={handleRunSeries}
					onSecondaryAction={handleCheckBackend}
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

				<div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
					<div className="flex flex-col gap-6">
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
