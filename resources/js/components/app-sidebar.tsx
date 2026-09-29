import { Link, usePage } from '@inertiajs/react';
import { Activity, BarChart3, Building2, Calculator, Compass, LayoutGrid, RefreshCw, Star, Users } from 'lucide-react';
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
import dealerOverviewRoute from '@/routes/dealer-overview';
import dealers from '@/routes/dealers';
import gmbClusterRoute from '@/routes/gmb-cluster';
import monitoringFeedbackRoute from '@/routes/monitoring-feedback';
import ratingSimulasi from '@/routes/rating-simulasi';
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
        title: 'Monitoring Feedback',
        href: monitoringFeedbackRoute.index(),
        icon: Activity,
    },
    {
        title: 'Dealer Overview',
        href: dealerOverviewRoute.index(),
        icon: BarChart3,
    },
    {
        title: 'GMB Cluster',
        href: gmbClusterRoute.index(),
        icon: Compass,
    },
    {
        title: 'Review',
        href: reviews.index(),
        icon: Star,
    },
    {
        title: 'Rating Simulasi',
        href: ratingSimulasi.index(),
        icon: Calculator,
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
