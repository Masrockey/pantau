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
        Schema::create('scraping_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dealer_id')->nullable()->constrained('dealers')->nullOnDelete();
            $table->unsignedInteger('max_reviews')->default(50);
            $table->string('sort_by', 30)->default('newest');
            $table->unsignedInteger('interval_value')->default(30);
            $table->string('interval_unit', 20)->default('minute');
            $table->boolean('use_proxy')->default(true);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('last_run_at')->nullable();
            $table->timestamp('next_run_at')->nullable()->index();
            $table->string('last_status', 30)->default('idle');
            $table->text('last_message')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scraping_schedules');
    }
};
