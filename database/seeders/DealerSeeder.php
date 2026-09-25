<?php

namespace Database\Seeders;

use App\Models\Dealer;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DealerSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $dealers = [
            [
                'kode_dealer' => 'DLR001',
                'nama_dealer' => 'Dealer Nusantara Jakarta',
                'link_google_maps' => 'https://maps.google.com/?q=Jakarta',
            ],
            [
                'kode_dealer' => 'DLR002',
                'nama_dealer' => 'Dealer Jaya Surabaya',
                'link_google_maps' => 'https://maps.google.com/?q=Surabaya',
            ],
            [
                'kode_dealer' => 'DLR003',
                'nama_dealer' => 'Dealer Pratama Bandung',
                'link_google_maps' => 'https://maps.google.com/?q=Bandung',
            ],
            [
                'kode_dealer' => 'DLR004',
                'nama_dealer' => 'Dealer Sentosa Medan',
                'link_google_maps' => 'https://maps.google.com/?q=Medan',
            ],
            [
                'kode_dealer' => 'DLR005',
                'nama_dealer' => 'Dealer Makmur Makassar',
                'link_google_maps' => 'https://maps.google.com/?q=Makassar',
            ],
        ];

        foreach ($dealers as $dealer) {
            Dealer::updateOrCreate(
                ['kode_dealer' => $dealer['kode_dealer']],
                [
                    'nama_dealer' => $dealer['nama_dealer'],
                    'link_google_maps' => $dealer['link_google_maps'],
                ]
            );
        }
    }
}
