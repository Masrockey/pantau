<?php

use App\Models\Dealer;
use App\Models\User;
use App\Services\DealerExcelService;
use App\Services\DealerSyncService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

test('guests are redirected to the login page from dealers', function (): void {
    $response = $this->get(route('dealers.index'));

    $response->assertRedirect(route('login'));
});

test('authenticated users can view dealer list', function (): void {
    $user = User::factory()->create();
    Dealer::factory()->create([
        'kode_dealer' => 'DLR001',
        'nama_dealer' => 'Dealer Nusantara Jakarta',
        'link_google_maps' => 'https://maps.google.com/?q=Jakarta',
    ]);

    $response = $this->actingAs($user)->get(route('dealers.index'));

    $response->assertOk();
});

test('dealers can be created with valid data including google maps link', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('dealers.store'), [
        'kode_dealer' => 'DLR099',
        'nama_dealer' => 'Dealer Baru',
        'link_google_maps' => 'https://maps.google.com/?q=-6.200000,106.816666',
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR099',
        'nama_dealer' => 'Dealer Baru',
        'link_google_maps' => 'https://maps.google.com/?q=-6.200000,106.816666',
    ]);
});

test('dealers cannot be created with duplicate kode_dealer', function (): void {
    $user = User::factory()->create();
    Dealer::factory()->create(['kode_dealer' => 'DLR001']);

    $response = $this->actingAs($user)->post(route('dealers.store'), [
        'kode_dealer' => 'DLR001',
        'nama_dealer' => 'Dealer Lain',
    ]);

    $response->assertSessionHasErrors(['kode_dealer']);
});

test('dealers can be updated with google maps link', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'kode_dealer' => 'DLR001',
        'nama_dealer' => 'Dealer Lama',
        'link_google_maps' => null,
    ]);

    $response = $this->actingAs($user)->put(route('dealers.update', $dealer), [
        'kode_dealer' => 'DLR001',
        'nama_dealer' => 'Dealer Update',
        'link_google_maps' => 'https://maps.google.com/?q=Bandung',
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
        'nama_dealer' => 'Dealer Update',
        'link_google_maps' => 'https://maps.google.com/?q=Bandung',
    ]);
});

test('dealers can be deleted when no users are associated', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();

    $response = $this->actingAs($user)->delete(route('dealers.destroy', $dealer));

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseMissing('dealers', [
        'id' => $dealer->id,
    ]);
});

test('dealers cannot be deleted when users are associated', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();
    User::factory()->forDealer($dealer)->create();

    $response = $this->actingAs($user)->delete(route('dealers.destroy', $dealer));

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
    ]);
});

test('authenticated users can download dealer excel template', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('dealers.template'));

    $response->assertOk();
    $response->assertHeader('content-disposition', 'attachment; filename="template_dealer.xlsx"');
});

test('dealers can be imported from a csv file', function (): void {
    $user = User::factory()->create();

    $csvContent = "Kode Dealer,Nama Dealer,Link Google Maps\n"
        ."DLR901,Dealer Medan Pusat,https://maps.google.com/?q=Medan\n"
        ."DLR902,Dealer Palembang Jaya,https://maps.google.com/?q=Palembang\n";

    $file = UploadedFile::fake()->createWithContent('dealers.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('dealers.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR901',
        'nama_dealer' => 'Dealer Medan Pusat',
        'link_google_maps' => 'https://maps.google.com/?q=Medan',
    ]);
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR902',
        'nama_dealer' => 'Dealer Palembang Jaya',
        'link_google_maps' => 'https://maps.google.com/?q=Palembang',
    ]);
});

test('dealers can be imported from the generated template xlsx file', function (): void {
    $user = User::factory()->create();
    $excelService = app(DealerExcelService::class);
    $xlsxContent = $excelService->generateTemplateXlsx();

    $file = UploadedFile::fake()->createWithContent('template_dealer.xlsx', $xlsxContent);

    $response = $this->actingAs($user)->post(route('dealers.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR001',
        'nama_dealer' => 'Dealer Nusantara Jakarta',
    ]);
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR002',
        'nama_dealer' => 'Dealer Jaya Surabaya',
    ]);
});

