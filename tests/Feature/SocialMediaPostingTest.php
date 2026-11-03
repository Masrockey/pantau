<?php

use App\Models\SocialMediaPosting;
use App\Models\SocialMediaProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;

test('guests are redirected to the login page from social media postings', function (): void {
    $response = $this->get(route('social-media.posting.index'));

    $response->assertRedirect(route('login'));
});

test('authenticated users can view social media postings list', function (): void {
    $user = User::factory()->create();
    $profile = SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Kreator Viral',
    ]);
    SocialMediaPosting::factory()->create([
        'social_media_profile_id' => $profile->id,
        'brand' => 'Honda',
        'jenis_sosmed' => 'ig',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.posting.index'));

    $response->assertOk();
});

test('postings are ordered by latest release date (tanggal_rilis desc) by default', function (): void {
    $user = User::factory()->create();
    $profile = SocialMediaProfile::factory()->create();

    $olderPosting = SocialMediaPosting::factory()->create([
        'social_media_profile_id' => $profile->id,
        'tanggal_rilis' => '2026-01-01',
    ]);
    $newerPosting = SocialMediaPosting::factory()->create([
        'social_media_profile_id' => $profile->id,
        'tanggal_rilis' => '2026-12-31',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.posting.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('social-media/posting/index')
        ->has('postings.data', 2)
        ->where('postings.data.0.id', $newerPosting->id)
        ->where('postings.data.1.id', $olderPosting->id)
    );
});

test('postings can be sorted by views, comments, and creator name', function (): void {
    $user = User::factory()->create();
    $profileA = SocialMediaProfile::factory()->create(['nama_lengkap' => 'Andi Pratama']);
    $profileZ = SocialMediaProfile::factory()->create(['nama_lengkap' => 'Zainal Abidin']);

    $lowPosting = SocialMediaPosting::factory()->create([
        'social_media_profile_id' => $profileZ->id,
        'total_views' => 10,
        'total_komentar' => 500,
    ]);
    $highPosting = SocialMediaPosting::factory()->create([
        'social_media_profile_id' => $profileA->id,
        'total_views' => 50000,
        'total_komentar' => 5,
    ]);

    // Sort by views desc
    $respViews = $this->actingAs($user)->get(route('social-media.posting.index', ['sort' => 'views_desc']));
    $respViews->assertOk();
    $respViews->assertInertia(fn ($page) => $page
        ->where('postings.data.0.id', $highPosting->id)
        ->where('postings.data.1.id', $lowPosting->id)
    );

    // Sort by komentar desc
    $respComments = $this->actingAs($user)->get(route('social-media.posting.index', ['sort' => 'komentar_desc']));
    $respComments->assertOk();
    $respComments->assertInertia(fn ($page) => $page
        ->where('postings.data.0.id', $lowPosting->id)
        ->where('postings.data.1.id', $highPosting->id)
    );

    // Sort by nama asc
    $respNama = $this->actingAs($user)->get(route('social-media.posting.index', ['sort' => 'nama_asc']));
    $respNama->assertOk();
    $respNama->assertInertia(fn ($page) => $page
        ->where('postings.data.0.id', $highPosting->id)
        ->where('postings.data.1.id', $lowPosting->id)
    );
});

test('social media postings can be created with all fields', function (): void {
    $user = User::factory()->create();
    $profile = SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Alif Content Creator',
    ]);

    $payload = [
        'social_media_profile_id' => $profile->id,
        'jenis_sosmed' => 'ig',
        'tanggal_rilis' => '2026-12-24',
        'bulan_entry' => 'Dec',
        'caption' => 'Test ride Honda New Vario 160 seru banget!',
        'link' => 'https://www.instagram.com/p/DeRsNjYvrv6/',
        'brand' => 'Honda',
        'total_komentar' => 125,
        'total_views' => 15000,
    ];

    $response = $this->actingAs($user)->post(route('social-media.posting.store'), $payload);

    $response->assertRedirect(route('social-media.posting.index'));
    $this->assertDatabaseHas('social_media_postings', [
        'social_media_profile_id' => $profile->id,
        'jenis_sosmed' => 'ig',
        'brand' => 'Honda',
        'bulan_entry' => 'Dec',
        'total_komentar' => 125,
        'total_views' => 15000,
    ]);
});

test('social media postings creation requires valid profile, brand, and platform', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('social-media.posting.store'), [
        'social_media_profile_id' => 999999, // non-existent
        'jenis_sosmed' => 'invalid_platform',
        'brand' => 'Invalid Brand',
    ]);

    $response->assertSessionHasErrors(['social_media_profile_id', 'jenis_sosmed', 'brand']);
});

