<?php
use IlluminateSupportFacadesRoute;
use App\Http\Controllers\ScenarioController;
Route::get('/health', fn () => ['ok'=>true,'mode'=>'simulation-only']);
Route::apiResource('scenarios', ScenarioController::class)->only(['index','store','show','destroy']);

