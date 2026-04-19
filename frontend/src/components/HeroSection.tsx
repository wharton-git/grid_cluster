import { ArrowRight, Cloud, ShieldCheck, Zap } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { BackendState } from "../types/demo";

type HeroSectionProps = {
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
	backendState,
	observedPodCount,
	latestPodName,
	onPrimaryAction,
	onSecondaryAction,
}: HeroSectionProps) {
	const networkAnimationSrc = `${import.meta.env.BASE_URL}Network.lottie`;

	return (
		<section className="surface-card surface-grid relative overflow-hidden px-8 py-8">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,24,27,0.08),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(82,82,91,0.1),transparent_30%)]" />
			<div className="relative grid grid-cols-[1.15fr_0.85fr] items-center gap-8">
				<div className="min-w-0 flex flex-col gap-6">
					<div className="flex flex-wrap gap-2">
						<span className="badge badge-neutral rounded-full px-3 py-2 text-[0.56rem] uppercase tracking-[0.16em]">
							Cloud Scaling Demo App
						</span>
						<span className="badge badge-outline rounded-full px-3 py-2 text-[0.56rem]">
							React + Go + Kubernetes
						</span>
					</div>

					<div className="space-y-4">
						<h1 className="max-w-3xl text-base font-semibold tracking-tight text-primary">
							Une APP de démo GKE concue pour l'autoscaling
							et la haute disponibilite.
						</h1>
						<p className="max-w-2xl text-xs leading-5 text-base-content/72">
							Cette application est une plateforme de démonstration cloud-native permettant de tester la montée en charge et la haute disponibilité d’un backend via différents scénarios (CPU, latence, requêtes mixtes). Elle visualise en temps réel les performances du système et le comportement des instances (pods), tout en offrant un contrôle précis des tests et du monitoring.
						</p>
					</div>

					<div className="flex flex-row flex-wrap gap-3">
						<button
							type="button"
							className="btn btn-primary w-auto justify-center rounded-full px-6"
							onClick={onPrimaryAction}
						>
							Lancer une serie
							<ArrowRight className="size-4" />
						</button>
						<button
							type="button"
							className="btn btn-ghost w-auto justify-center rounded-full px-6"
							onClick={onSecondaryAction}
						>
							Check backend
						</button>
					</div>

					<div className="grid grid-cols-3 gap-3">
						<div className="rounded-3xl border border-base-300/80 bg-base-100/80 p-4">
							<div className="mb-3 flex items-center gap-2 text-[0.7rem] font-medium text-base-content/65">
								<Cloud className="size-4" />
								Disponibilite
							</div>
							<p className="text-sm font-semibold text-primary">
								{availabilityLabel(backendState)}
							</p>
						</div>
						<div className="rounded-3xl border border-base-300/80 bg-base-100/80 p-4">
							<div className="mb-3 flex items-center gap-2 text-[0.7rem] font-medium text-base-content/65">
								<ShieldCheck className="size-4" />
								Pods observes
							</div>
							<p className="text-sm font-semibold text-primary">
								{observedPodCount}
							</p>
						</div>
						<div className="rounded-3xl border border-base-300/80 bg-base-100/80 p-4">
							<div className="mb-3 flex items-center gap-2 text-[0.7rem] font-medium text-base-content/65">
								<Zap className="size-4" />
								Derniere cible
							</div>
							<p className="break-all text-sm font-semibold text-primary">
								{latestPodName ?? "Aucun pod observe"}
							</p>
						</div>
					</div>
				</div>

				<div className="relative min-w-0">
					<div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle,rgba(24,24,27,0.12),transparent_60%)] blur-2xl" />
					<div className="surface-card relative mx-auto w-full overflow-hidden border-base-300/80 bg-neutral text-neutral-content">
						<div className="flex flex-row items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-white/55">
									GKE demo snapshot
								</p>
								<p className="mt-1 text-xs font-semibold">
									Flux de requetes distribue
								</p>
							</div>
							<div className="badge badge-outline border-white/20 text-white/80">
								stateless
							</div>
						</div>

						<div className="grid gap-4 p-5">
							<div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white">
								<DotLottieReact
									src={networkAnimationSrc}
									loop
									autoplay
									className="block h-64 w-full"
									renderConfig={{ autoResize: true }}
								/>
							</div>

							<div className="grid grid-cols-3 gap-2">
								<div className="rounded-2xl border border-white/10 bg-white/6 p-3">
									<p className="text-xs uppercase tracking-[0.22em] text-white/55">
										Replicas
									</p>
									<p className="mt-2 text-xs font-semibold">2+</p>
								</div>
								<div className="rounded-2xl border border-white/10 bg-white/6 p-3">
									<p className="text-xs uppercase tracking-[0.22em] text-white/55">
										CPU test
									</p>
									<p className="mt-2 text-xs font-semibold">HPA</p>
								</div>
								<div className="rounded-2xl border border-white/10 bg-white/6 p-3">
									<p className="text-xs uppercase tracking-[0.22em] text-white/55">
										Probe-ready
									</p>
									<p className="mt-2 text-xs font-semibold">Oui</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