test('dealer import updates existing dealer when update_existing is true', function (): void {
    $user = User::factory()->create();
    Dealer::factory()->create([
        'kode_dealer' => 'DLR901',
        'nama_dealer' => 'Nama Lama',
        'link_google_maps' => null,
    ]);

    $csvContent = "Kode Dealer,Nama Dealer,Link Google Maps\n"
        ."DLR901,Nama Baru Update,https://maps.google.com/?q=Update\n";

    $file = UploadedFile::fake()->createWithContent('dealers.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('dealers.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR901',
        'nama_dealer' => 'Nama Baru Update',
        'link_google_maps' => 'https://maps.google.com/?q=Update',
    ]);
});

test('dealer import requires a valid file', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('dealers.import'), [
        'file' => null,
    ]);

    $response->assertSessionHasErrors(['file']);
});

test('dealers can be created with valid data including latitude and longitude', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('dealers.store'), [
        'kode_dealer' => 'DLR088',
        'nama_dealer' => 'Dealer Bali Denpasar',
        'link_google_maps' => 'https://maps.google.com/?q=-8.650000,115.216667',
        'latitude' => -8.650000,
        'longitude' => 115.216667,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR088',
        'nama_dealer' => 'Dealer Bali Denpasar',
        'latitude' => -8.650000,
        'longitude' => 115.216667,
    ]);
});

test('dealers can be updated with latitude and longitude', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'latitude' => null,
        'longitude' => null,
    ]);

    $response = $this->actingAs($user)->put(route('dealers.update', $dealer), [
        'kode_dealer' => $dealer->kode_dealer,
        'nama_dealer' => $dealer->nama_dealer,
        'latitude' => -6.917464,
        'longitude' => 107.619123,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
        'latitude' => -6.917464,
        'longitude' => 107.619123,
    ]);
});

test('dealers can be imported from a csv file with latitude and longitude', function (): void {
    $user = User::factory()->create();

    $csvContent = "Kode Dealer,Nama Dealer,Link Google Maps,Latitude,Longitude\n"
        ."DLR701,Dealer Balikpapan,, -1.265386, 116.831200\n";

    $file = UploadedFile::fake()->createWithContent('dealers.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('dealers.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR701',
        'nama_dealer' => 'Dealer Balikpapan',
        'latitude' => -1.265386,
        'longitude' => 116.831200,
    ]);
});

test('dealers can be created with ratings and address details', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('dealers.store'), [
        'kode_dealer' => 'DLR555',
        'nama_dealer' => 'Dealer Sukses Abadi',
        'star_rate' => 4.75,
        'alamat' => 'Jl. Gatot Subroto No. 45',
        'kelurahan' => 'Kuningan Barat',
        'kecamatan' => 'Mampang Prapatan',
        'pos_code' => '12710',
        'no_telp_showroom' => '021-7981234',
        'total_review' => 250,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR555',
        'nama_dealer' => 'Dealer Sukses Abadi',
        'star_rate' => 4.75,
        'alamat' => 'Jl. Gatot Subroto No. 45',
        'kelurahan' => 'Kuningan Barat',
        'kecamatan' => 'Mampang Prapatan',
        'pos_code' => '12710',
        'no_telp_showroom' => '021-7981234',
        'total_review' => 250,
    ]);
});

test('dealers can be updated with ratings and address details', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();

    $response = $this->actingAs($user)->put(route('dealers.update', $dealer), [
        'kode_dealer' => $dealer->kode_dealer,
        'nama_dealer' => 'Dealer Updated Name',
        'star_rate' => 4.90,
        'alamat' => 'Jl. Merdeka No. 1',
        'kelurahan' => 'Gambir',
        'kecamatan' => 'Gambir',
        'pos_code' => '10110',
        'no_telp_showroom' => '021-3841234',
        'total_review' => 500,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
        'nama_dealer' => 'Dealer Updated Name',
        'star_rate' => 4.90,
        'alamat' => 'Jl. Merdeka No. 1',
        'kelurahan' => 'Gambir',
        'kecamatan' => 'Gambir',
        'pos_code' => '10110',
        'no_telp_showroom' => '021-3841234',
        'total_review' => 500,
    ]);
});

