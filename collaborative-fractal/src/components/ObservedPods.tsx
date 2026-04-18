import { CheckCircle2, CircleAlert, Server } from "lucide-react";
import {
	formatAverage,
	formatCompactTimestamp,
	formatPercentage,
} from "../lib/format";
import type { PodObservation } from "../types/demo";
import { SectionHeader } from "./SectionHeader";

type ObservedPodsProps = {
	pods: PodObservation[];
};

export function ObservedPods({ pods }: ObservedPodsProps) {
	return (
		<section className="surface-card p-6 sm:p-7">
			<div className="flex flex-col gap-6">
				<SectionHeader
					eyebrow="Observed Pods"
					title="Visualisation des pods observes"
					description="Chaque reponse enregistre le pod source. Si plusieurs noms apparaissent, la repartition est visible et la demonstration de haute disponibilite devient immediate."
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
						<div className="rounded-[1.4rem] border border-dashed border-base-300/80 bg-base-200/45 p-6 text-sm text-base-content/65">
							Aucun pod n a encore ete observe dans le journal recent.
						</div>
					) : (
						pods.map((pod) => (
							<div
								key={pod.podName}
								className="rounded-[1.5rem] border border-base-300/75 bg-base-200/42 p-4"
							>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div className="flex items-center gap-3">
										<div className="rounded-2xl bg-base-100 p-3 text-primary shadow-sm">
											<Server className="size-5" />
										</div>
										<div>
											<p className="font-semibold text-primary">{pod.podName}</p>
											<p className="text-sm text-base-content/60">
												Dernier passage a {formatCompactTimestamp(pod.lastSeen)}
											</p>
										</div>
									</div>

									<div className="grid grid-cols-3 gap-3 text-right text-sm">
										<div>
											<p className="text-base-content/55">Requetes</p>
											<p className="font-semibold text-primary">{pod.count}</p>
										</div>
										<div>
											<p className="text-base-content/55">Succes</p>
											<p className="font-semibold text-primary">
												{formatPercentage(pod.successRate)}
											</p>
										</div>
										<div>
											<p className="text-base-content/55">Latence moy.</p>
											<p className="font-semibold text-primary">
												{formatAverage(pod.averageDurationMs)}
											</p>
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
