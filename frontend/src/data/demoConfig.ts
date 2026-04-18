import type { TestType } from "../types/demo";

export const TEST_OPTIONS: Array<{
	value: TestType;
	label: string;
	description: string;
}> = [
	{
		value: "health",
		label: "Health check",
		description: "Verification rapide du service vivant pour les probes et tests simples.",
	},
	{
		value: "info",
		label: "Info pod",
		description: "Expose le pod, la version et le contexte d'execution.",
	},
	{
		value: "cpu",
		label: "CPU load",
		description: "Charge CPU volontaire pour faire monter l'utilisation et stimuler le HPA.",
	},
	{
		value: "latency",
		label: "Latency",
		description: "Retard artificiel pour simuler des appels lents.",
	},
	{
		value: "mixed",
		label: "Mixed load",
		description: "Combine latence et calcul CPU pour une charge plus realiste.",
	},
	{
		value: "status",
		label: "Status",
		description: "Resume pod-local avec compteurs et moyenne de temps de reponse.",
	},
];

export const COMMAND_EXAMPLES = [
	{
		id: "simple",
		label: "Test simple",
		description: "Verification rapide du routage et des probes.",
		command: 'ab -n 100 -c 10 http://<BACKEND_URL>/api/health',
	},
	{
		id: "concurrent",
		label: "Test concurrent",
		description: "Observe la repartition sur plusieurs pods backend.",
		command:
			'ab -n 600 -c 40 "http://<BACKEND_URL>/api/load/latency?delay=1200"',
	},
	{
		id: "aggressive",
		label: "Test agressif",
		description: "Met en evidence l autoscaling HPA sur la charge CPU.",
		command:
			'ab -n 1200 -c 120 "http://<BACKEND_URL>/api/load/cpu?duration=5000&intensity=high"',
	},
];
