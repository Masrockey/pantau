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
            <SidebarGroup className="px-2 py-0">
                {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={isCurrentUrl(item.href)}
                                tooltip={{ children: item.title }}
                            >
                                <Link href={item.href} prefetch>
                                    {item.icon && <item.icon />}
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
            <SidebarGroup className="px-2 py-0">
                {label && (
                    <SidebarGroupLabel asChild>
                        <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer select-none hover:text-sidebar-foreground transition-colors py-1">
                            <span>{label}</span>
                            <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-sidebar-foreground/60" />
                        </CollapsibleTrigger>
                    </SidebarGroupLabel>
                )}
                <CollapsibleContent className="transition-all duration-200 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden group-data-[collapsible=icon]:!block">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isCurrentUrl(item.href)}
                                        tooltip={{ children: item.title }}
                                    >
                                        <Link href={item.href} prefetch>
                                            {item.icon && <item.icon />}
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
