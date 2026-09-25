<?php

namespace App\Models;

use Database\Factories\ReviewFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $dealer_id
 * @property string $nama_reviewer
 * @property Carbon $tanggal_publish_review
 * @property float $star_rate
 * @property string|null $review
 * @property bool $respon_from_owner
 * @property Carbon|null $tanggal_respon
 * @property string|null $respon
 * @property string|null $google_review_url
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Dealer $dealer
 */
#[Fillable([
    'dealer_id',
    'nama_reviewer',
    'tanggal_publish_review',
    'star_rate',
    'review',
    'respon_from_owner',
    'tanggal_respon',
    'respon',
    'google_review_url',
])]
class Review extends Model
{
    /** @use HasFactory<ReviewFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'dealer_id' => 'integer',
            'tanggal_publish_review' => 'date',
            'star_rate' => 'float',
            'respon_from_owner' => 'boolean',
            'tanggal_respon' => 'date',
        ];
    }

    /**
     * Get the dealer that owns the review.
     *
     * @return BelongsTo<Dealer, $this>
     */
    public function dealer(): BelongsTo
    {
        return $this->belongsTo(Dealer::class);
    }
}
