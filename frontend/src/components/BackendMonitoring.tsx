import {
	Activity,
	CheckCircle2,
	Clock3,
	Play,
	RefreshCw,
	Square,
} from "lucide-react";
import {
	formatCompactTimestamp,
	formatDuration,
	formatTimestamp,
} from "../lib/format";
import type {
	AppRuntimeState,
	BackendState,
	InfoPayload,
	RequestRecord,
	StatusPayload,
} from "../types/demo";
import { SectionHeader } from "./SectionHeader";

type BackendMonitoringProps = {
	backendState: BackendState;
	appRuntimeState: AppRuntimeState;
	isCheckingBackend: boolean;
	isManualMonitoringEnabled: boolean;
	isMonitoringActive: boolean;
	monitoringModeLabel: string;
	isStopRequested: boolean;
	monitoringRequests: RequestRecord[];
	lastBackendCheckAt: string | null;
	latestInfo: InfoPayload | null;
	latestStatus: StatusPayload | null;
	onCheckBackend: () => void;
	onToggleMonitoring: () => void;
};

const stateBadgeClass = (backendState: BackendState) => {
	switch (backendState) {
		case "ok":
			return "badge badge-success";
		case "down":
			return "badge badge-error";
		case "loading":
			return "badge badge-warning";
		default:
			return "badge badge-outline";
	}
};

const stateLabel = (backendState: BackendState) => {
	switch (backendState) {
		case "ok":
			return "Backend: OK";
		case "down":
			return "Backend: DOWN";
		case "loading":
			return "Backend: LOADING";
		default:
			return "Backend: IDLE";
	}
};

export function BackendMonitoring({
	backendState,
	appRuntimeState,
	isCheckingBackend,
	isManualMonitoringEnabled,
	isMonitoringActive,
	monitoringModeLabel,
	isStopRequested,
	monitoringRequests,
	lastBackendCheckAt,
	latestInfo,
	latestStatus,
	onCheckBackend,
	onToggleMonitoring,
}: BackendMonitoringProps) {
	return (
		<section className="surface-card p-6">
			<div className="flex flex-col gap-6">
				<SectionHeader
					eyebrow="Backend Monitoring"
					title="Checks backend controles"
					description="Aucun appel n est envoye au chargement. Tu peux verifier le backend manuellement ou activer un monitoring leger avec intervalle long, sans polluer le tableau principal."
				/>

				<div className="grid grid-cols-4 gap-4 rounded-[1.4rem] border border-base-300/70 bg-base-200/55 p-4">
					<div>
						<p className="mb-2 text-xs text-base-content/58">Etat</p>
						<div className="flex flex-wrap items-center gap-2">
							<span className={stateBadgeClass(backendState)}>
								{stateLabel(backendState)}
							</span>
							{isCheckingBackend ? (
								<RefreshCw className="size-4 animate-spin text-base-content/55" />
							) : null}
						</div>
					</div>
					<div>
						<p className="mb-2 text-xs text-base-content/58">Activite app</p>
						<p className="text-xs font-medium text-primary">
							{appRuntimeState === "idle"
								? "idle"
								: appRuntimeState === "test_running"
									? "test en cours"
									: appRuntimeState === "monitoring"
										? "monitoring actif"
										: "arret manuel demande"}
						</p>
					</div>
					<div>
						<p className="mb-2 text-xs text-base-content/58">Monitoring</p>
						<p className="text-xs font-medium text-primary">
							{isMonitoringActive ? monitoringModeLabel : "Arrete"}
						</p>
					</div>
					<div>
						<p className="mb-2 text-xs text-base-content/58">Derniere verification</p>
						<p className="text-xs font-medium text-primary">
							{lastBackendCheckAt
								? formatCompactTimestamp(lastBackendCheckAt)
								: "Aucune encore"}
						</p>
					</div>
				</div>

				<div className="flex flex-row flex-wrap gap-3">
					<button
						className="btn btn-primary w-auto justify-center rounded-full px-6"
						onClick={onCheckBackend}
						disabled={isCheckingBackend}
					>
						<Activity className="size-4" />
						Check backend
					</button>
					<button
						className="btn btn-neutral w-auto justify-center rounded-full px-6"
						onClick={onToggleMonitoring}
					>
						{isManualMonitoringEnabled ? (
							<Square className="size-4" />
						) : (
							<Play className="size-4" />
						)}
						{isManualMonitoringEnabled
							? "Stop monitoring"
							: "Start monitoring"}
					</button>
				</div>
				{isStopRequested ? (
					<div className="rounded-[1.2rem] border border-warning/20 bg-warning/10 px-4 py-3 text-xs text-warning">
						Arret manuel demande. Les nouvelles requetes de test sont bloquees et
						le monitoring temporaire associe est en train de s arreter.
					</div>
				) : null}

				<div className="grid grid-cols-2 gap-4">
					<div className="rounded-[1.5rem] border border-base-300/75 bg-base-200/45 p-5">
						<div className="mb-4 flex items-center gap-2 text-xs text-base-content/60">
							<Clock3 className="size-4" />
							Snapshot backend
						</div>
						<div className="space-y-3 text-xs">
							<p>
								<span className="font-medium text-primary">Pod:</span>{" "}
								{latestStatus?.podName ?? latestInfo?.podName ?? "inconnu"}
							</p>
							<p>
								<span className="font-medium text-primary">Uptime:</span>{" "}
								{latestStatus?.uptime ?? latestInfo?.uptime ?? "n/a"}
							</p>
							<p>
								<span className="font-medium text-primary">Request count:</span>{" "}
								{latestStatus?.requestCount ?? 0}
							</p>
							<p>
								<span className="font-medium text-primary">Latence moyenne:</span>{" "}
								{formatDuration(latestStatus?.averageResponseTimeMs ?? 0)}
							</p>
							<p>
								<span className="font-medium text-primary">Environnement:</span>{" "}
								{latestInfo?.environment ?? "n/a"}
							</p>
							<p>
								<span className="font-medium text-primary">Region:</span>{" "}
								{latestInfo?.region ?? "n/a"}
							</p>
						</div>
					</div>

					<div className="rounded-[1.5rem] max-h-[28rem] overflow-y-auto border border-base-300/75 bg-base-200/45 p-5">
						<div className="mb-4 flex items-center gap-2 text-xs text-base-content/60">
							<CheckCircle2 className="size-4" />
							Historique monitoring
						</div>
						<div className="space-y-3">
							{monitoringRequests.length === 0 ? (
								<p className="text-xs text-base-content/65">
									Aucun check backend pour le moment. Le service reste idle
									tant que tu ne cliques pas.
								</p>
							) : (
								monitoringRequests.map((request) => (
									<div
										key={request.id}
										className="flex flex-row items-center justify-between gap-3 rounded-[1.15rem] border border-base-300/70 bg-base-100/75 px-4 py-3"
									>
										<div>
											<p className="text-xs font-medium text-primary">
												{request.endpoint}
											</p>
											<p className="text-xs text-base-content/58">
												{formatTimestamp(request.timestamp)}
											</p>
										</div>
										<div className="text-right text-xs">
											<p className="font-medium text-primary">{request.podName}</p>
											<p className="text-base-content/58">
												{request.statusCode === 0
													? request.statusText
													: `${request.statusCode} | ${formatDuration(request.durationMs)}`}
											</p>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
