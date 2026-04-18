import { Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { COMMAND_EXAMPLES } from "../data/demoConfig";
import { SectionHeader } from "./SectionHeader";

export function CommandShowcase() {
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const handleCopy = async (command: string, id: string) => {
		if (!navigator.clipboard) {
			return;
		}

		await navigator.clipboard.writeText(command);
		setCopiedId(id);
		window.setTimeout(() => {
			setCopiedId((current) => (current === id ? null : current));
		}, 1800);
	};

	return (
		<section className="surface-card p-6 sm:p-7">
			<div className="flex flex-col gap-6">
				<SectionHeader
					eyebrow="Apache Bench"
					title="Commandes de test conseillees"
					description="Ces commandes ne sont pas executees par le frontend. Elles sont presentes pour la soutenance ou la demo afin de provoquer un comportement visible cote pods et HPA."
				/>

				<div className="grid gap-4 xl:grid-cols-3">
					{COMMAND_EXAMPLES.map((example) => (
						<article
							key={example.id}
							className="rounded-[1.5rem] border border-base-300/75 bg-base-200/48 p-5"
						>
							<div className="mb-4 flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-base-content/60">
									<Terminal className="size-4" />
									{example.label}
								</div>
								<button
									className="btn btn-ghost btn-sm rounded-full"
									onClick={() => void handleCopy(example.command, example.id)}
								>
									<Copy className="size-4" />
									{copiedId === example.id ? "Copie" : "Copier"}
								</button>
							</div>
							<p className="mb-4 text-sm leading-6 text-base-content/68">
								{example.description}
							</p>
							<pre className="overflow-auto rounded-[1.25rem] bg-neutral px-4 py-4 text-sm leading-6 text-neutral-content">
								{example.command}
							</pre>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