test('dealers can be imported from a csv file with all details and header variations', function (): void {
    $user = User::factory()->create();

    $csvContent = "Kode Dealer,Nama Dealer,Star Rate,Alamat,Kelurahar,Kecamata,Pos Code,No Telp Sh,Total Review\n"
        ."DLR888,Dealer Semarang,4.85,\"Jl. Pahlawan No. 10\",Pleburan,Semarang Selatan,50241,024-8311234,310\n";

    $file = UploadedFile::fake()->createWithContent('dealers.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('dealers.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR888',
        'nama_dealer' => 'Dealer Semarang',
        'star_rate' => 4.85,
        'alamat' => 'Jl. Pahlawan No. 10',
        'kelurahan' => 'Pleburan',
        'kecamatan' => 'Semarang Selatan',
        'pos_code' => '50241',
        'no_telp_showroom' => '024-8311234',
        'total_review' => 310,
    ]);
});

test('dealer sync updates only the 9 specified profile fields and does not touch reviews', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'nama_dealer' => 'Padolo Jaya Motor - Dompu',
        'link_google_maps' => 'https://maps.app.goo.gl/yDPjVp5vSdsPnM646',
        'star_rate' => 4.0,
        'total_review' => 20,
        'no_telp_showroom' => '0812345678',
        'alamat' => 'Alamat Lama',
        'kelurahan' => 'Lama',
        'kecamatan' => 'Lama',
        'pos_code' => '00000',
        'latitude' => 0.0,
        'longitude' => 0.0,
    ]);

    Http::fake([
        '*/health' => Http::response(['status' => 'ok'], 200),
        '*/api/scrape/profile' => Http::response([
            'success' => true,
            'data' => [
                'name' => 'Padolo Jaya Motor',
                'rating' => 4.5,
                'reviewCount' => 75,
                'category' => 'Dealer Honda',
                'address' => 'Jl. Soekarno-Hatta No.26, Bada, Kec. Dompu, Kabupaten Dompu, Nusa Tenggara Bar. 84211',
                'phone' => '0821-4448-0140',
                'placeUrl' => 'https://www.google.com/maps/place/Padolo+Jaya+Motor/@-8.5387744,118.4620428,584m/data=!3m2!1e3!4b1',
                'latitude' => -8.5387744,
                'longitude' => 118.4620428,
            ],
        ], 200),
    ]);

    $response = $this->actingAs($user)->postJson(route('dealers.sync', $dealer->id));

    $response->assertOk()
        ->assertJson([
            'success' => true,
        ]);

    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
        'star_rate' => 4.5,
        'total_review' => 75,
        'no_telp_showroom' => '0821-4448-0140',
        'alamat' => 'Jl. Soekarno-Hatta No.26, Bada, Kec. Dompu, Kabupaten Dompu, Nusa Tenggara Bar. 84211',
        'kelurahan' => 'Bada',
        'kecamatan' => 'Dompu',
        'pos_code' => '84211',
        'latitude' => -8.5387744,
        'longitude' => 118.4620428,
    ]);

    $this->assertDatabaseCount('reviews', 0);
});

test('dealer sync returns error if dealer has no google maps link', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'nama_dealer' => 'Dealer Tanpa Link',
        'link_google_maps' => null,
    ]);

    $response = $this->actingAs($user)->postJson(route('dealers.sync', $dealer->id));

    $response->assertStatus(422)
        ->assertJson([
            'success' => false,
        ]);
});

test('dealer sync-all updates all eligible dealers', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'link_google_maps' => 'https://maps.app.goo.gl/validlink1',
    ]);

    Http::fake([
        '*/health' => Http::response(['status' => 'ok'], 200),
        '*/api/scrape/profile' => Http::response([
            'success' => true,
            'data' => [
                'rating' => 4.8,
                'reviewCount' => 150,
                'phone' => '08123456789',
                'address' => 'Jl. Test No. 1, Desa Sukamaju, Kec. Denpasar Sel., Denpasar 80222',
                'latitude' => -8.65,
                'longitude' => 115.22,
            ],
        ], 200),
    ]);

    $response = $this->actingAs($user)->postJson(route('dealers.sync-all'));

    $response->assertOk()
        ->assertJson([
            'success' => true,
            'summary' => [
                'success' => 1,
            ],
        ]);

    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
        'star_rate' => 4.8,
        'total_review' => 150,
        'kelurahan' => 'Sukamaju',
        'kecamatan' => 'Denpasar Selatan',
        'pos_code' => '80222',
    ]);
});

