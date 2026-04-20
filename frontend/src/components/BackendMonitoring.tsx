import { RefreshCw } from "lucide-react";
import { formatCompactTimestamp } from "../lib/format";
import type {
	AppRuntimeState,
	BackendState,
} from "../types/demo";
import { SectionHeader } from "./SectionHeader";

type BackendMonitoringProps = {
	backendState: BackendState;
	appRuntimeState: AppRuntimeState;
	isCheckingBackend: boolean;
	isMonitoringActive: boolean;
	monitoringModeLabel: string;
	isStopRequested: boolean;
	lastBackendCheckAt: string | null;
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
	isMonitoringActive,
	monitoringModeLabel,
	isStopRequested,
	lastBackendCheckAt,
}: BackendMonitoringProps) {
	return (
		<section className="surface-card p-6">
			<div className="flex flex-col gap-6">
				<SectionHeader
					eyebrow="Backend Monitoring"
					title="Checks backend controles"
					description="Le frontend verifie automatiquement le backend des le chargement puis toutes les secondes pour garder un etat frais sans action manuelle."
				/>

				<div className="grid grid-cols-4 gap-4 rounded-[1.4rem] border border-base-300/70 bg-base-200/55 p-4">
					<div>
						<p className="mb-2 text-xs text-base-content/58">Etat</p>
						<div className="flex flex-wrap items-center gap-2">
							<span className={stateBadgeClass(backendState) + ` text-sm`} >
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
				{isStopRequested ? (
					<div className="rounded-[1.2rem] border border-warning/20 bg-warning/10 px-4 py-3 text-xs text-warning">
						Arret manuel demande. Les nouvelles requetes de test sont bloquees et
						le monitoring temporaire associe est en train de s arreter.
					</div>
				) : null}
			</div>
		</section>
	);
}
