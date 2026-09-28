import { Link, usePage } from '@inertiajs/react';
import { Building2, LayoutGrid, RefreshCw, Star, Users } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import dealers from '@/routes/dealers';
import reviews from '@/routes/reviews';
import syncRoute from '@/routes/reviews/sync';
import users from '@/routes/users';
import type { NavItem } from '@/types';

const gbpNavItems: NavItem[] = [
    {
        title: 'Dashboard GBP',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Review',
        href: reviews.index(),
        icon: Star,
    },
];

const managementNavItems: NavItem[] = [
    {
        title: 'Dealer',
        href: dealers.index(),
        icon: Building2,
    },
    {
        title: 'Sync Review',
        href: syncRoute.index(),
        icon: RefreshCw,
    },
    {
        title: 'User',
        href: users.index(),
        icon: Users,
    },
];

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const page = usePage<{ auth?: { user?: { role?: string } } }>();
    const userRole = page.props?.auth?.user?.role;
    const isSuperAdmin = userRole === 'super_admin';
    const isDealer = userRole === 'dealer';

    const visibleManagementItems = isDealer
        ? []
        : managementNavItems.filter((item) => {
            if (item.title === 'Sync Review') {
                return isSuperAdmin;
            }
            return true;
        });

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={gbpNavItems} label="Google Bisnis Profile" />
                {!isDealer && visibleManagementItems.length > 0 && (
                    <NavMain items={visibleManagementItems} label="Management" />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