test('syncable dealer list can be retrieved', function (): void {
    $user = User::factory()->create();
    $dealerWithMaps = Dealer::factory()->create([
        'link_google_maps' => 'https://maps.app.goo.gl/test1234',
        'nama_dealer' => 'Dealer Sukamaju',
    ]);
    $dealerWithoutMaps = Dealer::factory()->create([
        'link_google_maps' => null,
        'nama_dealer' => 'Dealer Tanpa Maps',
    ]);

    $response = $this->actingAs($user)->getJson(route('dealers.syncable'));

    $response->assertOk()
        ->assertJson([
            'success' => true,
        ])
        ->assertJsonFragment([
            'id' => $dealerWithMaps->id,
            'nama_dealer' => 'Dealer Sukamaju',
        ])
        ->assertJsonMissing([
            'id' => $dealerWithoutMaps->id,
        ]);
});

test('dealers can be created and updated with nama_dealer_gbp and operating hours', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('dealers.store'), [
        'kode_dealer' => 'DLR888',
        'nama_dealer' => 'Dealer Bintang',
        'nama_dealer_gbp' => 'Dealer Bintang Official GBP',
        'jam_buka_weekday' => '08.00–17.00',
        'jam_buka_sabtu' => '08.00–14.00',
        'jam_buka_minggu' => 'Tutup',
    ]);

    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'kode_dealer' => 'DLR888',
        'nama_dealer_gbp' => 'Dealer Bintang Official GBP',
        'jam_buka_weekday' => '08.00–17.00',
        'jam_buka_sabtu' => '08.00–14.00',
        'jam_buka_minggu' => 'Tutup',
    ]);

    $dealer = Dealer::where('kode_dealer', 'DLR888')->firstOrFail();

    $updateResponse = $this->actingAs($user)->put(route('dealers.update', $dealer), [
        'kode_dealer' => 'DLR888',
        'nama_dealer' => 'Dealer Bintang Baru',
        'nama_dealer_gbp' => 'Dealer Bintang Mandiri GBP',
        'jam_buka_weekday' => '08.30–16.30',
        'jam_buka_sabtu' => '08.30–13.00',
        'jam_buka_minggu' => '09.00–15.00',
    ]);

    $updateResponse->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
        'nama_dealer_gbp' => 'Dealer Bintang Mandiri GBP',
        'jam_buka_weekday' => '08.30–16.30',
        'jam_buka_sabtu' => '08.30–13.00',
        'jam_buka_minggu' => '09.00–15.00',
    ]);
});

test('dealer sync updates nama_dealer_gbp and opening hours from scraper profile', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'nama_dealer' => 'Dealer Krida Test',
        'link_google_maps' => 'https://maps.app.goo.gl/kridatest123',
    ]);

    Http::fake([
        '*/health' => Http::response(['status' => 'ok'], 200),
        '*/api/scrape/profile' => Http::response([
            'success' => true,
            'data' => [
                'name' => 'Dealer Krida Toyota Dompu',
                'rating' => 4.7,
                'reviewCount' => 95,
                'phone' => '0373-21123',
                'address' => 'Jl. Bhayangkara No. 10, Bali, Kec. Dompu, Dompu 84212',
                'openingHours' => [
                    'Senin: 08.00–17.00',
                    'Selasa: 08.00–17.00',
                    'Rabu: 08.00–17.00',
                    'Kamis: 08.00–17.00',
                    'Jumat: 08.00–17.00',
                    'Sabtu: 08.00–14.00',
                    'Minggu: Tutup',
                ],
                'latitude' => -8.53,
                'longitude' => 118.46,
            ],
        ], 200),
    ]);

    $response = $this->actingAs($user)->postJson(route('dealers.sync', $dealer->id));

    $response->assertOk()
        ->assertJson([
            'success' => true,
        ]);

    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
        'nama_dealer_gbp' => 'Dealer Krida Toyota Dompu',
        'jam_buka_weekday' => '08.00–17.00',
        'jam_buka_sabtu' => '08.00–14.00',
        'jam_buka_minggu' => 'Tutup',
    ]);
});

