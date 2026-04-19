import { Activity, Cpu, Server, ShieldCheck } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const principles = [
	{
		title: "Replicas backend multiples",
		description:
			"Le backend est pense pour tourner avec plusieurs replicas. Chaque requete peut etre traitee par n importe quel pod sans session serveur.",
		icon: Server,
	},
	{
		title: "Readiness et liveness probes",
		description:
			"Les endpoints `health` et `ready` permettent a Kubernetes de ne router que vers des pods fonctionnels.",
		icon: ShieldCheck,
	},
	{
		title: "Autoscaling HPA sur CPU",
		description:
			"Les endpoints de charge CPU font monter l utilisation processeur afin d observer le scaling horizontal du backend.",
		icon: Cpu,
	},
	{
		title: "Continuite de service",
		description:
			"Si un pod disparait, le service reste disponible grace aux replicas, au Service Kubernetes et au PodDisruptionBudget.",
		icon: Activity,
	},
];

export function AvailabilitySection() {
	return (
		<section className="surface-card p-6">
			<div className="flex flex-col gap-6">
				<SectionHeader
					eyebrow="High Availability"
					title="Section pedagogique haute disponibilite"
					description="Cette application est pensee comme un support de demonstration. Elle aide a expliquer pourquoi plusieurs replicas, des probes correctes et un HPA CPU rendent le service resilient et observable sur GKE."
				/>

				<div className="grid grid-cols-4 gap-4">
					{principles.map((principle) => {
						const Icon = principle.icon;

						return (
							<article
								key={principle.title}
								className="rounded-[1.5rem] border border-base-300/75 bg-base-200/50 p-5"
							>
								<div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-base-100 text-primary shadow-sm">
									<Icon className="size-5" />
								</div>
								<h3 className="text-xs font-semibold text-primary">
									{principle.title}
								</h3>
								<p className="mt-3 text-[0.72rem] leading-5 text-base-content/68">
									{principle.description}
								</p>
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}
