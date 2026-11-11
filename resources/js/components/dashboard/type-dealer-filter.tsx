import { router } from '@inertiajs/react';
import { Select as AntSelect } from 'antd';
import React from 'react';

export const EMPTY_TYPE_DEALER_VALUE = '__empty__';

export function isTypeDealerUrlKey(key: string): boolean {
    return (
        key === 'type_dealer' ||
        key === 'type_dealer[]' ||
        /^type_dealer\[\d*\]$/.test(key)
    );
}

export function hasUrlTypeFilter(selectedTypeDealers: ReadonlyArray<string>): boolean {
    if (selectedTypeDealers.length > 0) {
        return true;
    }

    const currentParams = new URLSearchParams(window.location.search);
    for (const key of currentParams.keys()) {
        if (isTypeDealerUrlKey(key)) {
            return true;
        }
    }

    return false;
}

export function buildTypeDealerNavigationParams(
    selectedTypeDealers: ReadonlyArray<string>,
    typeDealerFilter: string[],
    typeDealersOverride?: string[] | null,
): Record<string, string | string[]> {
    const currentParams = new URLSearchParams(window.location.search);
    const result: Record<string, string | string[]> = {};

    for (const [key, value] of currentParams.entries()) {
        if (!isTypeDealerUrlKey(key)) {
            result[key] = value;
        }
    }

    const effectiveTypeDealers =
        typeDealersOverride !== undefined ? typeDealersOverride : typeDealerFilter;

    if (
        effectiveTypeDealers &&
        effectiveTypeDealers.length > 0 &&
        hasUrlTypeFilter(selectedTypeDealers)
    ) {
        result.type_dealer = effectiveTypeDealers;
    }

    return result;
}

export function matchesTypeDealerSelection(
    typeDealer: string | null | undefined,
    selectedSet: ReadonlySet<string>,
): boolean {
    if (selectedSet.size === 0) {
        return true;
    }

    const rawType = (typeDealer || '').trim();
    if (rawType === '') {
        return selectedSet.has(EMPTY_TYPE_DEALER_VALUE);
    }

    return selectedSet.has(rawType);
}

export interface TypeDealerOptionsData {
    values: string[];
    hasEmpty: boolean;
}

export function useTypeDealerFilter(
    dealers: ReadonlyArray<{ type_dealer?: string | null }>,
    availableTypeDealers: ReadonlyArray<string>,
    selectedTypeDealers: string[],
    onFilterChange?: () => void,
) {
    const [typeDealerFilter, setTypeDealerFilter] = React.useState<string[]>(
        selectedTypeDealers,
    );

    const selectedTypeDealersKey = selectedTypeDealers.join('\0');
    const prevSelectedTypeDealersKeyRef = React.useRef(selectedTypeDealersKey);

    React.useEffect(() => {
        if (prevSelectedTypeDealersKeyRef.current !== selectedTypeDealersKey) {
            prevSelectedTypeDealersKeyRef.current = selectedTypeDealersKey;
            setTypeDealerFilter(selectedTypeDealers);
        }
    }, [selectedTypeDealersKey, selectedTypeDealers]);

    const typeDealerOptions = React.useMemo<TypeDealerOptionsData>(() => {
        const types = new Set<string>(
            availableTypeDealers.map((t) => t.trim()).filter(Boolean),
        );
        let hasEmpty =
            selectedTypeDealers.includes(EMPTY_TYPE_DEALER_VALUE) ||
            typeDealerFilter.includes(EMPTY_TYPE_DEALER_VALUE);

        for (const d of dealers) {
            const t = d.type_dealer?.trim();
            if (t) {
                types.add(t);
            } else {
                hasEmpty = true;
            }
        }

        return {
            values: Array.from(types).sort((a, b) => a.localeCompare(b)),
            hasEmpty,
        };
    }, [dealers, availableTypeDealers, selectedTypeDealers, typeDealerFilter]);

    const handleTypeDealerChange = (values: string[]) => {
        const nextValues = values.filter(Boolean);
        setTypeDealerFilter(nextValues);
        onFilterChange?.();

        if (hasUrlTypeFilter(selectedTypeDealers)) {
            const nextParams = buildTypeDealerNavigationParams(
                selectedTypeDealers,
                nextValues,
                nextValues,
            );
            router.get(window.location.pathname, nextParams, {
                preserveState: true,
                preserveScroll: true,
            });
        }
    };

    const buildNavigationParams = (typeDealersOverride?: string[] | null) =>
        buildTypeDealerNavigationParams(
            selectedTypeDealers,
            typeDealerFilter,
            typeDealersOverride,
        );

    return {
        typeDealerFilter,
        typeDealerOptions,
        handleTypeDealerChange,
        buildNavigationParams,
    };
}

interface TypeDealerFilterSelectProps {
    value: string[];
    options: TypeDealerOptionsData;
    onChange: (values: string[]) => void;
}

export function TypeDealerFilterSelect({
    value,
    options,
    onChange,
}: TypeDealerFilterSelectProps) {
    return (
        <AntSelect<string[]>
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
            value={value}
            onChange={(vals) => onChange(vals ?? [])}
            options={[
                ...options.values.map((t) => ({
                    value: t,
                    label: t,
                })),
                ...(options.hasEmpty
                    ? [{ value: EMPTY_TYPE_DEALER_VALUE, label: 'Tanpa Type (Kosong)' }]
                    : []),
            ]}
            placeholder="Semua Type Dealer"
            className="w-48 sm:w-56 text-xs"
            popupMatchSelectWidth={false}
            aria-label="Filter Type Dealer"
        />
    );
}

