import { ArrowRight, Cloud, ShieldCheck, Zap } from "lucide-react";
import type { BackendState } from "../types/demo";

type HeroSectionProps = {
	imageSrc: string;
	backendState: BackendState;
	observedPodCount: number;
	latestPodName: string | null;
	onPrimaryAction: () => void;
	onSecondaryAction: () => void;
};

const availabilityLabel = (backendState: BackendState) => {
	switch (backendState) {
		case "ok":
			return "Backend OK";
		case "down":
			return "Backend DOWN";
		case "loading":
			return "Verification en cours";
		default:
			return "En attente d une verification";
	}
};

export function HeroSection({
	imageSrc,
	backendState,
	observedPodCount,
	latestPodName,
	onPrimaryAction,
	onSecondaryAction,
}: HeroSectionProps) {
	return (
		<section className="surface-card surface-grid relative overflow-hidden px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,24,27,0.08),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(82,82,91,0.1),transparent_30%)]" />
			<div className="relative grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
				<div className="flex flex-col gap-6">
					<div className="flex flex-wrap gap-2">
						<span className="badge badge-neutral rounded-full px-4 py-3 text-xs uppercase tracking-[0.22em]">
							Cloud Scaling Demo App
						</span>
						<span className="badge badge-outline rounded-full px-4 py-3 text-xs">
							React + Go + Kubernetes
						</span>
					</div>

					<div className="space-y-4">
						<h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-[3.6rem] lg:leading-[1.05]">
							Une application de demonstration GKE concue pour l autoscaling
							et la haute disponibilite.
						</h1>
						<p className="max-w-2xl text-base leading-7 text-base-content/72 sm:text-lg">
							L interface conserve l esprit DaisyUI de l existant, mais la
							logique produit est maintenant orientee vers une vraie
							demonstration cloud-native : probes, repartition des requetes,
							observation des pods et charge CPU visible pour le HPA.
						</p>
					</div>

					<div className="flex flex-wrap gap-3">
						<button className="btn btn-primary rounded-full px-6" onClick={onPrimaryAction}>
							Lancer une serie
							<ArrowRight className="size-4" />
						</button>
						<button className="btn btn-ghost rounded-full px-6" onClick={onSecondaryAction}>
							Check backend
						</button>
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						<div className="rounded-3xl border border-base-300/80 bg-base-100/80 p-4">
							<div className="mb-3 flex items-center gap-2 text-sm font-medium text-base-content/65">
								<Cloud className="size-4" />
								Disponibilite
							</div>
							<p className="text-lg font-semibold text-primary">
								{availabilityLabel(backendState)}
							</p>
						</div>
						<div className="rounded-3xl border border-base-300/80 bg-base-100/80 p-4">
							<div className="mb-3 flex items-center gap-2 text-sm font-medium text-base-content/65">
								<ShieldCheck className="size-4" />
								Pods observes
							</div>
							<p className="text-lg font-semibold text-primary">
								{observedPodCount}
							</p>
						</div>
						<div className="rounded-3xl border border-base-300/80 bg-base-100/80 p-4">
							<div className="mb-3 flex items-center gap-2 text-sm font-medium text-base-content/65">
								<Zap className="size-4" />
								Derniere cible
							</div>
							<p className="truncate text-lg font-semibold text-primary">
								{latestPodName ?? "Aucun pod observe"}
							</p>
						</div>
					</div>
				</div>

				<div className="relative">
					<div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle,rgba(24,24,27,0.12),transparent_60%)] blur-2xl" />
					<div className="surface-card relative mx-auto max-w-md overflow-hidden border-base-300/80 bg-neutral text-neutral-content">
						<div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-white/55">
									GKE demo snapshot
								</p>
								<p className="mt-1 text-lg font-semibold">
									Flux de requetes distribue
								</p>
							</div>
							<div className="badge badge-outline border-white/20 text-white/80">
								stateless
							</div>
						</div>

						<div className="grid gap-4 p-5">
							<div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5">
								<img
									src={imageSrc}
									alt="Fractal visual retained from the original project"
									className="h-64 w-full object-cover"
								/>
							</div>

							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-2xl border border-white/10 bg-white/6 p-3">
									<p className="text-xs uppercase tracking-[0.22em] text-white/55">
										Replicas
									</p>
									<p className="mt-2 text-2xl font-semibold">2+</p>
								</div>
								<div className="rounded-2xl border border-white/10 bg-white/6 p-3">
									<p className="text-xs uppercase tracking-[0.22em] text-white/55">
										CPU test
									</p>
									<p className="mt-2 text-2xl font-semibold">HPA</p>
								</div>
								<div className="rounded-2xl border border-white/10 bg-white/6 p-3">
									<p className="text-xs uppercase tracking-[0.22em] text-white/55">
										Probe-ready
									</p>
									<p className="mt-2 text-2xl font-semibold">Oui</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
