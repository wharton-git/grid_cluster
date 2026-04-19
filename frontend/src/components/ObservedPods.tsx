import { CheckCircle2, CircleAlert, Server } from "lucide-react";
import {
	formatAverage,
	formatCompactTimestamp,
} from "../lib/format";
import type { PodObservation } from "../types/demo";
import { SectionHeader } from "./SectionHeader";

type ObservedPodsProps = {
	pods: PodObservation[];
};

export function ObservedPods({ pods }: ObservedPodsProps) {
	return (
		<section className="surface-card p-6">
			<div className="flex flex-col gap-6">
				<SectionHeader
					eyebrow="Observed Pods"
					title="Visualisation des pods observes"
					description="Les metriques affichees ici viennent du dernier snapshot backend connu pour chaque pod. Le compteur n est plus derive du journal recent du frontend."
				/>

				{pods.length > 1 ? (
					<div className="alert border border-success/20 bg-success/10 text-success">
						<CheckCircle2 className="size-5" />
						<span>
							Plusieurs pods backend ont deja repondu. Le load balancing est
							bien visible.
						</span>
					</div>
				) : (
					<div className="alert border border-base-300/80 bg-base-200/50 text-base-content/72">
						<CircleAlert className="size-5" />
						<span>
							Un seul pod est visible pour l instant. Augmente la charge ou la
							concurrence pour observer la distribution.
						</span>
					</div>
				)}

				<div className="grid gap-4">
					{pods.length === 0 ? (
						<div className="rounded-[1.4rem] border border-dashed border-base-300/80 bg-base-200/45 p-6 text-[0.72rem] text-base-content/65">
							Aucun pod n a encore ete observe par le monitoring backend.
						</div>
					) : (
						pods.map((pod) => (
							<div
								key={pod.podName}
								className="rounded-3xl border border-base-300/75 bg-base-200/42 p-4"
							>
								<div className="flex items-center gap-3 ">
									<div>
										<div className="rounded-2xl bg-base-100 p-3 text-primary shadow-sm">
											<Server className="size-6" />
										</div>
									</div>

									<div className="flex flex-col flex-1 space-y-2">
										<div className="min-w-0">
											<div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-primary">
												<span className="mr-2 text-sm">{pod.podName}</span>
												<span className="text-[0.7rem] text-base-content/60">
													(Dernier passage a {formatCompactTimestamp(pod.lastSeen)})
												</span>
											</div>
											{!pod.hasBackendSnapshot ? (
												<p className="mt-1 text-xs text-base-content/52">
													Snapshot /api/status en attente pour ce pod.
												</p>
											) : null}
										</div>

										<div className="flex justify-between">
											<div>
												<p className="text-xs text-base-content/55">Requetes</p>
												<p className="text-xs font-semibold text-primary">
													{pod.requestCount ?? "n/d"}
												</p>
											</div>
											<div>
												<p className="text-xs text-base-content/55">In flight</p>
												<p className="text-xs font-semibold text-primary">
													{pod.inFlightRequests ?? "n/d"}
												</p>
											</div>
											<div>
												<p className="text-xs text-base-content/55">Erreurs</p>
												<p className="text-xs font-semibold text-primary">
													{pod.errorCount ?? "n/d"}
												</p>
											</div>
											<div>
												<p className="text-xs text-base-content/55">Latence moy.</p>
												<p className="text-xs font-semibold text-primary">
													{pod.averageResponseTimeMs === null
														? "n/d"
														: formatAverage(pod.averageResponseTimeMs)}
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</section>
	);
}
