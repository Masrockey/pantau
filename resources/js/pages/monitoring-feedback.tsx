import { Head } from '@inertiajs/react';
import React from 'react';
import {
    MonitoringFeedback as MonitoringFeedbackComponent,
    type MonitoringFeedbackItem,
    type MonitoringFeedbackSummary,
} from '@/components/dashboard/monitoring-feedback';
import { dashboard } from '@/routes';
import monitoringFeedbackRoute from '@/routes/monitoring-feedback';

interface MonitoringFeedbackPageProps {
    dealers: MonitoringFeedbackItem[];
    summary: MonitoringFeedbackSummary | null;
    availableMonths: string[];
    activeMonth: string | null;
    prevMonth: string | null;
    startDate?: string | null;
    endDate?: string | null;
    prevStartDate?: string | null;
    prevEndDate?: string | null;
    activeRangeLabel?: string | null;
    selectedDealerId: string;
    isGlobal: boolean;
    userRole: string;
}

export default function MonitoringFeedbackPage({
    dealers = [],
    summary = null,
    availableMonths = [],
    activeMonth = null,
    prevMonth = null,
    startDate = null,
    endDate = null,
    prevStartDate = null,
    prevEndDate = null,
    activeRangeLabel = null,
    selectedDealerId = '',
}: MonitoringFeedbackPageProps) {
    return (
        <>
            <Head title="Monitoring Feedback - Pantau" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4 sm:p-6">
                <MonitoringFeedbackComponent
                    dealers={dealers}
                    summary={summary}
                    availableMonths={availableMonths}
                    activeMonth={activeMonth}
                    prevMonth={prevMonth}
                    startDate={startDate}
                    endDate={endDate}
                    prevStartDate={prevStartDate}
                    prevEndDate={prevEndDate}
                    activeRangeLabel={activeRangeLabel}
                    selectedDealerId={selectedDealerId}
                />
            </div>
        </>
    );
}

MonitoringFeedbackPage.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard GBP',
            href: dashboard(),
        },
        {
            title: 'Monitoring Feedback',
            href: monitoringFeedbackRoute.index(),
        },
    ],
};
