<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportSocialMediaProfileRequest;
use App\Http\Requests\StoreSocialMediaProfileRequest;
use App\Http\Requests\UpdateSocialMediaProfileRequest;
use App\Models\SocialMediaProfile;
use App\Services\SocialMediaProfileExcelService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

class SocialMediaProfileController extends Controller
{
    /**
     * Display a listing of social media profiles.
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->value();

        $profiles = SocialMediaProfile::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($q) use ($search): void {
                    $q->where('nama_lengkap', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('no_hp', 'like', "%{$search}%")
                        ->orWhere('domisili', 'like', "%{$search}%")
                        ->orWhere('alamat_rumah', 'like', "%{$search}%");
                });
            })
            ->latest('id')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('social-media/profile/index', [
            'profiles' => $profiles,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    /**
     * Store a newly created social media profile in storage.
     */
    public function store(StoreSocialMediaProfileRequest $request): RedirectResponse
    {
        SocialMediaProfile::create($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Profile sosial media berhasil ditambahkan.',
        ]);

        return to_route('social-media.profile.index');
    }

    /**
     * Update the specified social media profile in storage.
     */
    public function update(UpdateSocialMediaProfileRequest $request, SocialMediaProfile $profile): RedirectResponse
    {
        $profile->update($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Profile sosial media berhasil diperbarui.',
        ]);

        return to_route('social-media.profile.index');
    }

    /**
     * Remove the specified social media profile from storage.
     */
    public function destroy(SocialMediaProfile $profile): RedirectResponse
    {
        $profile->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Profile sosial media berhasil dihapus.',
        ]);

        return to_route('social-media.profile.index');
    }

    /**
     * Download the social media profile Excel template.
     */
    public function template(SocialMediaProfileExcelService $excelService): SymfonyResponse
    {
        $content = $excelService->generateTemplateXlsx();

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="template_social_media_profile.xlsx"',
            'Content-Length' => (string) strlen($content),
        ]);
    }

    /**
     * Export social media profiles to XLSX or CSV spreadsheet based on active filters.
     */
    public function export(Request $request, SocialMediaProfileExcelService $excelService): SymfonyResponse
    {
        $search = $request->string('search')->trim()->value();
        $format = strtolower($request->string('format', 'xlsx')->trim()->value());

        $profiles = SocialMediaProfile::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($q) use ($search): void {
                    $q->where('nama_lengkap', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('no_hp', 'like', "%{$search}%")
                        ->orWhere('domisili', 'like', "%{$search}%")
                        ->orWhere('alamat_rumah', 'like', "%{$search}%");
                });
            })
            ->latest('id')
            ->get();

        if ($format === 'csv') {
            $content = $excelService->exportCsv($profiles);
            $filename = 'social_media_profiles_export_'.now()->format('Ymd_His').'.csv';

            return response($content, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Content-Length' => (string) strlen($content),
            ]);
        }

        $content = $excelService->export($profiles);
        $filename = 'social_media_profiles_export_'.now()->format('Ymd_His').'.xlsx';

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Content-Length' => (string) strlen($content),
        ]);
    }

    /**
     * Import social media profiles from an uploaded Excel or CSV file.
     */
    public function import(ImportSocialMediaProfileRequest $request, SocialMediaProfileExcelService $excelService): RedirectResponse
    {
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $updateExisting = $request->boolean('update_existing', true);

        try {
            $result = $excelService->import($file, $updateExisting);

            $message = "Import berhasil: {$result['imported']} profile baru ditambahkan";
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

        return to_route('social-media.profile.index');
    }
}
