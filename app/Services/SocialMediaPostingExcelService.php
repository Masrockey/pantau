<?php

namespace App\Services;

use App\Models\SocialMediaPosting;
use App\Models\SocialMediaProfile;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use ZipArchive;

class SocialMediaPostingExcelService
{
    /**
     * Allowed social media platforms.
     *
     * @var list<string>
     */
    protected const PLATFORMS = ['ig', 'TikTok', 'facebook', 'youtube'];

    /**
     * Allowed brands.
     *
     * @var list<string>
     */
    protected const BRANDS = [
        'Honda',
        'Kawasaki',
        'Yamaha',
        'Aprilia',
        'TVS',
        'Bajaj',
        'KTM',
        'Piaggio',
        'MV Agusta',
        'All Brand',
    ];

    /**
     * Parse and import social media posting records from an uploaded Excel or CSV file.
     *
     * @return array{imported: int, updated: int, total: int, errors: array<int, string>}
     */
    public function import(UploadedFile $file, bool $updateExisting = true, bool $replaceAll = false): array
    {
        // Prevent timeout and memory limits during large file batch imports
        @ini_set('memory_limit', '512M');
        @set_time_limit(600);
        @ini_set('max_execution_time', '600');

        $rows = $this->readRows($file);

        if (empty($rows)) {
            throw new Exception('File Excel kosong atau format tidak dapat dibaca.');
        }

        $headerRow = array_shift($rows);
        if ($headerRow === null) {
            throw new Exception('File Excel tidak memiliki baris judul (header).');
        }

        $colIndices = $this->detectColumns($headerRow);
        if ($colIndices['nama_lengkap'] === null) {
            throw new Exception(
                'Kolom header tidak sesuai. Pastikan terdapat kolom "Nama Lengkap" atau "Kreator".'
            );
        }

        if ($replaceAll) {
            SocialMediaPosting::query()->delete();
        }

        $imported = 0;
        $updated = 0;
        $errors = [];

        // Pre-fetch all profiles for fast in-memory lookup
        $profilesByName = [];
        foreach (SocialMediaProfile::all() as $p) {
            $key = mb_strtolower(trim($p->nama_lengkap));
            if ($key !== '') {
                $profilesByName[$key] = $p;
            }
        }

        // Pre-fetch existing postings into in-memory maps (O(1) lookups instead of N+1 database queries)
        $existingPostings = $replaceAll ? collect() : SocialMediaPosting::select([
            'id',
            'social_media_profile_id',
            'jenis_sosmed',
            'tanggal_rilis',
            'brand',
            'link',
            'caption',
        ])->get();

        $existingIdsByKey = [];

        foreach ($existingPostings as $ep) {
            $tglStr = $ep->tanggal_rilis ? Carbon::parse($ep->tanggal_rilis)->format('Y-m-d') : '';
            $captionHash = md5(trim((string) ($ep->caption ?? '')));
            $linkVal = ! empty($ep->link) ? trim((string) $ep->link) : '';
            if ($linkVal !== '') {
                $matchKey = "{$ep->social_media_profile_id}|{$ep->brand}|{$linkVal}";
            } else {
                $matchKey = "{$ep->social_media_profile_id}|{$ep->brand}|{$ep->jenis_sosmed}|{$tglStr}|{$captionHash}";
            }
            $existingIdsByKey[$matchKey][] = (int) $ep->id;
        }

        $allInserts = [];
        $updateItems = [];

        $lastProfile = null;

        foreach ($rows as $rowIndex => $row) {
            $rowNumber = $rowIndex + 2;

            $namaLengkap = trim((string) ($row[$colIndices['nama_lengkap']] ?? ''));

            // Link and caption
            $link = $colIndices['link'] !== null ? trim((string) ($row[$colIndices['link']] ?? '')) : null;
            if ($link === '') {
                $link = null;
            }

            $caption = $colIndices['caption'] !== null ? trim((string) ($row[$colIndices['caption']] ?? '')) : null;
            if ($caption === '') {
                $caption = null;
            }

            // Find or carry over profile
            if ($namaLengkap !== '') {
                $nameKey = mb_strtolower($namaLengkap);
                if (isset($profilesByName[$nameKey])) {
                    $profile = $profilesByName[$nameKey];
                } else {
                    $profile = SocialMediaProfile::create([
                        'nama_lengkap' => $namaLengkap,
                    ]);
                    $profilesByName[$nameKey] = $profile;
                }
                $lastProfile = $profile;
            } elseif ($lastProfile !== null && ($link !== null || $caption !== null)) {
                $profile = $lastProfile;
            } else {
                continue; // Skip truly empty rows
            }

            // Detect and normalize platform
            $rawJenis = $colIndices['jenis_sosmed'] !== null ? trim((string) ($row[$colIndices['jenis_sosmed']] ?? '')) : '';
            $jenisSosmed = $this->normalizeJenisSosmed($rawJenis);

            // Detect and normalize brand
            $rawBrand = $colIndices['brand'] !== null ? trim((string) ($row[$colIndices['brand']] ?? '')) : '';
            $brand = $this->normalizeBrand($rawBrand);

            // Detect and parse release date
            $rawTanggal = $colIndices['tanggal_rilis'] !== null ? trim((string) ($row[$colIndices['tanggal_rilis']] ?? '')) : '';
            $tanggalRilis = $this->parseDate($rawTanggal);

            // Detect month entry
            $bulanEntry = $colIndices['bulan_entry'] !== null ? trim((string) ($row[$colIndices['bulan_entry']] ?? '')) : null;
            if ($bulanEntry === '' || $bulanEntry === null) {
                $bulanEntry = $tanggalRilis ? Carbon::parse($tanggalRilis)->format('M') : null;
            }

            // Metrics: comments and views
            $rawKomentar = $colIndices['total_komentar'] !== null ? trim((string) ($row[$colIndices['total_komentar']] ?? '')) : '';
            $totalKomentar = $rawKomentar !== '' && is_numeric(preg_replace('/[^0-9]/', '', $rawKomentar))
                ? (int) preg_replace('/[^0-9]/', '', $rawKomentar)
                : 0;

            $rawViews = $colIndices['total_views'] !== null ? trim((string) ($row[$colIndices['total_views']] ?? '')) : '';
            $totalViews = $rawViews !== '' && is_numeric(preg_replace('/[^0-9]/', '', $rawViews))
                ? (int) preg_replace('/[^0-9]/', '', $rawViews)
                : 0;

            // Accurate matching:
            $existingId = null;
            if (! $replaceAll) {
                if ($link !== null) {
                    $matchKey = "{$profile->id}|{$brand}|{$link}";
                } else {
                    $tglStr = $tanggalRilis ?? '';
                    $captionHash = md5($caption ?? '');
                    $matchKey = "{$profile->id}|{$brand}|{$jenisSosmed}|{$tglStr}|{$captionHash}";
                }

                if (! empty($existingIdsByKey[$matchKey])) {
                    $existingId = array_shift($existingIdsByKey[$matchKey]);
                }
            }

            if ($existingId !== null) {
                if ($updateExisting) {
                    $updateItems[$existingId] = [
                        'id' => $existingId,
                        'data' => [
                            'social_media_profile_id' => $profile->id,
                            'jenis_sosmed' => $jenisSosmed,
                            'tanggal_rilis' => $tanggalRilis,
                            'bulan_entry' => $bulanEntry,
                            'caption' => $caption,
                            'link' => $link,
                            'brand' => $brand,
                            'total_komentar' => $totalKomentar,
                            'total_views' => $totalViews,
                            'updated_at' => now(),
                        ],
                    ];
                }
            } else {
                $now = now();
                $allInserts[] = [
                    'social_media_profile_id' => $profile->id,
                    'jenis_sosmed' => $jenisSosmed,
                    'tanggal_rilis' => $tanggalRilis,
                    'bulan_entry' => $bulanEntry,
                    'caption' => $caption,
                    'link' => $link,
                    'brand' => $brand,
                    'total_komentar' => $totalKomentar,
                    'total_views' => $totalViews,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        // Execute database operations in a single transaction for maximum speed
        DB::transaction(function () use (&$allInserts, &$updateItems, &$imported, &$updated): void {
            // Execute batch inserts in chunks of 250
            if (! empty($allInserts)) {
                foreach (array_chunk($allInserts, 250) as $chunk) {
                    SocialMediaPosting::insert($chunk);
                    $imported += count($chunk);
                }
            }

            // Execute updates
            if (! empty($updateItems)) {
                foreach ($updateItems as $item) {
                    SocialMediaPosting::where('id', $item['id'])->update($item['data']);
                    $updated++;
                }
            }
        });

        return [
            'imported' => $imported,
            'updated' => $updated,
            'total' => $imported + $updated,
            'errors' => $errors,
        ];
    }

    /**
     * Export collection or array of social media postings to a high-quality XLSX binary string.
     *
     * @param  iterable<SocialMediaPosting>  $postings
     */
    public function export(iterable $postings): string
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'sm_post_export_');
        if ($tempFile === false) {
            throw new Exception('Gagal membuat file sementara untuk ekspor.');
        }

        $zip = new ZipArchive;
        if ($zip->open($tempFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new Exception('Gagal membuat arsip Excel (.xlsx).');
        }

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
<sheets><sheet name="Data Sosmed Posting" sheetId="1" r:id="rId1"/></sheets>
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
            'A' => ['title' => 'NO', 'width' => 8, 'align' => 'center'],
            'B' => ['title' => 'NAMA LENGKAP', 'width' => 28, 'align' => 'left'],
            'C' => ['title' => 'JENIS SOSMED', 'width' => 16, 'align' => 'center'],
            'D' => ['title' => 'TANGGAL RILIS', 'width' => 18, 'align' => 'center'],
            'E' => ['title' => 'BULAN ENTRY', 'width' => 16, 'align' => 'center'],
            'F' => ['title' => 'BRAND', 'width' => 18, 'align' => 'center'],
            'G' => ['title' => 'TOTAL KOMENTAR', 'width' => 18, 'align' => 'center'],
            'H' => ['title' => 'TOTAL VIEWS', 'width' => 18, 'align' => 'center'],
            'I' => ['title' => 'LINK', 'width' => 38, 'align' => 'left'],
            'J' => ['title' => 'CAPTION', 'width' => 45, 'align' => 'left'],
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
        foreach ($postings as $p) {
            $creator = (string) ($p->profile?->nama_lengkap ?? '');
            $jenis = (string) ($p->jenis_sosmed ?? '');
            $tgl = $p->tanggal_rilis ? Carbon::parse($p->tanggal_rilis)->format('Y-m-d') : '';
            $bulan = (string) ($p->bulan_entry ?? '');
            $brand = (string) ($p->brand ?? '');
            $komentar = (string) ($p->total_komentar ?? 0);
            $views = (string) ($p->total_views ?? 0);
            $link = (string) ($p->link ?? '');
            $caption = (string) ($p->caption ?? '');

            $sheetXml .= '<row r="'.$rowNum.'" ht="22" customHeight="1">';
            $sheetXml .= '<c r="A'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$counter.'</t></is></c>';
            $sheetXml .= '<c r="B'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($creator).'</t></is></c>';
            $sheetXml .= '<c r="C'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($jenis).'</t></is></c>';
            $sheetXml .= '<c r="D'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($tgl).'</t></is></c>';
            $sheetXml .= '<c r="E'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($bulan).'</t></is></c>';
            $sheetXml .= '<c r="F'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($brand).'</t></is></c>';
            $sheetXml .= '<c r="G'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($komentar).'</t></is></c>';
            $sheetXml .= '<c r="H'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($views).'</t></is></c>';
            $sheetXml .= '<c r="I'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($link).'</t></is></c>';
            $sheetXml .= '<c r="J'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($caption).'</t></is></c>';
            $sheetXml .= '</row>';

            $rowNum++;
            $counter++;
        }

        $sheetXml .= '</sheetData></worksheet>';
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
        $zip->close();

        $content = file_get_contents($tempFile);
        @unlink($tempFile);

        if ($content === false) {
            throw new Exception('Gagal membaca data berkas Excel yang dibuat.');
        }

        return $content;
    }

    /**
     * Export collection or array of social media postings to a clean CSV string with UTF-8 BOM.
     *
     * @param  iterable<SocialMediaPosting>  $postings
     */
    public function exportCsv(iterable $postings): string
    {
        $fp = fopen('php://temp', 'r+');
        if ($fp === false) {
            throw new Exception('Gagal membuat stream data CSV.');
        }

        // Add UTF-8 BOM so Excel opens CSV with proper encoding
        fwrite($fp, "\xEF\xBB\xBF");

        $headers = [
            'NO',
            'NAMA LENGKAP',
            'JENIS SOSMED',
            'TANGGAL RILIS',
            'BULAN ENTRY',
            'BRAND',
            'TOTAL KOMENTAR',
            'TOTAL VIEWS',
            'LINK',
            'CAPTION',
        ];

        fputcsv($fp, $headers);

        $counter = 1;
        foreach ($postings as $p) {
            fputcsv($fp, [
                $counter,
                (string) ($p->profile?->nama_lengkap ?? ''),
                (string) ($p->jenis_sosmed ?? ''),
                $p->tanggal_rilis ? Carbon::parse($p->tanggal_rilis)->format('Y-m-d') : '',
                (string) ($p->bulan_entry ?? ''),
                (string) ($p->brand ?? ''),
                (string) ($p->total_komentar ?? 0),
                (string) ($p->total_views ?? 0),
                (string) ($p->link ?? ''),
                (string) ($p->caption ?? ''),
            ]);
            $counter++;
        }

        rewind($fp);
        $content = stream_get_contents($fp);
        fclose($fp);

        return $content !== false ? $content : '';
    }

    /**
     * Generate an Excel (.xlsx) template file for importing social media postings.
     */
    public function generateTemplateXlsx(): string
    {
        $sampleProfiles = [
            new SocialMediaProfile(['nama_lengkap' => 'Budi Pratama (Contoh)']),
            new SocialMediaProfile(['nama_lengkap' => 'Siti Nurhaliza (Contoh)']),
            new SocialMediaProfile(['nama_lengkap' => 'Ahmad Fauzi (Contoh)']),
        ];

        $dummyPostings = [
            new SocialMediaPosting([
                'jenis_sosmed' => 'ig',
                'tanggal_rilis' => '2026-11-01',
                'bulan_entry' => 'Nov',
                'brand' => 'Honda',
                'total_komentar' => 145,
                'total_views' => 28500,
                'link' => 'https://www.instagram.com/p/DeRsNjYvrv6/',
                'caption' => 'Test ride Honda EM1 e: keliling kota Mataram, tarikan halus dan hemat baterai! #HondaNTB #EM1e',
            ]),
            new SocialMediaPosting([
                'jenis_sosmed' => 'TikTok',
                'tanggal_rilis' => '2026-10-28',
                'bulan_entry' => 'Oct',
                'brand' => 'Yamaha',
                'total_komentar' => 312,
                'total_views' => 74200,
                'link' => 'https://www.tiktok.com/@sitinur/video/7392819283719',
                'caption' => 'Review NMAX Turbo di tanjakan Pusuk Sembalun, performanya gokil banget! #Yamaha #NMAXTurbo',
            ]),
            new SocialMediaPosting([
                'jenis_sosmed' => 'youtube',
                'tanggal_rilis' => '2026-09-15',
                'bulan_entry' => 'Sep',
                'brand' => 'Kawasaki',
                'total_komentar' => 88,
                'total_views' => 15600,
                'link' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'caption' => 'Vlog touring pantai Kuta Mandalika bareng Kawasaki KLX 150 #Kawasaki #TouringLombok',
            ]),
            new SocialMediaPosting([
                'jenis_sosmed' => 'facebook',
                'tanggal_rilis' => '2026-08-20',
                'bulan_entry' => 'Aug',
                'brand' => 'All Brand',
                'total_komentar' => 45,
                'total_views' => 6200,
                'link' => 'https://www.facebook.com/budipratama/posts/1029384756',
                'caption' => 'Komparasi motor matic 160cc paling nyaman buat harian di jalanan kota. #ReviewMotor',
            ]),
        ];

        $dummyPostings[0]->setRelation('profile', $sampleProfiles[0]);
        $dummyPostings[1]->setRelation('profile', $sampleProfiles[1]);
        $dummyPostings[2]->setRelation('profile', $sampleProfiles[2]);
        $dummyPostings[3]->setRelation('profile', $sampleProfiles[0]);

        return $this->export($dummyPostings);
    }

    /**
     * Read rows from an uploaded Excel or CSV file.
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
                $cellRef = isset($c['r']) ? (string) $c['r'] : '';
                $colIndex = $cellRef !== '' ? $this->cellRefToColumnIndex($cellRef) : count($rowCells);

                $type = (string) $c['t'];
                $val = '';

                if ($type === 's') {
                    $idx = (int) $c->v;
                    $val = $sharedStrings[$idx] ?? '';
                } elseif ($type === 'inlineStr' && isset($c->is)) {
                    if (isset($c->is->t)) {
                        $val = (string) $c->is->t;
                    } elseif (isset($c->is->r)) {
                        $text = '';
                        foreach ($c->is->r as $r) {
                            $text .= (string) $r->t;
                        }
                        $val = $text;
                    }
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
     * Read rows from a CSV file.
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
     * Convert cell reference like "A1", "C2", "J5" to 0-based column index.
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
     * @return array<string, int|null>
     */
    protected function detectColumns(array $headerRow): array
    {
        $indices = [
            'nama_lengkap' => null,
            'jenis_sosmed' => null,
            'tanggal_rilis' => null,
            'bulan_entry' => null,
            'brand' => null,
            'total_komentar' => null,
            'total_views' => null,
            'link' => null,
            'caption' => null,
        ];

        foreach ($headerRow as $index => $header) {
            $clean = strtolower(trim(str_replace(['_', '-'], ' ', $header)));

            if ($indices['nama_lengkap'] === null && (
                str_contains($clean, 'nama lengkap') ||
                str_contains($clean, 'nama kreator') ||
                str_contains($clean, 'nama profil') ||
                str_contains($clean, 'fullname') ||
                str_contains($clean, 'kreator') ||
                str_contains($clean, 'creator') ||
                str_contains($clean, 'influencer') ||
                $clean === 'nama'
            )) {
                $indices['nama_lengkap'] = $index;
            } elseif ($indices['jenis_sosmed'] === null && (
                str_contains($clean, 'jenis sosmed') ||
                str_contains($clean, 'media sosial') ||
                str_contains($clean, 'platform') ||
                str_contains($clean, 'sosmed') ||
                $clean === 'jenis'
            )) {
                $indices['jenis_sosmed'] = $index;
            } elseif ($indices['tanggal_rilis'] === null && (
                str_contains($clean, 'tanggal rilis') ||
                str_contains($clean, 'tgl rilis') ||
                str_contains($clean, 'release date') ||
                str_contains($clean, 'tanggal posting') ||
                $clean === 'tanggal' ||
                $clean === 'tgl' ||
                $clean === 'date'
            )) {
                $indices['tanggal_rilis'] = $index;
            } elseif ($indices['bulan_entry'] === null && (
                str_contains($clean, 'bulan entry') ||
                str_contains($clean, 'month entry') ||
                str_contains($clean, 'bulan') ||
                str_contains($clean, 'month')
            )) {
                $indices['bulan_entry'] = $index;
            } elseif ($indices['brand'] === null && (
                str_contains($clean, 'brand') ||
                str_contains($clean, 'merk') ||
                str_contains($clean, 'merek')
            )) {
                $indices['brand'] = $index;
            } elseif ($indices['total_komentar'] === null && (
                str_contains($clean, 'komentar') ||
                str_contains($clean, 'comment') ||
                str_contains($clean, 'comments') ||
                str_contains($clean, 'total comment')
            )) {
                $indices['total_komentar'] = $index;
            } elseif ($indices['total_views'] === null && (
                str_contains($clean, 'view') ||
                str_contains($clean, 'views') ||
                str_contains($clean, 'tayangan') ||
                str_contains($clean, 'total view')
            )) {
                $indices['total_views'] = $index;
            } elseif ($indices['link'] === null && (
                str_contains($clean, 'link') ||
                str_contains($clean, 'url') ||
                str_contains($clean, 'tautan')
            )) {
                $indices['link'] = $index;
            } elseif ($indices['caption'] === null && (
                str_contains($clean, 'caption') ||
                str_contains($clean, 'deskripsi') ||
                str_contains($clean, 'konten') ||
                str_contains($clean, 'isi postingan') ||
                $clean === 'text'
            )) {
                $indices['caption'] = $index;
            }
        }

        return $indices;
    }

    /**
     * Normalize platform to one of: 'ig', 'TikTok', 'facebook', 'youtube'.
     */
    public function normalizeJenisSosmed(string $value): string
    {
        $clean = strtolower(trim($value));

        if (str_contains($clean, 'tik') || $clean === 'tt') {
            return 'TikTok';
        }

        if (str_contains($clean, 'you') || $clean === 'yt') {
            return 'youtube';
        }

        if (str_contains($clean, 'face') || $clean === 'fb') {
            return 'facebook';
        }

        return 'ig';
    }

    /**
     * Normalize brand name matching the predefined brand list.
     */
    public function normalizeBrand(string $value): string
    {
        $clean = strtolower(trim($value));

        foreach (self::BRANDS as $brand) {
            if (strtolower($brand) === $clean) {
                return $brand;
            }
        }

        if (str_contains($clean, 'all') || $clean === 'semua') {
            return 'All Brand';
        }

        if (str_contains($clean, 'honda')) {
            return 'Honda';
        }
        if (str_contains($clean, 'kawasaki')) {
            return 'Kawasaki';
        }
        if (str_contains($clean, 'yamaha')) {
            return 'Yamaha';
        }
        if (str_contains($clean, 'aprilia')) {
            return 'Aprilia';
        }
        if (str_contains($clean, 'tvs')) {
            return 'TVS';
        }
        if (str_contains($clean, 'bajaj')) {
            return 'Bajaj';
        }
        if (str_contains($clean, 'ktm')) {
            return 'KTM';
        }
        if (str_contains($clean, 'piaggio')) {
            return 'Piaggio';
        }
        if (str_contains($clean, 'mv')) {
            return 'MV Agusta';
        }

        return 'All Brand';
    }

    /**
     * Parse date string or numeric Excel timestamp to 'Y-m-d' string.
     */
    public function parseDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        // Numeric Excel timestamp (e.g. 45650)
        if (is_numeric($value) && (float) $value > 1000 && (float) $value < 100000) {
            $days = (int) $value;
            // 25569 = days between 1899-12-30 and 1970-01-01
            $timestamp = ($days - 25569) * 86400;

            return gmdate('Y-m-d', $timestamp);
        }

        // Format DD/MM/YYYY or DD-MM-YYYY
        if (preg_match('/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/', $value, $m)) {
            $day = (int) $m[1];
            $month = (int) $m[2];
            $year = (int) $m[3];
            if (checkdate($month, $day, $year)) {
                return sprintf('%04d-%02d-%02d', $year, $month, $day);
            }
        }

        // Try standard Carbon parsing
        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (Exception) {
            return null;
        }
    }

    /**
     * Escape special XML characters for spreadsheet cell strings.
     */
    protected function escapeXmlString(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }
}
