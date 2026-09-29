<?php

namespace App\Services;

use App\Models\Dealer;
use App\Models\Review;
use Exception;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use ZipArchive;

class ReviewExcelService
{
    /**
     * Parse and import review records from an uploaded Excel or CSV file.
     *
     * @return array{imported: int, updated: int, total: int, errors: array<int, string>}
     */
    public function import(UploadedFile $file, bool $updateExisting = true, ?int $scopedDealerId = null): array
    {
        @ini_set('memory_limit', '512M');
        @set_time_limit(300);

        $rows = $this->readRows($file);

        if (empty($rows)) {
            throw new Exception('File Excel kosong atau format tidak dapat dibaca.');
        }

        $headerRow = array_shift($rows);
        if ($headerRow === null) {
            throw new Exception('File Excel tidak memiliki baris judul (header).');
        }

        $colIndices = $this->detectColumns($headerRow);

        if ($colIndices['nama_reviewer'] === null && $colIndices['review'] === null) {
            throw new Exception(
                'Kolom header tidak sesuai. Pastikan terdapat kolom "Nama Reviewer" atau "Review".'
            );
        }

        $imported = 0;
        $updated = 0;
        $errors = [];
        $affectedDealerIds = [];

        foreach ($rows as $rowIndex => $row) {
            $rowNumber = $rowIndex + 2; // +1 for 0-indexed, +1 for header row

            $kodeDealer = $colIndices['kode_dealer'] !== null
                ? trim((string) ($row[$colIndices['kode_dealer']] ?? ''))
                : '';
            $namaDealer = $colIndices['nama_dealer'] !== null
                ? trim((string) ($row[$colIndices['nama_dealer']] ?? ''))
                : '';
            $namaReviewer = $colIndices['nama_reviewer'] !== null
                ? trim((string) ($row[$colIndices['nama_reviewer']] ?? ''))
                : '';
            $rawDate = $colIndices['tanggal_publish_review'] !== null
                ? trim((string) ($row[$colIndices['tanggal_publish_review']] ?? ''))
                : '';
            $rawStar = $colIndices['star_rate'] !== null
                ? trim((string) ($row[$colIndices['star_rate']] ?? ''))
                : '';
            $reviewText = $colIndices['review'] !== null
                ? trim((string) ($row[$colIndices['review']] ?? ''))
                : '';
            $rawResponOwner = $colIndices['respon_from_owner'] !== null
                ? trim((string) ($row[$colIndices['respon_from_owner']] ?? ''))
                : '';
            $rawTanggalRespon = $colIndices['tanggal_respon'] !== null
                ? trim((string) ($row[$colIndices['tanggal_respon']] ?? ''))
                : '';
            $responText = $colIndices['respon'] !== null
                ? trim((string) ($row[$colIndices['respon']] ?? ''))
                : '';
            $googleReviewUrl = $colIndices['google_review_url'] !== null
                ? trim((string) ($row[$colIndices['google_review_url']] ?? ''))
                : '';

            // Skip completely empty rows
            if ($kodeDealer === '' && $namaDealer === '' && $namaReviewer === '' && $rawStar === '' && $reviewText === '') {
                continue;
            }

            // Determine dealer
            $dealer = null;
            if ($scopedDealerId) {
                $dealer = Dealer::find($scopedDealerId);
            } elseif ($kodeDealer !== '') {
                $dealer = Dealer::where('kode_dealer', strtoupper($kodeDealer))->first();
            } elseif ($namaDealer !== '') {
                $dealer = Dealer::where('nama_dealer', 'like', "%{$namaDealer}%")->first();
            }

            if (! $dealer) {
                $identifier = $kodeDealer !== '' ? "kode \"{$kodeDealer}\"" : ($namaDealer !== '' ? "nama \"{$namaDealer}\"" : 'tanpa identitas');
                $errors[] = "Baris {$rowNumber}: Dealer dengan {$identifier} tidak ditemukan dalam database.";

                continue;
            }

            // Fallback for reviewer name
            if ($namaReviewer === '') {
                $namaReviewer = 'Pengguna Google';
            }

            // Parse star rating (1 - 5)
            $starRate = 5.0;
            if ($rawStar !== '') {
                $cleanStar = str_replace(',', '.', preg_replace('/[^0-9,.]/', '', $rawStar));
                if (is_numeric($cleanStar)) {
                    $starRate = max(1.0, min(5.0, (float) $cleanStar));
                }
            }

            // Parse publish date
            $publishDate = $this->parseDate($rawDate);
            if (! $publishDate) {
                $publishDate = now()->format('Y-m-d');
            }

            // Parse owner response
            $hasOwnerResponse = $this->parseBoolean($rawResponOwner);
            if (! empty($responText)) {
                $hasOwnerResponse = true;
            }

            $tanggalRespon = null;
            if ($hasOwnerResponse) {
                $tanggalRespon = $this->parseDate($rawTanggalRespon);
                if (! $tanggalRespon) {
                    $tanggalRespon = $publishDate;
                }
            }

            // Deduplication / finding existing review
            $isAnonymous = in_array(
                mb_strtolower($namaReviewer),
                ['pengguna google', 'google user', 'a google user', 'anonymous', 'google customer', 'pelanggan google'],
                true
            );

            $existing = null;

            // 1. Match by google_review_url if provided
            if ($googleReviewUrl !== '') {
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('google_review_url', $googleReviewUrl)
                    ->first();
            }

            // 2. Match by author and publish date
            if (! $existing && ! $isAnonymous) {
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('nama_reviewer', $namaReviewer)
                    ->whereDate('tanggal_publish_review', $publishDate)
                    ->first();

                // If date was generic or not matched, match by author name on same dealer
                if (! $existing) {
                    $existing = Review::where('dealer_id', $dealer->id)
                        ->where('nama_reviewer', $namaReviewer)
                        ->first();
                }
            }

            // 3. Match by review text if non-empty
            if (! $existing && $reviewText !== '' && mb_strlen($reviewText) >= 8) {
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('review', $reviewText)
                    ->first();
            }

            if ($existing) {
                if ($updateExisting) {
                    $existing->update([
                        'nama_reviewer' => $namaReviewer,
                        'tanggal_publish_review' => $publishDate,
                        'star_rate' => $starRate,
                        'review' => $reviewText !== '' ? $reviewText : $existing->review,
                        'respon_from_owner' => $hasOwnerResponse,
                        'tanggal_respon' => $hasOwnerResponse ? ($tanggalRespon ?: $existing->tanggal_respon) : null,
                        'respon' => $hasOwnerResponse ? ($responText !== '' ? $responText : $existing->respon) : null,
                        'google_review_url' => $googleReviewUrl !== '' ? $googleReviewUrl : $existing->google_review_url,
                    ]);
                    $updated++;
                    $affectedDealerIds[$dealer->id] = true;
                }
            } else {
                Review::create([
                    'dealer_id' => $dealer->id,
                    'nama_reviewer' => $namaReviewer,
                    'tanggal_publish_review' => $publishDate,
                    'star_rate' => $starRate,
                    'review' => $reviewText !== '' ? $reviewText : null,
                    'respon_from_owner' => $hasOwnerResponse,
                    'tanggal_respon' => $hasOwnerResponse ? $tanggalRespon : null,
                    'respon' => $hasOwnerResponse && $responText !== '' ? $responText : null,
                    'google_review_url' => $googleReviewUrl !== '' ? $googleReviewUrl : null,
                ]);
                $imported++;
                $affectedDealerIds[$dealer->id] = true;
            }
        }

        // Recalculate stats for affected dealers
        foreach (array_keys($affectedDealerIds) as $dId) {
            $d = Dealer::find($dId);
            if ($d) {
                $dReviews = Review::where('dealer_id', $dId);
                $count = $dReviews->count();
                if ($count > 0) {
                    $avg = round((float) $dReviews->avg('star_rate'), 2);
                    $d->update([
                        'total_review' => $count,
                        'star_rate' => $avg,
                    ]);
                }
            }
        }

        return [
            'imported' => $imported,
            'updated' => $updated,
            'total' => $imported + $updated,
            'errors' => $errors,
        ];
    }

