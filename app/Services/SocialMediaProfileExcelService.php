<?php

namespace App\Services;

use App\Models\SocialMediaProfile;
use Exception;
use Illuminate\Http\UploadedFile;
use ZipArchive;

class SocialMediaProfileExcelService
{
    /**
     * Parse and import social media profile records from an uploaded Excel or CSV file.
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
        if ($colIndices['nama_lengkap'] === null) {
            throw new Exception(
                'Kolom header tidak sesuai. Pastikan terdapat kolom "Nama Lengkap".'
            );
        }

        $imported = 0;
        $updated = 0;
        $errors = [];

        // Pre-fetch existing profiles into memory maps for fast O(1) matching
        $existingProfiles = SocialMediaProfile::all();
        $existingByName = [];
        $existingByEmail = [];
        $existingByPhone = [];

        foreach ($existingProfiles as $p) {
            $nameKey = mb_strtolower(trim($p->nama_lengkap));
            if ($nameKey !== '') {
                $existingByName[$nameKey] = $p;
            }

            if ($p->email) {
                $existingByEmail[mb_strtolower(trim($p->email))] = $p;
            }

            if ($p->no_hp) {
                $cleanPhone = preg_replace('/[^0-9]/', '', $p->no_hp);
                if ($cleanPhone !== '') {
                    $existingByPhone[$cleanPhone] = $p;
                }
            }
        }

        foreach ($rows as $rowIndex => $row) {
            $rowNumber = $rowIndex + 2;

            $namaLengkap = trim((string) ($row[$colIndices['nama_lengkap']] ?? ''));
            if ($namaLengkap === '') {
                continue; // Skip empty rows
            }

            $linkYt = $colIndices['link_youtube'] !== null ? trim((string) ($row[$colIndices['link_youtube']] ?? '')) : null;
            $rawSubYt = $colIndices['total_subscribe_youtube'] !== null ? trim((string) ($row[$colIndices['total_subscribe_youtube']] ?? '')) : '';
            $subYt = $rawSubYt !== '' && is_numeric(preg_replace('/[^0-9]/', '', $rawSubYt)) ? (int) preg_replace('/[^0-9]/', '', $rawSubYt) : 0;

            $linkIg = $colIndices['link_instagram'] !== null ? trim((string) ($row[$colIndices['link_instagram']] ?? '')) : null;
            $rawFolIg = $colIndices['total_follower_ig'] !== null ? trim((string) ($row[$colIndices['total_follower_ig']] ?? '')) : '';
            $folIg = $rawFolIg !== '' && is_numeric(preg_replace('/[^0-9]/', '', $rawFolIg)) ? (int) preg_replace('/[^0-9]/', '', $rawFolIg) : 0;

            $linkTt = $colIndices['link_tiktok'] !== null ? trim((string) ($row[$colIndices['link_tiktok']] ?? '')) : null;
            $rawFolTt = $colIndices['total_follower_tiktok'] !== null ? trim((string) ($row[$colIndices['total_follower_tiktok']] ?? '')) : '';
            $folTt = $rawFolTt !== '' && is_numeric(preg_replace('/[^0-9]/', '', $rawFolTt)) ? (int) preg_replace('/[^0-9]/', '', $rawFolTt) : 0;

            $linkFb = $colIndices['link_facebook'] !== null ? trim((string) ($row[$colIndices['link_facebook']] ?? '')) : null;
            $rawFolFb = $colIndices['total_follower_fb'] !== null ? trim((string) ($row[$colIndices['total_follower_fb']] ?? '')) : '';
            $folFb = $rawFolFb !== '' && is_numeric(preg_replace('/[^0-9]/', '', $rawFolFb)) ? (int) preg_replace('/[^0-9]/', '', $rawFolFb) : 0;

            $noHp = $colIndices['no_hp'] !== null ? trim((string) ($row[$colIndices['no_hp']] ?? '')) : null;
            $email = $colIndices['email'] !== null ? trim((string) ($row[$colIndices['email']] ?? '')) : null;

            $rawTglLahir = $colIndices['tanggal_lahir'] !== null ? trim((string) ($row[$colIndices['tanggal_lahir']] ?? '')) : '';
            $tglLahir = null;
            if ($rawTglLahir !== '' && is_numeric(preg_replace('/[^0-9]/', '', $rawTglLahir))) {
                $parsedTgl = (int) preg_replace('/[^0-9]/', '', $rawTglLahir);
                if ($parsedTgl >= 1 && $parsedTgl <= 31) {
                    $tglLahir = $parsedTgl;
                }
            }

            $bulanLahir = $colIndices['bulan_lahir'] !== null ? trim((string) ($row[$colIndices['bulan_lahir']] ?? '')) : null;
            $ukHelm = $colIndices['ukuran_helm'] !== null ? trim((string) ($row[$colIndices['ukuran_helm']] ?? '')) : null;
            $ukJaket = $colIndices['ukuran_jaket'] !== null ? trim((string) ($row[$colIndices['ukuran_jaket']] ?? '')) : null;
            $ukSarungTangan = $colIndices['ukuran_sarung_tangan'] !== null ? trim((string) ($row[$colIndices['ukuran_sarung_tangan']] ?? '')) : null;
            $ukSepatu = $colIndices['ukuran_sepatu'] !== null ? trim((string) ($row[$colIndices['ukuran_sepatu']] ?? '')) : null;
            $alamat = $colIndices['alamat_rumah'] !== null ? trim((string) ($row[$colIndices['alamat_rumah']] ?? '')) : null;
            $domisili = $colIndices['domisili'] !== null ? trim((string) ($row[$colIndices['domisili']] ?? '')) : null;

            $data = [
                'nama_lengkap' => $namaLengkap,
                'link_youtube' => $linkYt ?: null,
                'total_subscribe_youtube' => $subYt,
                'link_instagram' => $linkIg ?: null,
                'total_follower_ig' => $folIg,
                'link_tiktok' => $linkTt ?: null,
                'total_follower_tiktok' => $folTt,
                'link_facebook' => $linkFb ?: null,
                'total_follower_fb' => $folFb,
                'no_hp' => $noHp ?: null,
                'email' => $email ?: null,
                'tanggal_lahir' => $tglLahir,
                'bulan_lahir' => $bulanLahir ?: null,
                'ukuran_helm' => $ukHelm ?: null,
                'ukuran_jaket' => $ukJaket ?: null,
                'ukuran_sarung_tangan' => $ukSarungTangan ?: null,
                'ukuran_sepatu' => $ukSepatu ?: null,
                'alamat_rumah' => $alamat ?: null,
                'domisili' => $domisili ?: null,
            ];

            // Match existing
            $existing = null;
            $nameKey = mb_strtolower($namaLengkap);
            if (isset($existingByName[$nameKey])) {
                $existing = $existingByName[$nameKey];
            } elseif ($email && isset($existingByEmail[mb_strtolower($email)])) {
                $existing = $existingByEmail[mb_strtolower($email)];
            } elseif ($noHp) {
                $cleanPhone = preg_replace('/[^0-9]/', '', $noHp);
                if (isset($existingByPhone[$cleanPhone])) {
                    $existing = $existingByPhone[$cleanPhone];
                }
            }

            try {
                if ($existing) {
                    if ($updateExisting) {
                        $existing->update($data);
                        $updated++;
                    }
                } else {
                    $newProfile = SocialMediaProfile::create($data);
                    $existingByName[$nameKey] = $newProfile;
                    if ($email) {
                        $existingByEmail[mb_strtolower($email)] = $newProfile;
                    }
                    if ($noHp) {
                        $cleanPhone = preg_replace('/[^0-9]/', '', $noHp);
                        if ($cleanPhone !== '') {
                            $existingByPhone[$cleanPhone] = $newProfile;
                        }
                    }
                    $imported++;
                }
            } catch (Exception $e) {
                $errors[] = "Baris {$rowNumber}: ".$e->getMessage();
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
     * Export collection or array of social media profiles to a clean, well-formatted XLSX string.
     *
     * @param  iterable<SocialMediaProfile>  $profiles
     */
    public function export(iterable $profiles): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'xlsx_smp_exp');
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
<sheets><sheet name="Data Profile Sosmed" sheetId="1" r:id="rId1"/></sheets>
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
            'C' => ['title' => 'LINK YOUTUBE', 'width' => 32, 'align' => 'left'],
            'D' => ['title' => 'TOTAL SUBSCRIBE YOUTUBE', 'width' => 25, 'align' => 'center'],
            'E' => ['title' => 'LINK INSTAGRAM', 'width' => 32, 'align' => 'left'],
            'F' => ['title' => 'TOTAL FOLLOWER IG', 'width' => 20, 'align' => 'center'],
            'G' => ['title' => 'LINK TIKTOK', 'width' => 32, 'align' => 'left'],
            'H' => ['title' => 'TOTAL FOLLOWER TIKTOK', 'width' => 22, 'align' => 'center'],
            'I' => ['title' => 'LINK FACEBOOK', 'width' => 32, 'align' => 'left'],
            'J' => ['title' => 'TOTAL FOLLOWER FB', 'width' => 20, 'align' => 'center'],
            'K' => ['title' => 'NO HP', 'width' => 18, 'align' => 'center'],
            'L' => ['title' => 'EMAIL', 'width' => 28, 'align' => 'left'],
            'M' => ['title' => 'TANGGAL LAHIR', 'width' => 16, 'align' => 'center'],
            'N' => ['title' => 'BULAN LAHIR', 'width' => 16, 'align' => 'center'],
            'O' => ['title' => 'UK HELM', 'width' => 12, 'align' => 'center'],
            'P' => ['title' => 'UK JAKET', 'width' => 12, 'align' => 'center'],
            'Q' => ['title' => 'UK SARUNG TANGAN', 'width' => 18, 'align' => 'center'],
            'R' => ['title' => 'UK SEPATU', 'width' => 12, 'align' => 'center'],
            'S' => ['title' => 'ALAMAT RUMAH', 'width' => 35, 'align' => 'left'],
            'T' => ['title' => 'DOMISILI', 'width' => 22, 'align' => 'left'],
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
        foreach ($profiles as $p) {
            $nama = (string) ($p->nama_lengkap ?? '');
            $linkYt = (string) ($p->link_youtube ?? '');
            $subYt = (string) ($p->total_subscribe_youtube ?? 0);
            $linkIg = (string) ($p->link_instagram ?? '');
            $folIg = (string) ($p->total_follower_ig ?? 0);
            $linkTt = (string) ($p->link_tiktok ?? '');
            $folTt = (string) ($p->total_follower_tiktok ?? 0);
            $linkFb = (string) ($p->link_facebook ?? '');
            $folFb = (string) ($p->total_follower_fb ?? 0);
            $noHp = (string) ($p->no_hp ?? '');
            $email = (string) ($p->email ?? '');
            $tglLahir = $p->tanggal_lahir !== null ? (string) $p->tanggal_lahir : '';
            $blnLahir = (string) ($p->bulan_lahir ?? '');
            $ukHelm = (string) ($p->ukuran_helm ?? '');
            $ukJaket = (string) ($p->ukuran_jaket ?? '');
            $ukST = (string) ($p->ukuran_sarung_tangan ?? '');
            $ukSepatu = (string) ($p->ukuran_sepatu ?? '');
            $alamat = (string) ($p->alamat_rumah ?? '');
            $domisili = (string) ($p->domisili ?? '');

            $sheetXml .= '<row r="'.$rowNum.'">'
                .'<c r="A'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$counter.'</t></is></c>'
                .'<c r="B'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($nama).'</t></is></c>'
                .'<c r="C'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($linkYt).'</t></is></c>'
                .'<c r="D'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($subYt).'</t></is></c>'
                .'<c r="E'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($linkIg).'</t></is></c>'
                .'<c r="F'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($folIg).'</t></is></c>'
                .'<c r="G'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($linkTt).'</t></is></c>'
                .'<c r="H'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($folTt).'</t></is></c>'
                .'<c r="I'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($linkFb).'</t></is></c>'
                .'<c r="J'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($folFb).'</t></is></c>'
                .'<c r="K'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($noHp).'</t></is></c>'
                .'<c r="L'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($email).'</t></is></c>'
                .'<c r="M'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($tglLahir).'</t></is></c>'
                .'<c r="N'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($blnLahir).'</t></is></c>'
                .'<c r="O'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($ukHelm).'</t></is></c>'
                .'<c r="P'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($ukJaket).'</t></is></c>'
                .'<c r="Q'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($ukST).'</t></is></c>'
                .'<c r="R'.$rowNum.'" t="inlineStr" s="2"><is><t>'.$this->escapeXmlString($ukSepatu).'</t></is></c>'
                .'<c r="S'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($alamat).'</t></is></c>'
                .'<c r="T'.$rowNum.'" t="inlineStr" s="3"><is><t>'.$this->escapeXmlString($domisili).'</t></is></c>'
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
     * Export collection or array of social media profiles to a clean CSV string.
     *
     * @param  iterable<SocialMediaProfile>  $profiles
     */
    public function exportCsv(iterable $profiles): string
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
            'LINK YOUTUBE',
            'TOTAL SUBSCRIBE YOUTUBE',
            'LINK INSTAGRAM',
            'TOTAL FOLLOWER IG',
            'LINK TIKTOK',
            'TOTAL FOLLOWER TIKTOK',
            'LINK FACEBOOK',
            'TOTAL FOLLOWER FB',
            'NO HP',
            'EMAIL',
            'TANGGAL LAHIR',
            'BULAN LAHIR',
            'UK HELM',
            'UK JAKET',
            'UK SARUNG TANGAN',
            'UK SEPATU',
            'ALAMAT RUMAH',
            'DOMISILI',
        ];

        fputcsv($fp, $headers);

        $counter = 1;
        foreach ($profiles as $p) {
            fputcsv($fp, [
                $counter,
                (string) ($p->nama_lengkap ?? ''),
                (string) ($p->link_youtube ?? ''),
                (string) ($p->total_subscribe_youtube ?? 0),
                (string) ($p->link_instagram ?? ''),
                (string) ($p->total_follower_ig ?? 0),
                (string) ($p->link_tiktok ?? ''),
                (string) ($p->total_follower_tiktok ?? 0),
                (string) ($p->link_facebook ?? ''),
                (string) ($p->total_follower_fb ?? 0),
                (string) ($p->no_hp ?? ''),
                (string) ($p->email ?? ''),
                $p->tanggal_lahir !== null ? (string) $p->tanggal_lahir : '',
                (string) ($p->bulan_lahir ?? ''),
                (string) ($p->ukuran_helm ?? ''),
                (string) ($p->ukuran_jaket ?? ''),
                (string) ($p->ukuran_sarung_tangan ?? ''),
                (string) ($p->ukuran_sepatu ?? ''),
                (string) ($p->alamat_rumah ?? ''),
                (string) ($p->domisili ?? ''),
            ]);
            $counter++;
        }

        rewind($fp);
        $content = stream_get_contents($fp);
        fclose($fp);

        return $content !== false ? $content : '';
    }

    /**
     * Generate an Excel (.xlsx) template file for importing social media profiles.
     */
    public function generateTemplateXlsx(): string
    {
        $dummyProfiles = [
            new SocialMediaProfile([
                'nama_lengkap' => 'Budi Pratama (Contoh)',
                'link_youtube' => 'https://youtube.com/@budipratama',
                'total_subscribe_youtube' => 15000,
                'link_instagram' => 'https://instagram.com/budipratama',
                'total_follower_ig' => 25000,
                'link_tiktok' => 'https://tiktok.com/@budipratama',
                'total_follower_tiktok' => 50000,
                'link_facebook' => 'https://facebook.com/budipratama',
                'total_follower_fb' => 8000,
                'no_hp' => '08123456789',
                'email' => 'budi@example.com',
                'tanggal_lahir' => 17,
                'bulan_lahir' => 'Agustus',
                'ukuran_helm' => 'L',
                'ukuran_jaket' => 'XL',
                'ukuran_sarung_tangan' => 'L',
                'ukuran_sepatu' => '42',
                'alamat_rumah' => 'Jl. Pejanggik No. 12',
                'domisili' => 'Kota Mataram',
            ]),
            new SocialMediaProfile([
                'nama_lengkap' => 'Siti Nurhaliza (Contoh)',
                'link_youtube' => '',
                'total_subscribe_youtube' => 0,
                'link_instagram' => 'https://instagram.com/sitinur',
                'total_follower_ig' => 45000,
                'link_tiktok' => 'https://tiktok.com/@sitinur',
                'total_follower_tiktok' => 120000,
                'link_facebook' => '',
                'total_follower_fb' => 0,
                'no_hp' => '087899887766',
                'email' => 'siti@example.com',
                'tanggal_lahir' => 5,
                'bulan_lahir' => 'Mei',
                'ukuran_helm' => 'M',
                'ukuran_jaket' => 'M',
                'ukuran_sarung_tangan' => 'M',
                'ukuran_sepatu' => '38',
                'alamat_rumah' => 'Jl. Selaparang No. 8',
                'domisili' => 'Lombok Barat',
            ]),
        ];

        return $this->export($dummyProfiles);
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
     * @return array<string, int|null>
     */
    protected function detectColumns(array $headerRow): array
    {
        $indices = [
            'nama_lengkap' => null,
            'link_youtube' => null,
            'total_subscribe_youtube' => null,
            'link_instagram' => null,
            'total_follower_ig' => null,
            'link_tiktok' => null,
            'total_follower_tiktok' => null,
            'link_facebook' => null,
            'total_follower_fb' => null,
            'no_hp' => null,
            'email' => null,
            'tanggal_lahir' => null,
            'bulan_lahir' => null,
            'ukuran_helm' => null,
            'ukuran_jaket' => null,
            'ukuran_sarung_tangan' => null,
            'ukuran_sepatu' => null,
            'alamat_rumah' => null,
            'domisili' => null,
        ];

        foreach ($headerRow as $index => $header) {
            $clean = strtolower(trim(str_replace(['_', '-'], ' ', $header)));

            if ($indices['nama_lengkap'] === null && (
                str_contains($clean, 'nama lengkap') ||
                $clean === 'nama' ||
                str_contains($clean, 'fullname') ||
                str_contains($clean, 'kreator') ||
                str_contains($clean, 'influencer')
            )) {
                $indices['nama_lengkap'] = $index;
            } elseif ($indices['total_subscribe_youtube'] === null && (
                str_contains($clean, 'subscribe') ||
                str_contains($clean, 'subscriber') ||
                str_contains($clean, 'sub yt')
            )) {
                $indices['total_subscribe_youtube'] = $index;
            } elseif ($indices['link_youtube'] === null && (
                str_contains($clean, 'youtube') ||
                $clean === 'yt'
            )) {
                $indices['link_youtube'] = $index;
            } elseif ($indices['total_follower_ig'] === null && (
                str_contains($clean, 'follower ig') ||
                str_contains($clean, 'followers ig') ||
                str_contains($clean, 'follower instagram') ||
                str_contains($clean, 'followers instagram')
            )) {
                $indices['total_follower_ig'] = $index;
            } elseif ($indices['link_instagram'] === null && (
                str_contains($clean, 'instagram') ||
                $clean === 'ig'
            )) {
                $indices['link_instagram'] = $index;
            } elseif ($indices['total_follower_tiktok'] === null && (
                str_contains($clean, 'follower tiktok') ||
                str_contains($clean, 'followers tiktok') ||
                str_contains($clean, 'follower tt')
            )) {
                $indices['total_follower_tiktok'] = $index;
            } elseif ($indices['link_tiktok'] === null && (
                str_contains($clean, 'tiktok') ||
                $clean === 'tt'
            )) {
                $indices['link_tiktok'] = $index;
            } elseif ($indices['total_follower_fb'] === null && (
                str_contains($clean, 'follower fb') ||
                str_contains($clean, 'followers fb') ||
                str_contains($clean, 'follower facebook')
            )) {
                $indices['total_follower_fb'] = $index;
            } elseif ($indices['link_facebook'] === null && (
                str_contains($clean, 'facebook') ||
                $clean === 'fb'
            )) {
                $indices['link_facebook'] = $index;
            } elseif ($indices['no_hp'] === null && (
                str_contains($clean, 'no hp') ||
                str_contains($clean, 'nomor hp') ||
                str_contains($clean, 'telepon') ||
                str_contains($clean, 'whatsapp') ||
                str_contains($clean, 'wa') ||
                str_contains($clean, 'phone') ||
                $clean === 'hp'
            )) {
                $indices['no_hp'] = $index;
            } elseif ($indices['email'] === null && (
                str_contains($clean, 'email') ||
                str_contains($clean, 'surel') ||
                $clean === 'mail'
            )) {
                $indices['email'] = $index;
            } elseif ($indices['tanggal_lahir'] === null && (
                str_contains($clean, 'tanggal lahir') ||
                str_contains($clean, 'tgl lahir')
            )) {
                $indices['tanggal_lahir'] = $index;
            } elseif ($indices['bulan_lahir'] === null && (
                str_contains($clean, 'bulan lahir') ||
                str_contains($clean, 'bln lahir')
            )) {
                $indices['bulan_lahir'] = $index;
            } elseif ($indices['ukuran_helm'] === null && (
                str_contains($clean, 'helm')
            )) {
                $indices['ukuran_helm'] = $index;
            } elseif ($indices['ukuran_jaket'] === null && (
                str_contains($clean, 'jaket') ||
                str_contains($clean, 'jacket')
            )) {
                $indices['ukuran_jaket'] = $index;
            } elseif ($indices['ukuran_sarung_tangan'] === null && (
                str_contains($clean, 'sarung tangan') ||
                str_contains($clean, 'glove')
            )) {
                $indices['ukuran_sarung_tangan'] = $index;
            } elseif ($indices['ukuran_sepatu'] === null && (
                str_contains($clean, 'sepatu') ||
                str_contains($clean, 'shoe')
            )) {
                $indices['ukuran_sepatu'] = $index;
            } elseif ($indices['alamat_rumah'] === null && (
                str_contains($clean, 'alamat') ||
                str_contains($clean, 'address')
            )) {
                $indices['alamat_rumah'] = $index;
            } elseif ($indices['domisili'] === null && (
                str_contains($clean, 'domisili') ||
                str_contains($clean, 'kota') ||
                str_contains($clean, 'kabupaten') ||
                $clean === 'city'
            )) {
                $indices['domisili'] = $index;
            }
        }

        return $indices;
    }

    private function escapeXmlString(string $value): string
    {
        $cleaned = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? $value;

        return htmlspecialchars($cleaned, ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }
}
