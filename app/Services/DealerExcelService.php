<?php

namespace App\Services;

use App\Models\Dealer;
use Exception;
use Illuminate\Http\UploadedFile;
use ZipArchive;

class DealerExcelService
{
    /**
     * Parse and import dealer records from an uploaded Excel or CSV file.
     *
     * @return array{imported: int, updated: int, total: int, errors: array<int, string>}
     */
    public function import(UploadedFile $file, bool $updateExisting = true): array
    {
        $rows = $this->readRows($file);

        if (empty($rows)) {
            throw new Exception('File Excel kosong atau format tidak dapat dibaca.');
        }

        $headerRow = array_shift($rows);
        if ($headerRow === null) {
            throw new Exception('File Excel tidak memiliki baris judul (header).');
        }

        $colIndices = $this->detectColumns($headerRow);
        if ($colIndices['kode_dealer'] === null || $colIndices['nama_dealer'] === null) {
            throw new Exception(
                'Kolom header tidak sesuai. Pastikan terdapat kolom "Kode Dealer" dan "Nama Dealer".'
            );
        }

        $imported = 0;
        $updated = 0;
        $errors = [];

        foreach ($rows as $rowIndex => $row) {
            $rowNumber = $rowIndex + 2; // +1 for 0-indexed, +1 for header

            $kodeDealer = trim((string) ($row[$colIndices['kode_dealer']] ?? ''));
            $namaDealer = trim((string) ($row[$colIndices['nama_dealer']] ?? ''));
            $linkGmaps = $colIndices['link_google_maps'] !== null
                ? trim((string) ($row[$colIndices['link_google_maps']] ?? ''))
                : null;
            $rawLat = $colIndices['latitude'] !== null
                ? trim((string) ($row[$colIndices['latitude']] ?? ''))
                : '';
            $rawLng = $colIndices['longitude'] !== null
                ? trim((string) ($row[$colIndices['longitude']] ?? ''))
                : '';

            $latitude = $rawLat !== '' && is_numeric(str_replace(',', '.', $rawLat))
                ? (float) str_replace(',', '.', $rawLat)
                : null;
            $longitude = $rawLng !== '' && is_numeric(str_replace(',', '.', $rawLng))
                ? (float) str_replace(',', '.', $rawLng)
                : null;

            $rawStar = $colIndices['star_rate'] !== null
                ? trim((string) ($row[$colIndices['star_rate']] ?? ''))
                : '';
            $rawTotalReview = $colIndices['total_review'] !== null
                ? trim((string) ($row[$colIndices['total_review']] ?? ''))
                : '';

            $starRate = $rawStar !== '' && is_numeric(str_replace(',', '.', $rawStar))
                ? (float) str_replace(',', '.', $rawStar)
                : null;
            $totalReview = $rawTotalReview !== '' && is_numeric(preg_replace('/[^0-9]/', '', $rawTotalReview))
                ? (int) preg_replace('/[^0-9]/', '', $rawTotalReview)
                : null;

            $alamat = $colIndices['alamat'] !== null
                ? trim((string) ($row[$colIndices['alamat']] ?? ''))
                : null;
            $kelurahan = $colIndices['kelurahan'] !== null
                ? trim((string) ($row[$colIndices['kelurahan']] ?? ''))
                : null;
            $kecamatan = $colIndices['kecamatan'] !== null
                ? trim((string) ($row[$colIndices['kecamatan']] ?? ''))
                : null;
            $posCode = $colIndices['pos_code'] !== null
                ? trim((string) ($row[$colIndices['pos_code']] ?? ''))
                : null;
            $noTelpShowroom = $colIndices['no_telp_showroom'] !== null
                ? trim((string) ($row[$colIndices['no_telp_showroom']] ?? ''))
                : null;
            $namaDealerGbp = $colIndices['nama_dealer_gbp'] !== null
                ? trim((string) ($row[$colIndices['nama_dealer_gbp']] ?? ''))
                : null;
            $typeDealer = $colIndices['type_dealer'] !== null
                ? trim((string) ($row[$colIndices['type_dealer']] ?? ''))
                : null;
            $jamBukaWeekday = $colIndices['jam_buka_weekday'] !== null
                ? trim((string) ($row[$colIndices['jam_buka_weekday']] ?? ''))
                : null;
            $jamBukaSabtu = $colIndices['jam_buka_sabtu'] !== null
                ? trim((string) ($row[$colIndices['jam_buka_sabtu']] ?? ''))
                : null;
            $jamBukaMinggu = $colIndices['jam_buka_minggu'] !== null
                ? trim((string) ($row[$colIndices['jam_buka_minggu']] ?? ''))
                : null;

            // Skip completely empty rows
            if ($kodeDealer === '' && $namaDealer === '' && empty($linkGmaps) && $latitude === null && $longitude === null && empty($alamat) && empty($noTelpShowroom)) {
                continue;
            }

            if ($kodeDealer === '') {
                $errors[] = "Baris {$rowNumber}: Kode dealer tidak boleh kosong.";

                continue;
            }

            if ($namaDealer === '') {
                $errors[] = "Baris {$rowNumber}: Nama dealer tidak boleh kosong.";

                continue;
            }

            $existing = Dealer::where('kode_dealer', $kodeDealer)->first();

            if ($existing) {
                if ($updateExisting) {
                    $existing->update([
                        'nama_dealer' => $namaDealer,
                        'nama_dealer_gbp' => $namaDealerGbp ?: $existing->nama_dealer_gbp,
                        'type_dealer' => $typeDealer ?: $existing->type_dealer,
                        'link_google_maps' => $linkGmaps ?: null,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'alamat' => $alamat ?: null,
                        'kelurahan' => $kelurahan ?: null,
                        'kecamatan' => $kecamatan ?: null,
                        'pos_code' => $posCode ?: null,
                        'no_telp_showroom' => $noTelpShowroom ?: null,
                        'jam_buka_weekday' => $jamBukaWeekday ?: $existing->jam_buka_weekday,
                        'jam_buka_sabtu' => $jamBukaSabtu ?: $existing->jam_buka_sabtu,
                        'jam_buka_minggu' => $jamBukaMinggu ?: $existing->jam_buka_minggu,
                        'star_rate' => $starRate,
                        'total_review' => $totalReview,
                    ]);
                    $updated++;
                }
            } else {
                Dealer::create([
                    'kode_dealer' => strtoupper($kodeDealer),
                    'nama_dealer' => $namaDealer,
                    'nama_dealer_gbp' => $namaDealerGbp ?: null,
                    'type_dealer' => $typeDealer ?: null,
                    'link_google_maps' => $linkGmaps ?: null,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'alamat' => $alamat ?: null,
                    'kelurahan' => $kelurahan ?: null,
                    'kecamatan' => $kecamatan ?: null,
                    'pos_code' => $posCode ?: null,
                    'no_telp_showroom' => $noTelpShowroom ?: null,
                    'jam_buka_weekday' => $jamBukaWeekday ?: null,
                    'jam_buka_sabtu' => $jamBukaSabtu ?: null,
                    'jam_buka_minggu' => $jamBukaMinggu ?: null,
                    'star_rate' => $starRate,
                    'total_review' => $totalReview,
                ]);
                $imported++;
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

        // Try XLSX parser first
        try {
            return $this->readXlsxRows($file->getPathname());
        } catch (Exception) {
            // Fallback to CSV if user renamed .csv to .xlsx or raw text
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

        // Detect delimiter by reading first line
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
     *     nama_dealer_gbp: int|null,
     *     type_dealer: int|null,
     *     link_google_maps: int|null,
     *     latitude: int|null,
     *     longitude: int|null,
     *     star_rate: int|null,
     *     alamat: int|null,
     *     kelurahan: int|null,
     *     kecamatan: int|null,
     *     pos_code: int|null,
     *     no_telp_showroom: int|null,
     *     jam_buka_weekday: int|null,
     *     jam_buka_sabtu: int|null,
     *     jam_buka_minggu: int|null,
     *     total_review: int|null
     * }
     */
    protected function detectColumns(array $headerRow): array
    {
        $indices = [
            'kode_dealer' => null,
            'nama_dealer' => null,
            'nama_dealer_gbp' => null,
            'type_dealer' => null,
            'link_google_maps' => null,
            'latitude' => null,
            'longitude' => null,
            'star_rate' => null,
            'alamat' => null,
            'kelurahan' => null,
            'kecamatan' => null,
            'pos_code' => null,
            'no_telp_showroom' => null,
            'jam_buka_weekday' => null,
            'jam_buka_sabtu' => null,
            'jam_buka_minggu' => null,
            'total_review' => null,
        ];

        foreach ($headerRow as $index => $header) {
            $clean = strtolower(trim(str_replace(['_', '-'], ' ', $header)));

            if ($indices['kode_dealer'] === null && (
                str_contains($clean, 'kode dealer') ||
                $clean === 'kode' ||
                $clean === 'kd dealer' ||
                $clean === 'kodedealer'
            )) {
                $indices['kode_dealer'] = $index;
            } elseif ($indices['nama_dealer_gbp'] === null && (
                str_contains($clean, 'nama dealer di gbp') ||
                str_contains($clean, 'nama dealer gbp') ||
                str_contains($clean, 'nama gbp') ||
                str_contains($clean, 'dealer gbp') ||
                $clean === 'gbp'
            )) {
                $indices['nama_dealer_gbp'] = $index;
            } elseif ($indices['type_dealer'] === null && (
                str_contains($clean, 'type dealer') ||
                str_contains($clean, 'tipe dealer') ||
                $clean === 'typedealer' ||
                $clean === 'tipedealer' ||
                $clean === 'type' ||
                $clean === 'tipe'
            )) {
                $indices['type_dealer'] = $index;
            } elseif ($indices['nama_dealer'] === null && (
                str_contains($clean, 'nama dealer') ||
                $clean === 'nama' ||
                $clean === 'dealer' ||
                $clean === 'namadealer'
            )) {
                $indices['nama_dealer'] = $index;
            } elseif ($indices['link_google_maps'] === null && (
                str_contains($clean, 'google maps') ||
                str_contains($clean, 'maps') ||
                str_contains($clean, 'gmaps') ||
                str_contains($clean, 'lokasi') ||
                str_contains($clean, 'link')
            )) {
                $indices['link_google_maps'] = $index;
            } elseif ($indices['latitude'] === null && (
                str_contains($clean, 'latitude') ||
                str_contains($clean, 'lintang') ||
                $clean === 'lat'
            )) {
                $indices['latitude'] = $index;
            } elseif ($indices['longitude'] === null && (
                str_contains($clean, 'longitude') ||
                str_contains($clean, 'bujur') ||
                $clean === 'long' ||
                $clean === 'lng'
            )) {
                $indices['longitude'] = $index;
            } elseif ($indices['star_rate'] === null && (
                str_contains($clean, 'star rate') ||
                str_contains($clean, 'star') ||
                str_contains($clean, 'rating') ||
                str_contains($clean, 'rate') ||
                str_contains($clean, 'bintang')
            )) {
                $indices['star_rate'] = $index;
            } elseif ($indices['total_review'] === null && (
                str_contains($clean, 'total review') ||
                str_contains($clean, 'review') ||
                str_contains($clean, 'ulasan')
            )) {
                $indices['total_review'] = $index;
            } elseif ($indices['alamat'] === null && (
                str_contains($clean, 'alamat') ||
                str_contains($clean, 'address') ||
                str_contains($clean, 'jalan')
            )) {
                $indices['alamat'] = $index;
            } elseif ($indices['kelurahan'] === null && (
                str_contains($clean, 'kelurahan') ||
                str_contains($clean, 'kelurahar') ||
                str_contains($clean, 'desa') ||
                $clean === 'kel'
            )) {
                $indices['kelurahan'] = $index;
            } elseif ($indices['kecamatan'] === null && (
                str_contains($clean, 'kecamatan') ||
                str_contains($clean, 'kecamata') ||
                str_contains($clean, 'distrik') ||
                $clean === 'kec'
            )) {
                $indices['kecamatan'] = $index;
            } elseif ($indices['pos_code'] === null && (
                str_contains($clean, 'pos code') ||
                str_contains($clean, 'postal code') ||
                str_contains($clean, 'kode pos') ||
                str_contains($clean, 'kodepos') ||
                $clean === 'pos' ||
                $clean === 'zip'
            )) {
                $indices['pos_code'] = $index;
            } elseif ($indices['jam_buka_weekday'] === null && (
                str_contains($clean, 'weekday') ||
                str_contains($clean, 'senin - jumat') ||
                str_contains($clean, 'senin-jumat')
            )) {
                $indices['jam_buka_weekday'] = $index;
            } elseif ($indices['jam_buka_sabtu'] === null && (
                str_contains($clean, 'sabtu') ||
                str_contains($clean, 'saturday')
            )) {
                $indices['jam_buka_sabtu'] = $index;
            } elseif ($indices['jam_buka_minggu'] === null && (
                str_contains($clean, 'minggu') ||
                str_contains($clean, 'sunday')
            )) {
                $indices['jam_buka_minggu'] = $index;
            } elseif ($indices['no_telp_showroom'] === null && (
                str_contains($clean, 'no telp') ||
                str_contains($clean, 'notelp') ||
                str_contains($clean, 'showroom') ||
                str_contains($clean, 'telepon') ||
                str_contains($clean, 'phone') ||
                str_contains($clean, 'telp')
            )) {
                $indices['no_telp_showroom'] = $index;
            }
        }

        // Fallback: If not matched by name, assume column positions
        if ($indices['kode_dealer'] === null && isset($headerRow[0])) {
            $indices['kode_dealer'] = 0;
        }
        if ($indices['nama_dealer'] === null && isset($headerRow[1])) {
            $indices['nama_dealer'] = 1;
        }
        if ($indices['link_google_maps'] === null && isset($headerRow[2])) {
            $indices['link_google_maps'] = 2;
        }
        if ($indices['latitude'] === null && isset($headerRow[3])) {
            $indices['latitude'] = 3;
        }
        if ($indices['longitude'] === null && isset($headerRow[4])) {
            $indices['longitude'] = 4;
        }
        if ($indices['star_rate'] === null && isset($headerRow[5])) {
            $indices['star_rate'] = 5;
        }
        if ($indices['alamat'] === null && isset($headerRow[6])) {
            $indices['alamat'] = 6;
        }
        if ($indices['kelurahan'] === null && isset($headerRow[7])) {
            $indices['kelurahan'] = 7;
        }
        if ($indices['kecamatan'] === null && isset($headerRow[8])) {
            $indices['kecamatan'] = 8;
        }
        if ($indices['pos_code'] === null && isset($headerRow[9])) {
            $indices['pos_code'] = 9;
        }
        if ($indices['no_telp_showroom'] === null && isset($headerRow[10])) {
            $indices['no_telp_showroom'] = 10;
        }
        if ($indices['total_review'] === null && isset($headerRow[11])) {
            $indices['total_review'] = 11;
        }

        return $indices;
    }

    /**
     * Generate a valid, clean XLSX template string for download.
     */
    public function generateTemplateXlsx(): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'xlsx_tmpl');
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
<sheets><sheet name="Dealer" sheetId="1" r:id="rId1"/></sheets>
</workbook>');

        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>');

        $headers = [
            'Kode Dealer',
            'Nama Dealer',
            'Nama Dealer di GBP',
            'Type Dealer',
            'Link Google Maps',
            'Latitude',
            'Longitude',
            'Star Rate',
            'Total Review',
            'No Telp Showroom',
            'Jam Buka Weekday',
            'Jam Buka Sabtu',
            'Jam Buka Minggu',
            'Alamat',
            'Kelurahan',
            'Kecamatan',
            'Pos Code',
        ];

        $sampleRows = [
            [
                'DLR001',
                'Dealer Nusantara Jakarta',
                'Dealer Nusantara Official Jakarta',
                'H123',
                'https://maps.google.com/?q=-6.200000,106.816666',
                '-6.200000',
                '106.816666',
                '4.8',
                '120',
                '021-5551234',
                '08.00–17.00',
                '08.00–14.00',
                'Tutup',
                'Jl. Jend. Sudirman No. 123',
                'Karet Semanggi',
                'Setiabudi',
                '12930',
            ],
            [
                'DLR002',
                'Dealer Jaya Surabaya',
                'Dealer Jaya Motor Surabaya',
                'H23',
                'https://maps.google.com/?q=-7.257472,112.752090',
                '-7.257472',
                '112.752090',
                '4.7',
                '85',
                '031-5556789',
                '08.30–16.30',
                '08.30–12.00',
                'Tutup',
                'Jl. Pemuda No. 45',
                'Embong Kaliasin',
                'Genteng',
                '60271',
            ],
        ];

        $strings = array_merge($headers, ...$sampleRows);

        $sstXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'.count($strings).'" uniqueCount="'.count($strings).'">';
        foreach ($strings as $str) {
            $sstXml .= '<si><t>'.htmlspecialchars($str, ENT_XML1, 'UTF-8').'</t></si>';
        }
        $sstXml .= '</sst>';
        $zip->addFromString('xl/sharedStrings.xml', $sstXml);

        $colCount = count($headers);
        $cols = array_map(fn (int $idx): string => chr(ord('A') + $idx), range(0, $colCount - 1));
        $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<sheetData>';

        $sheetXml .= '<row r="1">';
        foreach ($cols as $i => $col) {
            $sheetXml .= '<c r="'.$col.'1" t="s"><v>'.$i.'</v></c>';
        }
        $sheetXml .= '</row>';

        foreach ($sampleRows as $rowIdx => $sampleRow) {
            $excelRow = $rowIdx + 2;
            $offset = ($rowIdx + 1) * $colCount;
            $sheetXml .= '<row r="'.$excelRow.'">';
            foreach ($cols as $i => $col) {
                $sheetXml .= '<c r="'.$col.$excelRow.'" t="s"><v>'.($offset + $i).'</v></c>';
            }
            $sheetXml .= '</row>';
        }

        $sheetXml .= '</sheetData>'
            .'</worksheet>';
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);

        $zip->close();
        $content = (string) file_get_contents($tmp);
        unlink($tmp);

        return $content;
    }

