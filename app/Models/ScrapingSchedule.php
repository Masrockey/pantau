<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\ScrapingScheduleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $dealer_id
 * @property int $max_reviews
 * @property string $sort_by
 * @property int $interval_value
 * @property string $interval_unit
 * @property bool $use_proxy
 * @property bool $is_active
 * @property Carbon|null $last_run_at
 * @property Carbon|null $next_run_at
 * @property string $last_status
 * @property string|null $last_message
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Dealer|null $dealer
 * @property-read string $formatted_interval
 */
#[Fillable([
    'dealer_id',
    'max_reviews',
    'sort_by',
    'interval_value',
    'interval_unit',
    'use_proxy',
    'is_active',
    'last_run_at',
    'next_run_at',
    'last_status',
    'last_message',
])]
class ScrapingSchedule extends Model
{
    /** @use HasFactory<ScrapingScheduleFactory> */
    use HasFactory;

    /**
     * @var array<int, string>
     */
    protected $appends = [
        'formatted_interval',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'dealer_id' => 'integer',
            'max_reviews' => 'integer',
            'interval_value' => 'integer',
            'use_proxy' => 'boolean',
            'is_active' => 'boolean',
            'last_run_at' => 'datetime',
            'next_run_at' => 'datetime',
        ];
    }

    /**
     * Get the dealer associated with the schedule.
     *
     * @return BelongsTo<Dealer, $this>
     */
    public function dealer(): BelongsTo
    {
        return $this->belongsTo(Dealer::class);
    }

    /**
     * Calculate the next execution time based on the interval.
     */
    public function calculateNextRun(?CarbonInterface $from = null): CarbonInterface
    {
        $base = $from ? $from->copy() : now();
        $val = max(1, (int) $this->interval_value);

        return match ($this->interval_unit) {
            'minute' => $base->addMinutes(max(5, $val)),
            'hour' => $base->addHours($val),
            'day' => $base->addDays($val),
            'week' => $base->addWeeks($val),
            default => $base->addMinutes(max(5, $val)),
        };
    }

    /**
     * Human-readable interval string.
     */
    public function getFormattedIntervalAttribute(): string
    {
        $unitLabel = match ($this->interval_unit) {
            'minute' => 'Menit',
            'hour' => 'Jam',
            'day' => 'Hari',
            'week' => 'Minggu',
            default => $this->interval_unit,
        };

        return "Setiap {$this->interval_value} {$unitLabel}";
    }
}
