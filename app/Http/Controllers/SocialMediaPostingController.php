<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportSocialMediaPostingRequest;
use App\Http\Requests\StoreSocialMediaPostingRequest;
use App\Http\Requests\UpdateSocialMediaPostingRequest;
use App\Models\SocialMediaPosting;
use App\Models\SocialMediaProfile;
use App\Services\SocialMediaPostingExcelService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

class SocialMediaPostingController extends Controller
{
    /**
     * Display a listing of social media postings.
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->value();
        $brand = $request->string('brand')->trim()->value();
        $jenisSosmed = $request->string('jenis_sosmed')->trim()->value();
        $bulanEntry = $request->string('bulan_entry')->trim()->value();

        $sorting = $this->parseSorting($request);

        $query = SocialMediaPosting::query()
            ->with('profile:id,nama_lengkap,email,no_hp,domisili')
            ->when($search !== '', function ($q) use ($search): void {
                $q->where(function ($sub) use ($search): void {
                    $sub->where('caption', 'like', "%{$search}%")
                        ->orWhere('link', 'like', "%{$search}%")
                        ->orWhereHas('profile', function ($pq) use ($search): void {
                            $pq->where('nama_lengkap', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%")
                                ->orWhere('domisili', 'like', "%{$search}%");
                        });
                });
            })
            ->when($brand !== '', function ($q) use ($brand): void {
                $q->where('brand', $brand);
            })
            ->when($jenisSosmed !== '', function ($q) use ($jenisSosmed): void {
                $q->where('jenis_sosmed', $jenisSosmed);
            })
            ->when($bulanEntry !== '', function ($q) use ($bulanEntry): void {
                $q->where('bulan_entry', $bulanEntry);
            });

        // Compute aggregates matching current filter
        $stats = [
            'total_postings' => (clone $query)->count(),
            'total_views' => (int) (clone $query)->sum('total_views'),
            'total_komentar' => (int) (clone $query)->sum('total_komentar'),
        ];

        $this->applySorting($query, $sorting['sort_by'], $sorting['sort_dir']);

        $postings = $query
            ->paginate(10)
            ->withQueryString();

        $profiles = SocialMediaProfile::query()
            ->orderBy('nama_lengkap', 'asc')
            ->get(['id', 'nama_lengkap', 'email', 'no_hp', 'domisili']);

        return Inertia::render('social-media/posting/index', [
            'postings' => $postings,
            'profiles' => $profiles,
            'stats' => $stats,
            'filters' => [
                'search' => $search,
                'brand' => $brand,
                'jenis_sosmed' => $jenisSosmed,
                'bulan_entry' => $bulanEntry,
                'sort_by' => $sorting['sort_by'],
                'sort_dir' => $sorting['sort_dir'],
                'sort' => $sorting['sort'],
            ],
        ]);
    }

    /**
     * Store a newly created social media posting in storage.
     */
    public function store(StoreSocialMediaPostingRequest $request): RedirectResponse
    {
        SocialMediaPosting::create($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Postingan sosial media berhasil ditambahkan.',
        ]);

