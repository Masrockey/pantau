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
                            className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-sidebar-border/50 px-3 text-xs text-muted-foreground opacity-50 dark:border-sidebar-border"
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
                            'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors',
                            link.active
                                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                : 'border-sidebar-border/70 bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:border-sidebar-border',
                        )}
                        dangerouslySetInnerHTML={{ __html: cleanLabel }}
                    />
                );
            })}
        </nav>
    );
}
