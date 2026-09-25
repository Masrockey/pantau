<?php

namespace Database\Factories;

use App\Models\Dealer;
use App\Models\Review;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Review>
 */
class ReviewFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $publishDate = fake()->dateTimeBetween('-6 months', 'now');
        $hasResponse = fake()->boolean(65);

        return [
            'dealer_id' => Dealer::factory(),
            'nama_reviewer' => fake()->name(),
            'tanggal_publish_review' => $publishDate->format('Y-m-d'),
            'star_rate' => fake()->randomElement([5.00, 5.00, 4.00, 4.50, 4.00, 3.00, 2.00, 1.00]),
            'review' => fake()->paragraph(),
            'respon_from_owner' => $hasResponse,
            'tanggal_respon' => $hasResponse
                ? fake()->dateTimeBetween($publishDate, 'now')->format('Y-m-d')
                : null,
            'respon' => $hasResponse
                ? 'Terima kasih atas ulasan dan masukan Anda. Kepuasan pelanggan adalah prioritas utama kami.'
                : null,
            'google_review_url' => 'https://maps.app.goo.gl/'.fake()->lexify('????????????'),
        ];
    }

    /**
     * Indicate that the review has been responded to by owner.
     */
    public function responded(): static
    {
        return $this->state(fn (array $attributes) => [
            'respon_from_owner' => true,
            'tanggal_respon' => now()->toDateString(),
            'respon' => 'Terima kasih telah mengunjungi dealer kami!',
        ]);
    }

    /**
     * Indicate that the review has not been responded to.
     */
    public function unresponded(): static
    {
        return $this->state(fn (array $attributes) => [
            'respon_from_owner' => false,
            'tanggal_respon' => null,
            'respon' => null,
        ]);
    }
}
