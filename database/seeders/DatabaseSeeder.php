<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Dealer;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            DealerSeeder::class,
            ReviewSeeder::class,
        ]);

        User::updateOrCreate(
            ['email' => 'superadmin@pantau.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('SuperAdmin123@'),
                'role' => UserRole::SuperAdmin,
                'dealer_id' => null,
                'email_verified_at' => now(),
            ]
        );

        $dealer1 = Dealer::where('kode_dealer', 'DLR001')->first();
        if ($dealer1) {
            User::updateOrCreate(
                ['email' => 'admindealer@pantau.com'],
                [
                    'name' => 'Admin Dealer Jakarta',
                    'password' => Hash::make('Password123@'),
                    'role' => UserRole::AdminDealer,
                    'dealer_id' => $dealer1->id,
                    'email_verified_at' => now(),
                ]
            );

            User::updateOrCreate(
                ['email' => 'userdealer@pantau.com'],
                [
                    'name' => 'Staff Dealer Jakarta',
                    'password' => Hash::make('Password123@'),
                    'role' => UserRole::User,
                    'dealer_id' => $dealer1->id,
                    'email_verified_at' => now(),
                ]
            );
        }
    }
}
