import { Clock3, Gauge, Play, RefreshCw } from "lucide-react";
import { TEST_OPTIONS } from "../data/demoConfig";
import type { FormState } from "../types/demo";
import { SectionHeader } from "./SectionHeader";

type ControlPanelProps = {
	form: FormState;
	isRunning: boolean;
	sequenceProgress: {
		completed: number;
		total: number;
	} | null;
	onChange: (partial: Partial<FormState>) => void;
	onRunSingle: () => void;
	onRunSeries: () => void;
};

const usesDuration = (testType: FormState["testType"]) =>
	testType === "cpu" || testType === "mixed";

const usesDelay = (testType: FormState["testType"]) =>
	testType === "latency" || testType === "mixed";

const usesIntensity = (testType: FormState["testType"]) =>
	testType === "cpu" || testType === "mixed";

export function ControlPanel({
	form,
	isRunning,
	sequenceProgress,
	onChange,
	onRunSingle,
	onRunSeries,
}: ControlPanelProps) {
	return (
		<section className="surface-card p-6 sm:p-7">
			<div className="flex flex-col gap-6">
				<SectionHeader
					eyebrow="Control Panel"
					title="Piloter les scenarios de charge"
					description="Selectionne un type de test, ajuste duree, intensite et delai, puis lance une requete unique ou une serie pour mettre en evidence le load balancing et l autoscaling."
				/>

				<div className="grid gap-4 md:grid-cols-2">
					<label className="form-control">
						<div className="label">
							<span className="label-text font-medium">Type de test</span>
						</div>
						<select
							className="select select-bordered rounded-2xl"
							value={form.testType}
							onChange={(event) =>
								onChange({
									testType: event.target.value as FormState["testType"],
								})
							}
						>
							{TEST_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<div className="label">
							<span className="label-text-alt text-base-content/55">
								{
									TEST_OPTIONS.find((option) => option.value === form.testType)
										?.description
								}
							</span>
						</div>
					</label>

					<label className="form-control">
						<div className="label">
							<span className="label-text font-medium">Intensite CPU</span>
						</div>
						<select
							className="select select-bordered rounded-2xl"
							value={form.intensity}
							disabled={!usesIntensity(form.testType)}
							onChange={(event) =>
								onChange({
									intensity: event.target.value as FormState["intensity"],
								})
							}
						>
							<option value="low">low</option>
							<option value="medium">medium</option>
							<option value="high">high</option>
						</select>
					</label>

					<label className="form-control">
						<div className="label">
							<span className="label-text font-medium">Duree CPU (ms)</span>
						</div>
						<input
							className="input input-bordered rounded-2xl"
							type="number"
							min={250}
							max={30000}
							step={250}
							disabled={!usesDuration(form.testType)}
							value={form.durationMs}
							onChange={(event) =>
								onChange({
									durationMs: Number(event.target.value) || 0,
								})
							}
						/>
					</label>

					<label className="form-control">
						<div className="label">
							<span className="label-text font-medium">Delai artificiel (ms)</span>
						</div>
						<input
							className="input input-bordered rounded-2xl"
							type="number"
							min={0}
							max={30000}
							step={100}
							disabled={!usesDelay(form.testType)}
							value={form.delayMs}
							onChange={(event) =>
								onChange({
									delayMs: Number(event.target.value) || 0,
								})
							}
						/>
					</label>

					<label className="form-control">
						<div className="label">
							<span className="label-text font-medium">Serie de requetes</span>
						</div>
						<input
							className="input input-bordered rounded-2xl"
							type="number"
							min={1}
							max={50}
							step={1}
							value={form.repeatCount}
							onChange={(event) =>
								onChange({
									repeatCount: Number(event.target.value) || 1,
								})
							}
						/>
					</label>

					<label className="form-control">
						<div className="label">
							<span className="label-text font-medium">Pause entre requetes (ms)</span>
						</div>
						<input
							className="input input-bordered rounded-2xl"
							type="number"
							min={0}
							max={10000}
							step={50}
							value={form.intervalMs}
							onChange={(event) =>
								onChange({
									intervalMs: Number(event.target.value) || 0,
								})
							}
						/>
					</label>
				</div>

				<div className="grid gap-4 rounded-[1.4rem] border border-base-300/70 bg-base-200/55 p-4 md:grid-cols-3">
					<div className="flex items-start gap-3">
						<Gauge className="mt-1 size-4 text-base-content/55" />
						<p className="text-sm leading-6 text-base-content/70">
							Pour declencher un HPA visible, combine un test CPU `high`, une
							serie importante et de la concurrence cote `ab`.
						</p>
					</div>
					<div className="flex items-start gap-3">
						<Clock3 className="mt-1 size-4 text-base-content/55" />
						<p className="text-sm leading-6 text-base-content/70">
							Le test `latency` aide a montrer que le service reste joignable
							meme quand certains pods repondent lentement.
						</p>
					</div>
					<div className="flex items-start gap-3">
						<RefreshCw className="mt-1 size-4 text-base-content/55" />
						<p className="text-sm leading-6 text-base-content/70">
							Les checks backend ont maintenant leur propre panneau pour eviter
							de polluer le journal principal des tests utilisateur.
						</p>
					</div>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
					<button
						className="btn btn-primary rounded-full px-6"
						onClick={onRunSingle}
						disabled={isRunning}
					>
						<Play className="size-4" />
						Lancer une requete
					</button>
					<button
						className="btn btn-neutral rounded-full px-6"
						onClick={onRunSeries}
						disabled={isRunning}
					>
						<Play className="size-4" />
						Lancer une serie
					</button>
				</div>

				{sequenceProgress ? (
					<div className="rounded-[1.3rem] border border-base-300/70 bg-base-200/50 px-4 py-3 text-sm text-base-content/72">
						Serie en cours: {sequenceProgress.completed}/{sequenceProgress.total}
					</div>
				) : null}
			</div>
		</section>
	);
}
