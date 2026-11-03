<?php

namespace Database\Factories;

use App\Models\SocialMediaProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialMediaProfile>
 */
class SocialMediaProfileFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama_lengkap' => fake()->name(),
            'link_youtube' => 'https://youtube.com/@'.fake()->userName(),
            'total_subscribe_youtube' => fake()->numberBetween(1000, 500000),
            'link_instagram' => 'https://instagram.com/'.fake()->userName(),
            'total_follower_ig' => fake()->numberBetween(2000, 1000000),
            'link_tiktok' => 'https://tiktok.com/@'.fake()->userName(),
            'total_follower_tiktok' => fake()->numberBetween(5000, 2000000),
            'link_facebook' => 'https://facebook.com/'.fake()->userName(),
            'total_follower_fb' => fake()->numberBetween(500, 250000),
            'no_hp' => fake()->phoneNumber(),
            'email' => fake()->safeEmail(),
            'tanggal_lahir' => fake()->numberBetween(1, 28),
            'bulan_lahir' => fake()->randomElement([
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
            ]),
            'ukuran_helm' => fake()->randomElement(['S', 'M', 'L', 'XL', 'XXL']),
            'ukuran_jaket' => fake()->randomElement(['S', 'M', 'L', 'XL', 'XXL']),
            'ukuran_sarung_tangan' => fake()->randomElement(['S', 'M', 'L', 'XL']),
            'ukuran_sepatu' => (string) fake()->numberBetween(38, 45),
            'alamat_rumah' => fake()->address(),
            'domisili' => fake()->city(),
        ];
    }
}
