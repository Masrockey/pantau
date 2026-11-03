<?php

namespace App\Models;

use Database\Factories\SocialMediaPostingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialMediaPosting extends Model
{
    /** @use HasFactory<SocialMediaPostingFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'social_media_profile_id',
        'jenis_sosmed',
        'tanggal_rilis',
        'bulan_entry',
        'caption',
        'link',
        'brand',
        'total_komentar',
        'total_views',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tanggal_rilis' => 'date:Y-m-d',
            'total_komentar' => 'integer',
            'total_views' => 'integer',
        ];
    }

    /**
     * Get the profile that owns the posting.
     */
    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialMediaProfile::class, 'social_media_profile_id');
    }
}
