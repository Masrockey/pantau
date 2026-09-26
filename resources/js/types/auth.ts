import type { Dealer } from './dealer';

export type UserRole = 'super_admin' | 'dealer' | 'main_dealer';

export type User = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    dealer_id: number | null;
    dealer?: Dealer | null;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
};
