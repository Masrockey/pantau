import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import type { PaginationLink } from '@/types';

export function Pagination({
    links,
    className,
}: {
    links: PaginationLink[];
    className?: string;
}) {
    if (links.length <= 3) {
        return null;
    }

    return (
        <nav
            aria-label="Pagination"
            className={cn(
                'flex flex-wrap items-center justify-center gap-1',
                className,
            )}
        >
            {links.map((link, i) => {
                const isPrevious =
                    link.label.includes('Previous') ||
                    link.label.includes('&laquo;');
                const isNext =
                    link.label.includes('Next') ||
                    link.label.includes('&raquo;');
                const cleanLabel = isPrevious
                    ? 'Sebelumnya'
                    : isNext
                      ? 'Berikutnya'
                      : link.label;

                if (!link.url) {
                    return (
                        <span
                            key={i}
                            className="inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] border border-border/40 px-2.5 text-xs text-muted-foreground/50 opacity-60 cursor-not-allowed bg-muted/20"
                            dangerouslySetInnerHTML={{ __html: cleanLabel }}
                        />
                    );
                }

                return (
                    <Link
                        key={i}
                        href={link.url}
                        preserveState
                        preserveScroll
                        className={cn(
                            'inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] border px-2.5 text-xs transition-all cursor-pointer',
                            link.active
                                ? 'border-primary bg-primary/10 text-primary font-semibold shadow-2xs'
                                : 'border-border/60 bg-card text-foreground hover:border-primary hover:text-primary hover:bg-primary/5',
                        )}
                        dangerouslySetInnerHTML={{ __html: cleanLabel }}
                    />
                );
            })}
        </nav>
    );
}
