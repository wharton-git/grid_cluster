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
				<span className="badge badge-outline w-fit rounded-full border-base-300 px-4 py-3 text-[0.7rem] uppercase tracking-[0.24em] text-base-content/65">
					{eyebrow}
				</span>
			) : null}
			<h2 className="section-title">{title}</h2>
			<p className="section-copy">{description}</p>
		</div>
	);
}