        return to_route('social-media.posting.index');
    }

    /**
     * Update the specified social media posting in storage.
     */
    public function update(UpdateSocialMediaPostingRequest $request, SocialMediaPosting $posting): RedirectResponse
    {
        $posting->update($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Postingan sosial media berhasil diperbarui.',
        ]);

        return to_route('social-media.posting.index');
    }

    /**
     * Remove the specified social media posting from storage.
     */
    public function destroy(SocialMediaPosting $posting): RedirectResponse
    {
        $posting->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Postingan sosial media berhasil dihapus.',
        ]);

        return to_route('social-media.posting.index');
    }

    /**
     * Download the social media posting Excel template.
     */
    public function template(SocialMediaPostingExcelService $excelService): SymfonyResponse
    {
        $content = $excelService->generateTemplateXlsx();

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="template_social_media_posting.xlsx"',
            'Content-Length' => (string) strlen($content),
        ]);
    }

    /**
     * Export social media postings to XLSX or CSV spreadsheet based on active filters.
     */
    public function export(Request $request, SocialMediaPostingExcelService $excelService): SymfonyResponse
    {
        $search = $request->string('search')->trim()->value();
        $brand = $request->string('brand')->trim()->value();
        $jenisSosmed = $request->string('jenis_sosmed')->trim()->value();
        $bulanEntry = $request->string('bulan_entry')->trim()->value();
        $format = strtolower($request->string('format', 'xlsx')->trim()->value());

        $sorting = $this->parseSorting($request);

        $query = SocialMediaPosting::query()
            ->with('profile:id,nama_lengkap,email,no_hp,domisili')
            ->when($search !== '', function ($q) use ($search): void {
                $q->where(function ($sub) use ($search): void {
                    $sub->where('caption', 'like', "%{$search}%")
                        ->orWhere('link', 'like', "%{$search}%")
                        ->orWhereHas('profile', function ($pq) use ($search): void {
                            $pq->where('nama_lengkap', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%")
                                ->orWhere('domisili', 'like', "%{$search}%");
                        });
                });
            })
            ->when($brand !== '', function ($q) use ($brand): void {
                $q->where('brand', $brand);
            })
            ->when($jenisSosmed !== '', function ($q) use ($jenisSosmed): void {
                $q->where('jenis_sosmed', $jenisSosmed);
            })
            ->when($bulanEntry !== '', function ($q) use ($bulanEntry): void {
                $q->where('bulan_entry', $bulanEntry);
            });

        $this->applySorting($query, $sorting['sort_by'], $sorting['sort_dir']);

        $postings = $query->get();

        if ($format === 'csv') {
            $content = $excelService->exportCsv($postings);
            $filename = 'social_media_postings_export_'.now()->format('Ymd_His').'.csv';

            return response($content, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Content-Length' => (string) strlen($content),
            ]);
        }

        $content = $excelService->export($postings);
        $filename = 'social_media_postings_export_'.now()->format('Ymd_His').'.xlsx';

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Content-Length' => (string) strlen($content),
        ]);
    }

    /**
     * Import social media postings from an uploaded Excel or CSV file.
     */
    public function import(ImportSocialMediaPostingRequest $request, SocialMediaPostingExcelService $excelService): RedirectResponse
    {
        @set_time_limit(600);
        @ini_set('max_execution_time', '600');
        @ini_set('memory_limit', '512M');

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $updateExisting = $request->boolean('update_existing', true);
        $replaceAll = $request->boolean('replace_all', false);

        try {
            $result = $excelService->import($file, $updateExisting, $replaceAll);

            $message = "Import berhasil: {$result['imported']} postingan baru ditambahkan";
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

        return to_route('social-media.posting.index');
    }

    /**
     * Parse sorting parameters.
     *
     * @return array{sort_by: string, sort_dir: string, sort: string}
     */
    protected function parseSorting(Request $request): array
    {
        $sort = $request->string('sort')->trim()->value();
        $sortBy = 'tanggal';
        $sortDir = 'desc';

        if ($sort !== '') {
            $parts = explode('_', $sort);
            $dir = array_pop($parts);
            $by = implode('_', $parts);
            if (in_array($dir, ['asc', 'desc'], true) && in_array($by, ['tanggal', 'nama', 'views', 'komentar'], true)) {
                $sortBy = $by;
                $sortDir = $dir;
            }
        } else {
            $reqBy = $request->string('sort_by')->trim()->value();
            $reqDir = strtolower($request->string('sort_dir')->trim()->value());
            if (in_array($reqBy, ['tanggal', 'nama', 'views', 'komentar'], true)) {
                $sortBy = $reqBy;
            }
            if (in_array($reqDir, ['asc', 'desc'], true)) {
                $sortDir = $reqDir;
            }
        }

        return [
            'sort_by' => $sortBy,
            'sort_dir' => $sortDir,
            'sort' => "{$sortBy}_{$sortDir}",
        ];
    }

    /**
     * Apply sorting to posting query.
     */
    protected function applySorting($query, string $sortBy, string $sortDir): void
    {
        switch ($sortBy) {
            case 'nama':
                $query->orderBy(
                    SocialMediaProfile::select('nama_lengkap')
                        ->whereColumn('social_media_profiles.id', 'social_media_postings.social_media_profile_id'),
                    $sortDir
                )->orderBy('id', $sortDir);
                break;
            case 'views':
                $query->orderBy('total_views', $sortDir)->orderBy('id', $sortDir);
                break;
            case 'komentar':
                $query->orderBy('total_komentar', $sortDir)->orderBy('id', $sortDir);
                break;
            case 'tanggal':
            default:
                if ($sortDir === 'asc') {
                    $query->orderByRaw('tanggal_rilis IS NULL, tanggal_rilis ASC')->orderBy('id', 'asc');
                } else {
                    $query->orderByRaw('tanggal_rilis IS NULL, tanggal_rilis DESC')->orderByDesc('id');
                }
                break;
        }
    }
}
