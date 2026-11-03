export interface SocialMediaProfile {
    id: number;
    nama_lengkap: string;
    link_youtube?: string | null;
    total_subscribe_youtube?: number | null;
    link_instagram?: string | null;
    total_follower_ig?: number | null;
    link_tiktok?: string | null;
    total_follower_tiktok?: number | null;
    link_facebook?: string | null;
    total_follower_fb?: number | null;
    no_hp?: string | null;
    email?: string | null;
    tanggal_lahir?: number | null;
    bulan_lahir?: string | null;
    ukuran_helm?: string | null;
    ukuran_jaket?: string | null;
    ukuran_sarung_tangan?: string | null;
    ukuran_sepatu?: string | null;
    alamat_rumah?: string | null;
    domisili?: string | null;
    created_at?: string;
    updated_at?: string;
}

