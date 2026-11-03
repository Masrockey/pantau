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
        Schema::create('social_media_postings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_media_profile_id')
                ->constrained('social_media_profiles')
                ->cascadeOnDelete();
            $table->string('jenis_sosmed', 50);
            $table->date('tanggal_rilis')->nullable();
            $table->string('bulan_entry', 50)->nullable();
            $table->text('caption')->nullable();
            $table->text('link')->nullable();
            $table->string('brand', 100);
            $table->unsignedBigInteger('total_komentar')->default(0);
            $table->unsignedBigInteger('total_views')->default(0);
            $table->timestamps();

            $table->index('jenis_sosmed');
            $table->index('brand');
            $table->index('bulan_entry');
            $table->index('tanggal_rilis');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('social_media_postings');
    }
};