    /**
     * Export collection or array of dealers to a clean, well-formatted XLSX string.
     *
     * @param  iterable<Dealer>  $dealers
     */
    public function export(iterable $dealers): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'xlsx_dlr_exp');
        $zip = new ZipArchive;
        $zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>');

        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>');

        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Data Dealer" sheetId="1" r:id="rId1"/></sheets>
</workbook>');

        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>');

        $stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><name val="Calibri"/><sz val="11"/></font>
<font><b/><color rgb="FFFFFFFF"/><name val="Calibri"/><sz val="11"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDC2626"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/></border>
<border>
<left style="thin"><color rgb="FFD1D5DB"/></left>
<right style="thin"><color rgb="FFD1D5DB"/></right>
<top style="thin"><color rgb="FFD1D5DB"/></top>
<bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
</border>
</borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
<alignment horizontal="center" vertical="center" wrapText="1"/>
</xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
<alignment horizontal="center" vertical="center"/>
</xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
<alignment vertical="center"/>
</xf>
</cellXfs>
</styleSheet>';
        $zip->addFromString('xl/styles.xml', $stylesXml);

        $headers = [
            'A' => ['title' => 'NO', 'width' => 8],
            'B' => ['title' => 'KODE DEALER', 'width' => 15],
            'C' => ['title' => 'NAMA DEALER', 'width' => 32],
            'D' => ['title' => 'NAMA DEALER DI GBP', 'width' => 32],
            'E' => ['title' => 'TYPE DEALER', 'width' => 18],
            'F' => ['title' => 'STAR RATE', 'width' => 12],
            'G' => ['title' => 'TOTAL REVIEW', 'width' => 15],
            'H' => ['title' => 'NO TELP SHOWROOM', 'width' => 20],
            'I' => ['title' => 'JAM BUKA WEEKDAY', 'width' => 20],
            'J' => ['title' => 'JAM BUKA SABTU', 'width' => 18],
            'K' => ['title' => 'JAM BUKA MINGGU', 'width' => 18],
            'L' => ['title' => 'ALAMAT', 'width' => 45],
            'M' => ['title' => 'KELURAHAN', 'width' => 20],
            'N' => ['title' => 'KECAMATAN', 'width' => 20],
            'O' => ['title' => 'POS CODE', 'width' => 12],
            'P' => ['title' => 'LATITUDE', 'width' => 15],
            'Q' => ['title' => 'LONGITUDE', 'width' => 15],
            'R' => ['title' => 'LINK GOOGLE MAPS', 'width' => 45],
        ];

        $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<cols>';
        $colIdx = 1;
        foreach ($headers as $colDef) {
            $sheetXml .= '<col min="'.$colIdx.'" max="'.$colIdx.'" width="'.$colDef['width'].'" customWidth="1"/>';
            $colIdx++;
        }
        $sheetXml .= '</cols>'
            .'<sheetData>'
            .'<row r="1" ht="28" customHeight="1">';

        foreach ($headers as $colKey => $colDef) {
            $sheetXml .= '<c r="'.$colKey.'1" t="inlineStr" s="1"><is><t>'.$this->escapeXmlString($colDef['title']).'</t></is></c>';
        }
        $sheetXml .= '</row>';

        $rowNum = 2;
        $counter = 1;
        foreach ($dealers as $dealer) {
            $kodeDealer = (string) ($dealer->kode_dealer ?? '');
            $namaDealer = (string) ($dealer->nama_dealer ?? '');
            $namaDealerGbp = (string) ($dealer->nama_dealer_gbp ?? '');
            $typeDealer = (string) ($dealer->type_dealer ?? '');
            $starRate = $dealer->star_rate !== null ? number_format((float) $dealer->star_rate, 1) : '';
            $totalReview = $dealer->total_review !== null ? (string) $dealer->total_review : '';
            $noTelp = (string) ($dealer->no_telp_showroom ?? '');
            $jamWeekday = (string) ($dealer->jam_buka_weekday ?? '');
            $jamSabtu = (string) ($dealer->jam_buka_sabtu ?? '');
            $jamMinggu = (string) ($dealer->jam_buka_minggu ?? '');
            $alamat = (string) ($dealer->alamat ?? '');
            $kelurahan = (string) ($dealer->kelurahan ?? '');
            $kecamatan = (string) ($dealer->kecamatan ?? '');
            $posCode = (string) ($dealer->pos_code ?? '');
            $latitude = $dealer->latitude !== null ? (string) $dealer->latitude : '';
            $longitude = $dealer->longitude !== null ? (string) $dealer->longitude : '';
            $linkGmaps = (string) ($dealer->link_google_maps ?? '');

            $sheetXml .= '<row r="'.$rowNum.'">'
                .'<c r="A'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$counter.'</t></is></c>'
                .'<c r="B'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($kodeDealer).'</t></is></c>'
                .'<c r="C'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($namaDealer).'</t></is></c>'
                .'<c r="D'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($namaDealerGbp).'</t></is></c>'
                .'<c r="E'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($typeDealer).'</t></is></c>'
                .'<c r="F'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($starRate).'</t></is></c>'
                .'<c r="G'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($totalReview).'</t></is></c>'
                .'<c r="H'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($noTelp).'</t></is></c>'
                .'<c r="I'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($jamWeekday).'</t></is></c>'
                .'<c r="J'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($jamSabtu).'</t></is></c>'
                .'<c r="K'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($jamMinggu).'</t></is></c>'
                .'<c r="L'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($alamat).'</t></is></c>'
                .'<c r="M'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($kelurahan).'</t></is></c>'
                .'<c r="N'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($kecamatan).'</t></is></c>'
                .'<c r="O'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($posCode).'</t></is></c>'
                .'<c r="P'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($latitude).'</t></is></c>'
                .'<c r="Q'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($longitude).'</t></is></c>'
                .'<c r="R'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($linkGmaps).'</t></is></c>'
                .'</row>';

            $rowNum++;
            $counter++;
        }

        $sheetXml .= '</sheetData></worksheet>';
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);

        $zip->close();
        $content = (string) file_get_contents($tmp);
        unlink($tmp);

        return $content;
    }

    /**
     * Export collection or array of dealers to a clean CSV string.
     *
     * @param  iterable<Dealer>  $dealers
     */
    public function exportCsv(iterable $dealers): string
    {
        $fp = fopen('php://temp', 'r+');
        if ($fp === false) {
            throw new Exception('Gagal membuat stream data CSV.');
        }

        // Add UTF-8 BOM so Excel opens CSV with proper encoding
        fwrite($fp, "\xEF\xBB\xBF");

        $headers = [
            'NO',
            'KODE DEALER',
            'NAMA DEALER',
            'NAMA DEALER DI GBP',
            'TYPE DEALER',
            'STAR RATE',
            'TOTAL REVIEW',
            'NO TELP SHOWROOM',
            'JAM BUKA WEEKDAY',
            'JAM BUKA SABTU',
            'JAM BUKA MINGGU',
            'ALAMAT',
            'KELURAHAN',
            'KECAMATAN',
            'POS CODE',
            'LATITUDE',
            'LONGITUDE',
            'LINK GOOGLE MAPS',
        ];

        fputcsv($fp, $headers);

        $counter = 1;
        foreach ($dealers as $dealer) {
            fputcsv($fp, [
                $counter,
                (string) ($dealer->kode_dealer ?? ''),
                (string) ($dealer->nama_dealer ?? ''),
                (string) ($dealer->nama_dealer_gbp ?? ''),
                (string) ($dealer->type_dealer ?? ''),
                $dealer->star_rate !== null ? number_format((float) $dealer->star_rate, 1) : '',
                $dealer->total_review !== null ? (string) $dealer->total_review : '',
                (string) ($dealer->no_telp_showroom ?? ''),
                (string) ($dealer->jam_buka_weekday ?? ''),
                (string) ($dealer->jam_buka_sabtu ?? ''),
                (string) ($dealer->jam_buka_minggu ?? ''),
                (string) ($dealer->alamat ?? ''),
                (string) ($dealer->kelurahan ?? ''),
                (string) ($dealer->kecamatan ?? ''),
                (string) ($dealer->pos_code ?? ''),
                $dealer->latitude !== null ? (string) $dealer->latitude : '',
                $dealer->longitude !== null ? (string) $dealer->longitude : '',
                (string) ($dealer->link_google_maps ?? ''),
            ]);
            $counter++;
        }

        rewind($fp);
        $content = stream_get_contents($fp);
        fclose($fp);

        return $content ?: '';
    }

    private function escapeXmlString(string $value): string
    {
        $cleaned = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? $value;

        return htmlspecialchars($cleaned, ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }
}