    /**
     * Parse date string into Y-m-d format.
     */
    protected function parseDate(string $raw): ?string
    {
        $raw = trim($raw);
        if ($raw === '' || $raw === '-') {
            return null;
        }

        // Excel serial date number
        if (is_numeric($raw) && (int) $raw > 10000 && (int) $raw < 70000) {
            $unix = ((int) $raw - 25569) * 86400;

            return gmdate('Y-m-d', $unix);
        }

        $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'Y/m/d', 'd.m.Y', 'm/d/Y'];
        foreach ($formats as $fmt) {
            try {
                $parsed = Carbon::createFromFormat($fmt, $raw);
                if ($parsed && $parsed->year > 1990 && $parsed->year < 2100) {
                    return $parsed->format('Y-m-d');
                }
            } catch (\Throwable) {
                // Try next format
            }
        }

        try {
            $parsed = Carbon::parse($raw);
            if ($parsed && $parsed->year > 1990 && $parsed->year < 2100) {
                return $parsed->format('Y-m-d');
            }
        } catch (\Throwable) {
            // Ignore parse errors
        }

        return null;
    }

    /**
     * Parse boolean string (ya/tidak, sudah/belum, 1/0, true/false).
     */
    protected function parseBoolean(string $value): bool
    {
        $clean = strtolower(trim($value));

        return in_array($clean, ['ya', 'yes', 'true', '1', 'sudah', 'y', 'v'], true);
    }

    /**
     * Read all rows from an Excel or CSV file.
     *
     * @return array<int, array<int, string>>
     */
    public function readRows(UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension());

        if ($extension === 'csv' || $extension === 'txt') {
            return $this->readCsvRows($file->getPathname());
        }

        try {
            return $this->readXlsxRows($file->getPathname());
        } catch (Exception) {
            return $this->readCsvRows($file->getPathname());
        }
    }

    /**
     * Read rows from an XLSX spreadsheet using ZipArchive and XML parsing.
     *
     * @return array<int, array<int, string>>
     */
    protected function readXlsxRows(string $filePath): array
    {
        $zip = new ZipArchive;
        if ($zip->open($filePath) !== true) {
            throw new Exception('Gagal membuka file Excel (.xlsx).');
        }

        // 1. Read shared strings
        $sharedStrings = [];
        $sharedStringsContent = $zip->getFromName('xl/sharedStrings.xml');
        if ($sharedStringsContent !== false) {
            $xml = simplexml_load_string($sharedStringsContent);
            if ($xml && isset($xml->si)) {
                foreach ($xml->si as $si) {
                    if (isset($si->t)) {
                        $sharedStrings[] = (string) $si->t;
                    } elseif (isset($si->r)) {
                        $text = '';
                        foreach ($si->r as $r) {
                            $text .= (string) $r->t;
                        }
                        $sharedStrings[] = $text;
                    } else {
                        $sharedStrings[] = '';
                    }
                }
            }
        }

        // 2. Locate worksheet
        $sheetPath = 'xl/worksheets/sheet1.xml';
        if ($zip->locateName($sheetPath) === false) {
            $found = false;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (str_starts_with((string) $name, 'xl/worksheets/sheet') && str_ends_with((string) $name, '.xml')) {
                    $sheetPath = (string) $name;
                    $found = true;
                    break;
                }
            }
            if (! $found) {
                $zip->close();
                throw new Exception('Tidak ada lembar kerja (worksheet) dalam file Excel.');
            }
        }

        $sheetContent = $zip->getFromName($sheetPath);
        $zip->close();

        if ($sheetContent === false) {
            throw new Exception('Gagal membaca lembar kerja Excel.');
        }

        $sheetXml = simplexml_load_string($sheetContent);
        if (! $sheetXml || ! isset($sheetXml->sheetData->row)) {
            return [];
        }

        $rows = [];
        foreach ($sheetXml->sheetData->row as $row) {
            $rowCells = [];
            foreach ($row->c as $c) {
                $cellRef = (string) $c['r'];
                $colIndex = $this->cellRefToColumnIndex($cellRef);

                $type = (string) $c['t'];
                $val = '';

                if ($type === 's') {
                    $idx = (int) $c->v;
                    $val = $sharedStrings[$idx] ?? '';
                } elseif ($type === 'inlineStr' && isset($c->is->t)) {
                    $val = (string) $c->is->t;
                } elseif (isset($c->v)) {
                    $val = (string) $c->v;
                }

                $rowCells[$colIndex] = $val;
            }

            if (! empty($rowCells)) {
                $maxIndex = max(array_keys($rowCells));
                $normalizedRow = [];
                for ($i = 0; $i <= $maxIndex; $i++) {
                    $normalizedRow[$i] = $rowCells[$i] ?? '';
                }
                $rows[] = $normalizedRow;
            }
        }

        return $rows;
    }

    /**
     * Read rows from a CSV file with automatic delimiter detection.
     *
     * @return array<int, array<int, string>>
     */
    protected function readCsvRows(string $filePath): array
    {
        $handle = fopen($filePath, 'r');
        if (! $handle) {
            return [];
        }

        $firstLine = fgets($handle);
        rewind($handle);

        $delimiter = ',';
        if ($firstLine !== false) {
            $delimiters = [',', ';', "\t", '|'];
            $bestCount = 0;
            foreach ($delimiters as $d) {
                $count = substr_count($firstLine, $d);
                if ($count > $bestCount) {
                    $bestCount = $count;
                    $delimiter = $d;
                }
            }
        }

        $rows = [];
        while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
            $rows[] = array_map(fn ($val) => trim((string) $val), $data);
        }

        fclose($handle);

        return $rows;
    }

    /**
     * Convert cell reference like "A1", "C2", "AA5" to 0-based column index.
     */
    protected function cellRefToColumnIndex(string $cellRef): int
    {
        if (preg_match('/^([A-Z]+)/i', $cellRef, $matches)) {
            $letters = strtoupper($matches[1]);
            $len = strlen($letters);
            $index = 0;
            for ($i = 0; $i < $len; $i++) {
                $index = $index * 26 + (ord($letters[$i]) - ord('A') + 1);
            }

            return $index - 1;
        }

        return 0;
    }

    /**
     * Detect column indices based on header names.
     *
     * @param  array<int, string>  $headerRow
     * @return array{
     *     kode_dealer: int|null,
     *     nama_dealer: int|null,
     *     nama_reviewer: int|null,
     *     tanggal_publish_review: int|null,
     *     star_rate: int|null,
     *     review: int|null,
     *     respon_from_owner: int|null,
     *     tanggal_respon: int|null,
     *     respon: int|null,
     *     google_review_url: int|null
     * }
     */
    protected function detectColumns(array $headerRow): array
    {
        $indices = [
            'kode_dealer' => null,
            'nama_dealer' => null,
            'nama_reviewer' => null,
            'tanggal_publish_review' => null,
            'star_rate' => null,
            'review' => null,
            'respon_from_owner' => null,
            'tanggal_respon' => null,
            'respon' => null,
            'google_review_url' => null,
        ];

        foreach ($headerRow as $index => $header) {
            $clean = strtolower(trim(str_replace(['_', '-'], ' ', $header)));

            if ($indices['kode_dealer'] === null && (
                str_contains($clean, 'kode dealer') ||
                $clean === 'kode' ||
                $clean === 'kd dealer' ||
                $clean === 'kodedealer' ||
                $clean === 'dealer code'
            )) {
                $indices['kode_dealer'] = $index;
            } elseif ($indices['nama_dealer'] === null && (
                str_contains($clean, 'nama dealer') ||
                $clean === 'dealer' ||
                $clean === 'namadealer'
            )) {
                $indices['nama_dealer'] = $index;
            } elseif ($indices['nama_reviewer'] === null && (
                str_contains($clean, 'reviewer') ||
                str_contains($clean, 'pelanggan') ||
                str_contains($clean, 'customer') ||
                $clean === 'nama' ||
                $clean === 'author'
            )) {
                $indices['nama_reviewer'] = $index;
            } elseif ($indices['tanggal_publish_review'] === null && (
                str_contains($clean, 'tanggal review') ||
                str_contains($clean, 'tgl review') ||
                str_contains($clean, 'tanggal ulasan') ||
                str_contains($clean, 'tgl ulasan') ||
                str_contains($clean, 'publish') ||
                $clean === 'tanggal' ||
                $clean === 'date'
            )) {
                $indices['tanggal_publish_review'] = $index;
            } elseif ($indices['star_rate'] === null && (
                str_contains($clean, 'star') ||
                str_contains($clean, 'rating') ||
                str_contains($clean, 'bintang') ||
                $clean === 'rate' ||
                $clean === 'skor'
            )) {
                $indices['star_rate'] = $index;
            } elseif ($indices['respon_from_owner'] === null && (
                str_contains($clean, 'respon from owner') ||
                str_contains($clean, 'respon owner') ||
                str_contains($clean, 'status respon') ||
                str_contains($clean, 'sudah direspon') ||
                $clean === 'responded'
            )) {
                $indices['respon_from_owner'] = $index;
            } elseif ($indices['tanggal_respon'] === null && (
                str_contains($clean, 'tanggal respon') ||
                str_contains($clean, 'tgl respon') ||
                str_contains($clean, 'tanggal balas') ||
                str_contains($clean, 'response date')
            )) {
                $indices['tanggal_respon'] = $index;
            } elseif ($indices['respon'] === null && (
                str_contains($clean, 'balasan') ||
                str_contains($clean, 'tanggapan') ||
                str_contains($clean, 'isi respon') ||
                $clean === 'respon' ||
                $clean === 'reply'
            )) {
                $indices['respon'] = $index;
            } elseif ($indices['review'] === null && (
                str_contains($clean, 'ulasan') ||
                str_contains($clean, 'komentar') ||
                str_contains($clean, 'isi review') ||
                $clean === 'review' ||
                $clean === 'feedback' ||
                $clean === 'text'
            )) {
                $indices['review'] = $index;
            } elseif ($indices['google_review_url'] === null && (
                str_contains($clean, 'google review url') ||
                str_contains($clean, 'link review') ||
                str_contains($clean, 'url review') ||
                str_contains($clean, 'link') ||
                str_contains($clean, 'url')
            )) {
                $indices['google_review_url'] = $index;
            }
        }

        // Positional fallback if standard column order matches
        if ($indices['kode_dealer'] === null && isset($headerRow[0])) {
            $indices['kode_dealer'] = 0;
        }
        if ($indices['nama_reviewer'] === null && isset($headerRow[1])) {
            $indices['nama_reviewer'] = 1;
        }
        if ($indices['tanggal_publish_review'] === null && isset($headerRow[2])) {
            $indices['tanggal_publish_review'] = 2;
        }
        if ($indices['star_rate'] === null && isset($headerRow[3])) {
            $indices['star_rate'] = 3;
        }
        if ($indices['review'] === null && isset($headerRow[4])) {
            $indices['review'] = 4;
        }
        if ($indices['respon_from_owner'] === null && isset($headerRow[5])) {
            $indices['respon_from_owner'] = 5;
        }
        if ($indices['tanggal_respon'] === null && isset($headerRow[6])) {
            $indices['tanggal_respon'] = 6;
        }
        if ($indices['respon'] === null && isset($headerRow[7])) {
            $indices['respon'] = 7;
        }
        if ($indices['google_review_url'] === null && isset($headerRow[8])) {
            $indices['google_review_url'] = 8;
        }

        return $indices;
    }

    /**
     * Generate a valid, clean XLSX template string for download.
     */
    public function generateTemplateXlsx(): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'xlsx_rev_tmpl');
        $zip = new ZipArchive;
        $zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>');

        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>');

        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Review" sheetId="1" r:id="rId1"/></sheets>
