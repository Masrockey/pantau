import { Head } from '@inertiajs/react';
import React from 'react';
import {
    DealerOverview as DealerOverviewComponent,
    type DealerOverviewItem,
    type DealerOverviewSummary,
} from '@/components/dashboard/dealer-overview';
import { dashboard } from '@/routes';
import dealerOverviewRoute from '@/routes/dealer-overview';

interface DealerOverviewPageProps {
    dealers: DealerOverviewItem[];
    summary: DealerOverviewSummary | null;
    availableMonths: string[];
    activeMonth: string | null;
    selectedDealerId: string;
    isGlobal: boolean;
    userRole: string;
}

export default function DealerOverviewPage({
    dealers = [],
    summary = null,
    availableMonths = [],
    activeMonth = null,
    selectedDealerId = '',
}: DealerOverviewPageProps) {
    return (
        <>
            <Head title="Dealer Overview - Pantau" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4 sm:p-6">
                <DealerOverviewComponent
                    dealers={dealers}
                    summary={summary}
                    availableMonths={availableMonths}
                    activeMonth={activeMonth}
                    selectedDealerId={selectedDealerId}
                />
            </div>
        </>
    );
}

DealerOverviewPage.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard GBP',
            href: dashboard(),
        },
        {
            title: 'Dealer Overview',
            href: dealerOverviewRoute.index(),
        },
    ],
};
