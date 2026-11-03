<?php

namespace App\Models;

use Database\Factories\SocialMediaProfileFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SocialMediaProfile extends Model
{
    /** @use HasFactory<SocialMediaProfileFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'nama_lengkap',
        'link_youtube',
        'total_subscribe_youtube',
        'link_instagram',
        'total_follower_ig',
        'link_tiktok',
        'total_follower_tiktok',
        'link_facebook',
        'total_follower_fb',
        'no_hp',
        'email',
        'tanggal_lahir',
        'bulan_lahir',
        'ukuran_helm',
        'ukuran_jaket',
        'ukuran_sarung_tangan',
        'ukuran_sepatu',
        'alamat_rumah',
        'domisili',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'total_subscribe_youtube' => 'integer',
            'total_follower_ig' => 'integer',
            'total_follower_tiktok' => 'integer',
            'total_follower_fb' => 'integer',
            'tanggal_lahir' => 'integer',
        ];
    }
}
