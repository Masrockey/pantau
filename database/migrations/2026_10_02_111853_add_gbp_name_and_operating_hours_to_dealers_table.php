<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('dealers', function (Blueprint $table) {
            $table->string('nama_dealer_gbp', 255)->nullable()->after('nama_dealer');
            $table->string('jam_buka_weekday', 100)->nullable()->after('no_telp_showroom');
            $table->string('jam_buka_sabtu', 100)->nullable()->after('jam_buka_weekday');
            $table->string('jam_buka_minggu', 100)->nullable()->after('jam_buka_sabtu');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dealers', function (Blueprint $table) {
            $table->dropColumn([
                'nama_dealer_gbp',
                'jam_buka_weekday',
                'jam_buka_sabtu',
                'jam_buka_minggu',
            ]);
        });
    }
};