</workbook>');

        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>');

        $strings = [
            // Row 1 - Headers
            'Kode Dealer',
            'Nama Reviewer',
            'Tanggal Review',
            'Star Rate',
            'Review',
            'Respon From Owner',
            'Tanggal Respon',
            'Respon',
            'Google Review URL',

            // Row 2 - Sample 1
            'DLR001',
            'Budi Santoso',
            '2024-05-15',
            '5',
            'Pelayanan sangat memuaskan, tempat bersih, mekanik ramah dan profesional.',
            'Ya',
            '2024-05-16',
            'Terima kasih atas ulasannya Bapak Budi, kami senang bisa melayani Anda!',
            'https://maps.app.goo.gl/sample1',

            // Row 3 - Sample 2
            'DLR001',
            'Siti Rahma',
            '2024-05-18',
            '4',
            'Servis motor cepat selesai, ruang tunggu ber-AC dan nyaman.',
            'Ya',
            '2024-05-18',
            'Terima kasih atas masukannya Ibu Siti, sukses selalu untuk Anda!',
            'https://maps.app.goo.gl/sample2',

            // Row 4 - Sample 3
            'DLR002',
            'Ahmad Pratama',
            '2024-05-20',
            '5',
            'Pilihan sparepart lengkap dan proses transaksi cepat.',
            'Tidak',
            '',
            '',
            '',
        ];

        $sstXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'.count($strings).'" uniqueCount="'.count($strings).'">';
        foreach ($strings as $str) {
            $sstXml .= '<si><t>'.htmlspecialchars($str, ENT_XML1, 'UTF-8').'</t></si>';
        }
        $sstXml .= '</sst>';
        $zip->addFromString('xl/sharedStrings.xml', $sstXml);

        $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<sheetData>'
            .'<row r="1">'
            .'<c r="A1" t="s"><v>0</v></c>'
            .'<c r="B1" t="s"><v>1</v></c>'
            .'<c r="C1" t="s"><v>2</v></c>'
            .'<c r="D1" t="s"><v>3</v></c>'
            .'<c r="E1" t="s"><v>4</v></c>'
            .'<c r="F1" t="s"><v>5</v></c>'
            .'<c r="G1" t="s"><v>6</v></c>'
            .'<c r="H1" t="s"><v>7</v></c>'
            .'<c r="I1" t="s"><v>8</v></c>'
            .'</row>'
            .'<row r="2">'
            .'<c r="A2" t="s"><v>9</v></c>'
            .'<c r="B2" t="s"><v>10</v></c>'
            .'<c r="C2" t="s"><v>11</v></c>'
            .'<c r="D2" t="s"><v>12</v></c>'
            .'<c r="E2" t="s"><v>13</v></c>'
            .'<c r="F2" t="s"><v>14</v></c>'
            .'<c r="G2" t="s"><v>15</v></c>'
            .'<c r="H2" t="s"><v>16</v></c>'
            .'<c r="I2" t="s"><v>17</v></c>'
            .'</row>'
            .'<row r="3">'
            .'<c r="A3" t="s"><v>18</v></c>'
            .'<c r="B3" t="s"><v>19</v></c>'
            .'<c r="C3" t="s"><v>20</v></c>'
            .'<c r="D3" t="s"><v>21</v></c>'
            .'<c r="E3" t="s"><v>22</v></c>'
            .'<c r="F3" t="s"><v>23</v></c>'
            .'<c r="G3" t="s"><v>24</v></c>'
            .'<c r="H3" t="s"><v>25</v></c>'
            .'<c r="I3" t="s"><v>26</v></c>'
            .'</row>'
            .'<row r="4">'
            .'<c r="A4" t="s"><v>27</v></c>'
            .'<c r="B4" t="s"><v>28</v></c>'
            .'<c r="C4" t="s"><v>29</v></c>'
            .'<c r="D4" t="s"><v>30</v></c>'
            .'<c r="E4" t="s"><v>31</v></c>'
            .'<c r="F4" t="s"><v>32</v></c>'
            .'<c r="G4" t="s"><v>33</v></c>'
            .'<c r="H4" t="s"><v>34</v></c>'
            .'<c r="I4" t="s"><v>35</v></c>'
            .'</row>'
            .'</sheetData>'
            .'</worksheet>';
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);

        $zip->close();
        $content = (string) file_get_contents($tmp);
        unlink($tmp);

        return $content;
    }
}
