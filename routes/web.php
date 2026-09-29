<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DealerController;
use App\Http\Controllers\DealerOverviewController;
use App\Http\Controllers\GmbClusterController;
use App\Http\Controllers\MonitoringFeedbackController;
use App\Http\Controllers\RatingSimulationController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\ScrapingScheduleController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', 'login')->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('monitoring-feedback', [MonitoringFeedbackController::class, 'index'])->name('monitoring-feedback.index');
    Route::get('dealer-overview', [DealerOverviewController::class, 'index'])->name('dealer-overview.index');
    Route::get('gmb-cluster', [GmbClusterController::class, 'index'])->name('gmb-cluster.index');
    Route::get('rating-simulasi', [RatingSimulationController::class, 'index'])->name('rating-simulasi.index');

    Route::get('dealers/template', [DealerController::class, 'template'])->name('dealers.template');
    Route::post('dealers/import', [DealerController::class, 'import'])->name('dealers.import');
    Route::resource('dealers', DealerController::class)->except(['create', 'show', 'edit']);
    Route::resource('users', UserController::class)->except(['create', 'show', 'edit']);
    Route::get('reviews/scraper-health', [ReviewController::class, 'checkHealth'])->name('reviews.scraper-health');
    Route::get('reviews/sync', [ReviewController::class, 'syncPage'])->name('reviews.sync.index');
    Route::post('reviews/sync', [ReviewController::class, 'startSync'])->name('reviews.sync.start');
    Route::get('reviews/sync/progress', [ReviewController::class, 'syncProgress'])->name('reviews.sync.progress');
    Route::post('reviews/sync/cancel', [ReviewController::class, 'cancelSync'])->name('reviews.sync.cancel');
    Route::post('reviews/sync/reset', [ReviewController::class, 'resetSync'])->name('reviews.sync.reset');
    Route::post('reviews/sync/clear-logs', [ReviewController::class, 'clearSyncLogs'])->name('reviews.sync.clear-logs');
    Route::get('reviews/sync/{jobId}', [ReviewController::class, 'checkSyncStatus'])->name('reviews.sync.status');
    Route::post('reviews/sync/schedules', [ScrapingScheduleController::class, 'store'])->name('reviews.sync.schedules.store');
    Route::put('reviews/sync/schedules/{schedule}', [ScrapingScheduleController::class, 'update'])->name('reviews.sync.schedules.update');
    Route::delete('reviews/sync/schedules/{schedule}', [ScrapingScheduleController::class, 'destroy'])->name('reviews.sync.schedules.destroy');
    Route::post('reviews/sync/schedules/{schedule}/toggle', [ScrapingScheduleController::class, 'toggle'])->name('reviews.sync.schedules.toggle');
    Route::post('reviews/sync/schedules/{schedule}/run', [ScrapingScheduleController::class, 'run'])->name('reviews.sync.schedules.run');
    Route::get('reviews/template', [ReviewController::class, 'template'])->name('reviews.template');
    Route::post('reviews/import', [ReviewController::class, 'import'])->name('reviews.import');
    Route::resource('reviews', ReviewController::class)->except(['create', 'show', 'edit']);
});

require __DIR__.'/settings.php';
