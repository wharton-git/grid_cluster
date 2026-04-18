import {
	startTransition,
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

const sleep = (durationMs: number) =>
	new Promise((resolve) => {
		window.setTimeout(resolve, durationMs);
	});

const MAIN_REQUEST_LIMIT = 20;
const MONITORING_REQUEST_LIMIT = 9;
const MONITORING_INTERVAL_MS = 8000;
const BACKEND_CHECKS = ["health", "info", "status"] as const;

type PerformRequestOptions = {
	logToMain?: boolean;
	surfaceErrors?: boolean;
};

const getBackendStateFromRequest = (request: RequestRecord): BackendState => {
	if (request.statusCode === 0) {
		return "down";
	}

	return request.statusCode >= 500 ? "down" : "ok";
};

function App() {
	const [form, setForm] = useState<FormState>(initialForm);
	const [requests, setRequests] = useState<RequestRecord[]>([]);
	const [monitoringRequests, setMonitoringRequests] = useState<RequestRecord[]>([]);
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [isCheckingBackend, setIsCheckingBackend] = useState(false);
	const [isMonitoring, setIsMonitoring] = useState(false);
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

	const deferredRequests = useDeferredValue(requests);
	const deferredMonitoringRequests = useDeferredValue(monitoringRequests);
	const observedPods = summarizePods([
		...deferredRequests,
		...deferredMonitoringRequests,
	]);
	const selectedRequest =
		deferredRequests.find((request) => request.id === selectedRequestId) ??
		deferredRequests[0] ??
		null;

	const successfulRequests = deferredRequests.filter((request) => request.ok);
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
		[...deferredRequests, ...deferredMonitoringRequests].find(
			(request) => request.podName !== "unreachable",
		)?.podName ??
		null;

	const updateBackendSnapshot = (request: RequestRecord) => {
		setBackendState(getBackendStateFromRequest(request));

		if (request.ok && isStatusPayload(request.response)) {
			setLatestStatus(request.response);
		}

		if (request.ok && isInfoPayload(request.response)) {
			setLatestInfo(request.response);
		}
	};

	const appendMainRequest = (request: RequestRecord) => {
		startTransition(() => {
			setRequests((current) => [request, ...current].slice(0, MAIN_REQUEST_LIMIT));
			setSelectedRequestId((current) => current ?? request.id);
		});
	};

	const appendMonitoringRequest = (request: RequestRecord) => {
		startTransition(() => {
			setMonitoringRequests((current) =>
				[request, ...current].slice(0, MONITORING_REQUEST_LIMIT),
			);
		});
	};

	const performRequest = async (
		testType: FormState["testType"],
		options: PerformRequestOptions = {},
	) => {
		const { logToMain = true, surfaceErrors = true } = options;
		const request = await runDemoRequest(testType, form);
		updateBackendSnapshot(request);

		if (logToMain) {
			appendMainRequest(request);
		} else {
			appendMonitoringRequest(request);
		}

		if (!surfaceErrors) {
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
	};

	const runBackendCheck = useEffectEvent(
		async ({
			surfaceErrors,
			stopOnNetworkFailure,
		}: {
			surfaceErrors: boolean;
			stopOnNetworkFailure: boolean;
		}) => {
			if (monitoringInFlightRef.current) {
				return;
			}

			monitoringInFlightRef.current = true;
			setIsCheckingBackend(true);
			setBackendState("loading");

			try {
				for (const testType of BACKEND_CHECKS) {
					const request = await performRequest(testType, {
						logToMain: false,
						surfaceErrors,
					});

					if (stopOnNetworkFailure && request.statusCode === 0) {
						break;
					}
				}

				setLastBackendCheckAt(new Date().toISOString());
			} finally {
				monitoringInFlightRef.current = false;
				setIsCheckingBackend(false);
			}
		}
	);

	useEffect(() => {
		if (!isMonitoring) {
			return;
		}

		const intervalId = window.setInterval(() => {
			void runBackendCheck({
				surfaceErrors: false,
				stopOnNetworkFailure: true,
			});
		}, MONITORING_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [isMonitoring, runBackendCheck]);

	const handleRunSingle = async () => {
		setIsRunning(true);
		setSequenceProgress(null);

		try {
			await performRequest(form.testType);
		} finally {
			setIsRunning(false);
		}
	};

	const handleRunSeries = async () => {
		setIsRunning(true);
		setSequenceProgress({ completed: 0, total: form.repeatCount });

		try {
			for (let index = 0; index < form.repeatCount; index += 1) {
				await performRequest(form.testType);
				setSequenceProgress({
					completed: index + 1,
					total: form.repeatCount,
				});

				if (index < form.repeatCount - 1 && form.intervalMs > 0) {
					await sleep(form.intervalMs);
				}
			}
		} finally {
			setIsRunning(false);
			setSequenceProgress(null);
		}
	};

	const handleCheckBackend = async () => {
		await runBackendCheck({
			surfaceErrors: true,
			stopOnNetworkFailure: false,
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
		});
	};

	return (
		<div className="min-h-screen">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
				<HeroSection
					imageSrc={heroImage}
					backendState={backendState}
					observedPodCount={observedPods.length}
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
					observedPodCount={observedPods.length}
					loggedRequestCount={deferredRequests.length}
					averageClientLatencyMs={averageClientLatencyMs}
					latestPodName={latestPodName}
					isRunning={isRunning}
				/>

				<div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
					<div className="flex flex-col gap-6">
						<ControlPanel
							form={form}
							isRunning={isRunning}
							sequenceProgress={sequenceProgress}
							onChange={(partial) =>
								setForm((current) => ({
									...current,
									...partial,
								}))
							}
							onRunSingle={handleRunSingle}
							onRunSeries={handleRunSeries}
						/>
						<BackendMonitoring
							backendState={backendState}
							isCheckingBackend={isCheckingBackend}
							isMonitoring={isMonitoring}
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
					<ObservedPods pods={observedPods} />
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
