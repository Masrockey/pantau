<?php

namespace Database\Factories;

use App\Models\Dealer;
use App\Models\ScrapingSchedule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ScrapingSchedule>
 */
class ScrapingScheduleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'dealer_id' => null, // null for all dealers
            'max_reviews' => fake()->randomElement([50, 100, 200]),
            'sort_by' => fake()->randomElement(['newest', 'highest', 'lowest', 'relevant']),
            'interval_value' => fake()->randomElement([10, 15, 30, 60]),
            'interval_unit' => 'minute',
            'use_proxy' => true,
            'is_active' => true,
            'last_run_at' => null,
            'next_run_at' => now()->addMinutes(30),
            'last_status' => 'idle',
            'last_message' => null,
        ];
    }

    /**
     * Indicate that the schedule belongs to a specific dealer.
     */
    public function forDealer(?Dealer $dealer = null): static
    {
        return $this->state(fn (array $attributes) => [
            'dealer_id' => $dealer?->id ?? Dealer::factory(),
        ]);
    }

    /**
     * Indicate that the schedule is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
