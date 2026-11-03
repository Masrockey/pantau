<?php

use App\Models\SocialMediaProfile;
use App\Models\User;
use App\Services\SocialMediaProfileExcelService;
use Illuminate\Http\UploadedFile;

test('guests are redirected to the login page from social media profiles', function (): void {
    $response = $this->get(route('social-media.profile.index'));

    $response->assertRedirect(route('login'));
});

test('authenticated users can view social media profile list', function (): void {
    $user = User::factory()->create();
    SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Alif Influencer',
        'domisili' => 'Mataram',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.profile.index'));

    $response->assertOk();
});

test('social media profiles can be created with all fields', function (): void {
    $user = User::factory()->create();

    $payload = [
        'nama_lengkap' => 'Rian Mahardika',
        'link_youtube' => 'https://youtube.com/@rianm',
        'total_subscribe_youtube' => 15000,
        'link_instagram' => 'https://instagram.com/rianm',
        'total_follower_ig' => 25000,
        'link_tiktok' => 'https://tiktok.com/@rianm',
        'total_follower_tiktok' => 50000,
        'link_facebook' => 'https://facebook.com/rianm',
        'total_follower_fb' => 8000,
        'no_hp' => '081234567890',
        'email' => 'rian@example.com',
        'tanggal_lahir' => 17,
        'bulan_lahir' => 'Agustus',
        'ukuran_helm' => 'L',
        'ukuran_jaket' => 'XL',
        'ukuran_sarung_tangan' => 'L',
        'ukuran_sepatu' => '42',
        'alamat_rumah' => 'Jl. Pejanggik No. 10',
        'domisili' => 'Kota Mataram',
    ];

    $response = $this->actingAs($user)->post(route('social-media.profile.store'), $payload);

    $response->assertRedirect(route('social-media.profile.index'));
    $this->assertDatabaseHas('social_media_profiles', [
        'nama_lengkap' => 'Rian Mahardika',
        'total_subscribe_youtube' => 15000,
        'ukuran_helm' => 'L',
        'domisili' => 'Kota Mataram',
    ]);
});

test('nama_lengkap is required when creating a profile', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('social-media.profile.store'), [
        'nama_lengkap' => '',
        'link_instagram' => 'https://instagram.com/empty',
    ]);

    $response->assertSessionHasErrors(['nama_lengkap']);
});

test('social media profiles can be updated', function (): void {
    $user = User::factory()->create();
    $profile = SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Nama Lama',
        'ukuran_helm' => 'M',
    ]);

    $response = $this->actingAs($user)->put(route('social-media.profile.update', $profile), [
        'nama_lengkap' => 'Nama Baru',
        'ukuran_helm' => 'XL',
        'domisili' => 'Lombok Barat',
    ]);

    $response->assertRedirect(route('social-media.profile.index'));
    $this->assertDatabaseHas('social_media_profiles', [
        'id' => $profile->id,
        'nama_lengkap' => 'Nama Baru',
        'ukuran_helm' => 'XL',
        'domisili' => 'Lombok Barat',
    ]);
});

test('social media profiles can be deleted', function (): void {
    $user = User::factory()->create();
    $profile = SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Profil Hapus',
    ]);

    $response = $this->actingAs($user)->delete(route('social-media.profile.destroy', $profile));

    $response->assertRedirect(route('social-media.profile.index'));
    $this->assertDatabaseMissing('social_media_profiles', [
        'id' => $profile->id,
    ]);
});

test('social media profile search filter works', function (): void {
    $user = User::factory()->create();
    SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Target Kreator',
        'domisili' => 'Mataram',
    ]);
    SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Bukan Ini',
        'domisili' => 'Sumbawa',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.profile.index', [
        'search' => 'Target',
    ]));

    $response->assertOk();
});

test('guests are redirected to the login page from profile export', function (): void {
    $response = $this->get(route('social-media.profile.export'));

    $response->assertRedirect(route('login'));
});

test('authenticated users can download social media profile excel template', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('social-media.profile.template'));

    $response->assertOk();
    $response->assertHeader('content-disposition', 'attachment; filename="template_social_media_profile.xlsx"');
});

test('authenticated users can export social media profiles to xlsx', function (): void {
    $user = User::factory()->create();
    SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Budi Kreator',
        'email' => 'budi@example.com',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.profile.export'));

    $response->assertOk();
    $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect((string) $response->headers->get('Content-Disposition'))->toContain('social_media_profiles_export_');
    expect((string) $response->headers->get('Content-Disposition'))->toContain('.xlsx');
});

