<?php

namespace App\Http\Controllers;

use App\Models\Dealer;
use Illuminate\Database\Eloquent\Builder;

abstract class Controller
{
    /**
     * Get sorted, distinct non-empty type_dealer values for the given dealer query.
     *
     * @param  Builder<Dealer>  $dealersQuery
     * @return array<int, string>
     */
    protected function resolveAvailableTypeDealers(Builder $dealersQuery): array
    {
        return (clone $dealersQuery)
            ->whereNotNull('type_dealer')
            ->where('type_dealer', '!=', '')
            ->distinct()
            ->orderBy('type_dealer')
            ->pluck('type_dealer')
            ->map(fn (mixed $type): string => (string) $type)
            ->values()
            ->all();
    }

    /**
     * Normalize request type_dealer input into unique filter tokens.
     *
     * @param  array<int, string>  $availableTypeDealers
     * @return array<int, string>
     */
    protected function parseTypeDealerFilters(mixed $rawTypeDealer, array $availableTypeDealers): array
    {
        return collect(is_array($rawTypeDealer) ? $rawTypeDealer : [$rawTypeDealer])
            ->filter(fn (mixed $value): bool => is_scalar($value))
            ->flatMap(function (mixed $value) use ($availableTypeDealers): array {
                $trimmed = trim((string) $value);
                if ($trimmed === '' || $trimmed === 'all') {
                    return [];
                }

                if ($trimmed === '__empty__' || in_array($trimmed, $availableTypeDealers, true)) {
                    return [$trimmed];
                }

                if (str_contains($trimmed, ',')) {
                    return array_values(array_filter(
                        array_map('trim', explode(',', $trimmed)),
                        fn (string $part): bool => $part !== '' && $part !== 'all',
                    ));
                }

                return [$trimmed];
            })
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Apply multi-select type_dealer constraints (including '__empty__' for null/blank) to a dealer query.
     *
     * @param  Builder<Dealer>  $dealersQuery
     * @param  array<int, string>  $selectedTypeDealers
     */
    protected function applyTypeDealerFilters(Builder $dealersQuery, array $selectedTypeDealers): void
    {
        if ($selectedTypeDealers === []) {
            return;
        }

        $includeEmpty = in_array('__empty__', $selectedTypeDealers, true);
        $exactTypes = array_values(array_filter(
            $selectedTypeDealers,
            fn (string $type): bool => $type !== '__empty__',
        ));

        $dealersQuery->where(function (Builder $query) use ($includeEmpty, $exactTypes): void {
            $hasCondition = false;

            if ($exactTypes !== []) {
                $query->whereIn('type_dealer', $exactTypes);
                $hasCondition = true;
            }

            if ($includeEmpty) {
                $applyEmpty = function (Builder $subQuery): void {
                    $subQuery->whereNull('type_dealer')
                        ->orWhere('type_dealer', '');
                };

                if ($hasCondition) {
                    $query->orWhere($applyEmpty);
                } else {
                    $query->where($applyEmpty);
                }
            }
        });
    }
}