test('social media postings can be updated', function (): void {
    $user = User::factory()->create();
    $posting = SocialMediaPosting::factory()->create([
        'brand' => 'Honda',
        'total_views' => 1000,
    ]);

    $response = $this->actingAs($user)->put(route('social-media.posting.update', $posting), [
        'social_media_profile_id' => $posting->social_media_profile_id,
        'jenis_sosmed' => 'TikTok',
        'tanggal_rilis' => '2026-11-10',
        'bulan_entry' => 'Nov',
        'caption' => 'Updated caption',
        'link' => 'https://tiktok.com/@creator/video/12345',
        'brand' => 'Yamaha',
        'total_komentar' => 300,
        'total_views' => 50000,
    ]);

    $response->assertRedirect(route('social-media.posting.index'));
    $this->assertDatabaseHas('social_media_postings', [
        'id' => $posting->id,
        'jenis_sosmed' => 'TikTok',
        'brand' => 'Yamaha',
        'bulan_entry' => 'Nov',
        'total_views' => 50000,
    ]);
});

test('social media postings can be deleted', function (): void {
    $user = User::factory()->create();
    $posting = SocialMediaPosting::factory()->create();

    $response = $this->actingAs($user)->delete(route('social-media.posting.destroy', $posting));

    $response->assertRedirect(route('social-media.posting.index'));
    $this->assertDatabaseMissing('social_media_postings', [
        'id' => $posting->id,
    ]);
});

test('social media postings can be filtered by brand, platform, and search', function (): void {
    $user = User::factory()->create();
    $profile = SocialMediaProfile::factory()->create([
        'nama_lengkap' => 'Spesifik Kreator',
    ]);

    SocialMediaPosting::factory()->create([
        'social_media_profile_id' => $profile->id,
        'brand' => 'Honda',
        'jenis_sosmed' => 'ig',
        'caption' => 'Caption spesial motor Honda',
    ]);

    SocialMediaPosting::factory()->create([
        'brand' => 'Kawasaki',
        'jenis_sosmed' => 'youtube',
        'caption' => 'Motor trail balap',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.posting.index', [
        'search' => 'spesial motor',
        'brand' => 'Honda',
        'jenis_sosmed' => 'ig',
    ]));

    $response->assertOk();
});

test('users can download social media posting excel template', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('social-media.posting.template'));

    $response->assertOk();
    $response->assertHeader('Content-Disposition', 'attachment; filename="template_social_media_posting.xlsx"');
});

