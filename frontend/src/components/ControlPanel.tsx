import { Play, Square } from "lucide-react";
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
	isStopRequested: boolean;
	onChange: (partial: Partial<FormState>) => void;
	onRunSingle: () => void;
	onRunSeries: () => void;
	onStopTests: () => void;
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
	isStopRequested,
	onChange,
	onRunSingle,
	onRunSeries,
	onStopTests,
}: ControlPanelProps) {
	return (
		<section className="surface-card p-6">
			<div className="flex flex-col gap-6">
				<SectionHeader
					eyebrow="Control Panel"
					title="Piloter les scenarios de charge"
					description="Selectionne un type de test, ajuste duree, intensite et delai, puis lance une requete unique ou une serie pour mettre en evidence le load balancing et l autoscaling."
				/>

				<div className="grid grid-cols-2 gap-4">
					<label className="form-control">
						<div className="label">
							<span className="label-text text-xs font-medium">Type de test</span>
						</div>
						<select
							className="select select-bordered w-full rounded-2xl"
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
							<span className="label-text-alt text-[0.72rem] text-base-content/55">
								{
									TEST_OPTIONS.find((option) => option.value === form.testType)
										?.description
								}
							</span>
						</div>
					</label>

					<label className="form-control">
						<div className="label">
							<span className="label-text text-xs font-medium">Intensite CPU</span>
						</div>
						<select
							className="select select-bordered w-full rounded-2xl"
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
							<span className="label-text text-xs font-medium">Duree CPU (ms)</span>
						</div>
						<input
							className="input input-bordered w-full rounded-2xl"
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
							<span className="label-text text-xs font-medium">Delai artificiel (ms)</span>
						</div>
						<input
							className="input input-bordered w-full rounded-2xl"
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
							<span className="label-text text-xs font-medium">Serie de requetes</span>
						</div>
						<input
							className="input input-bordered w-full rounded-2xl"
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
							<span className="label-text text-xs font-medium">Pause entre requetes (ms)</span>
						</div>
						<input
							className="input input-bordered w-full rounded-2xl"
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

				<div className="flex flex-row flex-wrap gap-3">
					<button
						className="btn btn-primary w-auto justify-center rounded-full px-6"
						onClick={onRunSingle}
						disabled={isRunning}
					>
						<Play className="size-4" />
						Lancer une requete
					</button>
					<button
						className="btn btn-neutral w-auto justify-center rounded-full px-6"
						onClick={onRunSeries}
						disabled={isRunning}
					>
						<Play className="size-4" />
						Lancer une serie
					</button>
					{isRunning ? (
						<button
							onClick={onStopTests}
							disabled={isStopRequested}
							className="btn btn-outline btn-error w-auto justify-center rounded-full px-6"
						>
							<Square className="size-4 shrink-0" />
							{isStopRequested ? "Arret demande" : "Arreter les tests"}
						</button>
					) : null}
				</div>

				{sequenceProgress ? (
					<div className="rounded-[1.3rem] border border-base-300/70 bg-base-200/50 px-4 py-3 text-xs text-base-content/72">
						{isStopRequested
							? "Arret manuel demande. La campagne est en train de s interrompre."
							: `Serie en cours: ${sequenceProgress.completed}/${sequenceProgress.total}`}
					</div>
				) : null}
			</div>
		</section>
	);
}
