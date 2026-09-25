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
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dealer_id')->constrained('dealers')->cascadeOnDelete();
            $table->string('nama_reviewer');
            $table->date('tanggal_publish_review');
            $table->decimal('star_rate', 3, 2);
            $table->text('review')->nullable();
            $table->boolean('respon_from_owner')->default(false);
            $table->date('tanggal_respon')->nullable();
            $table->text('respon')->nullable();
            $table->text('google_review_url')->nullable();
            $table->timestamps();

            $table->index(['dealer_id', 'star_rate']);
            $table->index('tanggal_publish_review');
            $table->index('respon_from_owner');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
