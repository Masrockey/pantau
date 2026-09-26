<?php

use App\Http\Controllers\DealerController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::get('dealers/template', [DealerController::class, 'template'])->name('dealers.template');
    Route::post('dealers/import', [DealerController::class, 'import'])->name('dealers.import');
    Route::resource('dealers', DealerController::class)->except(['create', 'show', 'edit']);
    Route::resource('users', UserController::class)->except(['create', 'show', 'edit']);
    Route::get('reviews/scraper-health', [ReviewController::class, 'checkHealth'])->name('reviews.scraper-health');
    Route::get('reviews/sync', [ReviewController::class, 'syncPage'])->name('reviews.sync.index');
    Route::post('reviews/sync', [ReviewController::class, 'startSync'])->name('reviews.sync.start');
    Route::get('reviews/sync/{jobId}', [ReviewController::class, 'checkSyncStatus'])->name('reviews.sync.status');
    Route::resource('reviews', ReviewController::class)->except(['create', 'show', 'edit']);
});

require __DIR__.'/settings.php';
