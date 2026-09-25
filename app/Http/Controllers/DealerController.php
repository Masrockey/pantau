<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportDealerRequest;
use App\Http\Requests\StoreDealerRequest;
use App\Http\Requests\UpdateDealerRequest;
use App\Models\Dealer;
use App\Services\DealerExcelService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

class DealerController extends Controller
{
    /**
     * Display a listing of dealers.
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->value();

        $dealers = Dealer::query()
            ->withCount('users')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($q) use ($search): void {
                    $q->where('kode_dealer', 'like', "%{$search}%")
                        ->orWhere('nama_dealer', 'like', "%{$search}%")
                        ->orWhere('alamat', 'like', "%{$search}%")
                        ->orWhere('kecamatan', 'like', "%{$search}%")
                        ->orWhere('kelurahan', 'like', "%{$search}%")
                        ->orWhere('no_telp_showroom', 'like', "%{$search}%");
                });
            })
            ->latest('id')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('dealers/index', [
            'dealers' => $dealers,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    /**
     * Store a newly created dealer in storage.
     */
    public function store(StoreDealerRequest $request): RedirectResponse
    {
        Dealer::create($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Dealer berhasil ditambahkan.',
        ]);

        return to_route('dealers.index');
    }

    /**
     * Update the specified dealer in storage.
     */
    public function update(UpdateDealerRequest $request, Dealer $dealer): RedirectResponse
    {
        $dealer->update($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Dealer berhasil diperbarui.',
        ]);

        return to_route('dealers.index');
    }

    /**
     * Remove the specified dealer from storage.
     */
    public function destroy(Dealer $dealer): RedirectResponse
    {
        if ($dealer->users()->exists()) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'Dealer tidak dapat dihapus karena masih memiliki user terhubung.',
            ]);

            return to_route('dealers.index');
        }

        $dealer->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Dealer berhasil dihapus.',
        ]);

        return to_route('dealers.index');
    }

    /**
     * Download the dealer Excel template.
     */
    public function template(DealerExcelService $excelService): SymfonyResponse
    {
        $content = $excelService->generateTemplateXlsx();

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="template_dealer.xlsx"',
            'Content-Length' => (string) strlen($content),
        ]);
    }

    /**
     * Import dealers from an uploaded Excel or CSV file.
     */
    public function import(ImportDealerRequest $request, DealerExcelService $excelService): RedirectResponse
    {
        /** @var UploadedFile $file */
        $file = $request->file('file');
        $updateExisting = $request->boolean('update_existing', true);

        try {
            $result = $excelService->import($file, $updateExisting);

            $message = "Import berhasil: {$result['imported']} dealer baru ditambahkan";
            if ($result['updated'] > 0) {
                $message .= ", {$result['updated']} data diperbarui";
            }
            $message .= '.';

            if (! empty($result['errors'])) {
                $message .= ' Catatan: '.implode(' ', array_slice($result['errors'], 0, 3));
            }

            Inertia::flash('toast', [
                'type' => 'success',
                'message' => $message,
            ]);
        } catch (Throwable $e) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'Gagal mengimpor file: '.$e->getMessage(),
            ]);
        }

        return to_route('dealers.index');
    }
}
