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
        Schema::create('social_media_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('nama_lengkap', 255);
            $table->string('link_youtube', 500)->nullable();
            $table->unsignedBigInteger('total_subscribe_youtube')->nullable()->default(0);
            $table->string('link_instagram', 500)->nullable();
            $table->unsignedBigInteger('total_follower_ig')->nullable()->default(0);
            $table->string('link_tiktok', 500)->nullable();
            $table->unsignedBigInteger('total_follower_tiktok')->nullable()->default(0);
            $table->string('link_facebook', 500)->nullable();
            $table->unsignedBigInteger('total_follower_fb')->nullable()->default(0);
            $table->string('no_hp', 50)->nullable();
            $table->string('email', 255)->nullable();
            $table->unsignedTinyInteger('tanggal_lahir')->nullable();
            $table->string('bulan_lahir', 50)->nullable();
            $table->string('ukuran_helm', 20)->nullable();
            $table->string('ukuran_jaket', 20)->nullable();
            $table->string('ukuran_sarung_tangan', 20)->nullable();
            $table->string('ukuran_sepatu', 20)->nullable();
            $table->text('alamat_rumah')->nullable();
            $table->string('domisili', 255)->nullable();
            $table->timestamps();

            $table->index('nama_lengkap');
            $table->index('domisili');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('social_media_profiles');
    }
};
