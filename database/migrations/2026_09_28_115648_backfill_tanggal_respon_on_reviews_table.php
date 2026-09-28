<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('reviews')
            ->where('respon_from_owner', true)
            ->whereNull('tanggal_respon')
            ->update([
                'tanggal_respon' => DB::raw('COALESCE(tanggal_publish_review, CURRENT_DATE)'),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op rollback to avoid removing valid response dates
    }
};
