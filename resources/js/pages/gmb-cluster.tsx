import { Head } from '@inertiajs/react';
import React from 'react';
import {
    GmbCluster as GmbClusterComponent,
    type GmbClusterDealerItem,
    type GmbClusterSummary,
} from '@/components/dashboard/gmb-cluster';
import { dashboard } from '@/routes';
import gmbClusterRoute from '@/routes/gmb-cluster';

interface GmbClusterPageProps {
    dealers: GmbClusterDealerItem[];
    summary: GmbClusterSummary | null;
    isGlobal: boolean;
    userRole: string;
}

export default function GmbClusterPage({
    dealers = [],
    summary = null,
}: GmbClusterPageProps) {
    return (
        <>
            <Head title="GMB Cluster - Pantau" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4 sm:p-6">
                <GmbClusterComponent
                    dealers={dealers}
                    summary={summary}
                />
            </div>
        </>
    );
}

GmbClusterPage.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard GBP',
            href: dashboard(),
        },
        {
            title: 'GMB Cluster',
            href: gmbClusterRoute.index(),
        },
    ],
};
