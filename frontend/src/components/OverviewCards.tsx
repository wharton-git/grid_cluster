import {
	Activity,
	Clock3,
	RefreshCw,
	Server,
	ShieldCheck,
} from "lucide-react";
import { formatAverage } from "../lib/format";
import type {
	AppRuntimeState,
	BackendState,
	InfoPayload,
	StatusPayload,
} from "../types/demo";

type OverviewCardsProps = {
	backendState: BackendState;
	latestStatus: StatusPayload | null;
	latestInfo: InfoPayload | null;
	observedPodCount: number;
	loggedRequestCount: number;
	averageClientLatencyMs: number;
	latestPodName: string | null;
	isRunning: boolean;
	isMonitoringActive: boolean;
	appRuntimeState: AppRuntimeState;
};

const availabilityClass = (backendState: BackendState) => {
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

const availabilityLabel = (backendState: BackendState) => {
	switch (backendState) {
		case "ok":
			return "OK";
		case "down":
			return "DOWN";
		case "loading":
			return "LOADING";
		default:
			return "IDLE";
	}
};

export function OverviewCards({
	backendState,
	latestStatus,
	latestInfo,
	observedPodCount,
	loggedRequestCount,
	averageClientLatencyMs,
	latestPodName,
	isRunning,
	isMonitoringActive,
	appRuntimeState,
}: OverviewCardsProps) {
	return (
		<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<div className="surface-card p-5">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2 text-sm text-base-content/60">
						<Activity className="size-4" />
						Disponibilite backend
					</div>
					<span className={availabilityClass(backendState)}>
						{availabilityLabel(backendState)}
					</span>
				</div>
				<p className="text-3xl font-semibold text-primary">
					{latestStatus?.requestCount ?? 0}
				</p>
				<p className="mt-2 text-sm text-base-content/68">
					Requetes traitees par le pod le plus recemment observe. Moyenne
					client: {formatAverage(averageClientLatencyMs)}.
				</p>
			</div>

			<div className="surface-card p-5">
				<div className="mb-4 flex items-center gap-2 text-sm text-base-content/60">
					<Server className="size-4" />
					Pods observes
				</div>
				<p className="text-3xl font-semibold text-primary">{observedPodCount}</p>
				<p className="mt-2 text-sm text-base-content/68">
					Dernier pod repondu: {latestPodName ?? "aucun"}.
				</p>
			</div>

			<div className="surface-card p-5">
				<div className="mb-4 flex items-center gap-2 text-sm text-base-content/60">
					<ShieldCheck className="size-4" />
					Execution pod locale
				</div>
				<p className="text-3xl font-semibold text-primary">
					{latestStatus?.inFlightRequests ?? 0}
				</p>
				<p className="mt-2 text-sm text-base-content/68">
					In-flight en ce moment. Erreurs cumulees: {latestStatus?.errorCount ?? 0}.
				</p>
			</div>

			<div className="surface-card p-5">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2 text-sm text-base-content/60">
						<Clock3 className="size-4" />
						Runtime demo
					</div>
					{isRunning || isMonitoringActive ? (
						<RefreshCw className="size-4 animate-spin text-base-content/55" />
					) : null}
				</div>
				<p className="text-3xl font-semibold text-primary">
					{loggedRequestCount}
				</p>
				<p className="mt-2 text-sm text-base-content/68">
					Appels journalises. Env: {latestInfo?.environment ?? "indetermine"}.
					Region: {latestInfo?.region ?? "inconnue"}. Etat app:{" "}
					{appRuntimeState === "idle"
						? "idle"
						: appRuntimeState === "test_running"
							? "test en cours"
							: appRuntimeState === "monitoring"
								? "monitoring actif"
								: "arret demande"}.
				</p>
			</div>
		</section>
	);
}
