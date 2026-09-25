<?php

use App\Models\Dealer;
use App\Models\User;
use App\Services\DealerExcelService;
use Illuminate\Http\UploadedFile;

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
