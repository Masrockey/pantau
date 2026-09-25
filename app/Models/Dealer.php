<?php

namespace App\Models;

use Database\Factories\DealerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $kode_dealer
 * @property string $nama_dealer
 * @property string|null $link_google_maps
 * @property float|null $latitude
 * @property float|null $longitude
 * @property string|null $alamat
 * @property string|null $kelurahan
 * @property string|null $kecamatan
 * @property string|null $pos_code
 * @property string|null $no_telp_showroom
 * @property float|null $star_rate
 * @property int|null $total_review
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Collection<int, User> $users
 * @property Collection<int, Review> $reviews
 */
#[Fillable([
    'kode_dealer',
    'nama_dealer',
    'link_google_maps',
    'latitude',
    'longitude',
    'alamat',
    'kelurahan',
    'kecamatan',
    'pos_code',
    'no_telp_showroom',
    'star_rate',
    'total_review',
])]
class Dealer extends Model
{
    /** @use HasFactory<DealerFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'star_rate' => 'float',
            'total_review' => 'integer',
        ];
    }

    /**
     * Get the users associated with the dealer.
     *
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Get the reviews associated with the dealer.
     *
     * @return HasMany<Review, $this>
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }
}
