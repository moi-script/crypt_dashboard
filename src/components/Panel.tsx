import { clsx } from "@/lib/format";

/** The fundamental terminal surface: a bordered panel with an optional header. */
export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
  ticks,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  ticks?: boolean;
}) {
  return (
    <section className={clsx("panel", ticks && "ticks", className)}>
      {(title || right) && (
        <header className="panel-hd justify-between">
          <span className="flex items-center gap-2">{title}</span>
          {right}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
