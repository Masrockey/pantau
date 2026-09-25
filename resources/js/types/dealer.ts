export type Dealer = {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    link_google_maps: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    alamat?: string | null;
    kelurahan?: string | null;
    kecamatan?: string | null;
    pos_code?: string | null;
    no_telp_showroom?: string | null;
    star_rate?: number | string | null;
    total_review?: number | null;
    users_count?: number;
    created_at?: string;
    updated_at?: string;
};
