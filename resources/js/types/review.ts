import type { Dealer } from './dealer';

export interface Review {
    id: number;
    dealer_id: number;
    nama_reviewer: string;
    tanggal_publish_review: string;
    star_rate: number;
    review: string | null;
    respon_from_owner: boolean;
    tanggal_respon: string | null;
    respon: string | null;
    google_review_url: string | null;
    created_at?: string;
    updated_at?: string;
    dealer?: Pick<Dealer, 'id' | 'kode_dealer' | 'nama_dealer'>;
}

export interface ReviewStats {
    total: number;
    average_rating: number;
    responded: number;
    unresponded: number;
}
