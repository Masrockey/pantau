import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import React from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types';

export function NavMain({
    items,
    label = 'Google Bisnis Profile',
    collapsible = true,
}: {
    items: NavItem[];
    label?: string;
    collapsible?: boolean;
}) {
    const { isCurrentUrl } = useCurrentUrl();

    if (!items || items.length === 0) {
        return null;
    }

    if (!collapsible) {
        return (
            <SidebarGroup className="px-2 py-1">
                {label && (
                    <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 mb-1">
                        {label}
                    </SidebarGroupLabel>
                )}
                <SidebarMenu className="gap-0.5">
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={isCurrentUrl(item.href)}
                                tooltip={{ children: item.title }}
                                className="h-9 px-3 rounded-[6px] text-[13.5px] font-normal transition-all data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold dark:data-[active=true]:bg-primary/20 dark:data-[active=true]:text-rose-300 hover:bg-muted/70"
                            >
                                <Link href={item.href} prefetch className="flex items-center gap-2.5">
                                    {item.icon && <item.icon className="size-4 shrink-0" />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroup>
        );
    }

    return (
        <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup className="px-2 py-1">
                {label && (
                    <SidebarGroupLabel asChild>
                        <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 py-1.5 hover:text-foreground transition-colors">
                            <span>{label}</span>
                            <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/60" />
                        </CollapsibleTrigger>
                    </SidebarGroupLabel>
                )}
                <CollapsibleContent className="transition-all duration-200 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden group-data-[collapsible=icon]:!block">
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-0.5 pt-0.5">
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isCurrentUrl(item.href)}
                                        tooltip={{ children: item.title }}
                                        className="h-9 px-3 rounded-[6px] text-[13.5px] font-normal transition-all data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold dark:data-[active=true]:bg-primary/20 dark:data-[active=true]:text-rose-300 hover:bg-muted/70"
                                    >
                                        <Link href={item.href} prefetch className="flex items-center gap-2.5">
                                            {item.icon && <item.icon className="size-4 shrink-0" />}
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}
