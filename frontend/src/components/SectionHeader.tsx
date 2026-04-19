type SectionHeaderProps = {
	title: string;
	description: string;
	eyebrow?: string;
};

export function SectionHeader({
	title,
	description,
	eyebrow,
}: SectionHeaderProps) {
	return (
		<div className="flex flex-col gap-2">
			{eyebrow ? (
				<span className="badge badge-outline w-fit rounded-full border-base-300 px-3 py-2 text-[0.58rem] uppercase tracking-[0.18em] text-base-content/65">
					{eyebrow}
				</span>
			) : null}
			<h2 className="section-title">{title}</h2>
			<p className="section-copy">{description}</p>
		</div>
	);
}