test('authenticated users can export social media profiles to csv', function (): void {
    $user = User::factory()->create();
    SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Rian Seleb',
        'domisili' => 'Mataram',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.profile.export', ['format' => 'csv']));

    $response->assertOk();
    $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
    expect((string) $response->headers->get('Content-Disposition'))->toContain('social_media_profiles_export_');
    expect((string) $response->headers->get('Content-Disposition'))->toContain('.csv');
});

test('social media profile export respects search query', function (): void {
    $user = User::factory()->create();
    SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Unik Cari Export',
        'email' => 'unik@example.com',
    ]);
    SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Orang Lain',
        'email' => 'lain@example.com',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.profile.export', [
        'format' => 'csv',
        'search' => 'Unik Cari',
    ]));

    $response->assertOk();
    $content = $response->getContent();
    expect($content)->toContain('Unik Cari Export');
    expect($content)->not->toContain('Orang Lain');
});

test('social media profiles can be imported from a csv file', function (): void {
    $user = User::factory()->create();

    $csvContent = "Nama Lengkap,Link Youtube,Total Subscribe Youtube,Link Instagram,Total Follower IG,Link TikTok,Total Follower TikTok,Link Facebook,Total Follower FB,No HP,Email,Tanggal Lahir,Bulan Lahir,Uk Helm,Uk Jaket,Uk Sarung Tangan,Uk Sepatu,Alamat Rumah,Domisili\n"
        ."Ahmad Dhani,https://youtube.com/@adhani,100000,https://instagram.com/adhani,50000,https://tiktok.com/@adhani,80000,https://facebook.com/adhani,20000,081233445566,adhani@example.com,15,Januari,L,XL,L,43,Jl. Mataram No. 1,Kota Mataram\n";

    $file = UploadedFile::fake()->createWithContent('profiles.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('social-media.profile.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('social-media.profile.index'));
    $this->assertDatabaseHas('social_media_profiles', [
        'nama_lengkap' => 'Ahmad Dhani',
        'total_subscribe_youtube' => 100000,
        'total_follower_ig' => 50000,
        'no_hp' => '081233445566',
        'email' => 'adhani@example.com',
        'ukuran_helm' => 'L',
        'ukuran_jaket' => 'XL',
        'domisili' => 'Kota Mataram',
    ]);
});

test('social media profiles can be imported from the generated template xlsx file', function (): void {
    $user = User::factory()->create();
    $excelService = app(SocialMediaProfileExcelService::class);
    $xlsxContent = $excelService->generateTemplateXlsx();

    $file = UploadedFile::fake()->createWithContent('template_social_media_profile.xlsx', $xlsxContent);

    $response = $this->actingAs($user)->post(route('social-media.profile.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('social-media.profile.index'));
    $this->assertDatabaseHas('social_media_profiles', [
        'nama_lengkap' => 'Budi Pratama (Contoh)',
        'total_subscribe_youtube' => 15000,
    ]);
    $this->assertDatabaseHas('social_media_profiles', [
        'nama_lengkap' => 'Siti Nurhaliza (Contoh)',
        'total_follower_ig' => 45000,
    ]);
});

test('social media profile import updates existing profile when update_existing is true', function (): void {
    $user = User::factory()->create();
    $existing = SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Risa Saraswati',
        'email' => 'risa@example.com',
        'ukuran_helm' => 'S',
        'domisili' => 'Bandung',
    ]);

    $csvContent = "Nama Lengkap,Email,Uk Helm,Domisili\n"
        ."Risa Saraswati,risa@example.com,M,Kota Mataram\n";

    $file = UploadedFile::fake()->createWithContent('update_profile.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('social-media.profile.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('social-media.profile.index'));
    $this->assertDatabaseHas('social_media_profiles', [
        'id' => $existing->id,
        'nama_lengkap' => 'Risa Saraswati',
        'ukuran_helm' => 'M',
        'domisili' => 'Kota Mataram',
    ]);
});

test('social media profile import validation fails when file is missing or invalid', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('social-media.profile.import'), [
        'file' => null,
    ]);

    $response->assertSessionHasErrors(['file']);

    $invalidFile = UploadedFile::fake()->create('profile.pdf', 100, 'application/pdf');

    $response2 = $this->actingAs($user)->post(route('social-media.profile.import'), [
        'file' => $invalidFile,
    ]);

    $response2->assertSessionHasErrors(['file']);
});
