<?php

namespace Database\Factories;

use App\Models\SocialMediaPosting;
use App\Models\SocialMediaProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialMediaPosting>
 */
class SocialMediaPostingFactory extends Factory
{
    protected $model = SocialMediaPosting::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $brands = ['Honda', 'Kawasaki', 'Yamaha', 'Aprilia', 'TVS', 'Bajaj', 'KTM', 'Piaggio', 'MV Agusta', 'All Brand'];
        $platforms = ['ig', 'TikTok', 'facebook', 'youtube'];
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        return [
            'social_media_profile_id' => SocialMediaProfile::factory(),
            'jenis_sosmed' => fake()->randomElement($platforms),
            'tanggal_rilis' => fake()->dateTimeBetween('-1 year', 'now')->format('Y-m-d'),
            'bulan_entry' => fake()->randomElement($months),
            'caption' => fake()->paragraph(),
            'link' => fake()->url(),
            'brand' => fake()->randomElement($brands),
            'total_komentar' => fake()->numberBetween(0, 5000),
            'total_views' => fake()->numberBetween(100, 1000000),
        ];
    }
}
