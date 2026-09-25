<?php

namespace Database\Factories;

use App\Models\Dealer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Dealer>
 */
class DealerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $lat = fake()->latitude();
        $lng = fake()->longitude();

        return [
            'kode_dealer' => 'DLR'.fake()->unique()->numerify('####'),
            'nama_dealer' => 'Dealer '.fake()->city(),
            'link_google_maps' => "https://maps.google.com/?q={$lat},{$lng}",
            'latitude' => $lat,
            'longitude' => $lng,
            'alamat' => fake()->streetAddress(),
            'kelurahan' => fake()->citySuffix(),
            'kecamatan' => fake()->city(),
            'pos_code' => fake()->postcode(),
            'no_telp_showroom' => fake()->phoneNumber(),
            'star_rate' => fake()->randomFloat(2, 3, 5),
            'total_review' => fake()->numberBetween(10, 500),
        ];
    }
}
