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
                        'link_google_maps' => $linkGmaps ?: null,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'alamat' => $alamat ?: null,
                        'kelurahan' => $kelurahan ?: null,
                        'kecamatan' => $kecamatan ?: null,
                        'pos_code' => $posCode ?: null,
                        'no_telp_showroom' => $noTelpShowroom ?: null,
                        'star_rate' => $starRate,
                        'total_review' => $totalReview,
                    ]);
                    $updated++;
                }
            } else {
                Dealer::create([
                    'kode_dealer' => strtoupper($kodeDealer),
                    'nama_dealer' => $namaDealer,
                    'link_google_maps' => $linkGmaps ?: null,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'alamat' => $alamat ?: null,
                    'kelurahan' => $kelurahan ?: null,
                    'kecamatan' => $kecamatan ?: null,
                    'pos_code' => $posCode ?: null,
                    'no_telp_showroom' => $noTelpShowroom ?: null,
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
     *     link_google_maps: int|null,
     *     latitude: int|null,
     *     longitude: int|null,
     *     star_rate: int|null,
     *     alamat: int|null,
     *     kelurahan: int|null,
     *     kecamatan: int|null,
     *     pos_code: int|null,
     *     no_telp_showroom: int|null,
     *     total_review: int|null
     * }
     */
    protected function detectColumns(array $headerRow): array
    {
        $indices = [
            'kode_dealer' => null,
            'nama_dealer' => null,
            'link_google_maps' => null,
            'latitude' => null,
            'longitude' => null,
            'star_rate' => null,
            'alamat' => null,
            'kelurahan' => null,
            'kecamatan' => null,
            'pos_code' => null,
            'no_telp_showroom' => null,
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

        $strings = [
            'Kode Dealer',
            'Nama Dealer',
            'Link Google Maps',
            'Latitude',
            'Longitude',
            'Star Rate',
            'Alamat',
            'Kelurahan',
            'Kecamatan',
            'Pos Code',
            'No Telp Showroom',
            'Total Review',
            'DLR001',
            'Dealer Nusantara Jakarta',
            'https://maps.google.com/?q=-6.200000,106.816666',
            '-6.200000',
            '106.816666',
            '4.8',
            'Jl. Jend. Sudirman No. 123',
            'Karet Semanggi',
            'Setiabudi',
            '12930',
            '021-5551234',
            '120',
            'DLR002',
            'Dealer Jaya Surabaya',
            'https://maps.google.com/?q=-7.257472,112.752090',
            '-7.257472',
            '112.752090',
            '4.7',
            'Jl. Pemuda No. 45',
            'Embong Kaliasin',
            'Genteng',
            '60271',
            '031-5556789',
            '85',
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
            .'<c r="J1" t="s"><v>9</v></c>'
            .'<c r="K1" t="s"><v>10</v></c>'
            .'<c r="L1" t="s"><v>11</v></c>'
            .'</row>'
            .'<row r="2">'
            .'<c r="A2" t="s"><v>12</v></c>'
            .'<c r="B2" t="s"><v>13</v></c>'
            .'<c r="C2" t="s"><v>14</v></c>'
            .'<c r="D2" t="s"><v>15</v></c>'
            .'<c r="E2" t="s"><v>16</v></c>'
            .'<c r="F2" t="s"><v>17</v></c>'
            .'<c r="G2" t="s"><v>18</v></c>'
            .'<c r="H2" t="s"><v>19</v></c>'
            .'<c r="I2" t="s"><v>20</v></c>'
            .'<c r="J2" t="s"><v>21</v></c>'
            .'<c r="K2" t="s"><v>22</v></c>'
            .'<c r="L2" t="s"><v>23</v></c>'
            .'</row>'
            .'<row r="3">'
            .'<c r="A3" t="s"><v>24</v></c>'
            .'<c r="B3" t="s"><v>25</v></c>'
            .'<c r="C3" t="s"><v>26</v></c>'
            .'<c r="D3" t="s"><v>27</v></c>'
            .'<c r="E3" t="s"><v>28</v></c>'
            .'<c r="F3" t="s"><v>29</v></c>'
            .'<c r="G3" t="s"><v>30</v></c>'
            .'<c r="H3" t="s"><v>31</v></c>'
            .'<c r="I3" t="s"><v>32</v></c>'
            .'<c r="J3" t="s"><v>33</v></c>'
            .'<c r="K3" t="s"><v>34</v></c>'
            .'<c r="L3" t="s"><v>35</v></c>'
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
