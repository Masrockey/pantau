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
            $table->text('alamat')->nullable()->after('longitude');
            $table->string('kelurahan', 100)->nullable()->after('alamat');
            $table->string('kecamatan', 100)->nullable()->after('kelurahan');
            $table->string('pos_code', 20)->nullable()->after('kecamatan');
            $table->string('no_telp_showroom', 50)->nullable()->after('pos_code');
            $table->decimal('star_rate', 3, 2)->nullable()->after('no_telp_showroom');
            $table->unsignedInteger('total_review')->nullable()->after('star_rate');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dealers', function (Blueprint $table) {
            $table->dropColumn([
                'alamat',
                'kelurahan',
                'kecamatan',
                'pos_code',
                'no_telp_showroom',
                'star_rate',
                'total_review',
            ]);
        });
    }
};