test('DealerSyncService parseOpeningHours accurately parses various day formats and unicode icons', function (): void {
    $service = app(DealerSyncService::class);

    $hours = [
        "Jumat07.30\u{2013}17.00\u{E14D}",
        "Sabtu: 07.30\u{2013}17.30",
        'MingguTutup',
    ];

    $parsed = $service->parseOpeningHours($hours);

    expect($parsed['weekday'])->toBe("07.30\u{2013}17.00")
        ->and($parsed['saturday'])->toBe("07.30\u{2013}17.30")
        ->and($parsed['sunday'])->toBe('Tutup');
});

test('DealerSyncService parseOpeningHours parses English AM PM formats and normalizes to 24-hour dot notation', function (): void {
    $service = app(DealerSyncService::class);

    $hours = [
        'Friday: 8.00 am–4.00 pm',
        'Saturday: 8.00 am–2.00 pm',
        'Sunday: 8.00 am–2.00 pm',
        'Monday: 8.00 am–4.00 pm',
        'Tuesday: 8.00 am–4.00 pm',
        'Wednesday: 8.00 am–4.00 pm',
        'Thursday: 8.00 am–4.00 pm',
    ];

    $parsed = $service->parseOpeningHours($hours);

    expect($parsed['weekday'])->toBe("08.00\u{2013}16.00")
        ->and($parsed['saturday'])->toBe("08.00\u{2013}14.00")
        ->and($parsed['sunday'])->toBe("08.00\u{2013}14.00");

    $closedSunday = [
        'Monday: 8:30 AM – 5:00 PM',
        'Saturday: 8:30 AM – 2:00 PM',
        'Sunday: Closed',
    ];

    $parsedClosed = $service->parseOpeningHours($closedSunday);

    expect($parsedClosed['weekday'])->toBe("08.30\u{2013}17.00")
        ->and($parsedClosed['saturday'])->toBe("08.30\u{2013}14.00")
        ->and($parsedClosed['sunday'])->toBe('Tutup');
});

test('DealerSyncService normalizeTimeString handles various formats including closed and 24 hours', function (): void {
    $service = app(DealerSyncService::class);

    expect($service->normalizeTimeString('8 AM–4 PM'))->toBe("08.00\u{2013}16.00")
        ->and($service->normalizeTimeString('8.00 am-2.00 pm'))->toBe("08.00\u{2013}14.00")
        ->and($service->normalizeTimeString('08:30 - 17:00'))->toBe("08.30\u{2013}17.00")
        ->and($service->normalizeTimeString('Closed'))->toBe('Tutup')
        ->and($service->normalizeTimeString('Tutup'))->toBe('Tutup')
        ->and($service->normalizeTimeString('Open 24 hours'))->toBe('24 Jam');
});

test('dealer sync fallback extracts place name from redirected Google Maps URL when scraper is offline', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'nama_dealer' => 'Padolo Jaya Motor - Dompu',
        'link_google_maps' => 'https://maps.app.goo.gl/shortlink123',
    ]);

    Http::fake([
        '*/health' => Http::response([], 500),
        'https://maps.app.goo.gl/shortlink123' => Http::response(
            '<html><head><title>Padolo Jaya Motor - Google Maps</title></head><body></body></html>',
            302,
            ['Location' => 'https://www.google.com/maps/place/Padolo+Jaya+Motor/@-8.5387744,118.4620428,17z']
        ),
        'https://www.google.com/maps/place/Padolo+Jaya+Motor/@-8.5387744,118.4620428,17z*' => Http::response(
            '<html><head><meta property="og:title" content="Padolo Jaya Motor"><title>Padolo Jaya Motor - Google Maps</title></head><body></body></html>',
            200
        ),
    ]);

    $response = $this->actingAs($user)->postJson(route('dealers.sync', $dealer->id));

    $response->assertOk()
        ->assertJson([
            'success' => true,
        ]);

    $this->assertDatabaseHas('dealers', [
        'id' => $dealer->id,
        'nama_dealer_gbp' => 'Padolo Jaya Motor',
        'latitude' => -8.5387744,
        'longitude' => 118.4620428,
    ]);
});
