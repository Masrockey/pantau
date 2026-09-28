<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->unique()->after('name');
        });

        // Populate username for existing users
        User::query()->each(function (User $user): void {
            if (empty($user->username)) {
                $base = Str::slug(Str::before($user->email, '@'), '_');
                $candidate = $base ?: Str::slug($user->name, '_');
                $uniqueUsername = $candidate;
                $i = 1;
                while (User::where('username', $uniqueUsername)->where('id', '!=', $user->id)->exists()) {
                    $uniqueUsername = "{$candidate}_{$i}";
                    $i++;
                }
                $user->username = $uniqueUsername;
                $user->save();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('username');
        });
    }
};