test('users can export social media postings as xlsx', function (): void {
    $user = User::factory()->create();
    $profile = SocialMediaProfile::factory()->create(['nama_lengkap' => 'Kreator Export']);
    SocialMediaPosting::factory()->create([
        'social_media_profile_id' => $profile->id,
        'brand' => 'Honda',
        'jenis_sosmed' => 'ig',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.posting.export', ['format' => 'xlsx']));

    $response->assertOk();
    $response->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('users can export social media postings as csv', function (): void {
    $user = User::factory()->create();
    $profile = SocialMediaProfile::factory()->create(['nama_lengkap' => 'Kreator CSV']);
    SocialMediaPosting::factory()->create([
        'social_media_profile_id' => $profile->id,
        'brand' => 'Yamaha',
        'jenis_sosmed' => 'TikTok',
    ]);

    $response = $this->actingAs($user)->get(route('social-media.posting.export', ['format' => 'csv']));

    $response->assertOk();
    $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
});

test('users can import social media postings from csv and auto-create creator profile', function (): void {
    $user = User::factory()->create();

    $csvContent = "\xEF\xBB\xBFNO,NAMA LENGKAP,JENIS SOSMED,TANGGAL RILIS,BULAN ENTRY,BRAND,TOTAL KOMENTAR,TOTAL VIEWS,LINK,CAPTION\n";
    $csvContent .= "1,Bambang Pamungkas,ig,2026-11-03,Nov,Honda,50,12000,https://instagram.com/p/test12345/,Test Caption Honda\n";

    $file = UploadedFile::fake()->createWithContent('posting.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('social-media.posting.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('social-media.posting.index'));

    $this->assertDatabaseHas('social_media_profiles', [
        'nama_lengkap' => 'Bambang Pamungkas',
    ]);

    $this->assertDatabaseHas('social_media_postings', [
        'brand' => 'Honda',
        'jenis_sosmed' => 'ig',
        'link' => 'https://instagram.com/p/test12345/',
        'total_views' => 12000,
        'total_komentar' => 50,
    ]);
});

test('large batch import runs efficiently without timeout', function (): void {
    $user = User::factory()->create();

    $csvContent = "\xEF\xBB\xBFNO,NAMA LENGKAP,JENIS SOSMED,TANGGAL RILIS,BULAN ENTRY,BRAND,TOTAL KOMENTAR,TOTAL VIEWS,LINK,CAPTION\n";
    for ($i = 1; $i <= 100; $i++) {
        $csvContent .= "{$i},Kreator {$i},ig,2026-11-01,Nov,Honda,10,500,https://instagram.com/p/bulk_post_{$i}/,Caption {$i}\n";
    }

    $file = UploadedFile::fake()->createWithContent('bulk_postings.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('social-media.posting.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('social-media.posting.index'));
    expect(SocialMediaPosting::count())->toBeGreaterThanOrEqual(100);
});

test('import keeps all multiple postings for same creator on same date when links are distinct', function (): void {
    $user = User::factory()->create();

    $csvContent = "\xEF\xBB\xBFNO,NAMA LENGKAP,JENIS SOSMED,TANGGAL RILIS,BULAN ENTRY,BRAND,TOTAL KOMENTAR,TOTAL VIEWS,LINK,CAPTION\n";
    $csvContent .= "1,Kreator Sama,youtube,2026-11-01,Nov,Honda,10,100,https://youtube.com/watch?v=vid1,Video 1\n";
    $csvContent .= "2,Kreator Sama,youtube,2026-11-01,Nov,Honda,20,200,https://youtube.com/watch?v=vid2,Video 2\n";
    $csvContent .= "3,Kreator Sama,youtube,2026-11-01,Nov,Honda,30,300,https://youtube.com/watch?v=vid3,Video 3\n";

    $file = UploadedFile::fake()->createWithContent('distinct_links.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('social-media.posting.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('social-media.posting.index'));
    expect(SocialMediaPosting::where('link', 'like', '%vid%')->count())->toBe(3);
});

test('import can replace all existing postings with replace_all option', function (): void {
    $user = User::factory()->create();
    SocialMediaPosting::factory()->count(10)->create();

    expect(SocialMediaPosting::count())->toBeGreaterThanOrEqual(10);

    $csvContent = "\xEF\xBB\xBFNO,NAMA LENGKAP,JENIS SOSMED,TANGGAL RILIS,BULAN ENTRY,BRAND,TOTAL KOMENTAR,TOTAL VIEWS,LINK,CAPTION\n";
    $csvContent .= "1,Fresh Creator,ig,2026-11-03,Nov,Honda,5,50,https://instagram.com/p/fresh123/,Fresh Post\n";

    $file = UploadedFile::fake()->createWithContent('replace.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('social-media.posting.import'), [
        'file' => $file,
        'replace_all' => true,
    ]);

    $response->assertRedirect(route('social-media.posting.index'));
    expect(SocialMediaPosting::count())->toBe(1);
    expect(SocialMediaPosting::first()->link)->toBe('https://instagram.com/p/fresh123/');
});

test('import preserves all collaboration and multi-brand rows sharing identical links', function (): void {
    $user = User::factory()->create();

    $csvContent = "\xEF\xBB\xBFNO,NAMA LENGKAP,JENIS SOSMED,TANGGAL RILIS,BULAN ENTRY,BRAND,TOTAL KOMENTAR,TOTAL VIEWS,LINK,CAPTION\n";
    // Collaboration post: 3 different creators with same link
    $csvContent .= "1,Kreator Satu,ig,2026-11-01,Nov,Honda,2,2000,https://instagram.com/p/collab1/,Collab Caption\n";
    $csvContent .= "2,Kreator Dua,ig,2026-11-01,Nov,Honda,2,2000,https://instagram.com/p/collab1/,Collab Caption\n";
    $csvContent .= "3,Kreator Tiga,ig,2026-11-01,Nov,Honda,2,2000,https://instagram.com/p/collab1/,Collab Caption\n";
    // Multi-brand post: same creator, same link, different brands
    $csvContent .= "4,Kreator Empat,youtube,2026-11-01,Nov,Honda,1,100,https://youtube.com/watch?v=multibrand,Vid Caption\n";
    $csvContent .= "5,Kreator Empat,youtube,2026-11-01,Nov,Yamaha,1,100,https://youtube.com/watch?v=multibrand,Vid Caption\n";

    $file = UploadedFile::fake()->createWithContent('collab_and_multibrand.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('social-media.posting.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('social-media.posting.index'));
    expect(SocialMediaPosting::where('link', 'https://instagram.com/p/collab1/')->count())->toBe(3);
    expect(SocialMediaPosting::where('link', 'https://youtube.com/watch?v=multibrand')->count())->toBe(2);
});
