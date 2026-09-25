<?php

namespace Database\Seeders;

use App\Models\Dealer;
use App\Models\Review;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ReviewSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $dealer1 = Dealer::where('kode_dealer', 'DLR001')->first();
        $dealer2 = Dealer::where('kode_dealer', 'DLR002')->first();

        if ($dealer1) {
            Review::firstOrCreate(
                [
                    'dealer_id' => $dealer1->id,
                    'nama_reviewer' => 'Budi Santoso',
                    'tanggal_publish_review' => '2026-09-10',
                ],
                [
                    'star_rate' => 5.0,
                    'review' => 'Pelayanan ramah, ruang tunggu nyaman dan ber-AC, proses servis berkala cepat dan teratur.',
                    'respon_from_owner' => true,
                    'tanggal_respon' => '2026-09-11',
                    'respon' => 'Terima kasih banyak Bapak Budi Santoso atas ulasan positif dan kepercayaannya pada dealer kami. Sukses selalu!',
                    'google_review_url' => 'https://maps.app.goo.gl/dlr001rev1',
                ]
            );

            Review::firstOrCreate(
                [
                    'dealer_id' => $dealer1->id,
                    'nama_reviewer' => 'Citra Lestari',
                    'tanggal_publish_review' => '2026-09-18',
                ],
                [
                    'star_rate' => 4.0,
                    'review' => 'Sales sangat informatif menjelaskan simulasi kredit kendaraan. Sedikit antre saat hari sabtu.',
                    'respon_from_owner' => false,
                    'tanggal_respon' => null,
                    'respon' => null,
                    'google_review_url' => 'https://maps.app.goo.gl/dlr001rev2',
                ]
            );
        }

        if ($dealer2) {
            Review::firstOrCreate(
                [
                    'dealer_id' => $dealer2->id,
                    'nama_reviewer' => 'Hendro Prasetyo',
                    'tanggal_publish_review' => '2026-09-15',
                ],
                [
                    'star_rate' => 5.0,
                    'review' => 'Puas beli unit di sini, proses STNK cepat dan bonus aksesoris lengkap. Recommended!',
                    'respon_from_owner' => true,
                    'tanggal_respon' => '2026-09-16',
                    'respon' => 'Terima kasih atas kepercayaannya Bapak Hendro! Selamat menikmati perjalanan dengan unit baru Anda.',
                    'google_review_url' => 'https://maps.app.goo.gl/dlr002rev1',
                ]
            );
        }
    }
}
